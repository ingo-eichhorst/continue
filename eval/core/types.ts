// Simplified types for Continue.dev integration
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ILLM {
  uniqueId: string;
  model: string;
  title?: string;
  providerName: string;
  contextLength: number;
  completionOptions: any;
  
  streamChat(messages: ChatMessage[], options?: any): AsyncIterableIterator<{ content?: string; usage?: any }>;
}

// Core benchmark interfaces
export interface BenchmarkPlugin {
  name: string;
  description: string;
  propertiesSchema: Record<string, PropertySchema>;
  defaultDataset?: string;
  
  execute(context: BenchmarkContext): Promise<BenchmarkResult>;
  validateDataset?(dataset: Dataset): Promise<boolean>;
}

export interface PropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  default?: any;
  description?: string;
  enum?: any[];
}

export interface BenchmarkContext {
  models: ILLM[];
  dataset: Dataset;
  session: BenchmarkSession;
  properties: Record<string, any>;
  executionEnvironment: ExecutionEnvironment;
  logger: Logger;
}

export interface BenchmarkResult {
  pluginName: string;
  sessionId: string;
  testCases: TestCaseResult[];
  metrics: BenchmarkMetrics;
  summary: ResultSummary;
  startTime: Date;
  endTime: Date;
  duration: number;
}

// Dataset management
export interface Dataset {
  name: string;
  description: string;
  version: string;
  testCases: TestCase[];
  metadata: DatasetMetadata;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  input: TestInput;
  expected?: TestExpected;
  metadata?: Record<string, any>;
}

export interface TestInput {
  prompt: string;
  context?: string;
  sourceCode?: string;
  systemPrompt?: string;
  additionalData?: Record<string, any>;
}

export interface TestExpected {
  output?: string;
  shouldPass?: boolean;
  metrics?: Record<string, number>;
  validationRules?: ValidationRule[];
}

export interface ValidationRule {
  type: "syntax" | "compilation" | "execution" | "unit-test" | "custom";
  config: Record<string, any>;
}

export interface DatasetMetadata {
  language?: string;
  domain?: string;
  difficulty?: "easy" | "medium" | "hard";
  tags?: string[];
  source?: string;
  createdAt: Date;
  modifiedAt: Date;
}

// Test execution and results
export interface TestCaseResult {
  testCaseId: string;
  modelId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  
  // LLM interaction
  llmRequest?: LLMRequest;
  llmResponse?: LLMResponse;
  
  // Execution results
  executionResult?: ExecutionResult;
  
  // Validation results
  validationResults?: ValidationResult[];
  
  // Metrics
  metrics?: TestCaseMetrics;
  
  // Error information
  error?: BenchmarkError;
}

export interface LLMRequest {
  model: string;
  messages: any[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  timestamp: Date;
}

export interface LLMResponse {
  content: string;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency: number;
  timestamp: Date;
}

export interface ExecutionResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  successful: boolean;
  executionTime?: number;
  memoryUsage?: number;
  error?: string;
}

export interface ValidationResult {
  type: string;
  passed: boolean;
  score?: number;
  details?: string;
  error?: string;
}

// Session management
export interface BenchmarkSession {
  id: string;
  pluginName: string;
  startTime: Date;
  lastUpdateTime: Date;
  status: "running" | "completed" | "failed" | "paused";
  
  config: SessionConfig;
  progress: SessionProgress;
  results: TestCaseResult[];
  
  metadata?: Record<string, any>;
}

export interface SessionConfig {
  models: string[];
  dataset: string;
  properties: Record<string, any>;
  executionEnvironment: "local" | "docker";
  maxRetries: number;
  timeout: number;
}

export interface SessionProgress {
  totalTestCases: number;
  completedTestCases: number;
  failedTestCases: number;
  skippedTestCases: number;
  currentTestCase?: string;
  estimatedTimeRemaining?: number;
}

