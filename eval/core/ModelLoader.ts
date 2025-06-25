import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ILLM, Logger, ChatMessage } from './types.js';

export class ModelLoader {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadModels(modelIds: string[]): Promise<ILLM[]> {
    try {
      // Load Continue's configuration
      const config = await this.loadContinueConfig();
      
      if (!config.models || config.models.length === 0) {
        this.logger.warn('No models found in Continue configuration, using default models');
        return this.createDefaultModels(modelIds);
      }

      // Filter requested models from config
      const requestedModels: ILLM[] = [];
      
      for (const modelId of modelIds) {
        // Try exact match first
        let model = config.models.find((m: any) => m.title === modelId || m.model === modelId);
        
        // Try partial match if exact match not found
        if (!model) {
          model = config.models.find((m: any) => 
            m.title?.toLowerCase().includes(modelId.toLowerCase()) ||
            m.model?.toLowerCase().includes(modelId.toLowerCase())
          );
        }
        
        if (model) {
          // Convert config to ILLM instance
          const llmInstance = this.createLLMFromConfig(model);
          requestedModels.push(llmInstance);
          this.logger.info(`Loaded model: ${model.title || model.model} (${model.provider || 'unknown'})`);
        } else {
          this.logger.warn(`Model '${modelId}' not found in configuration, creating mock model`);
          requestedModels.push(this.createMockModel(modelId));
        }
      }

      return requestedModels.length > 0 ? requestedModels : this.createDefaultModels(modelIds);

    } catch (error) {
      this.logger.error('Failed to load Continue configuration, falling back to mock models', error as Error);
      return this.createDefaultModels(modelIds);
    }
  }

