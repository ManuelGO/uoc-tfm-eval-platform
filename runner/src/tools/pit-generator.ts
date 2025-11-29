#!/usr/bin/env node

/**
 * PIT Configuration Generator CLI
 *
 * Generates valid PIT configuration JSON files under runner/pits/
 * Supports both interactive mode (prompts) and non-interactive mode (CLI args)
 *
 * Usage:
 *   Interactive:   npm run generate:pit
 *   Non-interactive: npm run generate:pit -- --id=... --language=... --buildTool=... [options]
 *
 * Options:
 *   --id=<pitId>                      PIT identifier (required)
 *   --language=<lang>                 Programming language (default: java)
 *   --buildTool=<tool>                Build tool (default: maven)
 *   --testCommand=<cmd>               Test command (default: mvn -q test)
 *   --maxTimeoutMs=<ms>               Timeout in milliseconds (default: 60000)
 *   --setupCommands=<cmd1,cmd2>       Setup commands (comma-separated)
 *   --requiredFiles=<f1,f2>           Required files (comma-separated)
 *   --env=<KEY=VAL,FOO=BAR>           Environment variables (format: KEY=VALUE,FOO=BAR)
 *   --environment=<KEY=VAL,FOO=BAR>   Alias for --env
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { PitConfig } from '../pit-config/interfaces/pit-config.interface.js';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supported values
const SUPPORTED_LANGUAGES = ['java', 'python', 'javascript', 'typescript'];
const SUPPORTED_BUILD_TOOLS = ['maven', 'gradle', 'npm', 'pip', 'poetry'];

// Default values for Java/Maven
const DEFAULTS = {
  language: 'java',
  buildTool: 'maven',
  testCommand: 'mvn -q test',
  maxTimeoutMs: 60000,
};

interface GeneratorConfig {
  pitId: string;
  language: string;
  buildTool: string;
  testCommand: string;
  maxTimeoutMs: number;
  setupCommands?: string[];
  environment?: Record<string, string>;
  requiredFiles?: string[];
}

/**
 * Parse environment variable string
 * Format: KEY=VALUE,FOO=BAR
 */
function parseEnvString(value: string): Record<string, string> {
  const env: Record<string, string> = {};

  if (!value) return env;

  for (const pair of value.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      console.warn(`Warning: Ignoring invalid env pair "${trimmed}" (expected KEY=VALUE)`);
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();

    if (!key) {
      console.warn(`Warning: Ignoring env pair with empty key "${trimmed}"`);
      continue;
    }

    env[key] = val;
  }

  return env;
}

/**
 * Parse command-line arguments
 */
function parseArgs(): Partial<GeneratorConfig> | null {
  const args = process.argv.slice(2);

  // If no args or only --interactive, return null to trigger interactive mode
  if (args.length === 0 || (args.length === 1 && args[0] === '--interactive')) {
    return null;
  }

  const config: Partial<GeneratorConfig> = {};

  for (const arg of args) {
    if (!arg.startsWith('--')) continue;

    // Split only on the first '=' to handle values with '=' in them
    const equalIndex = arg.indexOf('=');
    if (equalIndex === -1) continue;

    const key = arg.slice(2, equalIndex);
    const value = arg.slice(equalIndex + 1);

    switch (key) {
      case 'id':
        config.pitId = value;
        break;
      case 'language':
        config.language = value;
        break;
      case 'buildTool':
        config.buildTool = value;
        break;
      case 'testCommand':
        config.testCommand = value;
        break;
      case 'maxTimeoutMs':
        config.maxTimeoutMs = parseInt(value, 10);
        break;
      case 'setupCommands':
        config.setupCommands = value.split(',').map(cmd => cmd.trim()).filter(cmd => cmd);
        break;
      case 'requiredFiles':
        config.requiredFiles = value.split(',').map(file => file.trim()).filter(file => file);
        break;
      case 'env':
      case 'environment':
        config.environment = {
          ...(config.environment ?? {}),
          ...parseEnvString(value),
        };
        break;
    }
  }

  return config;
}

/**
 * Validate PIT ID format
 */
function validatePitId(pitId: string): { valid: boolean; error?: string } {
  if (!pitId || pitId.trim().length === 0) {
    return { valid: false, error: 'PIT ID cannot be empty' };
  }

  // Check for filesystem-safe characters
  const validPattern = /^[a-z0-9-]+$/;
  if (!validPattern.test(pitId)) {
    return {
      valid: false,
      error: 'PIT ID must contain only lowercase letters, numbers, and hyphens',
    };
  }

  // Check for consecutive hyphens or leading/trailing hyphens
  if (pitId.includes('--') || pitId.startsWith('-') || pitId.endsWith('-')) {
    return {
      valid: false,
      error: 'PIT ID cannot have consecutive, leading, or trailing hyphens',
    };
  }

  return { valid: true };
}

/**
 * Validate timeout value
 */
