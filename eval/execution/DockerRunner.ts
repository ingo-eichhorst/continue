import Docker from 'dockerode';
import { Readable } from 'stream';
import { ExecutionEnvironment, ExecutionResult, ExecutionOptions } from '../core/types.js';

export class DockerExecutionEnvironment implements ExecutionEnvironment {
  name = 'docker';
  type = 'docker' as const;
  
  private docker: Docker;
  private defaultImages: Record<string, string> = {
    'javascript': 'node:20-alpine',
    'js': 'node:20-alpine',
    'typescript': 'node:20-alpine',
    'ts': 'node:20-alpine',
    'python': 'python:3.11-alpine',
    'py': 'python:3.11-alpine',
    'python2': 'python:2.7-alpine',
    'java': 'openjdk:17-alpine',
    'cpp': 'gcc:latest',
    'c++': 'gcc:latest',
    'c': 'gcc:latest',
    'go': 'golang:1.21-alpine',
    'rust': 'rust:1.75-alpine'
  };

  constructor() {
    this.docker = new Docker();
  }

  async runCode(
    code: string,
    language: string,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const {
      timeout = 30000,
      memoryLimit = '128m' as string,
      workingDirectory = '/app',
      environment = {},
      files = {}
    } = options;

    const startTime = Date.now();
    
    try {
      // Get Docker image for the language
      const image = this.getImageForLanguage(language);
      
      // Ensure image is available
      await this.ensureImage(image);

      // Prepare container configuration
      const containerConfig = this.getContainerConfig(
        image,
        language,
        code,
        files,
        workingDirectory,
        environment,
        String(memoryLimit),
        timeout
      );

      // Create and run container
      const container = await this.docker.createContainer(containerConfig);
      
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      try {
        // Start container
        await container.start();

        // Get logs
        const logStream = await container.logs({
          stdout: true,
          stderr: true,
          follow: true
        });

        // Parse logs
        const { stdout: out, stderr: err } = await this.parseContainerLogs(logStream);
        stdout = out;
        stderr = err;

        // Wait for container to finish
        const result = await container.wait();
        exitCode = result.StatusCode;

      } finally {
        // Always cleanup container
        try {
          await container.remove({ force: true });
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode,
        successful: exitCode === 0,
        executionTime,
        memoryUsage: undefined // Docker doesn't easily provide this without additional setup
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        stdout: '',
        stderr: (error as Error).message,
        exitCode: -1,
        successful: false,
        executionTime,
        error: (error as Error).message
      };
    }
  }

  private getImageForLanguage(language: string): string {
    const normalizedLang = language.toLowerCase();
    const image = this.defaultImages[normalizedLang];
    
    if (!image) {
      throw new Error(`No Docker image configured for language: ${language}`);
    }
    
    return image;
  }

  private async ensureImage(image: string): Promise<void> {
    try {
      await this.docker.getImage(image).inspect();
    } catch (error) {
      // Image doesn't exist, pull it
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.docker.modem.followProgress(stream, (err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      });
    }
  }

  private getContainerConfig(
    image: string,
    language: string,
    code: string,
    files: Record<string, string>,
    workingDirectory: string,
    environment: Record<string, string>,
    memoryLimit: string,
    timeout: number
  ): any {
    const { command, filename } = this.getExecutionCommand(language);
    
    // Prepare files for the container
    const containerFiles: Record<string, string> = {
      [filename]: code,
      ...files
    };

    // Create tar stream for files
    const fileContents = Object.entries(containerFiles)
      .map(([path, content]) => ({
        name: path,
        data: Buffer.from(content, 'utf-8')
      }));

    const tarStream = this.createTarStream(fileContents);

    return {
      Image: image,
      Cmd: command,
      WorkingDir: workingDirectory,
      Env: Object.entries(environment).map(([key, value]) => `${key}=${value}`),
      HostConfig: {
        Memory: this.parseMemoryLimit(memoryLimit),
        MemorySwap: this.parseMemoryLimit(memoryLimit), // Disable swap
        NetworkMode: 'none', // Disable network access for security
        ReadonlyRootfs: false, // Some languages need write access
        Tmpfs: {
          '/tmp': 'noexec,nosuid,size=10m'
        },
        Ulimits: [
          {
            Name: 'nproc',
            Soft: 50,
            Hard: 50
          },
          {
            Name: 'nofile',
            Soft: 1024,
            Hard: 1024
          }
        ]
      },
      AttachStdout: true,
      AttachStderr: true,
      // Add files to container
      Volumes: {},
      ExposedPorts: {}
    };
  }

  private getExecutionCommand(language: string): { command: string[]; filename: string } {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'js':
        return {
          command: ['node', 'main.js'],
          filename: 'main.js'
        };

      case 'typescript':
      case 'ts':
        return {
          command: ['sh', '-c', 'npm install -g tsx && tsx main.ts'],
          filename: 'main.ts'
        };

      case 'python':
      case 'py':
        return {
          command: ['python', 'main.py'],
          filename: 'main.py'
        };

      case 'python2':
        return {
          command: ['python2', 'main.py'],
          filename: 'main.py'
        };

      case 'java':
        return {
          command: ['sh', '-c', 'javac Main.java && java Main'],
          filename: 'Main.java'
        };

      case 'cpp':
      case 'c++':
        return {
          command: ['sh', '-c', 'g++ -o main main.cpp && ./main'],
          filename: 'main.cpp'
        };

      case 'c':
        return {
          command: ['sh', '-c', 'gcc -o main main.c && ./main'],
          filename: 'main.c'
        };

      case 'go':
        return {
          command: ['go', 'run', 'main.go'],
          filename: 'main.go'
        };

      case 'rust':
        return {
          command: ['sh', '-c', 'rustc main.rs && ./main'],
          filename: 'main.rs'
        };

      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private parseMemoryLimit(memoryLimit: string): number {
    const match = memoryLimit.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      throw new Error(`Invalid memory limit format: ${memoryLimit}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  private createTarStream(files: Array<{ name: string; data: Buffer }>): Readable {
    const { Readable } = require('stream');
    
    let fileIndex = 0;
    
    return new Readable({
      read() {
        if (fileIndex >= files.length) {
          this.push(null); // End of stream
          return;
        }

        const file = files[fileIndex++];
        const header = this.createTarHeader(file.name, file.data.length);
        
        this.push(header);
        this.push(file.data);
        
        // Add padding to align to 512-byte boundary
        const padding = 512 - (file.data.length % 512);
        if (padding !== 512) {
          this.push(Buffer.alloc(padding, 0));
        }
      }
    });
  }

  private createTarHeader(filename: string, size: number): Buffer {
    const header = Buffer.alloc(512, 0);
    
    // Filename (100 bytes)
    header.write(filename, 0, Math.min(filename.length, 100));
    
    // File mode (8 bytes) - octal
    header.write('0000644 ', 100, 8);
    
    // Owner ID (8 bytes) - octal
    header.write('0000000 ', 108, 8);
    
    // Group ID (8 bytes) - octal
    header.write('0000000 ', 116, 8);
    
    // File size (12 bytes) - octal
    header.write(size.toString(8).padStart(11, '0') + ' ', 124, 12);
    
    // Modification time (12 bytes) - octal
    const mtime = Math.floor(Date.now() / 1000);
    header.write(mtime.toString(8).padStart(11, '0') + ' ', 136, 12);
    
    // Checksum placeholder (8 bytes)
    header.write('        ', 148, 8);
    
    // Type flag (1 byte) - regular file
    header.write('0', 156, 1);
    
    // Calculate checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    
    // Write checksum
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    
    return header;
  }

  private async parseContainerLogs(stream: NodeJS.ReadableStream): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      const chunks: Buffer[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let offset = 0;
        
        while (offset < buffer.length) {
          if (buffer.length - offset < 8) break;
          
          const streamType = buffer.readUInt8(offset);
          const size = buffer.readUInt32BE(offset + 4);
          
          if (buffer.length - offset < 8 + size) break;
          
          const data = buffer.subarray(offset + 8, offset + 8 + size).toString('utf8');
          
          if (streamType === 1) {
            stdout += data;
          } else if (streamType === 2) {
            stderr += data;
          }
          
          offset += 8 + size;
        }
        
        resolve({ stdout, stderr });
      });
      
      stream.on('error', reject);
    });
  }

  async cleanup(): Promise<void> {
    // Docker handles cleanup automatically when containers are removed
    // This method is here for interface compliance
  }

  static getSupportedLanguages(): string[] {
    return [
      'javascript', 'js',
      'typescript', 'ts',
      'python', 'py', 'python2',
      'java',
      'cpp', 'c++',
      'c',
      'go',
      'rust'
    ];
  }

  static isLanguageSupported(language: string): boolean {
    return DockerExecutionEnvironment.getSupportedLanguages().includes(language.toLowerCase());
  }

  async validateEnvironment(): Promise<{ valid: boolean; missing: string[] }> {
    try {
      await this.docker.ping();
      return { valid: true, missing: [] };
    } catch (error) {
      return { 
        valid: false, 
        missing: ['docker'] 
      };
    }
  }

  async pullRequiredImages(): Promise<void> {
    const images = Object.values(this.defaultImages);
    const uniqueImages = [...new Set(images)];
    
    for (const image of uniqueImages) {
      try {
        await this.ensureImage(image);
      } catch (error) {
        throw new Error(`Failed to pull Docker image ${image}: ${(error as Error).message}`);
      }
    }
  }
}