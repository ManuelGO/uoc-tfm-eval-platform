/**
 * Execution Result Interfaces
 *
 * Defines the structure of test execution results and related types.
 */

/**
 * Execution status
 */
export enum ExecutionStatus {
  DONE = 'DONE',     // Tests completed successfully
  ERROR = 'ERROR',   // Tests failed or execution error
  TIMEOUT = 'TIMEOUT', // Execution exceeded timeout
}

/**
 * Test execution feedback
 * Contains summary of test results
 */
export interface ExecutionFeedback {
  /**
   * Total number of tests executed
   */
  totalTests?: number;

  /**
   * Number of tests that passed
   */
  passedTests?: number;

  /**
   * Number of tests that failed
   */
  failedTests?: number;

  /**
   * Detailed test results or error messages
   */
  details?: string;

  /**
   * Exit code from test execution
   */
  exitCode: number;

  /**
   * Whether execution was terminated due to timeout
   */
  timedOut: boolean;

  /**
   * Execution duration in milliseconds
   */
  durationMs: number;
}

/**
 * Complete execution result
 * Standardized format for runner output
 */
export interface ExecutionResult {
  /**
   * Execution status
   */
  status: ExecutionStatus;

  /**
   * Score calculated from test results (0-100)
   * For MVP, this can be a simple calculation based on pass rate
   */
  score: number;

  /**
   * Structured feedback from test execution
   */
  feedback: ExecutionFeedback;

  /**
   * Raw logs (stdout + stderr combined)
   */
  logs: string;
}
