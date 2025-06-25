import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { Dataset, Logger } from './types.js';

export class DatasetLoader {
  private logger: Logger;
  private baseDir: string;

  constructor(logger: Logger, baseDir: string = '') {
    this.logger = logger;
    this.baseDir = baseDir || process.cwd();
  }

  async loadDataset(datasetPath: string): Promise<Dataset> {
    try {
      // Resolve the dataset path
      let resolvedPath: string;
      
      if (datasetPath.startsWith('/') || datasetPath.includes(':')) {
        // Absolute path
        resolvedPath = datasetPath;
      } else if (datasetPath.startsWith('datasets/')) {
        // Path starting with datasets/ - resolve from base directory
        resolvedPath = join(this.baseDir, datasetPath);
      } else if (datasetPath.startsWith('../')) {
        // Relative path from eval directory
        resolvedPath = resolve(this.baseDir, datasetPath);
      } else {
        // Assume it's a dataset name - look in datasets directory
        resolvedPath = join(this.baseDir, 'datasets', datasetPath);
      }

      this.logger.debug(`Attempting to load dataset from: ${resolvedPath}`);

      // Try different file extensions and locations
      const possiblePaths = [
        resolvedPath,
        join(resolvedPath, 'dataset.json'),
        `${resolvedPath}.json`,
        join(resolvedPath, 'index.json')
      ];

      let datasetContent: string | null = null;
      let actualPath: string | null = null;

      for (const path of possiblePaths) {
        if (existsSync(path)) {
          try {
            datasetContent = readFileSync(path, 'utf-8');
            actualPath = path;
            this.logger.debug(`Found dataset at: ${path}`);
            break;
          } catch (error) {
            this.logger.warn(`Failed to read dataset from ${path}:`, error);
          }
        }
      }

      if (!datasetContent || !actualPath) {
        throw new Error(`Dataset not found at any of the expected locations: ${possiblePaths.join(', ')}`);
      }

      // Parse the dataset
      const dataset: Dataset = JSON.parse(datasetContent);
      
      // Validate the dataset structure
      this.validateDataset(dataset);
      
      // Ensure metadata dates are Date objects
      if (dataset.metadata) {
        if (dataset.metadata.createdAt && typeof dataset.metadata.createdAt === 'string') {
          dataset.metadata.createdAt = new Date(dataset.metadata.createdAt);
        }
        if (dataset.metadata.modifiedAt && typeof dataset.metadata.modifiedAt === 'string') {
          dataset.metadata.modifiedAt = new Date(dataset.metadata.modifiedAt);
        }
      }

      this.logger.info(`Loaded dataset: ${dataset.name} (${dataset.testCases.length} test cases) from ${actualPath}`);
      return dataset;

    } catch (error) {
      this.logger.error(`Failed to load dataset from ${datasetPath}`, error as Error);
      throw error;
    }
  }

  private validateDataset(dataset: any): void {
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

  // Method to list available datasets in the datasets directory
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