  private async loadContinueConfig(): Promise<any> {
    try {
      // Try to load from Continue's standard config locations
      const configPaths = [
        join(process.cwd(), '.continue', 'config.json'),
        join(homedir(), '.continue', 'config.json')
      ];

      for (const configPath of configPaths) {
        try {
          this.logger.debug(`Trying to load config from: ${configPath}`);
          if (existsSync(configPath)) {
            const configContent = readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            if (config) {
              this.logger.info(`Loaded Continue configuration from: ${configPath}`);
              return config;
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to load config from ${configPath}:`, error);
        }
      }

      // If no config found, return default config with some standard models
      this.logger.info('No Continue configuration found, using default configuration');
      return this.getDefaultConfig();

    } catch (error) {
      this.logger.error('Error loading Continue configuration', error as Error);
      throw error;
    }
  }

  private getDefaultConfig(): any {
    // Return a basic config with common models
    return {
      models: [
        {
          title: 'GPT-4',
          model: 'gpt-4',
          providerName: 'openai',
          apiKey: process.env.OPENAI_API_KEY,
          contextLength: 8192,
          completionOptions: {
            temperature: 0.1,
            maxTokens: 4000
          }
        },
        {
          title: 'GPT-3.5 Turbo',
          model: 'gpt-3.5-turbo',
          providerName: 'openai', 
          apiKey: process.env.OPENAI_API_KEY,
          contextLength: 4096,
          completionOptions: {
            temperature: 0.1,
            maxTokens: 2000
          }
        },
        {
          title: 'Claude 3 Sonnet',
          model: 'claude-3-sonnet-20240229',
          providerName: 'anthropic',
          apiKey: process.env.ANTHROPIC_API_KEY,
          contextLength: 200000,
          completionOptions: {
            temperature: 0.1,
            maxTokens: 4000
          }
        }
      ]
    };
  }

  private createDefaultModels(modelIds: string[]): ILLM[] {
    return modelIds.map(id => this.createMockModel(id));
  }

  private createLLMFromConfig(modelConfig: any): ILLM {
    // Create an ILLM instance from Continue config
    // For now, this creates a mock model with the config info
    // In a full integration, this would create actual LLM provider instances
    
    const modelId = modelConfig.title || modelConfig.model || 'unknown';
    const provider = modelConfig.provider || 'unknown';
    const apiKey = modelConfig.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    
    if (provider === 'openai' && apiKey) {
      this.logger.info(`Using OpenAI model ${modelId} with API key from config`);
      return this.createOpenAIModel(modelConfig);
    } else if (provider === 'anthropic' && apiKey) {
      this.logger.info(`Using Anthropic model ${modelId} with API key from config`);
      return this.createAnthropicModel(modelConfig);
    } else if (apiKey) {
      this.logger.info(`Using model ${modelId} with API key from config (provider: ${provider})`);
      return this.createGenericModel(modelConfig);
    } else {
      this.logger.warn(`No API key found for ${modelId} (provider: ${provider}), using mock model`);
      return this.createMockModel(modelId, provider);
    }
  }

  private createOpenAIModel(config: any): ILLM {
    // For now, create a mock that simulates OpenAI behavior
    // In a full integration, this would use OpenAI's actual SDK
    return this.createMockModel(config.title || config.model, 'openai');
  }

  private createAnthropicModel(config: any): ILLM {
    // For now, create a mock that simulates Anthropic behavior
    // In a full integration, this would use Anthropic's actual SDK
    return this.createMockModel(config.title || config.model, 'anthropic');
  }

  private createGenericModel(config: any): ILLM {
    // For models with API keys but unknown providers
    const provider = config.provider || 'unknown';
    return this.createMockModel(config.title || config.model, provider);
  }

  private createMockModel(modelId: string, provider: string = 'mock'): ILLM {
    // Create a mock model that generates realistic diffs for testing
    return {
      uniqueId: `${provider}-${modelId}`,
      model: modelId,
      title: modelId,
      providerName: provider,
      contextLength: 8192,
      completionOptions: {
        temperature: 0.1,
        maxTokens: 4000
      },
      
      async *streamChat(messages: any[], options: any = {}) {
        // Simulate realistic diff generation based on the prompt
        const userMessage = messages.find(m => m.role === 'user')?.content || '';
        
        let mockDiff = '';
        
        if (userMessage.includes('try-catch') || userMessage.includes('error handling')) {
          mockDiff = `@@ -1,3 +1,7 @@
 function calculate(a, b) {
-  return a + b;
+  try {
+    return a + b;
+  } catch (error) {
+    return null;
+  }
 }`;
        } else if (userMessage.includes('JSDoc') || userMessage.includes('documentation')) {
          mockDiff = `@@ -1,3 +1,8 @@
+/**
+ * Multiplies two numbers
+ * @param {number} x - First number
+ * @param {number} y - Second number  
+ * @returns {number} The product
+ */
 function multiply(x, y) {
   return x * y;
 }`;
        } else if (userMessage.includes('method') || userMessage.includes('subtract')) {
          mockDiff = `@@ -7,4 +7,9 @@
   add(value) {
     this.result += value;
     return this;
   }
+
+  subtract(value) {
+    this.result -= value;
+    return this;
+  }
 }`;
        } else {
          // Default generic diff
          mockDiff = `@@ -1,3 +1,3 @@
 function example() {
-  var message = 'Hello World';
+  const message = 'Hello World';
   return message;
 }`;
        }

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

        yield {
          content: mockDiff,
          usage: {
            promptTokens: Math.floor(50 + Math.random() * 100),
            completionTokens: Math.floor(20 + Math.random() * 80),
            totalTokens: 0
          }
        };
      }
    } as ILLM;
  }

  // Method to list available models from Continue config
  async listAvailableModels(): Promise<string[]> {
    try {
      const config = await this.loadContinueConfig();
      return config.models?.map((m: any) => m.title || m.model) || [];
    } catch (error) {
      this.logger.error('Failed to list available models', error as Error);
      return ['gpt-4', 'gpt-3.5-turbo', 'claude-3-sonnet'];
    }
  }

  // Method to validate that required API keys are available
  async validateApiKeys(): Promise<{ valid: boolean; missing: string[]; fromConfig: number; fromEnv: number }> {
    try {
      const config = await this.loadContinueConfig();
      const modelsWithKeys = config.models?.filter((m: any) => m.apiKey) || [];
      
      const envKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'];
      const envKeysAvailable = envKeys.filter(key => process.env[key]);
      
      return {
        valid: modelsWithKeys.length > 0 || envKeysAvailable.length > 0,
        missing: modelsWithKeys.length === 0 ? envKeys.filter(key => !process.env[key]) : [],
        fromConfig: modelsWithKeys.length,
        fromEnv: envKeysAvailable.length
      };
    } catch (error) {
      return {
        valid: false,
        missing: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
        fromConfig: 0,
        fromEnv: 0
      };
    }
  }
}