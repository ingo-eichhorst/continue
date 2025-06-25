import { v4 as uuidv4 } from 'uuid';
import {
  BenchmarkContext,
  BenchmarkMetrics,
  BenchmarkPlugin,
  BenchmarkResult,
  BenchmarkSession,
  Dataset,
  ExecutionEnvironment,
  ILLM,
  Logger,
  ResultSummary,
  TestCaseResult
} from './types.js';
import { SessionManager } from './SessionManager.js';

export class BenchmarkEngine {
  private plugins: Map<string, BenchmarkPlugin> = new Map();
  private sessionManager: SessionManager;
  private logger: Logger;

  constructor(logger: Logger, sessionManager: SessionManager) {
    this.logger = logger;
    this.sessionManager = sessionManager;
  }

  // Plugin management
  registerPlugin(plugin: BenchmarkPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Registered plugin: ${plugin.name}`);
  }

  getPlugin(name: string): BenchmarkPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  // Session management
  async createSession(
    pluginName: string,
    models: ILLM[],
    dataset: Dataset,
    properties: Record<string, any> = {},
    executionEnvironment: ExecutionEnvironment
  ): Promise<BenchmarkSession> {
    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const sessionId = uuidv4();
    const session: BenchmarkSession = {
      id: sessionId,
      pluginName,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      status: 'running',
      config: {
        models: models.map(m => m.uniqueId),
        dataset: dataset.name,
        properties,
        executionEnvironment: executionEnvironment.type,
        maxRetries: 3,
        timeout: 300000 // 5 minutes
      },
      progress: {
        totalTestCases: dataset.testCases.length * models.length,
        completedTestCases: 0,
        failedTestCases: 0,
        skippedTestCases: 0
      },
      results: []
    };

    await this.sessionManager.saveSession(session);
    this.logger.info(`Created session ${sessionId} for plugin ${pluginName}`);
    return session;
  }

  async getSession(sessionId: string): Promise<BenchmarkSession | null> {
    return await this.sessionManager.loadSession(sessionId);
  }

  async updateSession(session: BenchmarkSession): Promise<void> {
    session.lastUpdateTime = new Date();
    await this.sessionManager.updateSession(session);
  }

  // Main execution logic
  async executeBenchmark(
    pluginName: string,
    models: ILLM[],
    dataset: Dataset,
    executionEnvironment: ExecutionEnvironment,
    properties: Record<string, any> = {},
    sessionId?: string
  ): Promise<BenchmarkResult> {
    let session: BenchmarkSession;

    if (sessionId) {
      // Resume existing session
      const existingSession = await this.getSession(sessionId);
      if (!existingSession) {
        throw new Error(`Session ${sessionId} not found`);
      }
      session = existingSession;
      this.logger.info(`Resuming session ${sessionId}`);
    } else {
      // Create new session
      session = await this.createSession(pluginName, models, dataset, properties, executionEnvironment);
    }

    const plugin = this.getPlugin(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    try {
      // Validate dataset if plugin supports it
      if (plugin.validateDataset) {
        const isValid = await plugin.validateDataset(dataset);
        if (!isValid) {
          throw new Error(`Dataset validation failed for plugin ${pluginName}`);
        }
      }

      // Create benchmark context
      const context: BenchmarkContext = {
        models,
        dataset,
        session,
        properties,
        executionEnvironment,
        logger: this.logger
      };

      // Execute the benchmark
      session.status = 'running';
      await this.updateSession(session);

      const result = await this.executeWithErrorHandling(plugin, context);

      // Update session status
      session.status = 'completed';
      session.results = result.testCases;
      await this.updateSession(session);

      return result;

    } catch (error) {
      this.logger.error(`Benchmark execution failed for session ${session.id}`, error as Error);
      session.status = 'failed';
      await this.updateSession(session);
      throw error;
    }
  }

  private async executeWithErrorHandling(
    plugin: BenchmarkPlugin,
    context: BenchmarkContext
  ): Promise<BenchmarkResult> {
    const startTime = new Date();
    
    try {
      const result = await plugin.execute(context);
      const endTime = new Date();

      // Enhance result with timing information
      result.startTime = startTime;
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();
      result.sessionId = context.session.id;

      // Calculate aggregate metrics
      result.metrics = this.calculateMetrics(result.testCases);
      result.summary = this.generateSummary(result);

      return result;

    } catch (error) {
      this.logger.error(`Plugin execution failed`, error as Error);
      
      // Create error result
      const endTime = new Date();
      const errorResult: BenchmarkResult = {
        pluginName: plugin.name,
        sessionId: context.session.id,
        testCases: [],
        metrics: this.getEmptyMetrics(),
        summary: {
          overallScore: 0,
          recommendations: [`Benchmark failed: ${(error as Error).message}`],
          insights: []
        },
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime()
      };

      throw error;
    }
  }

  private calculateMetrics(testCases: TestCaseResult[]): BenchmarkMetrics {
    const totalTests = testCases.length;
    const completedTests = testCases.filter(tc => tc.status === 'completed');
    const passedTests = completedTests.filter(tc => 
      tc.validationResults?.every(vr => vr.passed) ?? false
    );
    const failedTests = testCases.filter(tc => tc.status === 'failed');

    // Functional metrics
    const successRate = totalTests > 0 ? passedTests.length / totalTests : 0;

    // Performance metrics
    const latencies = completedTests
      .map(tc => tc.duration)
      .filter((d): d is number => d !== undefined);
    
    const tokenUsage = completedTests
      .map(tc => tc.llmResponse?.usage?.totalTokens)
      .filter((t): t is number => t !== undefined);

    const averageLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : 0;

    const medianLatency = latencies.length > 0 
      ? this.calculateMedian(latencies) 
      : 0;

    const p95Latency = latencies.length > 0 
      ? this.calculatePercentile(latencies, 0.95) 
      : 0;

    const totalTokens = tokenUsage.reduce((a, b) => a + b, 0);
    const averageTokensPerRequest = tokenUsage.length > 0 
      ? totalTokens / tokenUsage.length 
      : 0;

    // Quality metrics
    const syntaxCorrectness = this.calculateQualityMetric(completedTests, 'syntax');
    const compilationSuccess = this.calculateQualityMetric(completedTests, 'compilation');

    return {
      functional: {
        totalTests,
        passedTests: passedTests.length,
        failedTests: failedTests.length,
        successRate,
        passAt1: successRate // Simplified for now
      },
      performance: {
        averageLatency,
        medianLatency,
        p95Latency,
        totalTokens,
        averageTokensPerRequest
      },
      quality: {
        syntaxCorrectness,
        compilationSuccess
      }
    };
  }

  private calculateQualityMetric(testCases: TestCaseResult[], type: string): number {
    const relevantResults = testCases
      .flatMap(tc => tc.validationResults || [])
      .filter(vr => vr.type === type);
    
    if (relevantResults.length === 0) return 0;
    
    return relevantResults.filter(vr => vr.passed).length / relevantResults.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }

  private generateSummary(result: BenchmarkResult): ResultSummary {
    const { metrics } = result;
    const overallScore = (
      metrics.functional.successRate * 0.5 +
      (metrics.quality.syntaxCorrectness * 0.3) +
      (metrics.quality.compilationSuccess * 0.2)
    );

    const recommendations: string[] = [];
    const insights: string[] = [];

    // Generate recommendations based on metrics
    if (metrics.functional.successRate < 0.5) {
      recommendations.push("Success rate is below 50%. Consider reviewing prompts and test cases.");
    }

    if (metrics.performance.averageLatency > 10000) {
      recommendations.push("Average latency is high. Consider optimizing prompts or using faster models.");
    }

    if (metrics.quality.syntaxCorrectness < 0.8) {
      recommendations.push("Syntax correctness is low. Consider improving system prompts for code generation.");
    }

    // Generate insights
    insights.push(`Processed ${metrics.functional.totalTests} test cases`);
    insights.push(`Overall success rate: ${(metrics.functional.successRate * 100).toFixed(1)}%`);
    insights.push(`Average response time: ${metrics.performance.averageLatency.toFixed(0)}ms`);

    return {
      overallScore,
      recommendations,
      insights
    };
  }

  private getEmptyMetrics(): BenchmarkMetrics {
    return {
      functional: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        successRate: 0
      },
      performance: {
        averageLatency: 0,
        medianLatency: 0,
        p95Latency: 0,
        totalTokens: 0,
        averageTokensPerRequest: 0
      },
      quality: {
        syntaxCorrectness: 0,
        compilationSuccess: 0
      }
    };
  }

  // Utility methods for session management
  async pauseSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.status = 'paused';
    await this.updateSession(session);
    this.logger.info(`Paused session ${sessionId}`);
  }

  async resumeSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    session.status = 'running';
    await this.updateSession(session);
    this.logger.info(`Resumed session ${sessionId}`);
  }

  async listSessions(): Promise<BenchmarkSession[]> {
    return this.sessionManager.listSessions();
  }

  async getActiveSessions(): Promise<BenchmarkSession[]> {
    const sessions = await this.listSessions();
    return sessions.filter(s => s.status === 'running');
  }
}