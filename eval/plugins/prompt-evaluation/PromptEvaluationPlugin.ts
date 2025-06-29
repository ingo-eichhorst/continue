import { TestCaseExecutor } from "../../core/TestCaseExecutor.js";
import {
  BenchmarkPlugin,
  ChatMessage,
  TestCase,
  TestCaseExecution,
  TestExecutionContext,
  TestStepResult,
} from "../../core/types.js";
import { applyPatch } from "diff";

/**
 * Evaluates how well rules files or prompt files improve code generation quality and unit test pass rates.
 * Enhanced to handle both standalone code generation and diff patch application for SWE-bench datasets.
 */
export class PromptEvaluationPlugin implements BenchmarkPlugin {
  name = "prompt-evaluation";
  description = "Evaluates effectiveness of rules files and prompt files for code generation and diff patch tasks";

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
   * Executes code extraction step to isolate code or diff from LLM response.
   * Enhanced to detect both standalone code and diff patches.
   */
  private executeCodeExtractionStep(llmResponse: string): TestStepResult & { extractedCode?: string; isDiff?: boolean } {
    const extractedCode = TestCaseExecutor.extractCodeFromResponse(llmResponse);
    const hasCode = extractedCode.trim().length > 0;
    const isDiff = hasCode && TestCaseExecutor.isDiffPatch(extractedCode);
    
    return {
      passed: hasCode,
      score: hasCode ? 1 : 0,
      details: hasCode 
        ? `Extracted ${extractedCode.trim().length} characters of ${isDiff ? 'diff patch' : 'code'}`
        : "No code blocks or diff patches found in response",
      extractedCode: hasCode ? extractedCode : undefined,
      isDiff,
    };
  }

  /**
   * Applies a diff patch to base source code to generate the final code.
   * Enhanced to handle multiple files from SWE-bench datasets.
   */
  private executeDiffApplicationStep(
    diffPatch: string, 
    testCase: TestCase,
    context: TestExecutionContext
  ): TestStepResult & { patchedCode?: string } {
    try {
      // Get base source code from test case or repository context
      const baseSourceCode = this.getBaseSourceCode(testCase, context);
      
      if (!baseSourceCode) {
        return {
          passed: false,
          score: 0,
          details: "No base source code available to apply diff patch",
        };
      }

      // Parse multiple files from base source code (format: "# File: path\ncode\n\n# File: path2\ncode2")
      const baseFiles = this.parseMultiFileSourceCode(baseSourceCode);
      const modifiedFiles: Record<string, string> = {};
      let totalChanges = 0;

      // Extract file paths from diff to know which files to patch
      const diffFilePaths = this.extractFilePathsFromDiff(diffPatch);

      if (diffFilePaths.length === 0) {
        // If no specific files found in diff, try to apply to the entire base code
        const patchedCode = applyPatch(baseSourceCode, diffPatch);
        
        if (!patchedCode) {
          return {
            passed: false,
            score: 0,
            details: "Failed to apply diff patch to base source code",
          };
        }

        return {
          passed: true,
          score: 1,
          details: `Successfully applied diff patch (${patchedCode.length} characters)`,
          patchedCode,
        };
      }

      // Apply patches to specific files
      for (const filePath of diffFilePaths) {
        const baseFileContent = baseFiles[filePath] || '';
        
        try {
          // Extract the portion of diff that applies to this file
          const fileDiff = this.extractFileDiffFromPatch(diffPatch, filePath);
          
          if (fileDiff) {
            const patchedFileContent = applyPatch(baseFileContent, fileDiff);
            
            if (patchedFileContent !== false) {
              modifiedFiles[filePath] = patchedFileContent;
              totalChanges += Math.abs(patchedFileContent.length - baseFileContent.length);
            } else {
              context.logger.warn(`Failed to apply patch to file: ${filePath}`);
              modifiedFiles[filePath] = baseFileContent; // Keep original on failure
            }
          }
        } catch (fileError) {
          context.logger.warn(`Error applying patch to ${filePath}:`, fileError as Error);
          modifiedFiles[filePath] = baseFiles[filePath] || ''; // Keep original on error
        }
      }

      // Combine modified files back into single source code
      const patchedCode = this.combineMultiFileSourceCode(modifiedFiles);

      return {
        passed: true,
        score: 1,
        details: `Successfully applied diff patch to ${Object.keys(modifiedFiles).length} files (${totalChanges} character changes)`,
        patchedCode,
      };

    } catch (error) {
      const errorMessage = (error as Error).message;
      context.logger.error(`Diff application failed: ${errorMessage}`);
      
      return {
        passed: false,
        score: 0,
        details: `Diff application failed: ${errorMessage}`,
        error: errorMessage,
      };
    }
  }

  /**
   * Gets base source code for applying diffs.
   * Enhanced to use repository source code when available from SWE-bench datasets.
   */
  private getBaseSourceCode(testCase: TestCase, context: TestExecutionContext): string {
    // First, try to get base code from test case input (populated by SWEBenchDatasetProvider)
    if (testCase.input.sourceCode && testCase.input.sourceCode.trim()) {
      context.logger.debug(`Using repository source code (${testCase.input.sourceCode.length} characters) for ${testCase.id}`);
      return testCase.input.sourceCode;
    }

    // Fallback for cases where repository cloning is disabled or failed
    if (testCase.metadata?.repository && testCase.metadata?.base_commit) {
      context.logger.warn(`Base source code not available for ${testCase.metadata.repository}@${testCase.metadata.base_commit}. Repository cloning may be disabled.`);
      // Return empty string as fallback - this will work for new files
      return "";
    }

    context.logger.debug(`No base source code available for test case ${testCase.id}`);
    return "";
  }

