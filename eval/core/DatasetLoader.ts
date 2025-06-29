import { Dataset, Logger, DatasetConfigInput } from './types.js';
import { DatasetProviderRegistry, LocalDatasetProvider, SWEBenchDatasetProvider } from '../dataset-providers/index.js';
import type { DatasetConfig } from '../dataset-providers/interfaces.js';

/**
 * Enhanced DatasetLoader that supports multiple dataset providers while maintaining backward compatibility
 */
export class DatasetLoader {
  private logger: Logger;
  private baseDir: string;
  private registry: DatasetProviderRegistry;

  constructor(logger: Logger, baseDir: string = '') {
    this.logger = logger;
    this.baseDir = baseDir || process.cwd();
    this.registry = new DatasetProviderRegistry(logger);
    
    // Register dataset providers by default
    this.registry.registerProvider(new LocalDatasetProvider(logger, baseDir));
    this.registry.registerProvider(new SWEBenchDatasetProvider(logger));
  }

  /**
   * Load a dataset using either the legacy string format or new configuration object
   */
  async loadDataset(datasetInput: DatasetConfigInput): Promise<Dataset> {
    const config = this.normalizeDatasetConfig(datasetInput);
    
    try {
      this.logger.debug(`Loading dataset with config:`, config);
      return await this.registry.loadDataset(config);
    } catch (error) {
      this.logger.error(`Failed to load dataset`, error as Error);
      throw error;
    }
  }

  /**
   * Validate a dataset configuration
   */
  async validateDataset(datasetInput: DatasetConfigInput): Promise<boolean> {
    const config = this.normalizeDatasetConfig(datasetInput);
    return await this.registry.validateConfig(config);
  }

  /**
   * Get information about all available dataset providers
   */
  getProviderInfo(): Array<{name: string, description: string, types: string[]}> {
    return this.registry.getProviderInfo();
  }

  /**
   * List all supported dataset types
   */
  getSupportedTypes(): string[] {
    return this.registry.listProviderTypes();
  }

  /**
   * Register a new dataset provider
   */
  registerProvider(provider: any): void {
    this.registry.registerProvider(provider);
  }

  /**
   * Check if subset selection is supported for a given dataset configuration
   */
  supportsSubsetSelection(datasetInput: DatasetConfigInput): boolean {
    const config = this.normalizeDatasetConfig(datasetInput);
    return this.registry.supportsSubsetSelection(config);
  }

  /**
   * List available local datasets in the datasets directory (backward compatibility)
   */
  async listAvailableDatasets(): Promise<string[]> {
    const localProvider = this.registry.getProvider('local') as LocalDatasetProvider;
    if (localProvider && localProvider.listAvailableDatasets) {
      return await localProvider.listAvailableDatasets();
    }
    return [];
  }

  /**
   * Convert legacy string format or new config object to standardized DatasetConfig
   */
  private normalizeDatasetConfig(datasetInput: DatasetConfigInput): DatasetConfig {
    // Handle legacy string format
    if (typeof datasetInput === 'string') {
      return {
        type: 'local',
        name: datasetInput,
        path: datasetInput
      };
    }
    
    // Handle new config object format
    const config = datasetInput as DatasetConfig;
    
    // Set default type if not specified
    if (!config.type) {
      config.type = 'local';
    }
    
    return config;
  }
}