// Execution environments
export interface ExecutionEnvironment {
  name: string;
  type: "local" | "docker";
  
  runCode(code: string, language: string, options?: ExecutionOptions): Promise<ExecutionResult>;
  cleanup?(): Promise<void>;
}

export interface ExecutionOptions {
  timeout?: number;
  memoryLimit?: number;
  workingDirectory?: string;
  environment?: Record<string, string>;
  files?: Record<string, string>;
}

// Metrics and reporting
export interface BenchmarkMetrics {
  functional: FunctionalMetrics;
  performance: PerformanceMetrics;
  quality: QualityMetrics;
  custom?: Record<string, any>;
}

export interface FunctionalMetrics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  successRate: number;
  passAt1?: number;
  passAt5?: number;
  passAt10?: number;
}

export interface PerformanceMetrics {
  averageLatency: number;
  medianLatency: number;
  p95Latency: number;
  totalTokens: number;
  averageTokensPerRequest: number;
  estimatedCost?: number;
  throughput?: number;
}

export interface QualityMetrics {
  syntaxCorrectness: number;
  compilationSuccess: number;
  codeStyleScore?: number;
  readabilityScore?: number;
  maintainabilityScore?: number;
  securityScore?: number;
}

export interface TestCaseMetrics {
  latency: number;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost?: number;
  qualityScores?: Record<string, number>;
}

export interface ResultSummary {
  overallScore: number;
  recommendations: string[];
  bestPerformingModel?: string;
  insights: string[];
  charts?: ChartData[];
}

export interface ChartData {
  type: "bar" | "line" | "scatter" | "histogram";
  title: string;
  data: any[];
  config?: Record<string, any>;
}

// Configuration and loading
export interface BenchmarkConfig {
  models: ModelConfig[];
  plugins: PluginConfig[];
  datasets: DatasetConfig[];
  execution: ExecutionConfig;
  reporting: ReportingConfig;
  session?: SessionConfig;
}

export interface ModelConfig {
  name: string;
  provider: string;
  config: Record<string, any>;
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  properties?: Record<string, any>;
}

export interface DatasetConfig {
  name: string;
  path: string;
  type: "local" | "remote";
  config?: Record<string, any>;
}

export interface ExecutionConfig {
  environment: "local" | "docker";
  timeout: number;
  maxRetries: number;
  parallel?: boolean;
  resources?: {
    memoryLimit?: string;
    cpuLimit?: string;
  };
}

export interface ReportingConfig {
  output: "console" | "json" | "html" | "all";
  outputPath?: string;
  includeDetails: boolean;
  charts: boolean;
}

// Error handling
export interface BenchmarkError {
  type: "llm" | "execution" | "validation" | "system" | "timeout";
  message: string;
  details?: string;
  stack?: string;
  recoverable: boolean;
  retryCount?: number;
}

// Logging
export interface Logger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error | BenchmarkError): void;
}

// CLI and utilities
export interface CLIOptions {
  benchmark?: string;
  models?: string[];
  dataset?: string;
  config?: string;
  continue?: string;
  output?: string;
  verbose?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

// Plugin-specific types
export interface UnifiedDiffTestCase extends TestCase {
  input: TestInput & {
    sourceCode: string;
    modificationPrompt: string;
  };
  expected?: TestExpected & {
    diffShouldApply: boolean;
    expectedChanges?: string[];
  };
}

export interface PromptOptimizationTestCase extends TestCase {
  input: TestInput & {
    problemDescription: string;
    signature: string;
    examples?: string[];
  };
  expected: TestExpected & {
    unitTests: string[];
    shouldPass: true;
  };
}

export interface PromptEvaluationTestCase extends TestCase {
  input: TestInput & {
    codebaseContext: string;
    task: string;
    promptFiles?: string[];
    continueRules?: string[];
  };
  expected?: TestExpected & {
    qualityThreshold: number;
    requiredFeatures?: string[];
  };
}