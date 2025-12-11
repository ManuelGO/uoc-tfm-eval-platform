import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import type { RunnerConfig } from '../config/config.js';

/**
 * S3 path prefix constants
 * Exported for use in other modules
 */
export const SUBMISSIONS_PREFIX = 'submissions';
export const LOGS_PREFIX = 'logs';
export const PITS_PREFIX = 'pits';

export class S3StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: RunnerConfig) {
    this.client = new S3Client({
      region: config.awsRegion,
    });

    this.bucket = config.awsS3Bucket;
  }

  /**
   * Download a submission ZIP from S3 into a local temporary path.
   *
   * @param fileKey      S3 object key (submissions/...)
   * @param submissionId UUID of the submission (used for folder naming)
   * @returns            Absolute or relative path to the downloaded ZIP
   */
  async downloadZipToTemp(
    fileKey: string,
    submissionId: string,
  ): Promise<string> {
    const localPath = `./tmp/${submissionId}/submission.zip`;

    // Ensure directory exists
    this.ensureDirectory(dirname(localPath));

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    let response: GetObjectCommandOutput;
    try {
      response = await this.client.send(command);
    } catch (error) {
      console.error('[S3StorageService] Failed to download object from S3', {
        bucket: this.bucket,
        key: fileKey,
        error,
      });
      throw error;
    }

    if (!response.Body) {
      throw new Error('S3 GetObject response has no Body');
    }

    const writeStream = createWriteStream(localPath);

    // In AWS SDK v3, Body is a Readable stream in Node.js
    const bodyStream = response.Body as NodeJS.ReadableStream;

    await new Promise<void>((resolve, reject) => {
      bodyStream
        .pipe(writeStream)
        .on('finish', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log('[S3StorageService] Download complete', {
      key: fileKey,
      localPath,
    });

    return localPath;
  }

  /**
   * Upload execution logs to S3
   *
   * @param submissionId UUID of the submission
   * @param logs         Complete execution logs (stdout + stderr)
   * @param maxBytes     Optional maximum log size in bytes (for security/cost control)
   * @returns            S3 key where logs were stored
   */
  async uploadLogs(
    submissionId: string,
    logs: string,
    maxBytes?: number,
  ): Promise<string> {
    const logsS3Key = `${LOGS_PREFIX}/${submissionId}/run.log`;

    console.log('[S3StorageService] Uploading logs to S3', {
      submissionId,
      logsS3Key,
      logSize: logs.length,
    });

    // Truncate logs if they exceed maximum size
    if (maxBytes && logs.length > maxBytes) {
      console.warn('[S3StorageService] Truncating large logs', {
        submissionId,
        maxBytes,
        actual: logs.length,
      });

      logs =
        logs.slice(0, maxBytes) +
        '\n\n[LOG OUTPUT TRUNCATED DUE TO SIZE LIMIT]\n';
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: logsS3Key,
      Body: logs,
      ContentType: 'text/plain',
    });

    try {
      await this.client.send(command);

      console.log('[S3StorageService] Logs uploaded successfully', {
        submissionId,
        logsS3Key,
      });

      return logsS3Key;
    } catch (error) {
      console.error('[S3StorageService] Failed to upload logs to S3', {
        submissionId,
        logsS3Key,
        error,
      });
      throw error;
    }
  }

   /**
   * Download professor tests ZIP for a PIT into a local temp path.
   *
   * @param testsKey   S3 object key where tests.zip is stored (e.g. "pits/<pitId>/tests.zip")
   * @param pitId      PIT UUID (used only for local folder naming)
   * @returns          Local path to downloaded tests.zip
   */
  async downloadTestsZipToTemp(
    testsKey: string,
    pitId: string,
  ): Promise<string> {
    // Puedes elegir la estructura que quieras. Ejemplo:
    const localPath = `./tmp/pits/${pitId}/tests.zip`;

    this.ensureDirectory(dirname(localPath));

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: testsKey,
    });

    let response: GetObjectCommandOutput;
    try {
      response = await this.client.send(command);
    } catch (error) {
      console.error('[S3StorageService] Failed to download PIT tests from S3', {
        bucket: this.bucket,
        key: testsKey,
        error,
      });
      throw error;
    }

    if (!response.Body) {
      throw new Error('S3 GetObject response has no Body (tests.zip)');
    }

    const writeStream = createWriteStream(localPath);
    const bodyStream = response.Body as NodeJS.ReadableStream;

    await new Promise<void>((resolve, reject) => {
      bodyStream
        .pipe(writeStream)
        .on('finish', () => resolve())
        .on('error', (err) => reject(err));
    });

    console.log('[S3StorageService] PIT tests download complete', {
      key: testsKey,
      localPath,
    });

    return localPath;
  }


  private ensureDirectory(path: string): void {
    mkdirSync(path, { recursive: true });
  }
}
