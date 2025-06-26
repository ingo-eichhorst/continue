import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  ChatMessage,
  ExecutionEnvironment,
  LLMRequest,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  TestStepResult,
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
    testStepResults: TestStepResult[],
  ): boolean {
    const isValid = isUnifiedDiffFormat(cleanedDiff);
    testStepResults.push({
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
    testStepResults: TestStepResult[],
  ): Promise<{ success: boolean; appliedCode: string; error: string }> {
    try {
      const diffLines = applyUnifiedDiff(sourceCode, cleanedDiff);
      const appliedCode = diffLines.map((line) => line.line).join("\n");

      testStepResults.push({
        passed: true,
        details: "Diff applied successfully",
      });

      return { success: true, appliedCode, error: "" };
    } catch (error) {
      const errorMessage = (error as Error).message;
      testStepResults.push({
        passed: false,
        details: `Diff application failed: ${errorMessage}`,
      });

      return { success: false, appliedCode: "", error: errorMessage };
    }
  }

  private async runUnitTests(
    appliedCode: string,
    testCase: TestCase,
    testStepResults: TestStepResult[],
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
    testStepResults.push({
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

    // Properties are validated and populated by BenchmarkEngine
    const systemPrompt = context.properties.systemPrompt;

    // Build and execute LLM request
    const { messages } = this.buildLLMRequest(
      testCase,
      systemPrompt,
      context.model,
    );

    const llmStepResult = await TestCaseExecutor.executeLLMRequest(
      messages,
      context.model,
    );

    const content = llmStepResult.llmResponse?.content || "";

    // Run validation pipeline with LLM data
    const { testStepResults, executionResult, metrics } =
      await this.runValidationPipeline(sourceCode, content, testCase, context, llmStepResult);

    return {
      testStepResults,
      executionResult,
      metrics,
    };
  }

  private async runValidationPipeline(
    sourceCode: string,
    diffContent: string,
    testCase: TestCase,
    context: TestExecutionContext,
    llmStepResult: TestStepResult,
  ): Promise<TestCaseExecution> {
    const testStepResults: TestStepResult[] = [];
    const testCaseId = testCase.id;

    context.logger.debug(`[${testCaseId}] Starting validation pipeline`);

    // Step 1: LLM Generation - use the passed LLM step result
    testStepResults.push(llmStepResult);
    context.logger.debug(`[${testCaseId}] LLM generation completed`);

    // Step 2: Clean diff content
    const cleanedDiff = this.cleanDiffContent(diffContent);
    context.logger.debug(
      `[${testCaseId}] Content cleaned: ${cleanedDiff.length} chars`,
    );

    // Step 3: Validate format
    const isValidFormat = this.validateDiffFormat(
      cleanedDiff,
      testStepResults,
    );
    if (!isValidFormat) {
      context.logger.debug(`[${testCaseId}] Format validation failed`);

      // Add format validation as a score
      const formatStep = testStepResults.find(step => step.details?.includes("unified diff format"));
      if (formatStep) {
        formatStep.score = isValidFormat ? 1 : 0;
      }

      const execution = TestCaseExecutor.completeTestCase(testStepResults);

      // Override stderr for validation failure
      if (execution.executionResult) {
        execution.executionResult.stderr = "Generated content is not a valid unified diff";
      }

      return execution;
    }
    context.logger.debug(`[${testCaseId}] Format validation passed`);

    // Step 4: Apply diff
    const {
      success: applySuccess,
      appliedCode,
      error: applyError,
    } = await this.applyDiff(sourceCode, cleanedDiff, testStepResults);
    context.logger.debug(
      `[${testCaseId}] Diff application: ${applySuccess ? "succeeded" : "failed"}`,
    );

    // Step 5: Run unit tests (if applicable)
    if (applySuccess && testCase.expected?.unitTest) {
      await this.runUnitTests(
        appliedCode,
        testCase,
        testStepResults,
        context.executionEnvironment,
        context.logger,
      );
      context.logger.debug(`[${testCaseId}] Unit tests completed`);
    }

    // Step 5: Add metrics as scores to relevant steps
    const formatStep = testStepResults.find(step => step.details?.includes("unified diff format"));
    if (formatStep) {
      formatStep.score = isValidFormat ? 1 : 0;
    }

    const applyStep = testStepResults.find(step => step.details?.includes("Diff application") || step.details?.includes("Diff applied"));
    if (applyStep) {
      applyStep.score = applySuccess ? 1 : 0;
    }

    // Build results using TestCaseExecutor utility
    context.logger.debug(
      `[${testCaseId}] Pipeline completed: ${testStepResults.filter((r) => r.passed).length}/${testStepResults.length} steps passed`,
    );

    const execution = TestCaseExecutor.completeTestCase(testStepResults);

    // Override stdout/stderr for diff-specific messaging
    if (execution.executionResult) {
      execution.executionResult.stdout = applySuccess ? "Diff applied successfully" : "";
      execution.executionResult.stderr = applyError;
    }

    return execution;
  }
}
