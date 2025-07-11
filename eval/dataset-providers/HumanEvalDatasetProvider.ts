import { Dataset, Logger, TestCase, TestInput, TestExpected, DatasetMetadata } from '../core/types.js';
import { DatasetProvider, DatasetConfig, DatasetConfigSchema, HumanEvalInstance, HumanEvalConfig } from './interfaces.js';
import { SubsetSelector } from './SubsetSelector.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Dataset provider for loading HumanEval datasets from HuggingFace
 */
export class HumanEvalDatasetProvider implements DatasetProvider {
  name = "human-eval";
  description = "Loads HumanEval datasets from HuggingFace Hub for code generation evaluation";
  supportedTypes = ["human-eval"];
  
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Check if this provider can handle the given configuration
   */
  canHandle(config: DatasetConfig): boolean {
    return config.type === "human-eval";
  }

  /**
   * Load HumanEval dataset from HuggingFace
   */
  async load(config: DatasetConfig): Promise<Dataset> {
    try {
      this.logger.info(`Loading HumanEval dataset: ${config.name}`);
      
      const humanEvalConfig = this.extractHumanEvalConfig(config);
      
      const instances = await this.fetchHumanEvalData(config.name, humanEvalConfig);
      
      // Transform HumanEval instances to TestCases
      const testCases = this.transformToTestCases(instances);
      
      // Apply subset selection if configured
      let filteredTestCases = testCases;
      if (config.subset) {
        const originalCount = filteredTestCases.length;
        filteredTestCases = SubsetSelector.applySubset(filteredTestCases, config.subset);
        
        const stats = SubsetSelector.getSubsetStats(originalCount, filteredTestCases.length, config.subset);
        this.logger.info(`Applied ${stats.selectionMethod} subset: ${stats.selectedCount}/${stats.originalCount} test cases (${stats.reductionPercent}% reduction)`);
      }

      const dataset: Dataset = {
        name: config.name,
        description: `HumanEval dataset loaded from HuggingFace for code generation evaluation`,
        version: "1.0.0",
        testCases: filteredTestCases,
        metadata: {
          source: "HuggingFace Hub",
          domain: "code generation",
          difficulty: "medium",
          language: "python",
          tags: ["code-generation", "functional-correctness", "programming"],
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      };

      this.logger.info(`Loaded HumanEval dataset: ${dataset.name} (${dataset.testCases.length} test cases)`);
      return dataset;

    } catch (error) {
      this.logger.error(`Failed to load HumanEval dataset`, error as Error);
      throw error;
    }
  }

  /**
   * Validate HumanEval dataset configuration
   */
  async validate(config: DatasetConfig): Promise<boolean> {
    try {
      if (!config.name) {
        this.logger.error('HumanEval dataset requires a name field');
        return false;
      }

      // Validate limit if specified
      if (config.config?.limit && (typeof config.config.limit !== 'number' || config.config.limit <= 0)) {
        this.logger.error('HumanEval limit must be a positive number');
        return false;
      }

      // Validate offset if specified
      if (config.config?.offset && (typeof config.config.offset !== 'number' || config.config.offset < 0)) {
        this.logger.error('HumanEval offset must be a non-negative number');
        return false;
      }

      // Validate execution timeout if specified
      if (config.config?.execution_timeout && (typeof config.config.execution_timeout !== 'number' || config.config.execution_timeout <= 0)) {
        this.logger.error('HumanEval execution timeout must be a positive number');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('HumanEval dataset validation failed:', error as Error);
      return false;
    }
  }

  /**
   * Get configuration schema for HumanEval datasets
   */
  getSchema(): DatasetConfigSchema {
    return {
      properties: {
        type: {
          type: "string",
          required: true,
          description: "Dataset provider type",
          enum: ["human-eval"]
        },
        name: {
          type: "string",
          required: true,
          description: "HumanEval dataset name (e.g., 'openai_humaneval')"
        },
        config: {
          type: "object",
          required: false,
          description: "HumanEval specific configuration"
        }
      },
      required: ["type", "name"]
    };
  }

  /**
   * HumanEval provider supports subset selection
   */
  supportsSubset(): boolean {
    return true;
  }

  /**
   * Extract HumanEval specific configuration
   */
  private extractHumanEvalConfig(config: DatasetConfig): HumanEvalConfig {
    const humanEvalConfig: HumanEvalConfig = {
      cache: true,
      execution_timeout: 10000, // 10 seconds default
      ...config.config
    };

    return humanEvalConfig;
  }

  /**
   * Fetch HumanEval data from HuggingFace Hub
   */
  private async fetchHumanEvalData(datasetName: string, config: HumanEvalConfig): Promise<HumanEvalInstance[]> {
    try {
      this.logger.info(`Fetching HumanEval data from HuggingFace: ${datasetName}`);
      
      // Try to load from cache first
      const cachedData = await this.loadFromCache(datasetName);
      if (cachedData) {
        this.logger.info(`Loaded HumanEval data from cache: ${cachedData.length} instances`);
        return this.applyFiltering(cachedData, config);
      }

      // Download from HuggingFace if not cached
      const instances = await this.downloadFromHuggingFace(datasetName);
      
      // Cache the downloaded data
      await this.saveToCache(datasetName, instances);
      
      // Apply filtering and return
      const filteredInstances = this.applyFiltering(instances, config);
      this.logger.info(`Fetched ${filteredInstances.length} HumanEval instances from ${datasetName}`);
      
      return filteredInstances;

    } catch (error) {
      this.logger.error(`Failed to fetch HumanEval data: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Download HumanEval data from HuggingFace Hub
   */
  private async downloadFromHuggingFace(datasetName: string): Promise<HumanEvalInstance[]> {
    try {
      this.logger.info(`Downloading ${datasetName} from HuggingFace...`);
      
      // Use HuggingFace datasets API
      const url = `https://datasets-server.huggingface.co/rows?dataset=openai/${datasetName}&config=openai_humaneval&split=test`;
      
      this.logger.debug(`Fetching from API: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error('Invalid response format from HuggingFace API');
      }
      
      // Transform the API response to HumanEvalInstance format
      const instances: HumanEvalInstance[] = data.rows.map((row: any) => ({
        task_id: row.row.task_id,
        prompt: row.row.prompt,
        canonical_solution: row.row.canonical_solution,
        test: row.row.test,
        entry_point: row.row.entry_point
      }));
      
      this.logger.info(`Downloaded ${instances.length} instances from HuggingFace API`);
      return instances;
      
    } catch (error) {
      throw new Error(`API download failed: ${(error as Error).message}`);
    }
  }

  /**
   * Apply filtering based on configuration
   */
  private applyFiltering(instances: HumanEvalInstance[], config: HumanEvalConfig): HumanEvalInstance[] {
    let filtered = instances;
    
    // Apply offset
    if (config.offset && config.offset > 0) {
      filtered = filtered.slice(config.offset);
      this.logger.debug(`Offset applied: ${filtered.length} instances after skipping ${config.offset}`);
    }

    // Apply limit
    if (config.limit && config.limit > 0) {
      filtered = filtered.slice(0, config.limit);
      this.logger.debug(`Limit applied: ${filtered.length} instances (limited to ${config.limit})`);
    }

    return filtered;
  }

  /**
   * Load data from local cache
   */
  private async loadFromCache(datasetName: string): Promise<HumanEvalInstance[] | null> {
    try {
      const cacheDir = join(tmpdir(), 'humaneval-cache');
      const cacheFile = join(cacheDir, `${datasetName}.json`);
      
      if (!existsSync(cacheFile)) {
        return null;
      }
      
      // Check if cache is older than 24 hours
      const stats = require('fs').statSync(cacheFile);
      const ageHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        this.logger.debug(`Cache expired (${ageHours.toFixed(1)}h old), will re-download`);
        return null;
      }
      
      const data = readFileSync(cacheFile, 'utf-8');
      return JSON.parse(data);
      
    } catch (error) {
      this.logger.warn(`Failed to load from cache: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Save data to local cache
   */
  private async saveToCache(datasetName: string, data: HumanEvalInstance[]): Promise<void> {
    try {
      const cacheDir = join(tmpdir(), 'humaneval-cache');
      
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      
      const cacheFile = join(cacheDir, `${datasetName}.json`);
      writeFileSync(cacheFile, JSON.stringify(data, null, 2));
      
      this.logger.debug(`Cached ${data.length} instances to ${cacheFile}`);
      
    } catch (error) {
      this.logger.warn(`Failed to save to cache: ${(error as Error).message}`);
      // Don't throw - caching is optional
    }
  }

  /**
   * Transform HumanEval instances to TestCase format
   */
  private transformToTestCases(instances: HumanEvalInstance[]): TestCase[] {
    return instances.map(instance => this.transformToTestCase(instance));
  }

  /**
   * Transform HumanEval instance to TestCase format
   */
  private transformToTestCase(instance: HumanEvalInstance): TestCase {
    const input: TestInput = {
      prompt: this.buildPrompt(instance),
      context: '',
      sourceCode: '',
      systemPrompt: this.buildSystemPrompt(),
      additionalData: {
        entry_point: instance.entry_point,
        canonical_solution: instance.canonical_solution,
        task_type: 'code_generation'
      }
    };

    const expected: TestExpected = {
      output: instance.canonical_solution,
      unitTest: instance.test,
      metrics: {}
    };

    const testCase: TestCase = {
      id: instance.task_id,
      name: `HumanEval: ${instance.entry_point}`,
      description: this.extractDescription(instance.prompt),
      input,
      expected,
      metadata: {
        language: "python",
        difficulty: this.inferDifficulty(instance.prompt),
        source: "HumanEval",
        task_category: this.categorizeProblem(instance.prompt),
        entry_point: instance.entry_point,
        task_id: instance.task_id
      }
    };

    return testCase;
  }

  /**
   * Build the prompt for the HumanEval test case
   */
  private buildPrompt(instance: HumanEvalInstance): string {
    return `Complete the following Python function:

${instance.prompt}

Provide only the complete function implementation. Do not include any explanations or test code.`;
  }

  /**
   * Build the system prompt for HumanEval tasks
   */
  private buildSystemPrompt(): string {
    return `You are an expert Python programmer. Your task is to complete Python functions based on their signatures and docstrings.

Requirements:
1. Provide only the complete function implementation
2. Ensure your code is syntactically correct
3. Follow the function signature exactly as specified
4. Implement the logic described in the docstring
5. Handle edge cases appropriately
6. Do not include any explanations, comments, or test code

Your response should contain only the Python function implementation.`;
  }

  /**
   * Extract description from the prompt docstring
   */
  private extractDescription(prompt: string): string {
    // Extract the first line of the docstring as description
    const lines = prompt.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
        const docstring = trimmed.substring(3);
        if (docstring.length > 0 && !docstring.endsWith('"""') && !docstring.endsWith("'''")) {
          return docstring.trim();
        }
      } else if (trimmed.length > 0 && !trimmed.startsWith('def ') && !trimmed.startsWith('#')) {
        return trimmed;
      }
    }
    return `Complete the ${prompt.split('(')[0].replace('def ', '')} function`;
  }

  /**
   * Infer difficulty based on prompt complexity
   */
  private inferDifficulty(prompt: string): "easy" | "medium" | "hard" {
    const complexity_indicators = {
      easy: ['return', 'print', 'len', 'max', 'min', 'sum'],
      medium: ['for', 'while', 'if', 'list', 'dict', 'sort'],
      hard: ['recursive', 'algorithm', 'complex', 'optimization', 'dynamic']
    };

    const lowerPrompt = prompt.toLowerCase();
    
    if (complexity_indicators.hard.some(indicator => lowerPrompt.includes(indicator))) {
      return "hard";
    } else if (complexity_indicators.medium.some(indicator => lowerPrompt.includes(indicator))) {
      return "medium";
    } else {
      return "easy";
    }
  }

  /**
   * Categorize problem based on content
   */
  private categorizeProblem(prompt: string): string {
    const categories = {
      'string_manipulation': ['string', 'char', 'text', 'word'],
      'algorithms': ['sort', 'search', 'algorithm', 'recursive'],
      'data_structures': ['list', 'dict', 'array', 'tree'],
      'mathematics': ['math', 'number', 'calculate', 'sum', 'average'],
      'logic': ['boolean', 'condition', 'logic', 'true', 'false']
    };

    const lowerPrompt = prompt.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }
}