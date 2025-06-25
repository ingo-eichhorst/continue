import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { ILLM, LLMOptions } from '../../core/index.js';
import { llmFromProviderAndOptions } from '../../core/llm/llms/index.js';
import { Logger } from './types.js';

export class ModelLoader {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async loadModels(modelIds: string[]): Promise<ILLM[]> {
    // Load Continue's configuration
    const config = await this.loadContinueConfig();
    
    if (!config.models || config.models.length === 0) {
      throw new Error('No models found in Continue configuration. Please configure models in your Continue config.');
    }

    // Filter requested models from config
    const requestedModels: ILLM[] = [];
    const notFoundModels: string[] = [];
    
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
        try {
          // Use Continue's factory function to create actual provider instances
          const llmInstance = await this.createLLMFromConfig(model.provider, model);
          requestedModels.push(llmInstance);
          this.logger.info(`Loaded model: ${model.title || model.model} (${model.provider || 'unknown'})`);
        } catch (error) {
          this.logger.error(`Failed to create LLM instance for ${model.title || model.model}:`, error as Error);
          notFoundModels.push(modelId);
        }
      } else {
        notFoundModels.push(modelId);
      }
    }

    if (notFoundModels.length > 0) {
      throw new Error(`Models not found in configuration: ${notFoundModels.join(', ')}. Available models: ${config.models.map((m: any) => m.title || m.model).join(', ')}`);
    }

    if (requestedModels.length === 0) {
      throw new Error('No valid models could be loaded from the configuration.');
    }

    return requestedModels;
  }

  private async loadContinueConfig(): Promise<any> {
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

    // If no config found, throw error
    throw new Error(`No Continue configuration found. Please ensure a config.json file exists in one of these locations: ${configPaths.join(', ')}`);
  }

  private async createLLMFromConfig(provider: string, modelConfig: LLMOptions): Promise<ILLM> {
    if (!modelConfig.model) {
      throw new Error(`Model configuration missing title or model name: ${JSON.stringify(modelConfig)}`);
    }
        
    // Create LLMOptions from config
    const llmOptions: LLMOptions = modelConfig

    // Use Continue's factory function to create the LLM instance
    const continueModel = llmFromProviderAndOptions(provider, llmOptions);
    
    if (!continueModel) {
      throw new Error(`Failed to create LLM instance for provider "${provider}". Provider not found in Continue's LLM registry.`);
    }
        
    this.logger.info(`Created model instance: ${modelConfig.model} (${provider}) using Continue's ${continueModel.constructor.name}`);
    return continueModel;
  }

  // Method to list available models from Continue config
  async listAvailableModels(): Promise<string[]> {
    const config = await this.loadContinueConfig();
    return config.models?.map((m: any) => m.title || m.model) || [];
  }
}