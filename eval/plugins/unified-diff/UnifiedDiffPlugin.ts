import { 
  BenchmarkPlugin, 
  BenchmarkContext, 
  BenchmarkResult, 
  TestCaseResult,
  UnifiedDiffTestCase,
  ValidationResult,
  LLMRequest,
  LLMResponse,
  BenchmarkError,
  ChatMessage
} from '../../core/types.js';

// Import Continue's actual diff functions (local copy)
import { applyUnifiedDiff, isUnifiedDiffFormat } from '../../core/unifiedDiffApply.js';

export class UnifiedDiffPlugin implements BenchmarkPlugin {
  name = 'unified-diff-testing';
  description = 'Evaluates quality of generated unified diffs and their application success';
  
  propertiesSchema = {
    systemPrompt: {
      type: 'string' as const,
      required: false,
      default: 'You are a helpful assistant that generates unified diffs. Generate only the unified diff without any additional explanation or markdown formatting.',
      description: 'System prompt for LLM when generating diffs'
    },
    maxRetries: {
      type: 'number' as const,
      required: false,
      default: 3,
      description: 'Maximum number of retries for failed LLM requests'
    },
    temperature: {
      type: 'number' as const,
      required: false,
      default: 0.1,
      description: 'Temperature for LLM generation (lower = more deterministic)'
    }
  };

  defaultDataset = 'datasets/diff-dataset';

  async execute(context: BenchmarkContext): Promise<BenchmarkResult> {
    const { models, dataset, session, properties, logger } = context;
    const systemPrompt = properties.systemPrompt || this.propertiesSchema.systemPrompt.default;
    const maxRetries = properties.maxRetries || this.propertiesSchema.maxRetries.default;
    const temperature = properties.temperature || this.propertiesSchema.temperature.default;

    logger.info(`Starting unified diff benchmark with ${models.length} models and ${dataset.testCases.length} test cases`);

    const testCases: TestCaseResult[] = [];
    let currentTestIndex = 0;

    for (const model of models) {
      logger.info(`Testing model: ${model.uniqueId}`);

      for (const testCase of dataset.testCases) {
        const testCaseId = `${testCase.id}-${model.uniqueId}`;
        
        // Check if this test case was already completed (session recovery)
        const existingResult = session.results?.find(r => 
          r.testCaseId === testCaseId && r.status === 'completed'
        );
        
        if (existingResult) {
          testCases.push(existingResult);
          logger.debug(`Skipping completed test case: ${testCaseId}`);
          continue;
        }

        const startTime = new Date();
        logger.debug(`Processing test case: ${testCase.id} with model: ${model.uniqueId}`);

        const result: TestCaseResult = {
          testCaseId,
          modelId: model.uniqueId,
          status: 'running',
          startTime
        };

        try {
          // Execute the test case
          await this.executeTestCase(
            testCase as UnifiedDiffTestCase,
            model,
            systemPrompt,
            temperature,
            maxRetries,
            result,
            context
          );

          result.status = 'completed';
          result.endTime = new Date();
          result.duration = result.endTime.getTime() - startTime.getTime();

        } catch (error) {
          logger.error(`Test case ${testCaseId} failed:`, error as Error);
          
          result.status = 'failed';
          result.endTime = new Date();
          result.duration = result.endTime ? result.endTime.getTime() - startTime.getTime() : 0;
          result.error = {
            type: 'execution',
            message: (error as Error).message,
            details: (error as Error).stack,
            recoverable: false
          };
        }

        testCases.push(result);
        
        // Update session progress
        session.progress.completedTestCases++;
        if (result.status === 'failed') {
          session.progress.failedTestCases++;
        }
        session.progress.currentTestCase = testCaseId;

        currentTestIndex++;
        logger.info(`Progress: ${currentTestIndex}/${session.progress.totalTestCases} test cases completed`);
      }
    }

    const endTime = new Date();
    return {
      pluginName: this.name,
      sessionId: session.id,
      testCases,
      metrics: {
        functional: { totalTests: 0, passedTests: 0, failedTests: 0, successRate: 0 },
        performance: { averageLatency: 0, medianLatency: 0, p95Latency: 0, totalTokens: 0, averageTokensPerRequest: 0 },
        quality: { syntaxCorrectness: 0, compilationSuccess: 0 }
      },
      summary: {
        overallScore: 0,
        recommendations: [],
        insights: []
      },
      startTime: session.startTime,
      endTime,
      duration: endTime.getTime() - session.startTime.getTime()
    };
  }