  /**
   * Parse multi-file source code format used by SWEBenchDatasetProvider
   * Format: "# File: path\ncode\n\n# File: path2\ncode2"
   */
  private parseMultiFileSourceCode(sourceCode: string): Record<string, string> {
    const files: Record<string, string> = {};
    
    if (!sourceCode.includes('# File:')) {
      // Single file or unstructured source code
      return { 'main': sourceCode };
    }

    const sections = sourceCode.split(/\n# File: /);
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      
      if (i === 0 && !section.startsWith('# File:')) {
        // Skip any content before the first file marker
        continue;
      }
      
      const lines = section.split('\n');
      let filePath: string;
      let fileContent: string;
      
      if (i === 0) {
        // First section starts with "# File:"
        filePath = lines[0].replace('# File: ', '');
        fileContent = lines.slice(1).join('\n').trim();
      } else {
        // Subsequent sections already have "# File:" removed by split
        filePath = lines[0];
        fileContent = lines.slice(1).join('\n').trim();
      }
      
      if (filePath && !filePath.includes('(not found')) {
        files[filePath] = fileContent;
      }
    }
    
    return files;
  }

  /**
   * Extract file paths from diff patch
   */
  private extractFilePathsFromDiff(diffPatch: string): string[] {
    const filePaths: string[] = [];
    const lines = diffPatch.split('\n');

    for (const line of lines) {
      // Match diff headers like "diff --git a/file.py b/file.py"
      const gitDiffMatch = line.match(/^diff --git a\/(.+) b\/(.+)/);
      if (gitDiffMatch) {
        filePaths.push(gitDiffMatch[1]);
        continue;
      }

      // Match unified diff headers like "--- a/file.py"
      const unifiedDiffMatch = line.match(/^--- a\/(.+)/);
      if (unifiedDiffMatch) {
        filePaths.push(unifiedDiffMatch[1]);
        continue;
      }
    }

    return [...new Set(filePaths)]; // Remove duplicates
  }

  /**
   * Extract the portion of a diff that applies to a specific file
   */
  private extractFileDiffFromPatch(diffPatch: string, filePath: string): string | null {
    const lines = diffPatch.split('\n');
    const fileDiffLines: string[] = [];
    let inTargetFile = false;
    let foundFile = false;

    for (const line of lines) {
      // Check if this is the start of our target file
      if (line.startsWith('diff --git') && line.includes(`a/${filePath}`)) {
        inTargetFile = true;
        foundFile = true;
        fileDiffLines.push(line);
        continue;
      }

      // Check if this is the start of a different file
      if (line.startsWith('diff --git') && !line.includes(`a/${filePath}`)) {
        if (inTargetFile) break; // We've finished with our target file
        continue;
      }

      // If we're in the target file, collect all lines
      if (inTargetFile) {
        fileDiffLines.push(line);
      }
    }

    return foundFile ? fileDiffLines.join('\n') : null;
  }

  /**
   * Combine modified files back into multi-file source code format
   */
  private combineMultiFileSourceCode(files: Record<string, string>): string {
    if (Object.keys(files).length === 1 && files['main']) {
      // Single unnamed file
      return files['main'];
    }

    const parts: string[] = [];
    
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath !== 'main') {
        parts.push(`# File: ${filePath}\n${content}`);
      } else {
        parts.push(content);
      }
    }
    
    return parts.join('\n\n');
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
   * Orchestrates the complete prompt evaluation workflow: enhanced prompt generation, code generation, 
   * diff application (if needed), code analysis, and unit testing.
   * Supports both standalone code generation and SWE-bench diff patch workflows.
   */
  async executeTestCase(
    testCase: TestCase,
    context: TestExecutionContext,
  ): Promise<TestCaseExecution> {
    const testStepResults: TestStepResult[] = [];

    // Step 1: Load and combine prompt files
    const rulesContent = TestCaseExecutor.loadFileContent(context.properties.rulesFile);
    const promptContent = TestCaseExecutor.loadFileContent(context.properties.promptFile);
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

    let finalCode = extractionStep.extractedCode;
    context.logger.debug(`Extracted ${extractionStep.isDiff ? 'diff patch' : 'code'}: ${finalCode.substring(0, 200)}...`);

    // Step 4: Apply diff patch if detected
    if (extractionStep.isDiff) {
      const diffStep = this.executeDiffApplicationStep(
        extractionStep.extractedCode,
        testCase,
        context,
      );
      testStepResults.push(diffStep);

      if (!diffStep.passed || !diffStep.patchedCode) {
        context.logger.debug(`Diff application failed, skipping analysis and unit tests`);
        return TestCaseExecutor.completeTestCase(testStepResults);
      }

      finalCode = diffStep.patchedCode;
      context.logger.debug(`Applied diff patch, result: ${finalCode.substring(0, 200)}...`);
    }

    // Step 5: Analyze final code
    const analysisStep = this.executeCodeAnalysisStep(finalCode);
    testStepResults.push(analysisStep);

    if (!analysisStep.passed) {
      context.logger.debug(`Code analysis failed, skipping unit tests`);
      return TestCaseExecutor.completeTestCase(testStepResults);
    }

    // Step 6: Run unit tests on final code
    const unitTestStep = await this.executeUnitTestStep(
      finalCode,
      testCase,
      context,
    );
    testStepResults.push(unitTestStep);

    return TestCaseExecutor.completeTestCase(testStepResults);
  }
}