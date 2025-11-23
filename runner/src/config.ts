/**
 * Configuration Module
 *
 * Loads and validates all required environment variables for the Runner service.
 * Fails fast if any required variable is missing.
 */

export interface RunnerConfig {
  // AWS Configuration
  awsRegion: string;
  awsS3Bucket: string;
  awsSqsQueueUrl: string;

  // Database Configuration
  databaseUrl?: string;
  dbHost?: string;
  dbPort?: number;
  dbUsername?: string;
  dbPassword?: string;
  dbName?: string;

  // Runner Configuration
  runnerPollIntervalMs: number;
  runnerTimeoutMs: number;
  runnerMaxLogBytes: number;

  // Build Tools
  jdkVersion: string;
  buildTool: string;
}

/**
 * Required environment variables that must be present
 */
const REQUIRED_VARS = [
  'AWS_REGION',
  'AWS_S3_BUCKET',
  'AWS_SQS_QUEUE_URL',
];

/**
 * Validates that all required environment variables are present
 * @throws Error if any required variable is missing
 */
function validateRequiredVariables(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  // Check database configuration (either DATABASE_URL or individual vars)
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasIndividualDbVars = !!(
    process.env.DB_HOST &&
    process.env.DB_PORT &&
    process.env.DB_USERNAME &&
    process.env.DB_PASSWORD &&
    process.env.DB_NAME
  );

  if (!hasDatabaseUrl && !hasIndividualDbVars) {
    missing.push('DATABASE_URL or (DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME)');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}\n\n` +
      'Please check your .env file or environment configuration.'
    );
  }
}

/**
 * Loads and validates configuration from environment variables
 * @returns RunnerConfig object with all configuration values
 * @throws Error if validation fails
 */
export function loadConfig(): RunnerConfig {
  validateRequiredVariables();

  return {
    // AWS Configuration
    awsRegion: process.env.AWS_REGION!,
    awsS3Bucket: process.env.AWS_S3_BUCKET!,
    awsSqsQueueUrl: process.env.AWS_SQS_QUEUE_URL!,

    // Database Configuration
    databaseUrl: process.env.DATABASE_URL,
    dbHost: process.env.DB_HOST,
    dbPort: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    dbUsername: process.env.DB_USERNAME,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    // Runner Configuration
    runnerPollIntervalMs: parseInt(process.env.RUNNER_POLL_INTERVAL_MS || '20000', 10),
    runnerTimeoutMs: parseInt(process.env.RUNNER_TIMEOUT_MS || '120000', 10),
    runnerMaxLogBytes: parseInt(process.env.RUNNER_MAX_LOG_BYTES || '200000', 10),

    // Build Tools
    jdkVersion: process.env.JDK_VERSION || '17',
    buildTool: process.env.BUILD_TOOL || 'maven',
  };
}

/**
 * Get database connection string
 * Uses DATABASE_URL if available, otherwise constructs from individual variables
 */
export function getDatabaseConnectionString(config: RunnerConfig): string {
  if (config.databaseUrl) {
    return config.databaseUrl;
  }

  return `postgresql://${config.dbUsername}:${config.dbPassword}@${config.dbHost}:${config.dbPort}/${config.dbName}`;
}
