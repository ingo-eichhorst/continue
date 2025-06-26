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
 * Evaluates and compares system prompt effectiveness across multiple models for code generation tasks.
 */
export class SystemPromptOptimizationPlugin implements BenchmarkPlugin {
  name = "system-prompt-optimization";
  description = "Compares system prompt effectiveness across models for code generation optimization";

  propertiesSchema = {
    systemPrompts: {
      type: "array" as const,
      required: true,
      description: "Array of system prompts to compare",
    },
    models: {
      type: "array" as const,
      required: false,
      default: [],
      description: "Array of model IDs for cross-model comparison (empty = use default from CLI)",
    },
    requirementsFile: {
      type: "string" as const,
      required: false,
      default: "",
      description: "Path to requirements document file",
    },
    contextFile: {
      type: "string" as const,
      required: false,
      default: "",
      description: "Path to existing code context file",
    },
    validationModel: {
      type: "string" as const,
      required: false,
      default: "gpt-4",
      description: "Model ID for code quality validation assessment",
    },
  };

  defaultDataset = "datasets/system-prompt-optimization-dataset";


  /**
   * Builds the complete prompt by combining system prompt with requirements and context.
   */
  private buildPrompt(
    systemPrompt: string,
    requirements: string,
    context: string,
  ): string {
    let prompt = systemPrompt;

    if (requirements.trim()) {
      prompt += `\n\nRequirements:\n${requirements}`;
    }

    if (context.trim()) {
      prompt += `\n\nExisting Code Context:\n${context}`;
    }

    return prompt.trim();
  }

  /**
   * Executes code generation step using the specified system prompt.
   */
  private async executeCodeGenerationStep(
    testCase: TestCase,
    systemPrompt: string,
    requirements: string,
    context: string,
    executionContext: TestExecutionContext,
  ): Promise<TestStepResult> {
    const fullSystemPrompt = this.buildPrompt(systemPrompt, requirements, context);
    
    const messages: ChatMessage[] = [
      { role: "system", content: fullSystemPrompt },
      { role: "user", content: testCase.input.prompt },
    ];

    return await TestCaseExecutor.executeLLMRequest(messages, executionContext.model);
  }


  /**
   * Executes code extraction step with validation.
   */
  private executeCodeExtractionStep(llmResponse: string): TestStepResult & { extractedCode?: string } {
    const extractedCode = TestCaseExecutor.extractCodeFromResponse(llmResponse);
    const hasCode = extractedCode.trim().length > 0;
    
    return {
      passed: hasCode,
      score: hasCode ? 1 : 0,
      details: hasCode 
        ? `Extracted ${extractedCode.trim().length} characters of code`
        : "No code blocks found in response",
      extractedCode: hasCode ? extractedCode : undefined,
    };
  }

