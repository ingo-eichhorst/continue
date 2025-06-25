import {
  BenchmarkContext,
  BenchmarkPlugin,
  BenchmarkResult,
  ChatMessage,
  ExecutionEnvironment,
  LLMRequest,
  LLMResponse,
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

// Import Continue's actual diff functions (local copy)
import {
  applyUnifiedDiff,
  isUnifiedDiffFormat,
} from "../../../core/edit/lazy/unifiedDiffApply.js";

export class UnifiedDiffPlugin implements BenchmarkPlugin {
  name = "unified-diff-testing";
  description =
    "Evaluates quality of generated unified diffs and their application success";

  propertiesSchema = {
    systemPrompt: {
      type: "string" as const,
      required: false,
      default:
        "You are a helpful assistant that generates unified diffs. Generate only the unified diff without any additional explanation or markdown formatting.",
      description: "System prompt for LLM when generating diffs",
    },
  };

  defaultDataset = "datasets/diff-dataset";

  async execute(context: BenchmarkContext): Promise<BenchmarkResult> {
    const { models, dataset, session, properties, logger } = context;
    const systemPrompt =
      properties.systemPrompt || this.propertiesSchema.systemPrompt.default;

    logger.info(
      `Starting unified diff benchmark with ${models.length} models and ${dataset.testCases.length} test cases`,
    );

    const testCases: TestCaseResult[] = [];
    let currentTestIndex = 0;

    // TODO: The looping logic should move to the BenchmarkEngine.
    //       A BenchmarkPlugin execution should always have exactly one model.
    for (const model of models) {
      logger.info(`Testing model: ${model.uniqueId}`);

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
          `Progress: ${currentTestIndex}/${session.progress.totalTestCases} test cases completed`,
        );
      }
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
    const { logger } = context;

    logger.debug(`executeTestCase called for ${testCase.id}`);
    logger.debug(
      `Source code preview (first 200 chars):`,
      sourceCode?.substring(0, 200),
    );
    logger.debug(`Modification prompt:`, modificationPrompt);

    if (!sourceCode) {
      throw new Error(`No source code provided for test case ${testCase.id}`);
    }
    if (!modificationPrompt) {
      throw new Error(
        `No modification prompt provided for test case ${testCase.id}`,
      );
    }

    // Prepare messages for LLM
    const messages: ChatMessage[] = [
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

    logger.debug(`Prepared ${messages.length} messages for LLM`);
    logger.debug(
      `Message content length: ${messages[0].content.length} characters`,
    );

    // Record LLM request
    const llmRequest: LLMRequest = {
      model: model.uniqueId,
      messages,
      systemPrompt,
      timestamp: new Date(),
    };
    result.llmRequest = llmRequest;
    logger.debug(`LLM request prepared with model: ${model.uniqueId}`);

    try {
      logger.debug(`LLM request for test case ${testCase.id}`);

      // Make LLM request
      const startTime = Date.now();
      const abortController = new AbortController();
      logger.debug(`Making streamChat request to model ${model.uniqueId}`);

      const response = await model.streamChat(
        messages,
        abortController.signal,
        { systemMessage: systemPrompt, maxTokens: 4000 },
      );

      const latency = Date.now() - startTime;
      logger.debug(`LLM response received in ${latency}ms`);

      let content = "";
      let chunkCount = 0;

      // Collect streaming response
      for await (const chunk of response) {
        chunkCount++;
        if (chunk.content) {
          content += chunk.content;
        }
      }

      logger.debug(
        `Streaming complete. Total chunks: ${chunkCount}, final content length: ${content.length}`,
      );

      // Record LLM response
      const llmResponse: LLMResponse = {
        content: content.trim(),
        latency,
        timestamp: new Date(),
      };
      result.llmResponse = llmResponse;

      logger.debug(
        `Starting validation and diff application for test case ${testCase.id}`,
      );

      // Validate and apply the diff
      await this.validateAndApplyDiff(
        sourceCode,
        content.trim(),
        testCase,
        result,
        logger,
        context.executionEnvironment,
      );

      logger.debug(`Test case ${testCase.id} completed successfully`);
    } catch (error) {
      logger.error(`Test case ${testCase.id} failed:`, error as Error);
      throw error;
    }
  }

  private async validateAndApplyDiff(
    sourceCode: string,
    diffContent: string,
    testCase: UnifiedDiffTestCase,
    result: TestCaseResult,
    logger: any,
    executionEnvironment: ExecutionEnvironment,
  ): Promise<void> {
    logger.debug(`validateAndApplyDiff called for test case ${testCase.id}`);
    logger.debug(`Diff content length: ${diffContent.length}`);
    logger.debug(
      `Diff content preview (first 300 chars):`,
      diffContent.substring(0, 300),
    );

    // 0. Remove "```diff" from start and "```" ending if it's there
    let cleanedDiffContent = diffContent.trim();
    if (cleanedDiffContent.startsWith("```diff")) {
      cleanedDiffContent = cleanedDiffContent.substring(7);
    } else if (cleanedDiffContent.startsWith("```")) {
      cleanedDiffContent = cleanedDiffContent.substring(3);
    }
    if (cleanedDiffContent.endsWith("```")) {
      cleanedDiffContent = cleanedDiffContent.substring(
        0,
        cleanedDiffContent.length - 3,
      );
    }
    cleanedDiffContent = cleanedDiffContent.trim();

    // 1. Validate diff format
    const validationResults: ValidationResult[] = [];
    logger.debug(`Validating diff format...`);
    const isValidFormat = isUnifiedDiffFormat(cleanedDiffContent);
    logger.debug(`Diff format validation result: ${isValidFormat}`);
    validationResults.push({
      type: "format",
      passed: isValidFormat,
      details: isValidFormat
        ? "Valid unified diff format"
        : "Invalid unified diff format",
    });

    if (!isValidFormat) {
      logger.warn(`Invalid diff format for test case ${testCase.id}`);
      result.validationResults = validationResults;
      result.error = {
        type: "validation",
        message: "Generated content is not a valid unified diff",
        details: `Content: ${cleanedDiffContent.substring(0, 200)}...`,
        recoverable: true,
      };
      return;
    }

    // 2. Attempt to apply the diff
    logger.debug(`Attempting to apply diff...`);
    let applySuccess = false;
    let appliedCode = "";
    let applyError = "";

    try {
      logger.info(`Source Code: ${sourceCode}`);
      logger.info(`Diff Content: ${cleanedDiffContent}`);
      const diffLines = applyUnifiedDiff(sourceCode, cleanedDiffContent);
      appliedCode = diffLines.map((line) => line.line).join("\n");
      applySuccess = true;

      logger.debug(
        `Diff applied successfully. Applied code length: ${appliedCode.length}`,
      );
      logger.debug(
        `Applied code preview (first 300 chars):`,
        appliedCode.substring(0, 300),
      );

      validationResults.push({
        type: "application",
        passed: true,
        details: "Diff applied successfully",
      });
    } catch (error) {
      applyError = (error as Error).message;
      logger.error(
        `Diff application failed for test case ${testCase.id}:`,
        error,
      );

      validationResults.push({
        type: "application",
        passed: false,
        details: `Diff application failed: ${applyError}`,
      });
    }

    // 4. TODO: Run Test Case
    const testResult = await executionEnvironment.runTest(
      testCase.expected?.unitTest || "",
      appliedCode,
      testCase.metadata?.language,
    );
    logger.info(`Test result for ${testCase.id}:`, testResult);

    if (testResult.exitCode === 0) {
      validationResults.push({
        type: "application",
        passed: true,
        details: `Unit test passed: ${testResult.stdout}`,
      });
    } else {
      validationResults.push({
        type: "application",
        passed: false,
        details: `Unit test failed: ${testResult.stderr}`,
      });
    }

    // Store additional metadata
    result.executionResult = {
      stdout: applySuccess ? "Diff applied successfully" : "",
      stderr: applyError,
      exitCode: applySuccess ? 0 : 1,
      successful: applySuccess,
    };

    // Calculate test case metrics
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

    logger.debug(`Test case ${testCase.id} metrics:`, result.metrics);
  }
}
