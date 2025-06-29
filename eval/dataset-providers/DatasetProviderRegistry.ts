import { Logger } from '../core/types.js';
import { DatasetProvider, DatasetConfig, DatasetProviderError } from './interfaces.js';

/**
 * Registry for managing dataset providers and routing dataset loading requests
 */
export class DatasetProviderRegistry {
  private providers: Map<string, DatasetProvider> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Register a dataset provider
   */
  registerProvider(provider: DatasetProvider): void {
    if (this.providers.has(provider.name)) {
      throw new Error(`Dataset provider ${provider.name} is already registered`);
    }
    
    this.providers.set(provider.name, provider);
    this.logger.info(`Registered dataset provider: ${provider.name} (supports: ${provider.supportedTypes.join(', ')})`);
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): DatasetProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Find the appropriate provider for a given dataset configuration
   */
  findProvider(config: DatasetConfig): DatasetProvider {
    // First, try to find a provider that explicitly supports the config type
    for (const provider of this.providers.values()) {
      if (provider.canHandle(config)) {
        this.logger.debug(`Selected provider '${provider.name}' for dataset type '${config.type}'`);
        return provider;
      }
    }

    // Fallback: find by supported types
    for (const provider of this.providers.values()) {
      if (provider.supportedTypes.includes(config.type)) {
        this.logger.debug(`Fallback provider '${provider.name}' for dataset type '${config.type}'`);
        return provider;
      }
    }

    throw new Error(`No dataset provider found for type: ${config.type}. Available providers: ${this.listProviderTypes().join(', ')}`);
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List all supported dataset types across all providers
   */
  listProviderTypes(): string[] {
    const types = new Set<string>();
    for (const provider of this.providers.values()) {
      provider.supportedTypes.forEach(type => types.add(type));
    }
    return Array.from(types).sort();
  }

  /**
   * Get information about all registered providers
   */
  getProviderInfo(): Array<{name: string, description: string, types: string[]}> {
    return Array.from(this.providers.values()).map(provider => ({
      name: provider.name,
      description: provider.description,
      types: provider.supportedTypes
    }));
  }

  /**
   * Validate a dataset configuration by finding and using the appropriate provider
   */
  async validateConfig(config: DatasetConfig): Promise<boolean> {
    try {
      const provider = this.findProvider(config);
      const isValid = await provider.validate(config);
      
      if (!isValid) {
        this.logger.error(`Dataset configuration validation failed for provider '${provider.name}'`);
      }
      
      return isValid;
    } catch (error) {
      this.logger.error(`Failed to validate dataset configuration: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Load a dataset using the appropriate provider
   */
  async loadDataset(config: DatasetConfig) {
    const provider = this.findProvider(config);
    
    try {
      // Validate configuration first
      const isValid = await provider.validate(config);
      if (!isValid) {
        throw new Error(`Dataset configuration validation failed for provider '${provider.name}'`);
      }

      this.logger.debug(`Loading dataset using provider '${provider.name}'`);
      const dataset = await provider.load(config);
      
      this.logger.info(`Successfully loaded dataset '${dataset.name}' with ${dataset.testCases.length} test cases`);
      return dataset;
      
    } catch (error) {
      const providerError: DatasetProviderError = {
        type: "loading",
        message: (error as Error).message,
        details: (error as Error).stack,
        provider: provider.name,
        config
      };
      
      this.logger.error(`Failed to load dataset using provider '${provider.name}':`, error as Error);
      throw providerError;
    }
  }

  /**
   * Check if any provider supports subset selection
   */
  supportsSubsetSelection(config: DatasetConfig): boolean {
    try {
      const provider = this.findProvider(config);
      return provider.supportsSubset();
    } catch {
      return false;
    }
  }

  /**
   * Clear all registered providers (useful for testing)
   */
  clear(): void {
    this.providers.clear();
    this.logger.debug('Cleared all dataset providers');
  }
}