  /**
   * Executes unit tests against generated code.
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
   * Executes code quality validation assessment using a separate LLM with detailed criteria.
   */
  private async executeCodeQualityValidationStep(
    generatedCode: string,
    context: TestExecutionContext,
    validationModel: string,
  ): Promise<TestStepResult> {
    const qualityAssessmentPrompt = `
Please assess the code quality and readability of the following JavaScript code. Rate each criterion on a scale of 1-10 and provide an overall score.

Assessment Criteria:
1. **Code Structure & Organization** (1-10): Logical flow, proper indentation, clear separation of concerns
2. **Naming Conventions** (1-10): Descriptive variable/function names, consistent naming style
3. **Error Handling** (1-10): Proper input validation, edge case handling, error recovery
4. **Performance Considerations** (1-10): Efficient algorithms, appropriate data structures, memory usage
5. **Best Practices** (1-10): Modern JavaScript features, maintainability, testability

Code to assess:
\`\`\`javascript
${generatedCode}
\`\`\`

Please respond in this exact format:
Structure: X/10
Naming: X/10  
Error Handling: X/10
Performance: X/10
Best Practices: X/10
Overall: X/10
Brief explanation: [your analysis]
`;

    const messages: ChatMessage[] = [
      { 
        role: "system", 
        content: "You are a senior JavaScript code reviewer with expertise in code quality assessment. Provide objective, detailed evaluations based on industry standards and best practices. Be constructive but honest in your assessment."
      },
      { role: "user", content: qualityAssessmentPrompt },
    ];

    try {
      // Note: In a real implementation, we would need to load the specified validation model
      // For now, we use the current model as the validation model
      const result = await TestCaseExecutor.executeLLMRequest(messages, context.model);
      
      if (!result.passed || !result.llmResponse) {
        return {
          passed: false,
          score: 0,
          details: "Code quality validation failed - no response from LLM",
        };
      }

      const response = result.llmResponse.content;
      
      // Parse the structured response to extract scores
      const overallMatch = response.match(/Overall:\s*(\d+(?:\.\d+)?)/i);
      const structureMatch = response.match(/Structure:\s*(\d+(?:\.\d+)?)/i);
      const namingMatch = response.match(/Naming:\s*(\d+(?:\.\d+)?)/i);
      const errorHandlingMatch = response.match(/Error\s+Handling:\s*(\d+(?:\.\d+)?)/i);
      const performanceMatch = response.match(/Performance:\s*(\d+(?:\.\d+)?)/i);
      const bestPracticesMatch = response.match(/Best\s+Practices:\s*(\d+(?:\.\d+)?)/i);
      
      const overallScore = overallMatch ? parseFloat(overallMatch[1]) : 0;
      const normalizedScore = Math.max(0, Math.min(10, overallScore)) / 10;
      
      // Extract detailed scores for reporting
      const structureScore = structureMatch ? parseFloat(structureMatch[1]) : 0;
      const namingScore = namingMatch ? parseFloat(namingMatch[1]) : 0;
      const errorHandlingScore = errorHandlingMatch ? parseFloat(errorHandlingMatch[1]) : 0;
      const performanceScore = performanceMatch ? parseFloat(performanceMatch[1]) : 0;
      const bestPracticesScore = bestPracticesMatch ? parseFloat(bestPracticesMatch[1]) : 0;

      // Extract explanation
      const explanationMatch = response.match(/Brief explanation:\s*(.*)/is);
      const explanation = explanationMatch ? explanationMatch[1].trim() : "No explanation provided";

      const detailedScores = `Structure:${structureScore}/10, Naming:${namingScore}/10, ErrorHandling:${errorHandlingScore}/10, Performance:${performanceScore}/10, BestPractices:${bestPracticesScore}/10`;
      
      return {
        passed: overallScore >= 6, // 6/10 as passing threshold
        score: normalizedScore,
        details: `Code quality validation: Overall ${overallScore}/10 (${detailedScores}). ${explanation.substring(0, 150)}${explanation.length > 150 ? '...' : ''}`,
      };
    } catch (error) {
      return {
        passed: false,
        score: 0,
        details: `Code quality validation error: ${(error as Error).message}`,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Executes performance measurement step.
   */
  private executePerformanceMeasurementStep(
    startTime: number,
    endTime: number,
  ): TestStepResult {
    const duration = endTime - startTime;
    const score = Math.max(0, 1 - (duration / 30000)); // Normalize against 30 second max

    return {
      passed: duration < 30000,
      score,
      details: `Code generation completed in ${duration}ms`,
    };
  }

  /**
   * Executes a single system prompt and returns comprehensive results.
   */
  private async executeSystemPromptVariant(
    testCase: TestCase,
    systemPrompt: string,
    promptIndex: number,
    requirements: string,
    codeContext: string,
    context: TestExecutionContext,
  ): Promise<TestStepResult[]> {
    const variantResults: TestStepResult[] = [];
    const startTime = Date.now();
    const modelId = context.model.uniqueId;

    context.logger.debug(`[${modelId}] Executing system prompt variant ${promptIndex + 1}: ${systemPrompt.substring(0, 100)}...`);

    // Step 1: Generate code using system prompt
    const codeGenStep = await this.executeCodeGenerationStep(
      testCase,
      systemPrompt,
      requirements,
      codeContext,
      context,
    );
    // Add prompt and model identification to the step
    codeGenStep.details = `[${modelId}] [Prompt ${promptIndex + 1}] ${codeGenStep.details || 'Code generation'}`;
    variantResults.push(codeGenStep);

    const rawResponse = codeGenStep.llmResponse?.content || "";
    
    // Step 2: Extract code from response
    const extractionStep = this.executeCodeExtractionStep(rawResponse);
    extractionStep.details = `[${modelId}] [Prompt ${promptIndex + 1}] ${extractionStep.details}`;
    variantResults.push(extractionStep);

    if (!extractionStep.passed || !extractionStep.extractedCode) {
      // Add failure markers for remaining steps
      variantResults.push({
        passed: false,
        score: 0,
        details: `[${modelId}] [Prompt ${promptIndex + 1}] Unit tests skipped - no code extracted`,
      });
      variantResults.push({
        passed: false,
        score: 0,
        details: `[${modelId}] [Prompt ${promptIndex + 1}] Performance measurement skipped`,
      });
      variantResults.push({
        passed: false,
        score: 0,
        details: `[${modelId}] [Prompt ${promptIndex + 1}] Code quality validation skipped`,
      });
      return variantResults;
    }

    const extractedCode = extractionStep.extractedCode;

    // Step 3: Execute unit tests
    const unitTestStep = await this.executeUnitTestStep(
      extractedCode,
      testCase,
      context,
    );
    unitTestStep.details = `[${modelId}] [Prompt ${promptIndex + 1}] ${unitTestStep.details}`;
    variantResults.push(unitTestStep);

    // Step 4: Performance measurement
    const endTime = Date.now();
    const performanceStep = this.executePerformanceMeasurementStep(startTime, endTime);
    performanceStep.details = `[${modelId}] [Prompt ${promptIndex + 1}] ${performanceStep.details}`;
    variantResults.push(performanceStep);

    // Step 5: Code quality validation assessment
    const qualityValidationStep = await this.executeCodeQualityValidationStep(
      extractedCode,
      context,
      context.properties.validationModel,
    );
    qualityValidationStep.details = `[${modelId}] [Prompt ${promptIndex + 1}] ${qualityValidationStep.details}`;
    variantResults.push(qualityValidationStep);

    return variantResults;
  }

  /**
   * Orchestrates the complete system prompt optimization workflow with multi-prompt comparison.
   */
  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
    const allTestStepResults: TestStepResult[] = [];

    // Load requirements and context files
    const requirements = TestCaseExecutor.loadFileContent(context.properties.requirementsFile);
    const codeContext = TestCaseExecutor.loadFileContent(context.properties.contextFile);

    // Get system prompts from properties
    const systemPrompts = context.properties.systemPrompts as string[];
    if (!systemPrompts || systemPrompts.length === 0) {
      throw new Error("No system prompts provided for optimization");
    }

    const modelId = context.model.uniqueId;
    context.logger.info(`[${modelId}] Comparing ${systemPrompts.length} system prompt variants for test case: ${testCase.id}`);

    // Execute each system prompt variant
    for (let i = 0; i < systemPrompts.length; i++) {
      const systemPrompt = systemPrompts[i];
      
      try {
        const variantResults = await this.executeSystemPromptVariant(
          testCase,
          systemPrompt,
          i,
          requirements,
          codeContext,
          context,
        );
        allTestStepResults.push(...variantResults);
      } catch (error) {
        context.logger.error(`[${modelId}] Failed to execute system prompt variant ${i + 1}`, error as Error);
        
        // Add error results for this variant
        allTestStepResults.push({
          passed: false,
          score: 0,
          details: `[${modelId}] [Prompt ${i + 1}] Execution failed: ${(error as Error).message}`,
          error: (error as Error).message,
        });
      }
    }

    // Add comparison summary step
    const comparisonStep = this.generateComparisonSummary(allTestStepResults, systemPrompts.length, modelId);
    allTestStepResults.push(comparisonStep);

    return TestCaseExecutor.completeTestCase(allTestStepResults);
  }

  /**
   * Generates a comparison summary of all system prompt variants.
   */
  private generateComparisonSummary(
    results: TestStepResult[],
    numPrompts: number,
    modelId: string,
  ): TestStepResult {
    const promptResults: Array<{
      promptIndex: number;
      unitTestPassed: boolean;
      performance: number;
      readability: number;
      overallScore: number;
    }> = [];

    // Group results by prompt (every 4-5 steps per prompt depending on readability)
    const stepsPerPrompt = results.length / numPrompts;
    
    for (let i = 0; i < numPrompts; i++) {
      const startIndex = Math.floor(i * stepsPerPrompt);
      const endIndex = Math.floor((i + 1) * stepsPerPrompt);
      const promptSteps = results.slice(startIndex, endIndex);
      
      // Extract metrics from this prompt's steps
      const unitTestStep = promptSteps.find(step => step.details?.includes('Unit tests'));
      const performanceStep = promptSteps.find(step => step.details?.includes('completed in'));
      const readabilityStep = promptSteps.find(step => step.details?.includes('Code quality validation'));
      
      const unitTestPassed = unitTestStep?.passed ?? false;
      const performance = performanceStep?.score ?? 0;
      const readability = readabilityStep?.score ?? 0;
      
      const overallScore = (
        (unitTestPassed ? 1 : 0) * 0.5 +
        performance * 0.3 +
        readability * 0.2
      );

      promptResults.push({
        promptIndex: i + 1,
        unitTestPassed,
        performance,
        readability,
        overallScore,
      });
    }

    // Find the best performing prompt
    const bestPrompt = promptResults.reduce((best, current) => 
      current.overallScore > best.overallScore ? current : best
    );

    // Calculate statistics across all prompts
    const successfulPrompts = promptResults.filter(result => result.unitTestPassed);
    const averageOverallScore = promptResults.reduce((sum, result) => sum + result.overallScore, 0) / promptResults.length;
    const averagePerformance = promptResults.reduce((sum, result) => sum + result.performance, 0) / promptResults.length;
    const averageReadability = promptResults.reduce((sum, result) => sum + result.readability, 0) / promptResults.length;
    
    // Sort prompts by overall score for ranking
    const sortedPrompts = [...promptResults].sort((a, b) => b.overallScore - a.overallScore);
    
    const summary = promptResults
      .map(result => 
        `P${result.promptIndex}:${result.unitTestPassed ? '✓' : '✗'}/${(result.performance * 100).toFixed(0)}%/${(result.readability * 100).toFixed(0)}%/${(result.overallScore * 100).toFixed(0)}%`
      )
      .join(' ');

    const ranking = sortedPrompts
      .map((result, index) => `${index + 1}.P${result.promptIndex}(${(result.overallScore * 100).toFixed(0)}%)`)
      .join(' ');

    const statistics = `Avg:${(averageOverallScore * 100).toFixed(0)}% Succ:${successfulPrompts.length}/${promptResults.length} PerfAvg:${(averagePerformance * 100).toFixed(0)}% ReadAvg:${(averageReadability * 100).toFixed(0)}%`;

    return {
      passed: bestPrompt.overallScore > 0.5,
      score: bestPrompt.overallScore,
      details: `[${modelId}] Prompt Optimization - Best: P${bestPrompt.promptIndex}(${(bestPrompt.overallScore * 100).toFixed(0)}%) | Ranking: ${ranking} | Stats: ${statistics} | Details: ${summary}`,
    };
  }
}