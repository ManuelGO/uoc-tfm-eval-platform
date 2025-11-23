import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Submission } from '../submissions/submission.entity';

interface SubmissionQueueMessage {
  submissionId: string;
  fileKey: string;
  pitId: string;
  userId: string;
  createdAt: string;
}

@Injectable()
export class SqsService {
  private readonly client: SQSClient;
  private readonly queueUrl: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const queueUrl = process.env.AWS_SQS_QUEUE_URL;

    if (!region) {
      throw new Error('AWS_REGION is not configured');
    }

    if (!queueUrl) {
      throw new Error('AWS_SQS_QUEUE_URL is not configured');
    }

    this.client = new SQSClient({ region });
    this.queueUrl = queueUrl;
  }

  async sendSubmissionEnqueued(submission: Submission): Promise<string> {
    if (!submission.pit || !submission.user) {
      throw new Error(
        'Submission must have pit and user relations loaded before enqueueing',
      );
    }

    const message: SubmissionQueueMessage = {
      submissionId: submission.id,
      fileKey: submission.s3Key,
      pitId: submission.pit.id,
      userId: submission.user.id,
      createdAt: submission.createdAt.toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
    });

    try {
      const response = await this.client.send(command);
      const messageId = response.MessageId ?? 'unknown';

      console.log('[SQS] Enqueued submission', {
        submissionId: submission.id,
        messageId,
        queueUrl: this.queueUrl,
      });

      return messageId;
    } catch (error: unknown) {
      console.error('[SQS] Failed to enqueue submission', {
        submissionId: submission.id,
        queueUrl: this.queueUrl,
        error:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      });
      throw error;
    }
  }
}
