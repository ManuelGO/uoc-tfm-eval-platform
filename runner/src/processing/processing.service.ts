import type { RunnerConfig } from '../config/config.js';
import type { SubmissionMessage } from '../queue/interfaces/submission-message.interface.js';
import { S3StorageService } from '../storage/s3-storage.service.js';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { PitConfigService } from '../pit-config/pit-config.service.js';
import { ExecutorService } from '../executor/executor.service.js';
import { ExecutionStatus } from '../executor/interfaces/execution-result.interface.js';
import { DatabaseService, type SubmissionStatus } from '../database/database.service.js';

/**
 * Processing Service
 *
 * Orchestrates the complete submission processing pipeline with robust error handling.
 * Ensures submissions always end with a final status (DONE or ERROR).
 *
 * RUN-10: Implements error handling and retry strategy
 */
export class ProcessingService {
  private s3Storage: S3StorageService;
  private workspace: WorkspaceService;
  private pitConfig: PitConfigService;
  private executor: ExecutorService;
  private database: DatabaseService;
  private config: RunnerConfig;

  constructor(config: RunnerConfig) {
    this.config = config;
    this.s3Storage = new S3StorageService(config);
    this.workspace = new WorkspaceService();
    this.pitConfig = new PitConfigService();
    this.executor = new ExecutorService();
    this.database = new DatabaseService(config);

    console.log('[ProcessingService] Initialized all services');
  }

