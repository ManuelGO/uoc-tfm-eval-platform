import { Pool, type PoolClient } from 'pg';
import type { RunnerConfig } from '../config/config.js';
import { getDatabaseConnectionString } from '../config/config.js';

/**
 * Submission status values
 * Matches the enum in the database
 */
export type SubmissionStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

/**
 * Submission result data to update in database
 * Matches the submission table schema in PostgreSQL
 */
export interface SubmissionResult {
  /**
   * Execution status
   */
  status: SubmissionStatus;

  /**
   * Score from test execution (0-100)
   */
  score: number;

  /**
   * Structured feedback (stored as JSONB)
   * Optional - may be null for early errors
   */
  feedback?: Record<string, unknown> | null;

  /**
   * S3 key where logs are stored
   * Optional - may be null if logs couldn't be uploaded
   */
  logsS3Key?: string | null;
}

/**
 * Database Service
 *
 * Handles PostgreSQL operations for the runner service.
 * Uses pg Pool for connection management.
 */
export class DatabaseService {
  private pool: Pool;

  constructor(config: RunnerConfig) {
    const connectionString = getDatabaseConnectionString(config);

    this.pool = new Pool({
      connectionString,
      // Connection pool settings
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Timeout for acquiring connection
      ssl: config.dbSsl ? { rejectUnauthorized: false } : undefined, 
    });

    // Log pool errors
    this.pool.on('error', (err) => {
      console.error('[DatabaseService] Unexpected pool error', err);
    });

    console.log('[DatabaseService] Database pool initialized');
  }

  /**
   * Update submission result in database
   *
   * @param submissionId  UUID of the submission
   * @param result        Execution result data
   */
  async updateSubmissionResult(
    submissionId: string,
    result: SubmissionResult,
  ): Promise<void> {
    console.log('[DatabaseService] Updating submission result', {
      submissionId,
      status: result.status,
      score: result.score,
    });

    const query = `
      UPDATE submissions
      SET
        status = $1,
        score = $2,
        feedback = $3,
        "logsS3Key" = $4,
        "updatedAt" = NOW()
      WHERE id = $5
    `;

    const values = [
      result.status,
      result.score,
      result.feedback ? JSON.stringify(result.feedback) : null,
      result.logsS3Key ?? null,
      submissionId,
    ];

    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();

      const queryResult = await client.query(query, values);

      if (queryResult.rowCount === 0) {
        console.warn('[DatabaseService] No rows updated - submission not found', {
          submissionId,
        });
        throw new Error(`Submission not found: ${submissionId}`);
      }

      console.log('[DatabaseService] Submission updated successfully', {
        submissionId,
        rowsAffected: queryResult.rowCount,
      });
    } catch (error) {
      console.error('[DatabaseService] Failed to update submission', {
        submissionId,
        error,
      });
      throw error;
    } finally {
      // Always release client back to pool
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Test database connection
   *
   * @returns True if connection successful
   */
  async testConnection(): Promise<boolean> {
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      await client.query('SELECT NOW()');

      console.log('[DatabaseService] Connection test successful');
      return true;
    } catch (error) {
      console.error('[DatabaseService] Connection test failed', error);
      return false;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Close database pool
   * Should be called during graceful shutdown
   */
  async close(): Promise<void> {
    console.log('[DatabaseService] Closing database pool');

    try {
      await this.pool.end();
      console.log('[DatabaseService] Database pool closed');
    } catch (error) {
      console.error('[DatabaseService] Error closing database pool', error);
      throw error;
    }
  }
}
