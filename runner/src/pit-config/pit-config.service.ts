import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PitConfig } from './interfaces/pit-config.interface.js';

/**
 * PIT Configuration Service
 *
 * Loads and validates PIT configuration files for different programming tasks.
 * Each PIT has its own configuration defining runtime, build tools, and test commands.
 */
export class PitConfigService {
  private readonly configRoot: string;
  private configCache: Map<string, PitConfig> = new Map();

  constructor(configRoot: string = './pits') {
    this.configRoot = configRoot;
  }

  /**
   * Load PIT configuration by ID
   *
   * @param pitId The PIT identifier (e.g., "java-maven-basic")
   * @returns The validated PIT configuration
   * @throws Error if config file doesn't exist or is invalid
   */
  async loadConfig(pitId: string): Promise<PitConfig> {
    // Check cache first
    if (this.configCache.has(pitId)) {
      console.log('[PitConfigService] Loading config from cache', { pitId });
      return this.configCache.get(pitId)!;
    }

    console.log('[PitConfigService] Loading config from file', { pitId });

    const configPath = this.getConfigPath(pitId);

    // Check if config file exists
    if (!existsSync(configPath)) {
      const error = `PIT configuration file not found: ${configPath}`;
      console.error('[PitConfigService]', error);
      throw new Error(error);
    }

    try {
      // Read and parse configuration file
      const fileContent = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(fileContent) as PitConfig;

      // Validate configuration
      this.validateConfig(config, pitId);

      // Cache the configuration
      this.configCache.set(pitId, config);

      console.log('[PitConfigService] Config loaded successfully', {
        pitId,
        language: config.language,
        buildTool: config.buildTool,
      });

      return config;
    } catch (error) {
      console.error('[PitConfigService] Failed to load config', {
        pitId,
        configPath,
        error,
      });

      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in PIT config file: ${configPath}`);
      }

      throw error;
    }
  }

  /**
   * Validate PIT configuration structure and required fields
   *
   * @param config The configuration to validate
   * @param pitId The PIT identifier (for error messages)
   * @throws Error if validation fails
   */
  private validateConfig(config: PitConfig, pitId: string): void {
    const requiredFields: (keyof PitConfig)[] = [
      'language',
      'buildTool',
      'testCommand',
      'maxTimeoutMs',
    ];

    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!config[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const error = `PIT config for '${pitId}' is missing required fields: ${missingFields.join(', ')}`;
      console.error('[PitConfigService]', error);
      throw new Error(error);
    }

    // Validate field types and values
    if (typeof config.language !== 'string' || config.language.trim() === '') {
      throw new Error(`PIT config for '${pitId}': 'language' must be a non-empty string`);
    }

    if (typeof config.buildTool !== 'string' || config.buildTool.trim() === '') {
      throw new Error(`PIT config for '${pitId}': 'buildTool' must be a non-empty string`);
    }

    if (typeof config.testCommand !== 'string' || config.testCommand.trim() === '') {
      throw new Error(`PIT config for '${pitId}': 'testCommand' must be a non-empty string`);
    }

    if (typeof config.maxTimeoutMs !== 'number' || config.maxTimeoutMs <= 0) {
      throw new Error(`PIT config for '${pitId}': 'maxTimeoutMs' must be a positive number`);
    }

    // Validate optional fields
    if (config.setupCommands && !Array.isArray(config.setupCommands)) {
      throw new Error(`PIT config for '${pitId}': 'setupCommands' must be an array`);
    }

    if (config.environment && typeof config.environment !== 'object') {
      throw new Error(`PIT config for '${pitId}': 'environment' must be an object`);
    }

    if (config.requiredFiles && !Array.isArray(config.requiredFiles)) {
      throw new Error(`PIT config for '${pitId}': 'requiredFiles' must be an array`);
    }

    console.log('[PitConfigService] Config validation passed', { pitId });
  }

  /**
   * Get the file path for a PIT configuration
   *
   * @param pitId The PIT identifier
   * @returns Absolute path to the config file
   */
  private getConfigPath(pitId: string): string {
    return resolve(this.configRoot, `${pitId}.json`);
  }

  /**
   * Clear the configuration cache
   * Useful for testing or hot-reloading configs
   */
  clearCache(): void {
    console.log('[PitConfigService] Clearing configuration cache');
    this.configCache.clear();
  }

  /**
   * Check if a PIT configuration exists
   *
   * @param pitId The PIT identifier
   * @returns True if config file exists
   */
  configExists(pitId: string): boolean {
    return existsSync(this.getConfigPath(pitId));
  }
}
