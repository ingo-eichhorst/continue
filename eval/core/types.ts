// Core types for Continue.dev Benchmarking Framework

export interface BenchmarkConfig {
  plugins: string[];
  output: {
    format: 'json' | 'yaml' | 'xml';
    path: string;
  };
  timeout?: number;
  parallel?: boolean;
  maxConcurrency?: number;
  verbose?: boolean;
}

export interface BenchmarkSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number; // milliseconds
  startTime: Date;
  endTime: Date;
}

export interface BenchmarkResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  metrics?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface BenchmarkMetadata {
  timestamp: Date;
  framework: string;
  version: string;
  environment: {
    node: string;
    platform: string;
    arch: string;
  };
  config: BenchmarkConfig;
  errors?: string[];
}

export interface BenchmarkResults {
  summary: BenchmarkSummary;
  results: BenchmarkResult[];
  metadata: BenchmarkMetadata;
}

export interface IBenchmarkPlugin {
  name: string;
  version: string;
  description: string;
  initialize(): Promise<void>;
  execute(config: any): Promise<BenchmarkResult[]>;
  cleanup(): Promise<void>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  entryPoint: string;
  dependencies?: string[];
  config?: Record<string, any>;
}

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  description: string;
  unit?: string;
}

export interface MetricData {
  name: string;
  value: number | string;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required?: boolean;
    default?: any;
    description?: string;
    validation?: (value: any) => boolean;
  };
}

export interface LogLevel {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

export interface LogEntry {
  level: keyof LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
  error?: Error;
}

// Error types
export class BenchmarkError extends Error {
  constructor(message: string, public code?: string, public context?: any) {
    super(message);
    this.name = 'BenchmarkError';
  }
}

export class PluginError extends BenchmarkError {
  constructor(message: string, public pluginName: string, context?: any) {
    super(message, 'PLUGIN_ERROR', context);
    this.name = 'PluginError';
  }
}

export class ConfigurationError extends BenchmarkError {
  constructor(message: string, public field?: string, context?: any) {
    super(message, 'CONFIG_ERROR', context);
    this.name = 'ConfigurationError';
  }
}