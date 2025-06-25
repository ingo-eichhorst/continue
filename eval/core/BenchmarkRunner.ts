import { 
  BenchmarkConfig, 
  BenchmarkResults, 
  BenchmarkSummary, 
  BenchmarkMetadata, 
  BenchmarkResult,
  ConfigurationError 
} from './types';

export class BenchmarkRunner {
  private config: BenchmarkConfig;
  private isRunning: boolean = false;

  constructor(config: BenchmarkConfig) {
    this.validateConfiguration(config);
    this.config = config;
  }

  private validateConfiguration(config: BenchmarkConfig): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigurationError('Invalid configuration: config must be an object');
    }

    if (!config.output || typeof config.output !== 'object') {
      throw new ConfigurationError('Invalid configuration: output configuration is required');
    }

    if (!config.output.format || !['json', 'yaml', 'xml'].includes(config.output.format)) {
      throw new ConfigurationError('Invalid configuration: output.format must be json, yaml, or xml');
    }

    if (!config.output.path || typeof config.output.path !== 'string') {
      throw new ConfigurationError('Invalid configuration: output.path is required and must be a string');
    }

    if (!Array.isArray(config.plugins)) {
      throw new ConfigurationError('Invalid configuration: plugins must be an array');
    }
  }

  public getConfig(): BenchmarkConfig {
    return { ...this.config };
  }

  public async run(): Promise<BenchmarkResults> {
    this.isRunning = true;
    const startTime = new Date();

    try {
      // Initialize metrics and results tracking
      const results: BenchmarkResult[] = [];
      const errors: string[] = [];

      // For now, with empty plugins, we just return empty results
      if (this.config.plugins.length === 0) {
        return this.buildResults(startTime, new Date(), results, errors);
      }

      // TODO: Implement plugin loading and execution
      // For now, simulate plugin execution errors for non-existent plugins
      for (const plugin of this.config.plugins) {
        try {
          // Simulate plugin loading attempt
          throw new Error(`Plugin '${plugin}' not found`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to load plugin '${plugin}': ${errorMessage}`);
          
          // Create a failed result for this plugin
          results.push({
            testId: `plugin-${plugin}`,
            testName: `Load Plugin: ${plugin}`,
            status: 'failed',
            duration: 0,
            error: errorMessage
          });
        }
      }

      return this.buildResults(startTime, new Date(), results, errors);

    } finally {
      this.isRunning = false;
    }
  }

  public stop(): void {
    this.isRunning = false;
  }

  private buildResults(
    startTime: Date, 
    endTime: Date, 
    results: BenchmarkResult[], 
    errors: string[]
  ): BenchmarkResults {
    const summary: BenchmarkSummary = {
      totalTests: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime
    };

    const metadata: BenchmarkMetadata = {
      timestamp: startTime,
      framework: 'continue-eval',
      version: '0.1.0',
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      },
      config: { ...this.config }
    };

    if (errors.length > 0) {
      metadata.errors = errors;
    }

    return {
      summary,
      results,
      metadata
    };
  }
}