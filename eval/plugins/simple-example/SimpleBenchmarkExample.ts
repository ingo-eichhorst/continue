import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  ValidationResult,
} from "../../core/types.js";

export class SimpleBenchmarkExample implements BenchmarkPlugin {
  name = "simple-example";
  description =
    "A simple benchmark that sends prompts to LLM and validates responses";

  propertiesSchema = {
    systemPrompt: {
      type: "string" as const,
      required: false,
      default:
        "You are a helpful assistant. Please respond to the user's question clearly and concisely.",
      description: "System prompt for the LLM",
    },
  };

  defaultDataset = "datasets/simple-demo-dataset";


  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
    // Get system prompt from properties
    const systemPrompt =
      context.properties.systemPrompt ||
      this.propertiesSchema.systemPrompt.default;

    // Build LLM request
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: testCase.input.prompt },
    ];

    // Execute LLM request using TestCaseExecutor utility
    const { content, latency } = await TestCaseExecutor.executeLLMRequest(
      messages,
      context.model,
    );

    // Simple validation: check if response is not empty
    const validationResults: ValidationResult[] = [
      {
        passed: content.length > 0,
        details:
          content.length > 0
            ? "Response generated successfully"
            : "Empty response from LLM",
      },
    ];

    // If expected output is provided, validate against it
    if (testCase.expected?.output) {
      const expectedOutput = testCase.expected.output;
      const containsExpected = content
        .toLowerCase()
        .includes(expectedOutput.toLowerCase());

      validationResults.push({
        passed: containsExpected,
        details: containsExpected
          ? `Response contains expected content: "${expectedOutput}"`
          : `Response does not contain expected content: "${expectedOutput}"`,
      });
    }

    // Build metrics using TestCaseExecutor utility
    const metrics = TestCaseExecutor.buildBaseMetrics(validationResults, {
      responseLength: content.length,
      hasExpectedContent: testCase.expected?.output
        ? content.toLowerCase().includes(testCase.expected.output.toLowerCase())
          ? 1
          : 0
        : 1,
    });

    const llmRequest = {
      model: context.model.uniqueId,
      messages,
      timestamp: new Date(),
    };

    const llmResponse = { content, latency, timestamp: new Date() };

    const executionResult = {
      stdout: content,
      stderr: "",
      exitCode: validationResults.every((vr) => vr.passed) ? 0 : 1,
      successful: validationResults.every((vr) => vr.passed),
    };

    return {
      llmRequest,
      llmResponse,
      validationResults,
      executionResult,
      metrics,
    };
  }
}
