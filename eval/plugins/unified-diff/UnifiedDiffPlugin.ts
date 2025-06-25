import {
  BenchmarkContext,
  BenchmarkPlugin,
  BenchmarkResult,
  ChatMessage,
  ExecutionEnvironment,
  LLMRequest,
  TestCase,
  TestCaseResult,
  TestExpected,
  TestInput,
  ValidationResult,
} from "../../core/types.js";

// Plugin-specific types
interface UnifiedDiffTestCase extends TestCase {
  input: TestInput & { sourceCode: string; modificationPrompt: string };
  expected?: TestExpected & {
    diffShouldApply: boolean;
    expectedChanges?: string[];
  };
}

interface ValidationContext {
  testCase: UnifiedDiffTestCase;
  result: TestCaseResult;
  logger: any;
  executionEnvironment: ExecutionEnvironment;
}

// Import Continue's actual diff functions (local copy)
import {
  applyUnifiedDiff,
  isUnifiedDiffFormat,
} from "../../../core/edit/lazy/unifiedDiffApply.js";

export class UnifiedDiffPlugin implements BenchmarkPlugin {
  name = "unified-diff-testing";
  description =
    "Evaluates quality of generated unified diffs and their application success";

  // Constants
  private static readonly DEFAULT_SYSTEM_PROMPT =
    "You are a helpful assistant that generates unified diffs. Generate only the unified diff without any additional explanation or markdown formatting.";
  private static readonly MAX_TOKENS = 4000;
  private static readonly VALIDATION_TYPES = {
    FORMAT: "format",
    APPLICATION: "application",
    EXECUTION: "execution",
    METRICS: "metrics",
  } as const;

  propertiesSchema = {
    systemPrompt: {
      type: "string" as const,
      required: false,
      default: UnifiedDiffPlugin.DEFAULT_SYSTEM_PROMPT,
      description: "System prompt for LLM when generating diffs",
    },
  };

  defaultDataset = "datasets/diff-dataset";

