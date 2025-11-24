import { spawn } from 'node:child_process';
import type { PitConfig } from '../pit-config/interfaces/pit-config.interface.js';
import {
  ExecutionStatus,
  type ExecutionResult,
  type ExecutionFeedback,
} from './interfaces/execution-result.interface.js';

/**
 * Executor Service
 *
 * Executes test commands in the workspace and captures results.
 * Handles timeouts, stdout/stderr capture, and result transformation.
 */
export class ExecutorService {
  /**
   * Execute tests in the workspace using PIT configuration
   *
   * @param workspacePath  Absolute path to the workspace directory
   * @param pitConfig      PIT configuration with test commands and settings
   * @param submissionId   Submission ID for logging
   * @returns              Standardized execution result
   */
  async executeTests(
    workspacePath: string,
    pitConfig: PitConfig,
    submissionId: string,
  ): Promise<ExecutionResult> {
    console.log('[ExecutorService] Starting test execution', {
      submissionId,
      workspacePath,
      testCommand: pitConfig.testCommand,
      timeout: pitConfig.maxTimeoutMs,
    });

    const startTime = Date.now();

    // Run setup commands if configured
    if (pitConfig.setupCommands && pitConfig.setupCommands.length > 0) {
      console.log('[ExecutorService] Running setup commands', {
        submissionId,
        commands: pitConfig.setupCommands,
      });

      for (const setupCommand of pitConfig.setupCommands) {
        try {
          await this.executeCommand(
            setupCommand,
            workspacePath,
            pitConfig.environment,
            pitConfig.maxTimeoutMs,
          );
        } catch (error) {
          console.error('[ExecutorService] Setup command failed', {
            submissionId,
            command: setupCommand,
            error,
          });
          // Continue even if setup fails - tests will likely fail anyway
        }
      }
    }

    // Execute test command
    try {
      const result = await this.executeCommand(
        pitConfig.testCommand,
        workspacePath,
        pitConfig.environment,
        pitConfig.maxTimeoutMs,
      );

      const durationMs = Date.now() - startTime;

      console.log('[ExecutorService] Test execution completed', {
        submissionId,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
        durationMs,
      });

      // Transform to standardized result
      return this.transformResult(result, durationMs);
    } catch (error) {
      const durationMs = Date.now() - startTime;

      console.error('[ExecutorService] Test execution failed', {
        submissionId,
        error,
        durationMs,
      });

      // Return error result
      return {
        status: ExecutionStatus.ERROR,
        score: 0,
        feedback: {
          exitCode: -1,
          timedOut: false,
          durationMs,
          details: `Execution error: ${(error as Error).message}`,
        },
        logs: `Error executing tests: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Execute a single command with timeout
   *
   * @param command     Command to execute
   * @param cwd         Working directory
   * @param env         Environment variables
   * @param timeoutMs   Timeout in milliseconds
   * @returns           Command execution result
   */
  private async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs: number = 120000,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
  }> {
    return new Promise((resolve, reject) => {
      // Parse command (simple split by space - may need enhancement for complex commands)
      const [cmd, ...args] = command.split(' ');

      // Spawn process
      const childProcess = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        shell: true, // Use shell to handle complex commands
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let exitCode = 0;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        console.warn('[ExecutorService] Command timeout - killing process', {
          command,
          timeoutMs,
        });
        childProcess.kill('SIGTERM');

        // Force kill if still running after 5 seconds
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      }, timeoutMs);

      // Capture stdout
      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Capture stderr
      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code) => {
        clearTimeout(timeoutHandle);
        exitCode = code ?? (timedOut ? 124 : -1); // 124 is timeout exit code

        resolve({
          stdout,
          stderr,
          exitCode,
          timedOut,
        });
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
    });
  }

  /**
   * Transform command execution result to standardized format
   *
   * @param result      Raw command execution result
   * @param durationMs  Execution duration
   * @returns           Standardized execution result
   */
  private transformResult(
    result: {
      stdout: string;
      stderr: string;
      exitCode: number;
      timedOut: boolean;
    },
    durationMs: number,
  ): ExecutionResult {
    // Combine logs
    const logs = this.combineLogs(result.stdout, result.stderr);

    // Determine status
    let status: ExecutionStatus;
    if (result.timedOut) {
      status = ExecutionStatus.TIMEOUT;
    } else if (result.exitCode === 0) {
      status = ExecutionStatus.DONE;
    } else {
      status = ExecutionStatus.ERROR;
    }

    // Parse test results (MVP: simple pass/fail based on exit code)
    const feedback = this.parseTestResults(result, durationMs);

    // Calculate score (MVP: 100 if passed, 0 if failed)
    const score = this.calculateScore(feedback);

    return {
      status,
      score,
      feedback,
      logs,
    };
  }

  /**
   * Parse test results from command output
   * MVP: Simple parsing based on exit code
   * TODO: Implement proper test result parsing for different frameworks
   *
   * @param result      Command execution result
   * @param durationMs  Execution duration
   * @returns           Execution feedback
   */
  private parseTestResults(
    result: {
      stdout: string;
      stderr: string;
      exitCode: number;
      timedOut: boolean;
    },
    durationMs: number,
  ): ExecutionFeedback {
    // MVP: Simple pass/fail based on exit code
    // In production, parse actual test framework output (JUnit XML, etc.)

    const feedback: ExecutionFeedback = {
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      durationMs,
    };

    if (result.timedOut) {
      feedback.details = 'Test execution exceeded timeout limit';
    } else if (result.exitCode === 0) {
      feedback.totalTests = 1;
      feedback.passedTests = 1;
      feedback.failedTests = 0;
      feedback.details = 'All tests passed';
    } else {
      feedback.totalTests = 1;
      feedback.passedTests = 0;
      feedback.failedTests = 1;
      feedback.details = `Tests failed with exit code ${result.exitCode}`;
    }

    // TODO: Parse Maven/JUnit output for detailed test results
    // Example patterns to look for:
    // - "Tests run: 5, Failures: 2, Errors: 0, Skipped: 0"
    // - JUnit XML reports
    // - Test framework specific output

    return feedback;
  }

  /**
   * Calculate score from test results
   * MVP: Simple 0 or 100 based on pass/fail
   * TODO: Calculate based on pass rate
   *
   * @param feedback  Execution feedback
   * @returns         Score (0-100)
   */
  private calculateScore(feedback: ExecutionFeedback): number {
    if (feedback.timedOut) {
      return 0;
    }

    // MVP: Binary scoring
    if (feedback.exitCode === 0) {
      return 100;
    }

    // TODO: Calculate based on pass rate
    // if (feedback.totalTests && feedback.passedTests) {
    //   return Math.round((feedback.passedTests / feedback.totalTests) * 100);
    // }

    return 0;
  }

  /**
   * Combine stdout and stderr into a single log string
   *
   * @param stdout  Standard output
   * @param stderr  Standard error
   * @returns       Combined logs
   */
  private combineLogs(stdout: string, stderr: string): string {
    let combined = '';

    if (stdout) {
      combined += '=== STDOUT ===\n' + stdout + '\n\n';
    }

    if (stderr) {
      combined += '=== STDERR ===\n' + stderr + '\n';
    }

    return combined.trim() || 'No output captured';
  }
}
