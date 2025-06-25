import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { ILLM, Logger } from './types.js';

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
        // Convert config to ILLM instance
        const llmInstance = this.createLLMFromConfig(model);
        requestedModels.push(llmInstance);
        this.logger.info(`Loaded model: ${model.title || model.model} (${model.provider || 'unknown'})`);
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

  private createLLMFromConfig(modelConfig: any): ILLM {
    // Create an ILLM instance from Continue config
    // This should integrate with actual LLM provider instances
    
    const modelId = modelConfig.title || modelConfig.model;
    const provider = modelConfig.provider || modelConfig.providerName;
    const apiKey = modelConfig.apiKey;
    
    if (!modelId) {
      throw new Error(`Model configuration missing title or model name: ${JSON.stringify(modelConfig)}`);
    }
    
    if (!provider) {
      throw new Error(`Model configuration missing provider for model ${modelId}: ${JSON.stringify(modelConfig)}`);
    }
    
    if (!apiKey) {
      throw new Error(`Model configuration missing API key for model ${modelId} (provider: ${provider}). Please configure apiKey in your Continue config.`);
    }
    
    // Create ILLM instance from config
    // TODO: This should create actual provider instances, not placeholder objects
    const llmInstance: ILLM = {
      uniqueId: `${provider}-${modelId}`,
      model: modelConfig.model || modelId,
      title: modelConfig.title || modelId,
      providerName: provider,
      contextLength: modelConfig.contextLength || 4096,
      completionOptions: modelConfig.completionOptions || {
        temperature: 0.1,
        maxTokens: 1000
      },
      
      async *streamChat() {
        throw new Error(`Model ${modelId} (${provider}) requires actual LLM provider implementation. This is a placeholder that only validates configuration.`);
      }
    };
    
    this.logger.info(`Created model instance: ${modelId} (${provider})`);
    return llmInstance;
  }

  // Method to list available models from Continue config
  async listAvailableModels(): Promise<string[]> {
    const config = await this.loadContinueConfig();
    return config.models?.map((m: any) => m.title || m.model) || [];
  }
}