  async execute(context: BenchmarkContext): Promise<BenchmarkResult> {
    const { model, dataset, session, properties, logger } = context;
    const systemPrompt =
      properties.systemPrompt || this.propertiesSchema.systemPrompt.default;

    logger.info(
      `Starting unified diff benchmark for model ${model.uniqueId} with ${dataset.testCases.length} test cases`,
    );

    const testCases: TestCaseResult[] = [];
    let currentTestIndex = 0;

    for (const testCase of dataset.testCases) {
      const testCaseId = `${testCase.id}-${model.uniqueId}`;
      logger.debug(
        `Processing test case: ${testCase.id}, full testCaseId: ${testCaseId}`,
      );

      // Check if this test case was already completed (session recovery)
      const existingResult = session.results?.find(
        (r) => r.testCaseId === testCaseId && r.status === "completed",
      );

      // TODO: The BenchmarkEngine should provide only the missing tests
      //       to the Benchmark Plugin to keep the implementation simple.
      if (existingResult) {
        testCases.push(existingResult);
        logger.debug(`Skipping completed test case: ${testCaseId}`);
        continue;
      }

      const startTime = new Date();
      logger.debug(
        `Processing test case: ${testCase.id} with model: ${model.title} at ${startTime.toISOString()}`,
      );

      const result: TestCaseResult = {
        testCaseId,
        modelId: model.uniqueId,
        status: "running",
        startTime,
      };

      try {
        // Execute the test case
        await this.executeTestCase(
          testCase as UnifiedDiffTestCase,
          model,
          systemPrompt,
          result,
          context,
        );

        result.status = "completed";
        result.endTime = new Date();
        result.duration = result.endTime.getTime() - startTime.getTime();
        logger.debug(
          `Test case ${testCaseId} completed successfully in ${result.duration}ms`,
        );
      } catch (error) {
        logger.error(`Test case ${testCaseId} failed:`, error as Error);

        result.status = "failed";
        result.endTime = new Date();
        result.duration = result.endTime
          ? result.endTime.getTime() - startTime.getTime()
          : 0;
        result.error = {
          type: "execution",
          message: (error as Error).message,
          details: (error as Error).stack,
          recoverable: false,
        };
      }

      testCases.push(result);

      // TODO: This logic should live in the metrics collector
      // Update session progress
      session.progress.completedTestCases++;
      if (result.status === "failed") {
        session.progress.failedTestCases++;
      }
      session.progress.currentTestCase = testCaseId;

      currentTestIndex++;
      logger.info(
        `Progress: ${currentTestIndex}/${dataset.testCases.length} test cases completed for model ${model.uniqueId}`,
      );
    }

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
      pluginName: this.name,
      sessionId: session.id,
      testCases,
      metrics: {
        functional: {
          totalTests: testCases.length,
          passedTests: completedTestCases,
          failedTests: failedTestCases,
          successRate: successRate,
        },
        // TODO
        performance: {
          averageLatency: 0,
          medianLatency: 0,
          p95Latency: 0,
          totalTokens: 0,
          averageTokensPerRequest: 0,
        },
        // TODO
        quality: { syntaxCorrectness: 0, compilationSuccess: 0 },
      },
      // TODO
      summary: { overallScore: 0, recommendations: [], insights: [] },

      startTime: session.startTime,
      endTime,
      duration: totalDuration,
    };
  }

  private buildLLMRequest(
    testCase: UnifiedDiffTestCase,
    systemPrompt: string,
    model: any,
  ): { messages: ChatMessage[]; llmRequest: LLMRequest } {
    const sourceCode = testCase.input.sourceCode;
    const modificationPrompt =
      testCase.input.additionalData?.modificationPrompt ||
      testCase.input.prompt;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Here is the source code:

\`\`\`
${sourceCode}
\`\`\`

${modificationPrompt}

Please generate a unified diff that applies this modification to the source code. Return only the unified diff without any additional explanation.`,
      },
    ];

    const llmRequest: LLMRequest = {
      model: model.uniqueId,
      messages,
      timestamp: new Date(),
    };

    return { messages, llmRequest };
  }

  private async executeLLMRequest(
    messages: ChatMessage[],
    model: any,
  ): Promise<{ content: string; latency: number }> {
    const startTime = Date.now();
    const abortController = new AbortController();

    const response = await model.streamChat(messages, abortController.signal, {
      maxTokens: UnifiedDiffPlugin.MAX_TOKENS,
    });

    let content = "";
    for await (const chunk of response) {
      if (chunk.content) {
        content += chunk.content;
      }
    }

    const latency = Date.now() - startTime;
    return { content: content.trim(), latency };
  }

  private cleanDiffContent(diffContent: string): string {
    let cleaned = diffContent.trim();
    if (cleaned.startsWith("```diff")) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  }

  private validateDiffFormat(
    cleanedDiff: string,
    validationResults: ValidationResult[],
  ): boolean {
    const isValid = isUnifiedDiffFormat(cleanedDiff);
    validationResults.push({
      type: UnifiedDiffPlugin.VALIDATION_TYPES.FORMAT,
      passed: isValid,
      details: isValid
        ? "Valid unified diff format"
        : "Invalid unified diff format",
    });
    return isValid;
  }

  private async applyDiff(
    sourceCode: string,
    cleanedDiff: string,
    validationResults: ValidationResult[],
  ): Promise<{ success: boolean; appliedCode: string; error: string }> {
    try {
      const diffLines = applyUnifiedDiff(sourceCode, cleanedDiff);
      const appliedCode = diffLines.map((line) => line.line).join("\n");

      validationResults.push({
        type: UnifiedDiffPlugin.VALIDATION_TYPES.APPLICATION,
        passed: true,
        details: "Diff applied successfully",
      });

      return { success: true, appliedCode, error: "" };
    } catch (error) {
      const errorMessage = (error as Error).message;
      validationResults.push({
        type: UnifiedDiffPlugin.VALIDATION_TYPES.APPLICATION,
        passed: false,
        details: `Diff application failed: ${errorMessage}`,
      });

      return { success: false, appliedCode: "", error: errorMessage };
    }
  }

  private async runUnitTests(
    appliedCode: string,
    testCase: UnifiedDiffTestCase,
    validationResults: ValidationResult[],
    executionEnvironment: ExecutionEnvironment,
    logger: any,
  ): Promise<void> {
    if (!testCase.expected?.unitTest) {
      return;
    }

    logger.debug(
      `Running unit test for ${testCase.id}: ${testCase.expected.unitTest}`,
    );
    logger.debug(`Applied code: ${appliedCode}`);

    const testResult = await executionEnvironment.runTest(
      testCase.expected.unitTest,
      appliedCode,
      testCase.metadata?.language,
    );

    logger.debug(`Unit test result for ${testCase.id}:`, testResult);

    const passed = testResult.exitCode === 0;
    validationResults.push({
      type: UnifiedDiffPlugin.VALIDATION_TYPES.EXECUTION,
      passed,
      details: passed
        ? `Unit test passed: ${testResult.stdout}`
        : `Unit test failed: ${testResult.stderr}`,
    });
  }

  private calculateMetrics(
    result: TestCaseResult,
    validationResults: ValidationResult[],
    isValidFormat: boolean,
    applySuccess: boolean,
  ): void {
    const overallQuality =
      validationResults.length > 0
        ? validationResults.filter((r) => r.passed).length /
          validationResults.length
        : 0;

    result.metrics = {
      latency: result.llmResponse?.latency || 0,
      tokens: {
        prompt: result.llmResponse?.usage?.promptTokens || 0,
        completion: result.llmResponse?.usage?.completionTokens || 0,
        total: result.llmResponse?.usage?.totalTokens || 0,
      },
      qualityScores: {
        formatValid: isValidFormat ? 1 : 0,
        applySuccess: applySuccess ? 1 : 0,
        overallQuality,
      },
    };
  }

  private async validateDiffPipeline(
    sourceCode: string,
    diffContent: string,
    context: ValidationContext,
  ): Promise<void> {
    const validationResults: ValidationResult[] = [];
    const testCaseId = context.testCase.id;

    context.logger.debug(`[${testCaseId}] Starting validation pipeline`);

    // Step 1: Clean diff content
    const cleanedDiff = this.cleanDiffContent(diffContent);
    context.logger.debug(
      `[${testCaseId}] Content cleaned: ${cleanedDiff.length} chars`,
    );

    // Step 2: Validate format
    const isValidFormat = this.validateDiffFormat(
      cleanedDiff,
      validationResults,
    );
    if (!isValidFormat) {
      context.logger.debug(`[${testCaseId}] Format validation failed`);
      context.result.validationResults = validationResults;
      context.result.error = {
        type: "validation",
        message: "Generated content is not a valid unified diff",
        details: `Content: ${cleanedDiff.substring(0, 200)}...`,
        recoverable: true,
      };
      return;
    }
    context.logger.debug(`[${testCaseId}] Format validation passed`);

    // Step 3: Apply diff
    const {
      success: applySuccess,
      appliedCode,
      error: applyError,
    } = await this.applyDiff(sourceCode, cleanedDiff, validationResults);
    context.logger.debug(
      `[${testCaseId}] Diff application: ${applySuccess ? "succeeded" : "failed"}`,
    );

    // Step 4: Run unit tests (if applicable)
    if (applySuccess && context.testCase.expected?.unitTest) {
      await this.runUnitTests(
        appliedCode,
        context.testCase,
        validationResults,
        context.executionEnvironment,
        context.logger,
      );
      context.logger.debug(`[${testCaseId}] Unit tests completed`);
    }

    // Step 5: Store results and calculate metrics
    context.result.validationResults = validationResults;
    context.result.executionResult = {
      stdout: applySuccess ? "Diff applied successfully" : "",
      stderr: applyError,
      exitCode: applySuccess ? 0 : 1,
      successful: applySuccess,
    };

    this.calculateMetrics(
      context.result,
      validationResults,
      isValidFormat,
      applySuccess,
    );
    context.logger.debug(
      `[${testCaseId}] Pipeline completed: ${validationResults.filter((r) => r.passed).length}/${validationResults.length} steps passed`,
    );
  }

  private async executeTestCase(
    testCase: UnifiedDiffTestCase,
    model: any,
    systemPrompt: string,
    result: TestCaseResult,
    context: BenchmarkContext,
  ): Promise<void> {
    const sourceCode = testCase.input.sourceCode;
    const modificationPrompt =
      testCase.input.additionalData?.modificationPrompt ||
      testCase.input.prompt;

    // Validate inputs
    if (!sourceCode) {
      throw new Error(`No source code provided for test case ${testCase.id}`);
    }
    if (!modificationPrompt) {
      throw new Error(
        `No modification prompt provided for test case ${testCase.id}`,
      );
    }

    // Build and execute LLM request
    const { messages, llmRequest } = this.buildLLMRequest(
      testCase,
      systemPrompt,
      model,
    );
    result.llmRequest = llmRequest;

    const { content, latency } = await this.executeLLMRequest(messages, model);

    // Record LLM response
    result.llmResponse = { content, latency, timestamp: new Date() };

    // Create validation context and run pipeline
    const validationContext: ValidationContext = {
      testCase,
      result,
      logger: context.logger,
      executionEnvironment: context.executionEnvironment,
    };

    await this.validateDiffPipeline(sourceCode, content, validationContext);
  }
}
