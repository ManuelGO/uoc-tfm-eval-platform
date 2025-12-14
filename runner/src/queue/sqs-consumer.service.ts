/**
 * SQS Consumer Service
 *
 * Implements a long-polling loop that continuously receives submission messages
 * from the SQS submissions queue and processes them.
 */

import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import type {
  SubmissionMessage,
  MessageProcessor,
} from './interfaces/submission-message.interface.js';

/**
 * Configuration options for SqsConsumerService
 */
export interface SqsConsumerConfig {
  queueUrl: string;
  region: string;
  maxMessages?: number; // Max number of messages to receive per poll (1-10)
  waitTimeSeconds?: number; // Long polling wait time (0-20)
  visibilityTimeout?: number; // Message visibility timeout in seconds
}

/**
 * SQS Consumer Service
 *
 * Responsible for polling and processing submission messages from SQS queue
 */
export class SqsConsumerService {
  private client: SQSClient;
  private config: SqsConsumerConfig;
  private processor: MessageProcessor;
  private isRunning: boolean = false;

  constructor(config: SqsConsumerConfig, processor: MessageProcessor) {
    this.config = {
      maxMessages: 10, // Process up to 10 messages at once
      waitTimeSeconds: 20, // Enable long polling with max wait time
      visibilityTimeout: 300, // 5 minutes visibility timeout
      ...config,
    };

    this.client = new SQSClient({ region: config.region });
    this.processor = processor;
  }

  /**
   * Start the polling loop
   */
  public start(): void {
    if (this.isRunning) {
      console.warn('⚠️  SQS Consumer is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Starting SQS Consumer...');
    console.log(`   Queue: ${this.config.queueUrl}`);
    console.log(`   Max Messages: ${this.config.maxMessages}`);
    console.log(`   Wait Time: ${this.config.waitTimeSeconds}s (long-polling enabled)`);
    console.log(`   Visibility Timeout: ${this.config.visibilityTimeout}s\n`);

    // Start polling loop (non-blocking)
    this.poll();
  }

  /**
   * Stop the polling loop
   */
  public stop(): void {
    console.log('Stopping SQS Consumer...');
    this.isRunning = false;
  }

  /**
   * Main polling loop - continuously polls SQS for messages
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        // Receive messages from SQS with long polling
        const messages = await this.receiveMessages();

        if (messages && messages.length > 0) {
          console.log(`Received ${messages.length} message(s) from SQS`);

          // Process all messages in parallel
          await Promise.all(
            messages.map((message) => this.processMessage(message))
          );
        } else {
          // No messages received (polling timed out)
          console.log('⏱No messages received (polling timeout)');
        }
      } catch (error) {
        console.error(' Error in polling loop:', error);
        console.error(' Continuing to poll...\n');

        // Wait a bit before retrying to avoid tight error loops
        await this.sleep(5000);
      }
    }

    console.log('✓ SQS Consumer stopped');
  }

  /**
   * Receive messages from SQS queue using long polling
   */
  private async receiveMessages(): Promise<Message[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.config.queueUrl,
      MaxNumberOfMessages: this.config.maxMessages,
      WaitTimeSeconds: this.config.waitTimeSeconds,
      VisibilityTimeout: this.config.visibilityTimeout,
      MessageAttributeNames: ['All'],
    });

    const response = await this.client.send(command);
    return response.Messages || [];
  }

  /**
   * Process a single SQS message
   */
  private async processMessage(message: Message): Promise<void> {
    let submissionId = 'unknown';

    try {
      // Parse message body
      if (!message.Body) {
        throw new Error('Message has no body');
      }

      const submissionMessage = this.parseMessageBody(message.Body);
      submissionId = submissionMessage.submissionId;

      console.log(`\n Processing submission: ${submissionId}`);
      console.log(`   File Key: ${submissionMessage.fileKey}`);
      console.log(`   User ID: ${submissionMessage.userId}`);
      console.log(`   PIT ID: ${submissionMessage.pitId}`);
      console.log(`   Created At: ${submissionMessage.createdAt}`);

      // Process the submission using the provided processor
      await this.processor(submissionMessage);

      console.log(`✓ Successfully processed submission: ${submissionId}`);

      // Delete message from queue after successful processing
      await this.deleteMessage(message, submissionId);

    } catch (error) {
      console.error(`Error processing submission ${submissionId}:`, error);
      console.error(`   Message will become visible again after ${this.config.visibilityTimeout}s`);

    }
  }

  /**
   * Parse the message body JSON and validate required fields
   */
  private parseMessageBody(body: string): SubmissionMessage {
    try {
      const parsed = JSON.parse(body);

      // Validate required fields
      const required = ['submissionId', 'fileKey', 'userId', 'pitId', 'createdAt'];
      for (const field of required) {
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      return {
        submissionId: parsed.submissionId,
        fileKey: parsed.fileKey,
        userId: parsed.userId,
        pitId: parsed.pitId,
        createdAt: parsed.createdAt,
      };
    } catch (error) {
      throw new Error(`Failed to parse message body: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a message from the SQS queue
   */
  private async deleteMessage(message: Message, submissionId: string): Promise<void> {
    if (!message.ReceiptHandle) {
      console.warn(`⚠️  Cannot delete message for ${submissionId}: no receipt handle`);
      return;
    }

    try {
      const command = new DeleteMessageCommand({
        QueueUrl: this.config.queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      });

      await this.client.send(command);
      console.log(` Deleted message from queue: ${submissionId}`);
    } catch (error) {
      console.error(`Failed to delete message for ${submissionId}:`, error);
      // Not throwing here - message will become visible again
    }
  }

  /**
   * Sleep utility for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
