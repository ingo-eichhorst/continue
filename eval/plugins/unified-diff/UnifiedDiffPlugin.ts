import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  ChatMessage,
  ExecutionEnvironment,
  LLMRequest,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  ValidationResult,
} from "../../core/types.js";

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


  private buildLLMRequest(
    testCase: TestCase,
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

${modificationPrompt}`,
      },
    ];

    const llmRequest: LLMRequest = {
      model: model.uniqueId,
      messages,
      timestamp: new Date(),
    };

    return { messages, llmRequest };
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
        passed: true,
        details: "Diff applied successfully",
      });

      return { success: true, appliedCode, error: "" };
    } catch (error) {
      const errorMessage = (error as Error).message;
      validationResults.push({
        passed: false,
        details: `Diff application failed: ${errorMessage}`,
      });

      return { success: false, appliedCode: "", error: errorMessage };
    }
  }

  private async runUnitTests(
    appliedCode: string,
    testCase: TestCase,
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
      passed,
      details: passed
        ? `Unit test passed: ${testResult.stdout}`
        : `Unit test failed: ${testResult.stderr}`,
    });
  }

  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
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

    // Get system prompt from properties
    const systemPrompt =
      context.properties.systemPrompt ||
      this.propertiesSchema.systemPrompt.default;

    // Build and execute LLM request
    const { messages, llmRequest } = this.buildLLMRequest(
      testCase,
      systemPrompt,
      context.model,
    );

    const { content, latency } = await TestCaseExecutor.executeLLMRequest(
      messages,
      context.model,
    );

    // Record LLM response
    const llmResponse = { content, latency, timestamp: new Date() };

    // Run validation pipeline
    const { validationResults, executionResult, metrics } =
      await this.runValidationPipeline(sourceCode, content, testCase, context);

    return {
      llmRequest,
      llmResponse,
      validationResults,
      executionResult,
      metrics,
    };
  }

  private async runValidationPipeline(
    sourceCode: string,
    diffContent: string,
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<{
    validationResults: ValidationResult[];
    executionResult: any;
    metrics: any;
  }> {
    const validationResults: ValidationResult[] = [];
    const testCaseId = testCase.id;

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

      const executionResult = {
        stdout: "",
        stderr: "Generated content is not a valid unified diff",
        exitCode: 1,
        successful: false,
      };

      const metrics = TestCaseExecutor.buildBaseMetrics(validationResults, {
        formatValid: isValidFormat ? 1 : 0,
        applySuccess: 0,
      });

      return { validationResults, executionResult, metrics };
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
    if (applySuccess && testCase.expected?.unitTest) {
      await this.runUnitTests(
        appliedCode,
        testCase,
        validationResults,
        context.executionEnvironment,
        context.logger,
      );
      context.logger.debug(`[${testCaseId}] Unit tests completed`);
    }

    // Step 5: Build results
    const executionResult = {
      stdout: applySuccess ? "Diff applied successfully" : "",
      stderr: applyError,
      exitCode: applySuccess ? 0 : 1,
      successful: applySuccess,
    };

    const metrics = TestCaseExecutor.buildBaseMetrics(validationResults, {
      formatValid: isValidFormat ? 1 : 0,
      applySuccess: applySuccess ? 1 : 0,
    });

    context.logger.debug(
      `[${testCaseId}] Pipeline completed: ${validationResults.filter((r) => r.passed).length}/${validationResults.length} steps passed`,
    );

    return { validationResults, executionResult, metrics };
  }
}
