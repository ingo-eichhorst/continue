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

/**
 * Evaluates LLM-generated unified diffs through format validation, application testing, and optional unit tests.
 */
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

  /**
   * Builds the LLM request with source code and modification instructions.
   */
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

  /**
   * Removes markdown code block formatting from LLM-generated diff content.
   */
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

  /**
   * Validates that the diff content conforms to unified diff format specification.
   */
  private executeFormatValidationStep(cleanedDiff: string): TestStepResult {
    const isValid = isUnifiedDiffFormat(cleanedDiff);
    return {
      passed: isValid,
      score: isValid ? 1 : 0,
      details: isValid
        ? "Valid unified diff format"
        : "Invalid unified diff format",
    };
  }

  /**
   * Applies the validated unified diff to the original source code.
   */
  private async executeDiffApplicationStep(
    sourceCode: string,
    cleanedDiff: string,
  ): Promise<TestStepResult & { appliedCode?: string }> {
    try {
      const diffLines = applyUnifiedDiff(sourceCode, cleanedDiff);
      const appliedCode = diffLines.map((line) => line.line).join("\n");

      return {
        passed: true,
        score: 1,
        details: "Diff applied successfully",
        appliedCode,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      return {
        passed: false,
        score: 0,
        details: `Diff application failed: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Runs unit tests against the code that resulted from applying the diff.
   */
  private async executeUnitTestStep(
    appliedCode: string,
    testCase: TestCase,
    executionEnvironment: ExecutionEnvironment,
    logger: any,
  ): Promise<TestStepResult> {
    if (!testCase.expected?.unitTest) {
      return {
        passed: true,
        score: 1,
        details: "No unit test specified - skipped",
      };
    }

    logger.debug(
      `Running unit test for ${testCase.id}: ${testCase.expected.unitTest}`,
    );
    logger.debug(`Applied code: ${appliedCode}`);

    try {
      const testResult = await executionEnvironment.runTest(
        testCase.expected.unitTest,
        appliedCode,
        testCase.metadata?.language,
      );

      logger.debug(`Unit test result for ${testCase.id}:`, testResult);

      const passed = testResult.exitCode === 0;
      return {
        passed,
        score: passed ? 1 : 0,
        details: passed
          ? `Unit test passed: ${testResult.stdout}`
          : `Unit test failed: ${testResult.stderr}`,
        error: passed ? undefined : testResult.stderr,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      return {
        passed: false,
        score: 0,
        details: `Unit test execution failed: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Orchestrates the complete diff testing workflow: LLM generation, format validation, diff application, and optional unit testing.
   */
  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
    const sourceCode = testCase.input.sourceCode;
    const modificationPrompt = testCase.input.prompt;

    // Validate inputs
    if (!sourceCode) {
      throw new Error(`No source code provided for test case ${testCase.id}`);
    }
    if (!modificationPrompt) {
      throw new Error(
        `No modification prompt provided for test case ${testCase.id}`,
      );
    }

    const systemPrompt = context.properties.systemPrompt;
    const testStepResults: TestStepResult[] = [];

    // Step 1: LLM Generation
    const { messages } = this.buildLLMRequest(
      testCase,
      systemPrompt,
      context.model,
    );

    const llmStepResult = await TestCaseExecutor.executeLLMRequest(
      messages,
      context.model,
    );
    testStepResults.push(llmStepResult);

    const content = llmStepResult.llmResponse?.content || "";

    // Step 2: Clean diff content (pure function)
    const cleanedDiff = this.cleanDiffContent(content);
    context.logger.debug(
      `[${testCase.id}] Content cleaned: ${cleanedDiff.length} chars`,
    );

    // Step 3: Format validation
    const formatStep = this.executeFormatValidationStep(cleanedDiff);
    testStepResults.push(formatStep);

    if (!formatStep.passed) {
      context.logger.debug(`[${testCase.id}] Format validation failed`);
      return TestCaseExecutor.completeTestCase(testStepResults);
    }
    context.logger.debug(`[${testCase.id}] Format validation passed`);

    // Step 4: Apply diff
    const applyStep = await this.executeDiffApplicationStep(
      sourceCode,
      cleanedDiff,
    );
    testStepResults.push(applyStep);

    if (!applyStep.passed) {
      context.logger.debug(`[${testCase.id}] Diff application failed`);
      return TestCaseExecutor.completeTestCase(testStepResults);
    }
    context.logger.debug(`[${testCase.id}] Diff application succeeded`);

    // Step 5: Unit tests (if applicable and diff was applied successfully)
    if (applyStep.appliedCode && testCase.expected?.unitTest) {
      const unitTestStep = await this.executeUnitTestStep(
        applyStep.appliedCode,
        testCase,
        context.executionEnvironment,
        context.logger,
      );
      testStepResults.push(unitTestStep);
      context.logger.debug(`[${testCase.id}] Unit tests completed`);
    }

    context.logger.debug(
      `[${testCase.id}] Pipeline completed: ${testStepResults.filter((r) => r.passed).length}/${testStepResults.length} steps passed`,
    );

    return TestCaseExecutor.completeTestCase(testStepResults);
  }
}
