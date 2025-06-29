import { Dataset, Logger, TestCase, TestInput, TestExpected, DatasetMetadata } from '../core/types.js';
import { DatasetProvider, DatasetConfig, DatasetConfigSchema, SWEBenchInstance, SWEBenchConfig } from './interfaces.js';
import { SubsetSelector } from './SubsetSelector.js';
import { RepositoryManager } from '../core/RepositoryManager.js';
import { downloadFile } from '@huggingface/hub';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Dataset provider for loading SWE-bench datasets from HuggingFace
 */
export class SWEBenchDatasetProvider implements DatasetProvider {
  name = "swe-bench";
  description = "Loads SWE-bench datasets from HuggingFace Hub";
  supportedTypes = ["swe-bench"];
  
  private logger: Logger;
  private repositoryManager?: RepositoryManager;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Check if this provider can handle the given configuration
   */
  canHandle(config: DatasetConfig): boolean {
    return config.type === "swe-bench";
  }

  /**
   * Load SWE-bench dataset from HuggingFace
   */
  async load(config: DatasetConfig): Promise<Dataset> {
    try {
      this.logger.info(`Loading SWE-bench dataset: ${config.name}`);
      
      const sweBenchConfig = this.extractSWEBenchConfig(config);
      
      // Initialize repository manager if repository cloning is enabled
      if (sweBenchConfig.clone_repositories) {
        this.repositoryManager = new RepositoryManager(this.logger, {
          cacheDir: sweBenchConfig.repository_cache_dir,
          maxCacheSize: sweBenchConfig.max_repository_cache_size,
          cloneTimeout: sweBenchConfig.clone_timeout,
          githubToken: sweBenchConfig.github_token,
        });
        this.logger.info('Repository cloning enabled - will populate source code from repositories');
      }
      
      const instances = await this.fetchSWEBenchData(config.name, sweBenchConfig);
      
      // Transform SWE-bench instances to TestCases (with repository cloning if enabled)
      const testCases = await this.transformToTestCases(instances, sweBenchConfig);
      
      // Apply filters if specified
      let filteredTestCases = testCases;
      if (sweBenchConfig.repo_filter) {
        filteredTestCases = testCases.filter(tc => 
          sweBenchConfig.repo_filter!.includes(tc.metadata?.repository || '')
        );
        this.logger.info(`Applied repository filter: ${filteredTestCases.length}/${testCases.length} test cases selected`);
      }

      // Apply subset selection if configured
      if (config.subset) {
        const originalCount = filteredTestCases.length;
        filteredTestCases = SubsetSelector.applySubset(filteredTestCases, config.subset);
        
        const stats = SubsetSelector.getSubsetStats(originalCount, filteredTestCases.length, config.subset);
        this.logger.info(`Applied ${stats.selectionMethod} subset: ${stats.selectedCount}/${stats.originalCount} test cases (${stats.reductionPercent}% reduction)`);
      }

      const dataset: Dataset = {
        name: config.name,
        description: `SWE-bench dataset loaded from HuggingFace (${sweBenchConfig.split || 'test'} split)${sweBenchConfig.clone_repositories ? ' with repository source code' : ''}`,
        version: "1.0.0",
        testCases: filteredTestCases,
        metadata: {
          source: "HuggingFace Hub",
          domain: "software engineering",
          difficulty: "hard",
          tags: ["code-generation", "bug-fixing", "software-engineering"],
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      };

      this.logger.info(`Loaded SWE-bench dataset: ${dataset.name} (${dataset.testCases.length} test cases)`);
      return dataset;

    } catch (error) {
      this.logger.error(`Failed to load SWE-bench dataset`, error as Error);
      throw error;
    }
  }

  /**
   * Validate SWE-bench dataset configuration
   */
  async validate(config: DatasetConfig): Promise<boolean> {
    try {
      if (!config.name) {
        this.logger.error('SWE-bench dataset requires a name field');
        return false;
      }

      // Validate split if specified
      if (config.config?.split && !['dev', 'test'].includes(config.config.split)) {
        this.logger.error('SWE-bench split must be either "dev" or "test"');
        return false;
      }

      // Validate limit if specified
      if (config.config?.limit && (typeof config.config.limit !== 'number' || config.config.limit <= 0)) {
        this.logger.error('SWE-bench limit must be a positive number');
        return false;
      }

      // Validate offset if specified
      if (config.config?.offset && (typeof config.config.offset !== 'number' || config.config.offset < 0)) {
        this.logger.error('SWE-bench offset must be a non-negative number');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('SWE-bench dataset validation failed:', error as Error);
      return false;
    }
  }

  /**
   * Get configuration schema for SWE-bench datasets
   */
  getSchema(): DatasetConfigSchema {
    return {
      properties: {
        type: {
          type: "string",
          required: true,
          description: "Dataset provider type",
          enum: ["swe-bench"]
        },
        name: {
          type: "string",
          required: true,
          description: "SWE-bench dataset name (e.g., 'SWE-bench_Lite')"
        },
        config: {
          type: "object",
          required: false,
          description: "SWE-bench specific configuration"
        }
      },
      required: ["type", "name"]
    };
  }

  /**
   * SWE-bench provider supports subset selection
   */
  supportsSubset(): boolean {
    return true;
  }

  /**
   * Extract SWE-bench specific configuration
   */
  private extractSWEBenchConfig(config: DatasetConfig): SWEBenchConfig {
    const sweBenchConfig: SWEBenchConfig = {
      split: 'test',
      cache: true,
      clone_repositories: false,
      max_repository_cache_size: 20,
      clone_timeout: 300000, // 5 minutes
      ...config.config
    };

    return sweBenchConfig;
  }

  /**
   * Fetch SWE-bench data from HuggingFace Hub
   */
  private async fetchSWEBenchData(datasetName: string, config: SWEBenchConfig): Promise<SWEBenchInstance[]> {
    try {
      this.logger.info(`Fetching SWE-bench data from HuggingFace: ${datasetName} (${config.split})`);
      
      // Try to load from cache first
      const cachedData = await this.loadFromCache(datasetName, config.split || 'test');
      if (cachedData) {
        this.logger.info(`Loaded SWE-bench data from cache: ${cachedData.length} instances`);
        return this.applyFiltering(cachedData, config);
      }

      // Download from HuggingFace if not cached
      const instances = await this.downloadFromHuggingFace(datasetName, config.split || 'test');
      
      // Cache the downloaded data
      await this.saveToCache(datasetName, config.split || 'test', instances);
      
      // Apply filtering and return
      const filteredInstances = this.applyFiltering(instances, config);
      this.logger.info(`Fetched ${filteredInstances.length} SWE-bench instances from ${datasetName}`);
      
      return filteredInstances;

    } catch (error) {
      this.logger.error(`Failed to fetch SWE-bench data: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Download SWE-bench data from HuggingFace Hub
   */
  private async downloadFromHuggingFace(datasetName: string, split: string): Promise<SWEBenchInstance[]> {
    try {
      this.logger.info(`Downloading ${datasetName} (${split}) from HuggingFace...`);
      
      // The SWE-bench dataset is stored as Parquet files
      // We'll download the JSON export instead for easier parsing
      const filename = `${split}.json`;
      const repo = `SWE-bench/${datasetName}`;
      
      try {
        await downloadFile({
          repo,
          path: filename,
        });
        
        // Since downloadFile doesn't directly return content, we'll use the API fallback
        // For now, we'll use the Parquet viewer API as the primary method
        return await this.downloadViaAPI(datasetName, split);
        
      } catch (downloadError) {
        this.logger.warn(`Direct download failed, trying API fallback: ${(downloadError as Error).message}`);
        return await this.downloadViaAPI(datasetName, split);
      }

    } catch (error) {
      throw new Error(`Failed to download from HuggingFace: ${(error as Error).message}`);
    }
  }

  /**
   * Download via HuggingFace API as fallback
   */
  private async downloadViaAPI(datasetName: string, split: string): Promise<SWEBenchInstance[]> {
    try {
      // Use HuggingFace API to get the dataset
      const url = `https://datasets-server.huggingface.co/rows?dataset=SWE-bench/${datasetName}&config=default&split=${split}`;
      
      this.logger.debug(`Fetching from API: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.rows || !Array.isArray(data.rows)) {
        throw new Error('Invalid response format from HuggingFace API');
      }
      
      // Transform the API response to SWEBenchInstance format
      const instances: SWEBenchInstance[] = data.rows.map((row: any) => ({
        instance_id: row.row.instance_id,
        repo: row.row.repo,
        base_commit: row.row.base_commit,
        patch: row.row.patch,
        test_patch: row.row.test_patch,
        problem_statement: row.row.problem_statement,
        hints_text: row.row.hints_text || '',
        created_at: row.row.created_at,
        version: row.row.version,
        FAIL_TO_PASS: row.row.FAIL_TO_PASS || [],
        PASS_TO_PASS: row.row.PASS_TO_PASS || [],
        environment_setup_commit: row.row.environment_setup_commit
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
  private applyFiltering(instances: SWEBenchInstance[], config: SWEBenchConfig): SWEBenchInstance[] {
    let filtered = instances;
    
    // Apply repository filtering
    if (config.repo_filter && config.repo_filter.length > 0) {
      filtered = instances.filter(instance => 
        config.repo_filter!.some(filter => instance.repo.includes(filter))
      );
      this.logger.debug(`Repository filter applied: ${filtered.length}/${instances.length} instances`);
    }

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
  private async loadFromCache(datasetName: string, split: string): Promise<SWEBenchInstance[] | null> {
    try {
      const cacheDir = join(tmpdir(), 'swe-bench-cache');
      const cacheFile = join(cacheDir, `${datasetName}-${split}.json`);
      
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
  private async saveToCache(datasetName: string, split: string, data: SWEBenchInstance[]): Promise<void> {
    try {
      const cacheDir = join(tmpdir(), 'swe-bench-cache');
      
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }
      
      const cacheFile = join(cacheDir, `${datasetName}-${split}.json`);
      writeFileSync(cacheFile, JSON.stringify(data, null, 2));
      
      this.logger.debug(`Cached ${data.length} instances to ${cacheFile}`);
      
    } catch (error) {
      this.logger.warn(`Failed to save to cache: ${(error as Error).message}`);
      // Don't throw - caching is optional
    }
  }

  /**
   * Transform SWE-bench instances to TestCase format (with optional repository cloning)
   */
  private async transformToTestCases(instances: SWEBenchInstance[], config: SWEBenchConfig): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    for (const instance of instances) {
      try {
        const testCase = await this.transformToTestCase(instance, config);
        testCases.push(testCase);
      } catch (error) {
        this.logger.warn(`Failed to transform instance ${instance.instance_id}:`, error as Error);
        // Add the test case without source code as fallback
        const fallbackTestCase = this.transformToTestCaseBasic(instance);
        testCases.push(fallbackTestCase);
      }
    }

    return testCases;
  }

  /**
   * Transform SWE-bench instance to TestCase format with repository source code
   */
  private async transformToTestCase(instance: SWEBenchInstance, config: SWEBenchConfig): Promise<TestCase> {
    let sourceCode = '';

    // Get source code from repository if cloning is enabled
    if (config.clone_repositories && this.repositoryManager) {
      try {
        const filePaths = RepositoryManager.extractFilePathsFromDiff(instance.patch);
        
        if (filePaths.length > 0) {
          this.logger.debug(`Extracting source code for ${filePaths.length} files from ${instance.repo}@${instance.base_commit}`);
          
          const fileContents = await this.repositoryManager.getMultipleFileContents(
            instance.repo,
            instance.base_commit,
            filePaths
          );

          // Combine file contents with file paths as comments
          const sourceCodeParts: string[] = [];
          for (const [filePath, content] of Object.entries(fileContents)) {
            if (content !== null) {
              sourceCodeParts.push(`# File: ${filePath}\n${content}`);
            } else {
              sourceCodeParts.push(`# File: ${filePath} (not found - likely new file)`);
            }
          }
          
          sourceCode = sourceCodeParts.join('\n\n');
          this.logger.debug(`Retrieved ${sourceCode.length} characters of source code for ${instance.instance_id}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to get repository source code for ${instance.instance_id}:`, error as Error);
        // Continue without source code
      }
    }

    return this.buildTestCase(instance, sourceCode);
  }

  /**
   * Transform SWE-bench instance to TestCase format (basic version without repository cloning)
   */
  private transformToTestCaseBasic(instance: SWEBenchInstance): TestCase {
    return this.buildTestCase(instance, '');
  }

  /**
   * Build TestCase from SWE-bench instance
   */
  private buildTestCase(instance: SWEBenchInstance, sourceCode: string): TestCase {
    const input: TestInput = {
      prompt: this.buildPrompt(instance),
      context: instance.hints_text || '',
      sourceCode: sourceCode, // Populated with repository source code if available
      systemPrompt: this.buildSystemPrompt(),
      additionalData: {
        repo: instance.repo,
        base_commit: instance.base_commit,
        environment_setup_commit: instance.environment_setup_commit,
        fail_to_pass: instance.FAIL_TO_PASS,
        pass_to_pass: instance.PASS_TO_PASS
      }
    };

    const expected: TestExpected = {
      output: instance.patch,
      unitTest: instance.test_patch,
      metrics: {}
    };

    const testCase: TestCase = {
      id: instance.instance_id,
      name: `SWE-bench: ${instance.repo} - ${instance.instance_id}`,
      description: instance.problem_statement,
      input,
      expected,
      metadata: {
        repository: instance.repo,
        language: "python", // SWE-bench is primarily Python
        difficulty: "hard",
        source: "SWE-bench",
        created_at: instance.created_at,
        base_commit: instance.base_commit,
        environment_setup_commit: instance.environment_setup_commit
      }
    };

    return testCase;
  }

  /**
   * Build the prompt for the SWE-bench test case
   */
  private buildPrompt(instance: SWEBenchInstance): string {
    return `Repository: ${instance.repo}
Base Commit: ${instance.base_commit}

Problem Statement:
${instance.problem_statement}

${instance.hints_text ? `Hints:
${instance.hints_text}

` : ''}Please provide a patch to fix this issue. The patch should be in unified diff format and address the problem described above.`;
  }

  /**
   * Build the system prompt for SWE-bench tasks
   */
  private buildSystemPrompt(): string {
    return `You are a software engineer tasked with fixing bugs in open source repositories. 

Your task is to:
1. Understand the problem statement and any provided hints
2. Analyze the repository context and existing code
3. Generate a minimal patch that fixes the issue
4. Ensure your solution passes the existing tests and doesn't break functionality

Provide your solution as a unified diff patch that can be applied to the repository.`;
  }
}