import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  TestStepResult,
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
    // Properties are validated and populated by BenchmarkEngine
    const systemPrompt = context.properties.systemPrompt;

    const testStepResults: TestStepResult[] = [];

    // Build LLM request
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: testCase.input.prompt },
    ];

    // Step 1: Execute LLM request using TestCaseExecutor utility
    const llmStepResult = await TestCaseExecutor.executeLLMRequest(
      messages,
      context.model,
    );
    testStepResults.push(llmStepResult);

    // Step 2: Content validation (if expected output is provided)
    // TODO: this should be validated with the datasetSchema provided
    if (testCase.expected?.output) {
      const expectedOutput = testCase.expected.output;
      const content = llmStepResult.llmResponse?.content || "";
      const containsExpected = content
        .toLowerCase()
        .includes(expectedOutput.toLowerCase());

      testStepResults.push({
        passed: containsExpected,
        score: containsExpected ? 1 : 0,
        details: containsExpected
          ? `Response contains expected content: "${expectedOutput}"`
          : `Response does not contain expected content: "${expectedOutput}"`,
      });
    }

    // Complete test case using TestCaseExecutor utility
    return TestCaseExecutor.completeTestCase(testStepResults);
  }
}