  /**
   * Process a submission message through the complete pipeline
   *
   * Error Handling Strategy (MVP - Option A):
   * - Try to process submission
   * - If any step fails: mark as ERROR in DB, upload partial logs
   * - Always return successfully so SQS message gets deleted
   * - Pipeline failures do not stop the runner loop
   *
   * @param message Submission message from SQS
   */
  async processSubmission(message: SubmissionMessage): Promise<void> {
    const { submissionId, fileKey, pitId } = message;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[ProcessingService] Starting pipeline for submission: ${submissionId}`);
    console.log(`${'='.repeat(60)}\n`);

    let localZipPath: string | null = null;
    let workspacePath: string | null = null;
    let logs = '';

    try {
      // ============================================================
      // STEP 1: Download ZIP from S3 (RUN-4)
      // ============================================================
      console.log(`[Step 1/6] Downloading ZIP from S3...`);
      try {
        localZipPath = await this.s3Storage.downloadZipToTemp(fileKey, submissionId);
        console.log(`✓ ZIP downloaded: ${localZipPath}\n`);
      } catch (error) {
        throw new Error(`Failed to download ZIP from S3: ${(error as Error).message}`);
      }

      // ============================================================
      // STEP 2: Extract ZIP to workspace (RUN-5)
      // ============================================================
      console.log(`[Step 2/6] Extracting ZIP to workspace...`);
      try {
        workspacePath = await this.workspace.extractZip(localZipPath, submissionId);
        console.log(`✓ ZIP extracted to: ${workspacePath}\n`);
      } catch (error) {
        throw new Error(`Failed to extract ZIP: ${(error as Error).message}`);
      }

      // ============================================================
      // STEP 3: Load PIT configuration (RUN-6)
      // ============================================================
      console.log(`[Step 3/6] Loading PIT configuration...`);
      const pitConfiguration = await (() => {
        try {
          return this.pitConfig.loadConfig(pitId);
        } catch (error) {
          throw new Error(`Failed to load PIT config: ${(error as Error).message}`);
        }
      })();
      console.log(`✓ PIT config loaded: ${pitConfiguration.language}/${pitConfiguration.buildTool}\n`);

      // ============================================================
      // STEP 4: Execute tests (RUN-7)
      // ============================================================
      console.log(`[Step 4/6] Executing tests...`);
      const executionResult = await (() => {
        try {
          return this.executor.executeTests(
            workspacePath,
            pitConfiguration,
            submissionId
          );
        } catch (error) {
          throw new Error(`Failed to execute tests: ${(error as Error).message}`);
        }
      })();
      console.log(`✓ Tests executed: ${executionResult.status} (score: ${executionResult.score})\n`);
      logs = executionResult.logs;

      // ============================================================
      // STEP 5: Upload logs to S3 (RUN-8)
      // ============================================================
      console.log(`[Step 5/6] Uploading logs to S3...`);
      let logsS3Key: string | null = null;
      try {
        logsS3Key = await this.s3Storage.uploadLogs(
          submissionId,
          logs,
          this.config.runnerMaxLogBytes
        );
        console.log(`✓ Logs uploaded: ${logsS3Key}\n`);
      } catch (error) {
        console.warn(`⚠️  Failed to upload logs (continuing): ${(error as Error).message}`);
        // Don't throw - continue with DB update even if log upload fails
      }

      // ============================================================
      // STEP 6: Update submission result in DB (RUN-9)
      // ============================================================
      console.log(`[Step 6/6] Updating database...`);
      try {
        const dbStatus = this.mapExecutionStatusToDbStatus(executionResult.status);

        await this.database.updateSubmissionResult(submissionId, {
          status: dbStatus,
          score: executionResult.score,
          feedback: executionResult.feedback as unknown as Record<string, unknown>,
          logsS3Key,
        });
        console.log(`✓ Database updated successfully\n`);
      } catch (error) {
        throw new Error(`Failed to update database: ${(error as Error).message}`);
      }

      // ============================================================
      // SUCCESS: Pipeline completed
      // ============================================================
      console.log(`${'='.repeat(60)}`);
      console.log(`✅ Pipeline completed successfully for: ${submissionId}`);
      console.log(`   Status: ${executionResult.status}`);
      console.log(`   Score: ${executionResult.score}`);
      console.log(`${'='.repeat(60)}\n`);

    } catch (error) {
      // ============================================================
      // ERROR HANDLING: Mark submission as ERROR in database
      // ============================================================
      console.error(`\n${'='.repeat(60)}`);
      console.error(`❌ Pipeline failed for submission: ${submissionId}`);
      console.error(`${'='.repeat(60)}`);
      console.error(`Error: ${(error as Error).message}`);
      console.error(`Stack trace:\n${(error as Error).stack}\n`);

      // Try to save error state to database
      try {
        // Generate error logs
        const errorLogs = this.generateErrorLogs(error as Error, message, logs);

        // Try to upload error logs
        let errorLogsS3Key: string | null = null;
        try {
          errorLogsS3Key = await this.s3Storage.uploadLogs(
            submissionId,
            errorLogs,
            this.config.runnerMaxLogBytes
          );
          console.log(`✓ Error logs uploaded: ${errorLogsS3Key}`);
        } catch (uploadError) {
          console.error(`⚠️  Failed to upload error logs: ${(uploadError as Error).message}`);
        }

        // Update database with ERROR status
        await this.database.updateSubmissionResult(submissionId, {
          status: 'ERROR',
          score: 0,
          feedback: {
            error: (error as Error).message,
            step: this.detectFailureStep(error as Error),
          },
          logsS3Key: errorLogsS3Key,
        });

        console.log(`✓ Database updated with ERROR status\n`);
      } catch (dbError) {
        console.error(`❌ Failed to update database with error status:`, dbError);
        console.error(`   Stack trace:\n${(dbError as Error).stack}`);
        // Even if DB update fails, we continue (message will be deleted)
      }

      console.error(`${'='.repeat(60)}`);
      console.error(`⚠️  Pipeline failed but runner continues`);
      console.error(`${'='.repeat(60)}\n`);

      // Strategy: Don't throw - let SQS delete the message
      // The submission is marked as ERROR in DB, so it won't be retried
    } finally {
      // ============================================================
      // CLEANUP: Always clean up workspace
      // ============================================================
      if (workspacePath) {
        try {
          this.workspace.cleanWorkspace(submissionId);
          console.log(`🧹 Workspace cleaned: ${submissionId}`);
        } catch (cleanupError) {
          console.warn(`⚠️  Failed to clean workspace: ${(cleanupError as Error).message}`);
        }
      }
    }
  }

  /**
   * Map execution status to database status
   */
  private mapExecutionStatusToDbStatus(status: ExecutionStatus): SubmissionStatus {
    switch (status) {
      case ExecutionStatus.DONE:
        return 'DONE';
      case ExecutionStatus.ERROR:
      case ExecutionStatus.TIMEOUT:
        return 'ERROR';
      default:
        return 'ERROR';
    }
  }

  /**
   * Generate error logs for failed submissions
   */
  private generateErrorLogs(error: Error, message: SubmissionMessage, partialLogs: string): string {
    const errorLog = `
========================================
SUBMISSION PROCESSING ERROR
========================================

Submission ID: ${message.submissionId}
PIT ID: ${message.pitId}
User ID: ${message.userId}
File Key: ${message.fileKey}
Timestamp: ${new Date().toISOString()}

Error Message:
${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}

========================================
PARTIAL LOGS (if any)
========================================

${partialLogs || 'No logs captured'}
`;

    return errorLog;
  }

  /**
   * Detect which step failed based on error message
   */
  private detectFailureStep(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('download')) return 'Download ZIP from S3';
    if (message.includes('extract')) return 'Extract ZIP';
    if (message.includes('pit config')) return 'Load PIT configuration';
    if (message.includes('execute tests')) return 'Execute tests';
    if (message.includes('upload logs')) return 'Upload logs to S3';
    if (message.includes('database')) return 'Update database';

    return 'Unknown step';
  }

  /**
   * Close database connection pool
   * Should be called during graceful shutdown
   */
  async close(): Promise<void> {
    await this.database.close();
  }
}
