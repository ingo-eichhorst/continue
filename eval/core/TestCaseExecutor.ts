import { readFileSync } from "fs";
import { join } from "path";
import type { ILLM } from "../../core/index.js";
import {
  BenchmarkContext,
  BenchmarkResult,
  BenchmarkSession,
  ChatMessage,
  LLMRequest,
  LLMResponse,
  Logger,
  TestCase,
  TestCaseExecution,
  TestCaseExecutorOptions,
  TestCaseResult,
  TestExecutionContext,
  TestStepResult,
} from "./types.js";

/**
 * TestCaseExecutor handles the common orchestration logic for executing test cases
 * that was previously duplicated across all BenchmarkPlugin implementations.
 *
 * This class provides:
 * - Test case ID generation
 * - Session recovery logic
 * - Result lifecycle management (timing, status transitions)
 * - Progress tracking
 * - Standardized error handling
 */
export class TestCaseExecutor {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Execute a list of test cases with full orchestration logic
   */
  async executeTestCases<TTestCase extends TestCase>(
    testCases: TTestCase[],
    context: BenchmarkContext,
    testCaseExecutor: (
      testCase: TTestCase,
      execContext: TestExecutionContext,
    ) => Promise<TestCaseExecution>,
    options: TestCaseExecutorOptions = {},
  ): Promise<TestCaseResult[]> {
    const { model, session } = context;
    const results: TestCaseResult[] = [];

    this.logger.info(
      `Starting test execution for model ${model.uniqueId} with ${testCases.length} test cases`,
    );

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      // 1. Generate consistent test case ID
      const testCaseId = this.generateTestCaseId(testCase, model);

      this.logger.debug(
        `Processing test case: ${testCase.id}, full testCaseId: ${testCaseId}`,
      );

      // 2. Check session recovery
      const existingResult = this.checkSessionRecovery(session, testCaseId);
      if (existingResult) {
        results.push(existingResult);
        this.logSkipped(testCaseId);
        continue;
      }

      // 3. Execute test case with full lifecycle management
      const result = await this.executeWithLifecycle(
        testCase,
        testCaseId,
        context,
        testCaseExecutor,
        options,
      );

      results.push(result);

      // 4. Update session progress
      this.updateSessionProgress(
        session,
        result,
        i + 1,
        testCases.length,
        model,
      );
    }

