/**
 * Submission Message Interface
 *
 * Structure of a submission message received from SQS queue
 */

export interface SubmissionMessage {
  submissionId: string;
  fileKey: string;
  userId: string;
  pitId: string;
  createdAt: string;
}

/**
 * Processor function type - will be called for each message received
 */
export type MessageProcessor = (message: SubmissionMessage) => Promise<void>;
