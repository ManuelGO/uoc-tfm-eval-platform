import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Runner Service Entry Point
 *
 * This service processes submission jobs from SQS, downloads ZIP files from S3,
 * executes tests in an isolated environment, and stores results back to S3 and RDS.
 */

async function main() {
  console.log('Runner started');
  console.log(`AWS Region: ${process.env.AWS_REGION || 'not set'}`);
  console.log(`S3 Bucket: ${process.env.AWS_S3_BUCKET || 'not set'}`);
  console.log(`SQS Queue URL: ${process.env.AWS_SQS_QUEUE_URL || 'not set'}`);

  // TODO: Initialize services (SQS consumer, S3 client, DB client)
  // TODO: Start polling SQS for messages

  console.log('Runner initialization complete');
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
