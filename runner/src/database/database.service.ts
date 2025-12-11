import { Pool, type PoolClient, type PoolConfig } from 'pg';
import type { RunnerConfig } from '../config/config.js';

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
    // Parse connection parameters
    // Using individual parameters instead of connectionString ensures SSL config is respected
    let host: string;
    let port: number;
    let database: string;
    let user: string;
    let password: string;

    if (config.databaseUrl) {
      // Parse DATABASE_URL (format: postgresql://user:pass@host:port/db?sslmode=require)
      const url = new URL(config.databaseUrl);
      host = url.hostname;
      port = parseInt(url.port, 10) || 5432;
      database = url.pathname.slice(1); // Remove leading /
      user = url.username;
      password = decodeURIComponent(url.password);
    } else {
      // Use individual config values
      host = config.dbHost!;
      port = config.dbPort!;
      database = config.dbName!;
      user = config.dbUsername!;
      password = config.dbPassword!;
    }

    // Determine SSL configuration
    // AWS RDS and other managed databases often require SSL with self-signed certificates
    const useSsl = config.dbSsl || (config.databaseUrl && config.databaseUrl.includes('sslmode=require'));

    // Build pool configuration using individual parameters (NOT connectionString)
    // This is critical for SSL to work correctly with self-signed certificates
    const poolConfig: PoolConfig = {
      host,
      port,
      database,
      user,
      password,
      // Connection pool settings
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Timeout for acquiring connection
    };

    // Configure SSL if needed
    // rejectUnauthorized: false allows self-signed certificates (common in AWS RDS)
    if (useSsl) {
      poolConfig.ssl = {
        rejectUnauthorized: false,
      };
    }

    this.pool = new Pool(poolConfig);

    // Log pool errors
    this.pool.on('error', (err) => {
      console.error('[DatabaseService] Unexpected pool error', err);
    });

    console.log('[DatabaseService] Database pool initialized', {
      host,
      port,
      database,
      user,
      configDbSsl: config.dbSsl,
      useSsl,
      sslConfig: poolConfig.ssl ? 'enabled (rejectUnauthorized: false)' : 'disabled',
    });
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
   * Get tests S3 key for a given PIT
   *
   * Reads the testsS3Key column from the pits table.
   *
   * @param pitId PIT UUID
   * @returns     testsS3Key string or null if not set
   * @throws      Error if PIT does not exist
   */
  async getPitTestsKey(pitId: string): Promise<string | null> {
    console.log('[DatabaseService] Fetching testsS3Key for PIT', { pitId });

    const query = `
      SELECT "testsS3Key"
      FROM pits
      WHERE id = $1
    `;

    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query<{ testsS3Key: string | null }>(query, [pitId]);

      if (result.rowCount === 0) {
        console.warn('[DatabaseService] PIT not found when fetching testsS3Key', { pitId });
        throw new Error(`PIT not found: ${pitId}`);
      }

      const testsS3Key = result.rows[0].testsS3Key ?? null;

      console.log('[DatabaseService] Loaded testsS3Key for PIT', {
        pitId,
        testsS3Key,
      });

      return testsS3Key;
    } catch (error) {
      console.error('[DatabaseService] Failed to fetch testsS3Key for PIT', {
        pitId,
        error,
      });
      throw error;
    } finally {
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
