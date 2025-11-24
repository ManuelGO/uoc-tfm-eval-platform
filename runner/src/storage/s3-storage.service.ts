import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname } from 'node:path';
import {
  S3Client,
  GetObjectCommand,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import type { RunnerConfig } from '../config/config.js';

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

  private ensureDirectory(path: string): void {
    mkdirSync(path, { recursive: true });
  }
}
