import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Dataset, Logger } from '../core/types.js';
import { DatasetProvider, DatasetConfig, DatasetConfigSchema } from './interfaces.js';
import { SubsetSelector } from './SubsetSelector.js';

/**
 * Dataset provider for loading local JSON datasets from the filesystem
 * This provider maintains backward compatibility with the existing DatasetLoader
 */
export class LocalDatasetProvider implements DatasetProvider {
  name = "local";
  description = "Loads datasets from local JSON files";
  supportedTypes = ["local"];
  
  private logger: Logger;
  private baseDir: string;

  constructor(logger: Logger, baseDir: string = '') {
    this.logger = logger;
    this.baseDir = baseDir || process.cwd();
  }

  /**
   * Check if this provider can handle the given configuration
   */
  canHandle(config: DatasetConfig): boolean {
    return config.type === "local" || (!config.type && !!config.path);
  }

  /**
   * Load a local dataset from JSON file
   */
  async load(config: DatasetConfig): Promise<Dataset> {
    try {
      const resolvedPath = this.resolveDatasetPath(config);
      this.logger.debug(`Loading local dataset from: ${resolvedPath}`);

      const datasetContent = this.readDatasetFile(resolvedPath);
      const dataset: Dataset = JSON.parse(datasetContent);
      
      // Validate the basic dataset structure
      this.validateDatasetStructure(dataset);
      
      // Ensure metadata dates are Date objects
      this.normalizeMetadata(dataset);

      // Apply subset selection if configured
      if (config.subset) {
        const originalCount = dataset.testCases.length;
        dataset.testCases = SubsetSelector.applySubset(dataset.testCases, config.subset);
        
        const stats = SubsetSelector.getSubsetStats(originalCount, dataset.testCases.length, config.subset);
        this.logger.info(`Applied ${stats.selectionMethod} subset: ${stats.selectedCount}/${stats.originalCount} test cases (${stats.reductionPercent}% reduction)`);
      }

      this.logger.info(`Loaded local dataset: ${dataset.name} (${dataset.testCases.length} test cases) from ${resolvedPath}`);
      return dataset;

    } catch (error) {
      this.logger.error(`Failed to load local dataset`, error as Error);
      throw error;
    }
  }

