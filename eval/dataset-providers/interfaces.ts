import { Dataset, DatasetMetadata, TestCase } from '../core/types.js';

/**
 * Enhanced dataset configuration supporting multiple provider types and subset selection
 */
export interface DatasetConfig {
  type: "local" | "swe-bench" | "live-code-bench" | "human-eval";
  name: string;
  path?: string; // for local datasets
  config?: {
    split?: "dev" | "test";
    limit?: number;
    offset?: number;
    filter?: Record<string, any>;
    repo_filter?: string[]; // SWE-bench specific
    cache?: boolean;
  };
  subset?: SubsetConfig;
}

/**
 * Configuration for selecting a subset of test cases from a dataset
 */
export interface SubsetConfig {
  indices?: number[];
  range?: { start: number; end: number };
  random?: { count: number; seed?: number };
  filter?: string; // serialized filter function for JSON config
}

/**
 * Schema definition for dataset configuration validation
 */
export interface DatasetConfigSchema {
  properties: Record<string, {
    type: string;
    required?: boolean;
    description?: string;
    enum?: any[];
    default?: any;
  }>;
  required: string[];
}

/**
 * Core interface for dataset providers
 */
export interface DatasetProvider {
  name: string;
  description: string;
  supportedTypes: string[];
  
  /**
   * Load a dataset based on the provided configuration
   */
  load(config: DatasetConfig): Promise<Dataset>;
  
  /**
   * Validate the dataset configuration before loading
   */
  validate(config: DatasetConfig): Promise<boolean>;
  
  /**
   * Get the configuration schema for this provider
   */
  getSchema(): DatasetConfigSchema;
  
  /**
   * Check if this provider supports subset selection
   */
  supportsSubset(): boolean;
  
  /**
   * Check if this provider can handle the given configuration
   */
  canHandle(config: DatasetConfig): boolean;
}

/**
 * Raw data structure from SWE-bench dataset
 */
export interface SWEBenchInstance {
  instance_id: string;
  repo: string;
  base_commit: string;
  patch: string;
  test_patch: string;
  problem_statement: string;
  hints_text?: string;
  created_at: string;
  version: string;
  FAIL_TO_PASS?: string[];
  PASS_TO_PASS?: string[];
  environment_setup_commit?: string;
}

/**
 * Configuration specific to SWE-bench provider
 */
export interface SWEBenchConfig {
  split?: "dev" | "test";
  repo_filter?: string[];
  limit?: number;
  offset?: number;
  cache?: boolean;
  huggingface_token?: string;
  // Repository management options
  clone_repositories?: boolean;
  repository_cache_dir?: string;
  max_repository_cache_size?: number;
  clone_timeout?: number;
  github_token?: string;
}

/**
 * Error types for dataset provider operations
 */
export interface DatasetProviderError {
  type: "validation" | "loading" | "transformation" | "network" | "auth";
  message: string;
  details?: string;
  provider: string;
  config?: DatasetConfig;
}