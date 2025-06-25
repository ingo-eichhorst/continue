import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionEnvironment, ExecutionResult, ExecutionOptions } from '../core/types.js';

export class LocalExecutionEnvironment implements ExecutionEnvironment {
  name = 'local';
  type = 'local' as const;
  private tempDir: string;

  constructor() {
    this.tempDir = join(tmpdir(), 'continue-eval-local');
  }

  async runCode(
    code: string, 
    language: string, 
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const {
      timeout = 30000,
      memoryLimit,
      workingDirectory,
      environment = {},
      files = {}
    } = options;

    const executionId = uuidv4();
    const execDir = workingDirectory || join(this.tempDir, executionId);
    
    try {
      // Create execution directory
      await fs.mkdir(execDir, { recursive: true });

      // Write additional files if provided
      for (const [filename, content] of Object.entries(files)) {
        const filePath = join(execDir, filename);
        await fs.mkdir(dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');
      }

      // Get language-specific execution command
      const { command, args, filename } = this.getExecutionCommand(language, code, execDir);

      // Write the main code file
      const codeFilePath = join(execDir, filename);
      await fs.writeFile(codeFilePath, code, 'utf-8');

      // Execute the code
      const startTime = Date.now();
      const result = await this.executeCommand(
        command, 
        args, 
        execDir, 
        timeout, 
        environment
      );
      const executionTime = Date.now() - startTime;

      return {
        ...result,
        executionTime,
        successful: result.exitCode === 0
      };

    } catch (error) {
      return {
        stdout: '',
        stderr: (error as Error).message,
        exitCode: -1,
        successful: false,
        error: (error as Error).message
      };
    } finally {
      // Cleanup temporary files
      try {
        if (!workingDirectory) {
          await fs.rm(execDir, { recursive: true, force: true });
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }

  private getExecutionCommand(language: string, code: string, execDir: string): {
    command: string;
    args: string[];
    filename: string;
  } {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return {
          command: 'node',
          args: ['main.js'],
          filename: 'main.js'
        };

      case 'typescript':
      case 'ts':
        return {
          command: 'npx',
          args: ['tsx', 'main.ts'],
          filename: 'main.ts'
        };

      case 'python':
      case 'py':
        return {
          command: 'python3',
          args: ['main.py'],
          filename: 'main.py'
        };

      case 'python2':
        return {
          command: 'python2',
          args: ['main.py'],
          filename: 'main.py'
        };

      case 'bash':
      case 'sh':
        return {
          command: 'bash',
          args: ['main.sh'],
          filename: 'main.sh'
        };

      case 'java':
        // Extract class name from code for Java
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : 'Main';
        return {
          command: 'sh',
          args: ['-c', `javac ${className}.java && java ${className}`],
          filename: `${className}.java`
        };

      case 'cpp':
      case 'c++':
        return {
          command: 'sh',
          args: ['-c', 'g++ -o main main.cpp && ./main'],
          filename: 'main.cpp'
        };

      case 'c':
        return {
          command: 'sh',
          args: ['-c', 'gcc -o main main.c && ./main'],
          filename: 'main.c'
        };

      case 'go':
        return {
          command: 'go',
          args: ['run', 'main.go'],
          filename: 'main.go'
        };

      case 'rust':
        return {
          command: 'sh',
          args: ['-c', 'rustc main.rs && ./main'],
          filename: 'main.rs'
        };

      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private executeCommand(
    command: string,
    args: string[],
    cwd: string,
    timeout: number,
    environment: Record<string, string>
  ): Promise<{stdout: string; stderr: string; exitCode: number}> {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd,
        env: { ...process.env, ...environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      // Set up timeout
      const timer = setTimeout(() => {
        isTimedOut = true;
        childProcess.kill('SIGKILL');
        reject(new Error(`Execution timed out after ${timeout}ms`));
      }, timeout);

      // Collect output
      childProcess.stdout?.on('data', (data: any) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: any) => {
        stderr += data.toString();
      });

      // Handle process completion
      childProcess.on('close', (code: any) => {
        clearTimeout(timer);
        if (!isTimedOut) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: code || 0
          });
        }
      });

      childProcess.on('error', (error: any) => {
        clearTimeout(timer);
        if (!isTimedOut) {
          reject(error);
        }
      });
    });
  }

  async cleanup(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  // Utility methods for language detection and validation
  static getSupportedLanguages(): string[] {
    return [
      'javascript', 'js',
      'typescript', 'ts',
      'python', 'py', 'python2',
      'bash', 'sh',
      'java',
      'cpp', 'c++',
      'c',
      'go',
      'rust'
    ];
  }

  static isLanguageSupported(language: string): boolean {
    return LocalExecutionEnvironment.getSupportedLanguages().includes(language.toLowerCase());
  }

  async validateEnvironment(): Promise<{valid: boolean; missing: string[]}> {
    const commands = [
      { name: 'node', test: ['--version'] },
      { name: 'python3', test: ['--version'] },
      { name: 'npx', test: ['--version'] }
    ];

    const missing: string[] = [];
    
    for (const cmd of commands) {
      try {
        await this.executeCommand(cmd.name, cmd.test, process.cwd(), 5000, {});
      } catch (error) {
        missing.push(cmd.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }
}