  /**
   * Validate the dataset configuration
   */
  async validate(config: DatasetConfig): Promise<boolean> {
    try {
      // Check if path is provided
      if (!config.path && !config.name) {
        this.logger.error('Local dataset requires either "path" or "name" field');
        return false;
      }

      // Check if file exists
      const resolvedPath = this.resolveDatasetPath(config);
      if (!this.findDatasetFile(resolvedPath)) {
        this.logger.error(`Dataset file not found at: ${resolvedPath}`);
        return false;
      }

      // Validate subset configuration if provided
      if (config.subset) {
        if (config.subset.indices && !Array.isArray(config.subset.indices)) {
          this.logger.error('Subset indices must be an array of numbers');
          return false;
        }
        
        if (config.subset.range) {
          const { start, end } = config.subset.range;
          if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || start >= end) {
            this.logger.error('Subset range must have valid start and end numbers with start < end');
            return false;
          }
        }
        
        if (config.subset.random) {
          const { count } = config.subset.random;
          if (typeof count !== 'number' || count <= 0) {
            this.logger.error('Subset random count must be a positive number');
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Local dataset validation failed:', error as Error);
      return false;
    }
  }

  /**
   * Get the configuration schema for local datasets
   */
  getSchema(): DatasetConfigSchema {
    return {
      properties: {
        type: {
          type: "string",
          required: false,
          description: "Dataset provider type",
          enum: ["local"],
          default: "local"
        },
        name: {
          type: "string",
          required: false,
          description: "Dataset name (will look in datasets/ directory)"
        },
        path: {
          type: "string",
          required: false,
          description: "Path to dataset file (relative or absolute)"
        },
        subset: {
          type: "object",
          required: false,
          description: "Subset selection configuration"
        }
      },
      required: [] // Either name or path is required, but not both
    };
  }

  /**
   * Check if this provider supports subset selection
   */
  supportsSubset(): boolean {
    return true;
  }

  /**
   * Resolve the dataset path based on configuration
   * This maintains compatibility with the original DatasetLoader logic
   */
  private resolveDatasetPath(config: DatasetConfig): string {
    const datasetPath = config.path || config.name;
    if (!datasetPath) {
      throw new Error('Dataset configuration must specify either "path" or "name"');
    }

    if (datasetPath.startsWith('/') || datasetPath.includes(':')) {
      // Absolute path
      return datasetPath;
    } else if (datasetPath.startsWith('datasets/')) {
      // Path starting with datasets/ - resolve from base directory
      return join(this.baseDir, datasetPath);
    } else if (datasetPath.startsWith('../')) {
      // Relative path from eval directory
      return resolve(this.baseDir, datasetPath);
    } else {
      // Assume it's a dataset name - look in datasets directory
      return join(this.baseDir, 'datasets', datasetPath);
    }
  }

  /**
   * Find and read the dataset file, trying multiple possible locations
   */
  private findDatasetFile(resolvedPath: string): string | null {
    const possiblePaths = [
      resolvedPath,
      join(resolvedPath, 'dataset.json'),
      `${resolvedPath}.json`,
      join(resolvedPath, 'index.json')
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        const stat = require('fs').statSync(path);
        if (stat.isFile()) {
          this.logger.debug(`Found dataset at: ${path}`);
          return path;
        }
      }
    }

    return null;
  }

  /**
   * Read the dataset file content
   */
  private readDatasetFile(resolvedPath: string): string {
    const actualPath = this.findDatasetFile(resolvedPath);
    
    if (!actualPath) {
      const possiblePaths = [
        resolvedPath,
        join(resolvedPath, 'dataset.json'),
        `${resolvedPath}.json`,
        join(resolvedPath, 'index.json')
      ];
      throw new Error(`Dataset not found at any of the expected locations: ${possiblePaths.join(', ')}`);
    }

    try {
      return readFileSync(actualPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read dataset from ${actualPath}: ${(error as Error).message}`);
    }
  }

  /**
   * Validate the basic structure of the loaded dataset
   */
  private validateDatasetStructure(dataset: any): void {
    if (!dataset.name) {
      throw new Error('Dataset missing required field: name');
    }
    
    if (!dataset.testCases || !Array.isArray(dataset.testCases)) {
      throw new Error('Dataset missing required field: testCases (must be an array)');
    }

    if (dataset.testCases.length === 0) {
      throw new Error('Dataset must contain at least one test case');
    }

    // Validate each test case
    dataset.testCases.forEach((testCase: any, index: number) => {
      if (!testCase.id) {
        throw new Error(`Test case at index ${index} missing required field: id`);
      }
      
      if (!testCase.name) {
        throw new Error(`Test case ${testCase.id} missing required field: name`);
      }
      
      if (!testCase.input) {
        throw new Error(`Test case ${testCase.id} missing required field: input`);
      }
      
      if (!testCase.input.prompt) {
        throw new Error(`Test case ${testCase.id} missing required field: input.prompt`);
      }
    });

    this.logger.debug(`Dataset validation passed: ${dataset.name}`);
  }

  /**
   * Normalize metadata by converting string dates to Date objects
   */
  private normalizeMetadata(dataset: Dataset): void {
    if (dataset.metadata) {
      if (dataset.metadata.createdAt && typeof dataset.metadata.createdAt === 'string') {
        dataset.metadata.createdAt = new Date(dataset.metadata.createdAt);
      }
      if (dataset.metadata.modifiedAt && typeof dataset.metadata.modifiedAt === 'string') {
        dataset.metadata.modifiedAt = new Date(dataset.metadata.modifiedAt);
      }
    }
  }

  /**
   * List available datasets in the datasets directory
   * This maintains compatibility with the original DatasetLoader
   */
  async listAvailableDatasets(): Promise<string[]> {
    try {
      const datasetsDir = join(this.baseDir, 'datasets');
      
      if (!existsSync(datasetsDir)) {
        this.logger.warn(`Datasets directory not found: ${datasetsDir}`);
        return [];
      }

      const { readdirSync, statSync } = await import('fs');
      const items = readdirSync(datasetsDir);
      const datasets: string[] = [];

      for (const item of items) {
        const itemPath = join(datasetsDir, item);
        const stat = statSync(itemPath);
        
        if (stat.isDirectory()) {
          // Check if directory contains dataset.json
          const datasetFile = join(itemPath, 'dataset.json');
          if (existsSync(datasetFile)) {
            datasets.push(item);
          }
        } else if (item.endsWith('.json')) {
          // JSON file in datasets directory
          datasets.push(item.replace('.json', ''));
        }
      }

      return datasets;
    } catch (error) {
      this.logger.error('Failed to list available datasets', error as Error);
      return [];
    }
  }
}