function validateTimeout(timeout: number): { valid: boolean; error?: string } {
  if (isNaN(timeout) || timeout <= 0) {
    return { valid: false, error: 'Timeout must be a positive integer' };
  }

  if (timeout > 600000) {
    return {
      valid: false,
      error: 'Timeout cannot exceed 600000ms (10 minutes)',
    };
  }

  return { valid: true };
}

/**
 * Check if language/buildTool is supported (warn if not)
 */
function checkSupported(
  type: 'language' | 'buildTool',
  value: string,
): { warning?: string } {
  const supported =
    type === 'language' ? SUPPORTED_LANGUAGES : SUPPORTED_BUILD_TOOLS;

  if (!supported.includes(value)) {
    return {
      warning: `Warning: "${value}" is not in the officially supported ${type} list: ${supported.join(', ')}`,
    };
  }

  return {};
}

/**
 * Interactive mode: prompt user for configuration
 */
async function interactiveMode(): Promise<GeneratorConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  };

  console.log('\n=== PIT Configuration Generator ===\n');

  // PIT ID
  let pitId = '';
  while (true) {
    pitId = await question('PIT ID (required): ');
    const validation = validatePitId(pitId);
    if (validation.valid) break;
    console.error(`Error: ${validation.error}`);
  }

  // Language
  const language =
    (await question(`Language [${DEFAULTS.language}]: `)) || DEFAULTS.language;
  const langCheck = checkSupported('language', language);
  if (langCheck.warning) console.warn(langCheck.warning);

  // Build Tool
  const buildTool =
    (await question(`Build Tool [${DEFAULTS.buildTool}]: `)) ||
    DEFAULTS.buildTool;
  const buildToolCheck = checkSupported('buildTool', buildTool);
  if (buildToolCheck.warning) console.warn(buildToolCheck.warning);

  // Test Command
  const testCommand =
    (await question(`Test Command [${DEFAULTS.testCommand}]: `)) ||
    DEFAULTS.testCommand;

  // Timeout
  let maxTimeoutMs = DEFAULTS.maxTimeoutMs;
  while (true) {
    const timeoutInput = await question(
      `Max Timeout (ms) [${DEFAULTS.maxTimeoutMs}]: `,
    );
    if (!timeoutInput) {
      maxTimeoutMs = DEFAULTS.maxTimeoutMs;
      break;
    }
    const parsedTimeout = parseInt(timeoutInput, 10);
    const validation = validateTimeout(parsedTimeout);
    if (validation.valid) {
      maxTimeoutMs = parsedTimeout;
      break;
    }
    console.error(`Error: ${validation.error}`);
  }

  // Optional: Setup Commands
  const setupCommandsInput = await question(
    'Setup Commands (comma-separated, optional): ',
  );
  const setupCommands =
    setupCommandsInput
      .split(',')
      .map((cmd) => cmd.trim())
      .filter((cmd) => cmd.length > 0) || undefined;

  // Optional: Required Files
  const requiredFilesInput = await question(
    'Required Files (comma-separated, optional): ',
  );
  const requiredFiles =
    requiredFilesInput
      .split(',')
      .map((file) => file.trim())
      .filter((file) => file.length > 0) || undefined;

  // Optional: Environment Variables
  const environmentInput = await question(
    'Environment Variables (format: KEY=VALUE,FOO=BAR, optional): ',
  );
  const environment = parseEnvString(environmentInput);
  const envToSave = Object.keys(environment).length > 0 ? environment : undefined;

  rl.close();

  return {
    pitId,
    language,
    buildTool,
    testCommand,
    maxTimeoutMs,
    setupCommands: setupCommands?.length ? setupCommands : undefined,
    requiredFiles: requiredFiles?.length ? requiredFiles : undefined,
    environment: envToSave,
  };
}

/**
 * Non-interactive mode: validate provided config
 */
function nonInteractiveMode(
  config: Partial<GeneratorConfig>,
): GeneratorConfig {
  // Validate required fields
  if (!config.pitId) {
    console.error('Error: --id is required');
    process.exit(1);
  }

  const pitIdValidation = validatePitId(config.pitId);
  if (!pitIdValidation.valid) {
    console.error(`Error: ${pitIdValidation.error}`);
    process.exit(1);
  }

  const language = config.language || DEFAULTS.language;
  const buildTool = config.buildTool || DEFAULTS.buildTool;
  const testCommand = config.testCommand || DEFAULTS.testCommand;
  const maxTimeoutMs = config.maxTimeoutMs || DEFAULTS.maxTimeoutMs;

  // Validate timeout
  const timeoutValidation = validateTimeout(maxTimeoutMs);
  if (!timeoutValidation.valid) {
    console.error(`Error: ${timeoutValidation.error}`);
    process.exit(1);
  }

  // Check supported values (warnings only)
  const langCheck = checkSupported('language', language);
  if (langCheck.warning) console.warn(langCheck.warning);

  const buildToolCheck = checkSupported('buildTool', buildTool);
  if (buildToolCheck.warning) console.warn(buildToolCheck.warning);

  return {
    pitId: config.pitId,
    language,
    buildTool,
    testCommand,
    maxTimeoutMs,
    setupCommands: config.setupCommands,
    requiredFiles: config.requiredFiles,
    environment: config.environment,
  };
}

