import dotenv from 'dotenv';
import { loadConfig, type RunnerConfig } from './config/config.js';
import { SqsConsumerService } from './queue/sqs-consumer.service.js';
import type { SubmissionMessage } from './queue/interfaces/submission-message.interface.js';

// Load environment variables
dotenv.config();

/**
 * Runner Service Entry Point
 *
 * This service processes submission jobs from SQS, downloads ZIP files from S3,
 * executes tests in an isolated environment, and stores results back to S3 and RDS.
 */

// Global reference to consumer for graceful shutdown
let consumer: SqsConsumerService | null = null;

/**
 * Process a submission message
 * This is the main processing pipeline that will be called for each message
 *
 * @param message - The submission message to process
 */
async function processSubmission(message: SubmissionMessage): Promise<void> {
  // TODO: Implement full processing pipeline in future issues:
  // 1. Download ZIP from S3 (RUN-4)
  // 2. Extract ZIP to workspace (RUN-5)
  // 3. Load PIT configuration (RUN-6)
  // 4. Execute tests (RUN-7)
  // 5. Upload logs to S3 (RUN-8)
  // 6. Update submission result in DB (RUN-9)

  // For now, just simulate processing with a delay
  console.log(`   [Processing] Starting pipeline for ${message.submissionId}...`);
  await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
  console.log(`   [Processing] Pipeline complete for ${message.submissionId}`);
}

/**
 * Bootstrap the runner service
 */
async function bootstrap(): Promise<void> {
  console.log('🚀 Runner Service starting...\n');

  // Load and validate configuration (fails fast if required vars are missing)
  let config: RunnerConfig;
  try {
    config = loadConfig();
    console.log('✓ Configuration loaded successfully');
  } catch (error) {
    console.error('✗ Configuration validation failed:');
    console.error((error as Error).message);
    process.exit(1);
  }

  // Display configuration (without sensitive data)
  console.log('\n📋 Configuration:');
  console.log(`  AWS Region: ${config.awsRegion}`);
  console.log(`  S3 Bucket: ${config.awsS3Bucket}`);
  console.log(`  SQS Queue: ${config.awsSqsQueueUrl}`);
  console.log(`  Poll Interval: ${config.runnerPollIntervalMs}ms`);
  console.log(`  Execution Timeout: ${config.runnerTimeoutMs}ms`);
  console.log(`  Max Log Size: ${config.runnerMaxLogBytes} bytes`);
  console.log(`  JDK Version: ${config.jdkVersion}`);
  console.log(`  Build Tool: ${config.buildTool}`);

  // Initialize SQS Consumer
  console.log('\n📦 Initializing services...');
  consumer = new SqsConsumerService(
    {
      queueUrl: config.awsSqsQueueUrl,
      region: config.awsRegion,
      maxMessages: 10, // Process up to 10 submissions at once
      waitTimeSeconds: 20, // Long polling
      visibilityTimeout: 300, // 5 minutes to process before message becomes visible again
    },
    processSubmission
  );

  // Start polling for messages
  consumer.start();

  console.log('\n✓ Runner initialization complete');
  console.log('👀 Listening for submissions...\n');
}

/**
 * Handle graceful shutdown
 */
function shutdown(): void {
  console.log('\n🛑 Shutdown signal received');

  if (consumer) {
    consumer.stop();
  }

  // Give some time for ongoing processing to complete
  setTimeout(() => {
    console.log('✓ Runner stopped');
    process.exit(0);
  }, 3000);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the runner
bootstrap().catch((error) => {
  console.error('❌ Fatal error in Runner:', error);
  process.exit(1);
});
