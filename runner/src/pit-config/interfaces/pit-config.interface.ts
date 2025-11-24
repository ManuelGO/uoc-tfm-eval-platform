/**
 * PIT Configuration Interface
 *
 * Defines the structure of a PIT (Programming Interactive Task) configuration.
 * Each PIT may have different runtime requirements, build tools, and test commands.
 */

export interface PitConfig {
  /**
   * Programming language used in the PIT
   * Examples: "java", "python", "javascript", "typescript"
   */
  language: string;

  /**
   * Build tool or package manager
   * Examples: "maven", "gradle", "npm", "pip"
   */
  buildTool: string;

  /**
   * Command to execute tests
   * This command will be run in the workspace directory
   */
  testCommand: string;

  /**
   * Maximum execution timeout in milliseconds
   * Tests will be terminated if they exceed this duration
   */
  maxTimeoutMs: number;

  /**
   * Optional: Pre-execution setup commands
   * Run before the test command (e.g., installing dependencies)
   */
  setupCommands?: string[];

  /**
   * Optional: Environment variables to set during execution
   */
  environment?: Record<string, string>;

  /**
   * Optional: Expected file structure validation
   */
  requiredFiles?: string[];
}