    return results;
  }

  private generateTestCaseId(testCase: TestCase, model: ILLM): string {
    return `${testCase.id}-${model.uniqueId}`;
  }

  private checkSessionRecovery(
    session: BenchmarkSession,
    testCaseId: string,
  ): TestCaseResult | null {
    const existingResult = session.results?.find(
      (r) => r.testCaseId === testCaseId && r.status === "completed",
    );
    return existingResult || null;
  }

  private logSkipped(testCaseId: string): void {
    this.logger.debug(`Skipping completed test case: ${testCaseId}`);
  }

  private async executeWithLifecycle<TTestCase extends TestCase>(
    testCase: TTestCase,
    testCaseId: string,
    context: BenchmarkContext,
    testCaseExecutor: (
      testCase: TTestCase,
      execContext: TestExecutionContext,
    ) => Promise<TestCaseExecution>,
    options: TestCaseExecutorOptions,
  ): Promise<TestCaseResult> {
    // Create initial result with timing
    const result = this.createInitialResult(testCaseId, context.model);

    this.logger.debug(
      `Processing test case: ${testCase.id} with model: ${context.model.title} at ${result.startTime!.toISOString()}`,
    );

    try {
      // Execute plugin-specific logic
      const execContext: TestExecutionContext = {
        model: context.model,
        properties: context.properties,
        logger: context.logger,
        executionEnvironment: context.executionEnvironment,
      };

      const execution = await testCaseExecutor(testCase, execContext);

      // Determine success/failure
      const success = this.evaluateSuccess(execution, options.successEvaluator);

      // Finalize result
      this.finalizeResult(result, execution, success, testCaseId);
    } catch (error) {
      // Standardized error handling
      this.handleExecutionError(result, error as Error, testCaseId);
    }

    return result;
  }

  private createInitialResult(testCaseId: string, model: ILLM): TestCaseResult {
    return {
      testCaseId,
      modelId: model.uniqueId,
      status: "running",
      startTime: new Date(),
    };
  }

  private evaluateSuccess(
    execution: TestCaseExecution,
    customEvaluator?: (execution: TestCaseExecution) => boolean,
  ): boolean {
    // Use custom evaluator if provided
    if (customEvaluator) {
      return customEvaluator(execution);
    }

    // Default success evaluation
    if (execution.testStepResults) {
      return execution.testStepResults.every((tsr) => tsr.passed);
    }
    if (execution.executionResult) {
      return execution.executionResult.successful;
    }
    return true; // If no test step/execution results, assume success
  }

  private finalizeResult(
    result: TestCaseResult,
    execution: TestCaseExecution,
    success: boolean,
    testCaseId: string,
  ): void {
    result.endTime = new Date();
    result.duration = result.endTime.getTime() - result.startTime!.getTime();
    result.status = success ? "completed" : "failed";

    // Copy execution data to result
    result.testStepResults = execution.testStepResults;
    result.executionResult = execution.executionResult;

    // Enhance metrics with timing and token information
    // Extract LLM response data from test steps for metrics calculation
    const llmResponses =
      execution.testStepResults?.filter((step) => step.llmResponse) || [];
    const primaryLlmResponse =
      llmResponses.length > 0 ? llmResponses[0].llmResponse : undefined;
    result.metrics = this.enhanceMetrics(
      execution.metrics,
      primaryLlmResponse,
      result.duration,
    );

    if (success) {
      this.logger.debug(
        `Test case ${testCaseId} completed successfully in ${result.duration}ms`,
      );
    } else {
      result.error = {
        type: "validation",
        message: "One or more validation steps failed",
        details: "Check testStepResults for specific failures",
        recoverable: true,
      };
      this.logger.error(`Test case ${testCaseId} failed validation steps`);
    }
  }

  private enhanceMetrics(
    baseMetrics: any,
    llmResponse: any,
    duration: number,
  ): any {
    if (!baseMetrics) {
      return {
        latency: duration,
        tokens: { prompt: 0, completion: 0, total: 0 },
      };
    }

    return {
      ...baseMetrics,
      latency: llmResponse?.latency || duration,
      tokens: {
        prompt: llmResponse?.usage?.promptTokens || 0,
        completion: llmResponse?.usage?.completionTokens || 0,
        total: llmResponse?.usage?.totalTokens || 0,
      },
    };
  }

  /**
   * Creates base metrics structure with test step results and quality scores
   * This is a utility method that plugins can use to build their metrics
   */
  static buildBaseMetrics(
    testStepResults: TestStepResult[],
    qualityScores: Record<string, number> = {},
  ): any {
    const overallQuality =
      testStepResults.length > 0
        ? testStepResults.filter((r) => r.passed).length /
          testStepResults.length
        : 0;

    return {
      latency: 0, // Will be populated by TestCaseExecutor
      tokens: {
        prompt: 0, // Will be populated by TestCaseExecutor
        completion: 0, // Will be populated by TestCaseExecutor
        total: 0, // Will be populated by TestCaseExecutor
      },
      qualityScores: {
        ...qualityScores,
        overallQuality,
      },
    };
  }

  /**
   * Executes an LLM request as exactly one test step with timing and streaming response handling
   * This is a utility method that plugins can use for standardized LLM interaction
   */
  static async executeLLMRequest(
    messages: ChatMessage[],
    model: ILLM,
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const abortController = new AbortController();

    // Create LLM request object
    const llmRequest: LLMRequest = {
      model: model.uniqueId,
      messages,
      timestamp: new Date(),
    };

    const response = await model.streamChat(messages, abortController.signal);

    let content = "";
    for await (const chunk of response) {
      if (chunk.content) {
        content += chunk.content;
      }
    }

    const latency = Date.now() - startTime;

    // Create LLM response object
    const llmResponse: LLMResponse = {
      content: content.trim(),
      latency,
      timestamp: new Date(),
    };

    // Return as TestStepResult representing one test step
    return {
      passed: content.trim().length > 0,
      score: content.trim().length > 0 ? 1 : 0,
      details:
        content.trim().length > 0
          ? `LLM generated response (${content.trim().length} characters)`
          : "Empty response from LLM",
      llmRequest,
      llmResponse,
    };
  }

  /**
   * Executes a complete benchmark plugin with standardized orchestration
   * This method handles the entire execution pattern that's common to all plugins
   */
  static async executePlugin<TPlugin extends { name: string }>(
    plugin: TPlugin,
    context: BenchmarkContext,
    testCaseExecutor: (
      testCase: TestCase,
      execContext: TestExecutionContext,
    ) => Promise<TestCaseExecution>,
  ): Promise<BenchmarkResult> {
    const { dataset, logger } = context;

    // Use TestCaseExecutor to handle all orchestration logic
    const executor = new TestCaseExecutor(logger);
    const testCases = await executor.executeTestCases(
      dataset.testCases as TestCase[],
      context,
      testCaseExecutor,
    );

    // Build and return the benchmark result
    return TestCaseExecutor.buildBenchmarkResult(
      plugin.name,
      testCases,
      context,
      logger,
    );
  }

  /**
   * Completes a test case by summarizing all test step results into a final TestCaseExecution
   * This function automatically extracts metrics, determines success, and builds execution results
   */
  static completeTestCase(
    testStepResults: TestStepResult[],
  ): TestCaseExecution {
    // Extract content from the first LLM step result for stdout
    const firstLlmStep = testStepResults.find((step) => step.llmResponse);
    const content = firstLlmStep?.llmResponse?.content || "";

    // Determine overall success
    const allPassed = testStepResults.every((tsr) => tsr.passed);
    const failedSteps = testStepResults.filter((step) => !step.passed);

    // Build execution result
    const executionResult = {
      stdout: content,
      stderr: allPassed ? "" : `${failedSteps.length} test step(s) failed`,
      exitCode: allPassed ? 0 : 1,
      successful: allPassed,
    };

    // Extract quality scores from step results (plugins can add custom scores to step.score)
    const qualityScores: Record<string, number> = {};
    testStepResults.forEach((step, index) => {
      if (step.score !== undefined) {
        qualityScores[`step_${index}_score`] = step.score;
      }
    });

    // Build metrics
    const metrics = TestCaseExecutor.buildBaseMetrics(
      testStepResults,
      qualityScores,
    );

    return {
      testStepResults,
      executionResult,
      metrics,
    };
  }

  /**
   * Builds a standardized BenchmarkResult from test case results
   * This is a utility method that plugins can use to create their final results
   */
  static buildBenchmarkResult(
    pluginName: string,
    testCases: TestCaseResult[],
    context: BenchmarkContext,
    logger: Logger,
  ): BenchmarkResult {
    const { session } = context;

    const endTime = new Date();
    const totalDuration = endTime.getTime() - session.startTime.getTime();
    logger.info(`Benchmark execution completed in ${totalDuration}ms`);

    const completedTestCases = testCases.filter(
      (tc) => tc.status === "completed",
    ).length;
    const failedTestCases = testCases.filter(
      (tc) => tc.status === "failed",
    ).length;
    const successRate = (completedTestCases / testCases.length) * 100;

    return {
      pluginName,
      sessionId: session.id,
      testCases,
      metrics: {
        functional: {
          totalTests: testCases.length,
          passedTests: completedTestCases,
          failedTests: failedTestCases,
          successRate: successRate,
        },
        // TODO: These should be calculated from actual test case metrics
        performance: {
          averageLatency: 0,
          medianLatency: 0,
          p95Latency: 0,
          totalTokens: 0,
          averageTokensPerRequest: 0,
        },
        // TODO: These should be calculated from validation results
        quality: { syntaxCorrectness: 0, compilationSuccess: 0 },
      },
      // TODO: Generate actual summary
      summary: { overallScore: 0, recommendations: [], insights: [] },

      startTime: session.startTime,
      endTime,
      duration: totalDuration,
    };
  }

  private handleExecutionError(
    result: TestCaseResult,
    error: Error,
    testCaseId: string,
  ): void {
    this.logger.error(`Test case ${testCaseId} failed:`, error);

    result.endTime = new Date();
    result.duration =
      result.endTime.getTime() - (result.startTime?.getTime() || 0);
    result.status = "failed";
    result.error = {
      type: "execution",
      message: error.message,
      details: error.stack,
      recoverable: false,
    };
  }

  private updateSessionProgress(
    session: BenchmarkSession,
    result: TestCaseResult,
    currentIndex: number,
    totalTests: number,
    model: ILLM,
  ): void {
    // Update session progress
    session.progress.completedTestCases++;
    if (result.status === "failed") {
      session.progress.failedTestCases++;
    }
    session.progress.currentTestCase = result.testCaseId;

    this.logger.info(
      `Progress: ${currentIndex}/${totalTests} test cases completed for model ${model.uniqueId}`,
    );
  }

  /**
   * Loads content from a file path, returns empty string if not found.
   */
  static loadFileContent(filePath: string): string {
    if (!filePath || filePath.trim() === "") {
      return "";
    }

    try {
      const fullPath = join(process.cwd(), filePath);
      return readFileSync(fullPath, "utf-8");
    } catch (error) {
      return "";
    }
  }

  /**
   * Extracts code blocks from LLM response, handling markdown and explanatory text.
   * Enhanced to detect both standalone code and diff patches.
   */
  static extractCodeFromResponse(response: string): string {
    const codeBlocks: string[] = [];
    
    // First, try to extract diff patches
    const diffContent = this.extractDiffFromResponse(response);
    if (diffContent) {
      return diffContent;
    }
    
    // Match code blocks with language specifiers
    const codeBlockRegex = /```(?:javascript|js|typescript|ts|python|java|cpp|c\+\+|c|go|rust|diff)?\s*\n?([\s\S]*?)\n?```/gi;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const codeContent = match[1].trim();
      if (codeContent) {
        codeBlocks.push(codeContent);
      }
    }
    
    // Fallback patterns for non-markdown code
    if (codeBlocks.length === 0) {
      const patterns = [
        /(?:here'?s?|is|the)\s+(?:the\s+)?(?:function|code|implementation|solution)(?:\s+(?:for|that))?[:\s]*\n((?:function|class|const|let|var|def|public|private|import|from|#include)[\s\S]*)/i,
        /(?:implementation|solution|code)[:\s]*\n((?:function|class|const|let|var|def|public|private|import|from|#include)[\s\S]*)/i,
      ];
      
      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          codeBlocks.push(match[1].trim());
          break;
        }
      }
    }
    
    return codeBlocks.join('\n\n').trim();
  }

  /**
   * Extracts diff patches from LLM response
   */
  static extractDiffFromResponse(response: string): string | null {
    // Look for diff patterns
    const diffPatterns = [
      // Match full diff blocks with proper headers
      /```(?:diff|patch)?\s*\n?((?:diff --git[\s\S]*?|\-\-\-[\s\S]*?\+\+\+[\s\S]*?)(?:```|$))/gi,
      // Match diff without code blocks
      /(diff --git [\s\S]*?)(?:\n\n|\n(?![@\-\+\s]))/gi,
      // Match simple diff format
      /(\-\-\- [\s\S]*?\+\+\+ [\s\S]*?)(?:\n\n|\n(?![@\-\+\s]))/gi,
    ];
    
    for (const pattern of diffPatterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        const diffContent = match[1].replace(/```$/, '').trim();
        if (this.isDiffPatch(diffContent)) {
          return diffContent;
        }
      }
    }
    
    return null;
  }

  /**
   * Checks if the given content is a valid diff patch
   */
  static isDiffPatch(content: string): boolean {
    // Check for diff headers
    const diffMarkers = [
      /^diff --git/m,
      /^--- /m,
      /^\+\+\+ /m,
      /^@@ -\d+,\d+ \+\d+,\d+ @@/m
    ];
    
    return diffMarkers.some(marker => marker.test(content));
  }
}
