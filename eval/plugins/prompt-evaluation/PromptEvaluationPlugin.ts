import { readFileSync } from "fs";
import { join } from "path";
import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  ChatMessage,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  TestStepResult,
} from "../../core/types.js";

/**
 * Evaluates how well rules files or prompt files improve code generation quality and unit test pass rates.
 */
export class PromptEvaluationPlugin implements BenchmarkPlugin {
  name = "prompt-evaluation";
  description = "Evaluates effectiveness of rules files and prompt files for code generation tasks";

  propertiesSchema = {
    systemPrompt: {
      type: "string" as const,
      required: false,
      default: "",
      description: "Base system prompt for the LLM",
    },
    rulesFile: {
      type: "string" as const,
      required: false,
      default: "",
      description: "Path to rules file containing coding guidelines",
    },
    promptFile: {
      type: "string" as const,
      required: false,
      default: "",
      description: "Path to prompt file containing additional instructions",
    },
  };

  defaultDataset = "datasets/prompt-evaluation-dataset";

  /**
   * Loads content from a file path if provided, returns empty string if not found or empty path.
   */
  private loadFileContent(filePath: string): string {
    if (!filePath || filePath.trim() === "") {
      return "";
    }

    try {
      const fullPath = join(process.cwd(), filePath);
      return readFileSync(fullPath, "utf-8");
    } catch (error) {
      // Return empty string if file doesn't exist or can't be read
      return "";
    }
  }

  /**
   * Builds the enhanced system prompt by combining base prompt with rules and prompt files.
   */
  private buildEnhancedSystemPrompt(
    baseSystemPrompt: string,
    rulesContent: string,
    promptContent: string,
  ): string {
    let enhancedPrompt = baseSystemPrompt;

    if (rulesContent.trim()) {
      enhancedPrompt += `\n\nCoding Rules:\n${rulesContent}`;
    }

    if (promptContent.trim()) {
      enhancedPrompt += `\n\nAdditional Instructions:\n${promptContent}`;
    }

    return enhancedPrompt.trim();
  }