/**
 * Build PitConfig object
 */
function buildPitConfig(config: GeneratorConfig): PitConfig {
  const pitConfig: PitConfig = {
    language: config.language,
    buildTool: config.buildTool,
    testCommand: config.testCommand,
    maxTimeoutMs: config.maxTimeoutMs,
  };

  // Add optional fields if provided
  if (config.setupCommands && config.setupCommands.length > 0) {
    pitConfig.setupCommands = config.setupCommands;
  }

  if (config.environment && Object.keys(config.environment).length > 0) {
    pitConfig.environment = config.environment;
  }

  if (config.requiredFiles && config.requiredFiles.length > 0) {
    pitConfig.requiredFiles = config.requiredFiles;
  }

  return pitConfig;
}

/**
 * Write JSON file
 */
async function writeConfigFile(
  pitId: string,
  pitConfig: PitConfig,
  isInteractive: boolean,
): Promise<string> {
  // Determine output path (runner/pits/<pitId>.json)
  const pitsDir = path.join(__dirname, '../../pits');
  const outputPath = path.join(pitsDir, `${pitId}.json`);

  // Ensure pits directory exists
  if (!fs.existsSync(pitsDir)) {
    fs.mkdirSync(pitsDir, { recursive: true });
  }

  // Check if file already exists
  if (fs.existsSync(outputPath)) {
    if (isInteractive) {
      // Prompt for overwrite in interactive mode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `\nFile already exists: ${outputPath}\nOverwrite? (yes/no): `,
          resolve,
        );
      });

      rl.close();

      if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
        console.log('\nOperation cancelled.');
        process.exit(0);
      }
    } else {
      // Fail in non-interactive mode
      console.error(
        `Error: File already exists: ${outputPath}\nUse interactive mode to overwrite.`,
      );
      process.exit(1);
    }
  }

  // Write JSON file with pretty formatting
  const jsonContent = JSON.stringify(pitConfig, null, 2) + '\n';
  fs.writeFileSync(outputPath, jsonContent, 'utf-8');

  return outputPath;
}

/**
 * Log summary
 */
function logSummary(pitId: string, outputPath: string, config: PitConfig) {
  console.log('\n=== PIT Configuration Generated ===\n');
  console.log(`PIT ID:       ${pitId}`);
  console.log(`Output Path:  ${outputPath}`);
  console.log(`Language:     ${config.language}`);
  console.log(`Build Tool:   ${config.buildTool}`);
  console.log(`Test Command: ${config.testCommand}`);
  console.log(`Timeout:      ${config.maxTimeoutMs}ms`);

  if (config.setupCommands && config.setupCommands.length > 0) {
    console.log(`Setup Commands: ${config.setupCommands.length} command(s)`);
  }

  if (config.environment && Object.keys(config.environment).length > 0) {
    console.log(`Environment Variables: ${Object.keys(config.environment).length} variable(s)`);
    Object.entries(config.environment).forEach(([key, value]) => {
      console.log(`  - ${key}=${value}`);
    });
  }

  if (config.requiredFiles && config.requiredFiles.length > 0) {
    console.log(`Required Files: ${config.requiredFiles.length} file(s)`);
  }

  console.log('\n✅ Configuration saved successfully!\n');

  // Usage example
  console.log('📋 Next Steps:\n');
  console.log('1. Register this PIT in the API database:');
  console.log(`   - PIT ID in DB must match: "${pitId}"`);
  console.log('   - Use DummyPitSeedService as a template\n');
  console.log('2. Deploy the Runner service with this config file\n');
  console.log('3. Use this PIT ID when creating submissions:');
  console.log(`   POST /submissions/confirm`);
  console.log(`   {`);
  console.log(`     "pitId": "${pitId}",`);
  console.log(`     "userId": "...",`);
  console.log(`     "fileKey": "..."`);
  console.log(`   }\n`);
}

/**
 * Main execution
 */
async function main() {
  try {
    const args = parseArgs();
    const isInteractive = args === null;

    let config: GeneratorConfig;

    if (isInteractive) {
      config = await interactiveMode();
    } else {
      config = nonInteractiveMode(args);
    }

    const pitConfig = buildPitConfig(config);
    const outputPath = await writeConfigFile(
      config.pitId,
      pitConfig,
      isInteractive,
    );
    logSummary(config.pitId, outputPath, pitConfig);
  } catch (error) {
    console.error('\nError:', (error as Error).message);
    process.exit(1);
  }
}

// Run if executed directly
main();
