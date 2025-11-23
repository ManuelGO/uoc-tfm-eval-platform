import dotenv from 'dotenv';
import { loadConfig, type RunnerConfig } from './config.js';

// Load environment variables
dotenv.config();

/**
 * Runner Service Entry Point
 *
 * This service processes submission jobs from SQS, downloads ZIP files from S3,
 * executes tests in an isolated environment, and stores results back to S3 and RDS.
 */

async function main() {
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

  // TODO: Initialize services (SQS consumer, S3 client, DB client)
  // TODO: Start polling SQS for messages

  console.log('\n✓ Runner initialization complete');
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing Runner gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing Runner gracefully');
  process.exit(0);
});

// Start the runner
main().catch((error) => {
  console.error('Fatal error in Runner:', error);
  process.exit(1);
});
