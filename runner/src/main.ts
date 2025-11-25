import dotenv from 'dotenv';
import { loadConfig, type RunnerConfig } from './config/config.js';
import { SqsConsumerService } from './queue/sqs-consumer.service.js';
import { ProcessingService } from './processing/processing.service.js';

// Load environment variables
dotenv.config();

/**
 * Runner Service Entry Point
 *
 * This service processes submission jobs from SQS, downloads ZIP files from S3,
 * executes tests in an isolated environment, and stores results back to S3 and RDS.
 *
 * RUN-10: Implements robust error handling and retry strategy
 */

// Global references for graceful shutdown
let consumer: SqsConsumerService | null = null;
let processor: ProcessingService | null = null;

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

  // Initialize services
  console.log('\n📦 Initializing services...');

  // Initialize processing service (orchestrates the pipeline)
  processor = new ProcessingService(config);

  // Initialize SQS Consumer
  consumer = new SqsConsumerService(
    {
      queueUrl: config.awsSqsQueueUrl,
      region: config.awsRegion,
      maxMessages: 10, // Process up to 10 submissions at once
      waitTimeSeconds: 20, // Long polling
      visibilityTimeout: 300, // 5 minutes to process before message becomes visible again
    },
    // Bind processor's method as the message handler
    (message) => processor!.processSubmission(message)
  );

  // Start polling for messages
  consumer.start();

  console.log('\n✓ Runner initialization complete');
  console.log('👀 Listening for submissions...\n');
}

/**
 * Handle graceful shutdown
 */
async function shutdown(): Promise<void> {
  console.log('\n🛑 Shutdown signal received');

  // Stop accepting new messages
  if (consumer) {
    consumer.stop();
  }

  // Give some time for ongoing processing to complete
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Close database connections
  if (processor) {
    try {
      await processor.close();
    } catch (error) {
      console.error('Error closing processor:', error);
    }
  }

  console.log('✓ Runner stopped');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the runner
bootstrap().catch((error) => {
  console.error('❌ Fatal error in Runner:', error);
  process.exit(1);
});