  private async executeTestCase(
    testCase: UnifiedDiffTestCase,
    model: any,
    systemPrompt: string,
    temperature: number,
    maxRetries: number,
    result: TestCaseResult,
    context: BenchmarkContext
  ): Promise<void> {
    const sourceCode = testCase.input.sourceCode;
    const modificationPrompt = testCase.input.additionalData?.modificationPrompt || testCase.input.prompt;
    const { logger } = context;

    // Prepare messages for LLM
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: `Here is the source code:

\`\`\`
${sourceCode}
\`\`\`

${modificationPrompt}

Please generate a unified diff that applies this modification to the source code. Return only the unified diff without any additional explanation.`
      }
    ];

    // Record LLM request
    const llmRequest: LLMRequest = {
      model: model.uniqueId,
      messages,
      systemPrompt,
      temperature,
      timestamp: new Date()
    };
    result.llmRequest = llmRequest;

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxRetries) {
      try {
        logger.debug(`LLM request attempt ${attempt + 1}/${maxRetries} for test case ${testCase.id}`);
        
        // Make LLM request
        const startTime = Date.now();
        const response = await model.streamChat(
          messages,
          {
            systemMessage: systemPrompt,
            temperature,
            maxTokens: 4000
          }
        );

        const latency = Date.now() - startTime;
        let content = '';
        
        // Collect streaming response
        for await (const chunk of response) {
          if (chunk.content) {
            content += chunk.content;
          }
        }

        // Record LLM response
        const llmResponse: LLMResponse = {
          content: content.trim(),
          latency,
          timestamp: new Date()
        };
        result.llmResponse = llmResponse;

        // Validate and apply the diff
        await this.validateAndApplyDiff(sourceCode, content.trim(), testCase, result, logger);
        
        return; // Success, exit retry loop

      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt < maxRetries) {
          logger.warn(`Attempt ${attempt} failed for test case ${testCase.id}, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }

    // All attempts failed
    throw lastError || new Error('Max retries exceeded');
  }

  private async validateAndApplyDiff(
    sourceCode: string,
    diffContent: string,
    testCase: UnifiedDiffTestCase,
    result: TestCaseResult,
    logger: any
  ): Promise<void> {
    const validationResults: ValidationResult[] = [];

    // 1. Validate diff format
    const isValidFormat = isUnifiedDiffFormat(diffContent);
    validationResults.push({
      type: 'format',
      passed: isValidFormat,
      details: isValidFormat ? 'Valid unified diff format' : 'Invalid unified diff format'
    });

    if (!isValidFormat) {
      result.validationResults = validationResults;
      result.error = {
        type: 'validation',
        message: 'Generated content is not a valid unified diff',
        details: `Content: ${diffContent.substring(0, 200)}...`,
        recoverable: true
      };
      return;
    }

    // 2. Attempt to apply the diff
    let applySuccess = false;
    let appliedCode = '';
    let applyError = '';

    try {
      const diffLines = applyUnifiedDiff(sourceCode, diffContent);
      appliedCode = diffLines.map(line => line.line).join('\n');
      applySuccess = true;
      
      validationResults.push({
        type: 'application',
        passed: true,
        details: 'Diff applied successfully'
      });

    } catch (error) {
      applyError = (error as Error).message;
      validationResults.push({
        type: 'application',
        passed: false,
        details: `Diff application failed: ${applyError}`
      });
    }

    // 3. Check against expected results if provided
    const diffShouldApply = testCase.expected?.validationRules?.find(
      rule => rule.type === 'custom' && rule.config.diffShouldApply !== undefined
    )?.config.diffShouldApply;
    
    if (diffShouldApply !== undefined) {
      const actuallyApplied = applySuccess;
      
      validationResults.push({
        type: 'expectation',
        passed: diffShouldApply === actuallyApplied,
        details: `Expected apply=${diffShouldApply}, actual apply=${actuallyApplied}`
      });
    }

    // 4. Basic syntax validation for applied code (if successful)
    if (applySuccess && appliedCode) {
      const syntaxValid = await this.validateSyntax(appliedCode, testCase, result.testCaseId, logger);
      validationResults.push({
        type: 'syntax',
        passed: syntaxValid,
        details: syntaxValid ? 'Applied code has valid syntax' : 'Applied code has syntax errors'
      });
    }

    // 5. Check for expected changes if specified
    if (testCase.expected?.expectedChanges && applySuccess) {
      const containsExpectedChanges = testCase.expected.expectedChanges.every(change => 
        appliedCode.includes(change)
      );
      
      validationResults.push({
        type: 'content',
        passed: containsExpectedChanges,
        details: containsExpectedChanges 
          ? 'All expected changes present in applied code'
          : 'Some expected changes missing from applied code'
      });
    }

    result.validationResults = validationResults;

    // Store additional metadata
    result.executionResult = {
      stdout: applySuccess ? 'Diff applied successfully' : '',
      stderr: applyError,
      exitCode: applySuccess ? 0 : 1,
      successful: applySuccess
    };

    // Calculate test case metrics
    result.metrics = {
      latency: result.llmResponse?.latency || 0,
      tokens: {
        prompt: result.llmResponse?.usage?.promptTokens || 0,
        completion: result.llmResponse?.usage?.completionTokens || 0,
        total: result.llmResponse?.usage?.totalTokens || 0
      },
      qualityScores: {
        formatValid: isValidFormat ? 1 : 0,
        applySuccess: applySuccess ? 1 : 0,
        overallQuality: validationResults.filter(r => r.passed).length / validationResults.length
      }
    };
  }

  private async validateSyntax(
    code: string,
    testCase: UnifiedDiffTestCase,
    testCaseId: string,
    logger: any
  ): Promise<boolean> {
    // Simple syntax validation - in a real implementation, you might want to use
    // language-specific parsers or the execution environment
    
    try {
      // For JavaScript/TypeScript, we can use a simple check
      if (testCase.metadata?.language === 'javascript' || testCase.metadata?.language === 'typescript') {
        // Basic bracket matching
        const openBrackets = (code.match(/[{[(]/g) || []).length;
        const closeBrackets = (code.match(/[}\])]/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
          return false;
        }
        
        // Check for basic syntax patterns
        const hasSyntaxErrors = /\b(function|class|if|for|while)\s*\s*[^{(]/.test(code) === false;
        return !hasSyntaxErrors;
      }
      
      // For other languages, assume valid for now
      // In a production system, you would integrate with language-specific validators
      return true;
      
    } catch (error) {
      logger.warn(`Syntax validation failed for test case ${testCaseId}:`, error);
      return false;
    }
  }

  async validateDataset(dataset: any): Promise<boolean> {
    // Validate that all test cases have the required fields for unified diff testing
    for (const testCase of dataset.testCases) {
      if (!testCase.input?.sourceCode) {
        return false;
      }
      // Check for modificationPrompt in additionalData or as direct prompt
      const hasModificationPrompt = testCase.input?.additionalData?.modificationPrompt || testCase.input?.prompt;
      if (!hasModificationPrompt) {
        return false;
      }
    }
    return true;
  }
}