  /**
   * Extracts JavaScript code blocks from LLM response, removing explanatory text and markdown formatting.
   */
  private extractCodeFromResponse(response: string): string {
    const codeBlocks: string[] = [];
    
    // Match code blocks with language specifiers: ```javascript, ```js, or plain ```
    const codeBlockRegex = /```(?:javascript|js)?\s*\n?([\s\S]*?)\n?```/gi;
    let match;
    
    while ((match = codeBlockRegex.exec(response)) !== null) {
      const codeContent = match[1].trim();
      if (codeContent) {
        codeBlocks.push(codeContent);
      }
    }
    
    // If no code blocks found, try to extract code after common phrases
    if (codeBlocks.length === 0) {
      const patterns = [
        /(?:here'?s?\s+(?:the\s+)?(?:function|code|implementation)(?:\s+(?:for|that))?[\s\S]*?:?\s*\n)((?:function|class|const|let|var)[\s\S]*)/i,
        /(?:implementation|solution|code)[\s\S]*?:\s*\n((?:function|class|const|let|var)[\s\S]*)/i,
      ];
      
      for (const pattern of patterns) {
        const match = response.match(pattern);
        if (match && match[1]) {
          codeBlocks.push(match[1].trim());
          break;
        }
      }
    }
    
    // Join all code blocks with newlines
    return codeBlocks.join('\n\n').trim();
  }

  /**
   * Executes code generation step using the enhanced prompt.
   */
  private async executeCodeGenerationStep(
    testCase: TestCase,
    enhancedSystemPrompt: string,
    context: TestExecutionContext,
  ): Promise<TestStepResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: enhancedSystemPrompt },
      { role: "user", content: testCase.input.prompt },
    ];

    return await TestCaseExecutor.executeLLMRequest(messages, context.model);
  }

  /**
   * Executes code extraction step to isolate JavaScript code from LLM response.
   */
  private executeCodeExtractionStep(llmResponse: string): TestStepResult & { extractedCode?: string } {
    const extractedCode = this.extractCodeFromResponse(llmResponse);
    const hasCode = extractedCode.trim().length > 0;
    
    return {
      passed: hasCode,
      score: hasCode ? 1 : 0,
      details: hasCode 
        ? `Extracted ${extractedCode.trim().length} characters of code`
        : "No JavaScript code blocks found in response",
      extractedCode: hasCode ? extractedCode : undefined,
    };
  }

  /**
   * Analyzes the generated code for basic syntax correctness and structure.
   */
  private executeCodeAnalysisStep(generatedCode: string): TestStepResult {
    const codeLength = generatedCode.trim().length;
    const hasFunction = /function\s+\w+|const\s+\w+\s*=|class\s+\w+/.test(generatedCode);
    const hasSyntaxErrors = this.checkBasicSyntax(generatedCode);

    const passed = codeLength > 0 && hasFunction && !hasSyntaxErrors;
    
    return {
      passed,
      score: passed ? 1 : 0,
      details: passed
        ? `Generated valid code (${codeLength} characters)`
        : `Code analysis failed: ${codeLength === 0 ? "empty response" : hasSyntaxErrors ? "syntax errors detected" : "no function/class found"}`,
    };
  }

  /**
   * Performs basic syntax validation on generated code.
   */
  private checkBasicSyntax(code: string): boolean {
    // Basic checks for common syntax errors
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    return openBraces !== closeBraces || openParens !== closeParens;
  }

  /**
   * Executes unit tests against the generated code to validate functionality.
   */
  private async executeUnitTestStep(
    generatedCode: string,
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestStepResult> {
    if (!testCase.expected?.unitTest) {
      return {
        passed: true,
        score: 1,
        details: "No unit test specified - skipped",
      };
    }

    try {
      const testResult = await context.executionEnvironment.runTest(
        testCase.expected.unitTest,
        generatedCode,
        testCase.metadata?.language || "javascript",
      );

      const passed = testResult.exitCode === 0;
      return {
        passed,
        score: passed ? 1 : 0,
        details: passed
          ? `Unit tests passed: ${testResult.stdout}`
          : `Unit tests failed: ${testResult.stderr}`,
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
   * Orchestrates the complete prompt evaluation workflow: enhanced prompt generation, code generation, analysis, and unit testing.
   */
  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
    const testStepResults: TestStepResult[] = [];

    // Step 1: Load and combine prompt files
    const rulesContent = this.loadFileContent(context.properties.rulesFile);
    const promptContent = this.loadFileContent(context.properties.promptFile);
    const enhancedSystemPrompt = this.buildEnhancedSystemPrompt(
      context.properties.systemPrompt,
      rulesContent,
      promptContent,
    );

    context.logger.debug(
      `Enhanced system prompt (${enhancedSystemPrompt.length} chars): ${enhancedSystemPrompt.substring(0, 100)}...`,
    );

    // Step 2: Generate code using enhanced prompt
    const codeGenStep = await this.executeCodeGenerationStep(
      testCase,
      enhancedSystemPrompt,
      context,
    );
    testStepResults.push(codeGenStep);

    const rawResponse = codeGenStep.llmResponse?.content || "";
    context.logger.debug(`Raw LLM response: ${rawResponse.substring(0, 200)}...`);

    // Step 3: Extract code from LLM response
    const extractionStep = this.executeCodeExtractionStep(rawResponse);
    testStepResults.push(extractionStep);

    if (!extractionStep.passed || !extractionStep.extractedCode) {
      context.logger.debug(`Code extraction failed, skipping analysis and unit tests`);
      return TestCaseExecutor.completeTestCase(testStepResults);
    }

    const extractedCode = extractionStep.extractedCode;
    context.logger.debug(`Extracted code: ${extractedCode}`);

    // Step 4: Analyze extracted code
    const analysisStep = this.executeCodeAnalysisStep(extractedCode);
    testStepResults.push(analysisStep);

    if (!analysisStep.passed) {
      context.logger.debug(`Code analysis failed, skipping unit tests`);
      return TestCaseExecutor.completeTestCase(testStepResults);
    }

    // Step 5: Run unit tests on extracted code
    const unitTestStep = await this.executeUnitTestStep(
      extractedCode,
      testCase,
      context,
    );
    testStepResults.push(unitTestStep);

    return TestCaseExecutor.completeTestCase(testStepResults);
  }
}