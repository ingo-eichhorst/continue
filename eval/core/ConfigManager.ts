import { BenchmarkConfig, ConfigurationError, ConfigSchema } from './types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export class ConfigManager {
  private defaultConfig: BenchmarkConfig = {
    plugins: [],
    output: {
      format: 'json',
      path: './reports'
    },
    timeout: 30000,
    parallel: false,
    maxConcurrency: 4,
    verbose: false
  };

  private configSchema: ConfigSchema = {
    plugins: {
      type: 'array',
      required: true,
      description: 'List of plugin names to load'
    },
    output: {
      type: 'object',
      required: true,
      description: 'Output configuration'
    },
    timeout: {
      type: 'number',
      required: false,
      default: 30000,
      description: 'Timeout for benchmark execution in milliseconds'
    },
    parallel: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Whether to run benchmarks in parallel'
    },
    maxConcurrency: {
      type: 'number',
      required: false,
      default: 4,
      description: 'Maximum number of concurrent benchmark executions'
    },
    verbose: {
      type: 'boolean',
      required: false,
      default: false,
      description: 'Enable verbose logging'
    }
  };

  public async loadConfig(configPath: string): Promise<BenchmarkConfig> {
    if (!fs.existsSync(configPath)) {
      return { ...this.defaultConfig };
    }

    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = yaml.parse(configContent);
      
      // Merge with defaults
      const config = this.mergeWithDefaults(parsedConfig);
      
      // Validate the merged config
      this.validateConfig(config);
      
      return config;
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error;
      }
      throw new ConfigurationError(`Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public validateConfig(config: any): void {
    if (!config || typeof config !== 'object') {
      throw new ConfigurationError('Configuration must be an object');
    }

    // Validate required fields
    for (const [field, schema] of Object.entries(this.configSchema)) {
      if (schema.required && !(field in config)) {
        throw new ConfigurationError(`Configuration validation failed: missing required field '${field}'`);
      }

      if (field in config) {
        const value = config[field];
        
        // Type validation
        if (!this.validateFieldType(value, schema.type, field)) {
          throw new ConfigurationError(`Configuration validation failed: field '${field}' must be of type ${schema.type}`);
        }

        // Special validation for output format
        if (field === 'output' && value && typeof value === 'object') {
          if (!value.format || !['json', 'yaml', 'xml'].includes(value.format)) {
            throw new ConfigurationError('Configuration validation failed: output.format must be json, yaml, or xml');
          }
          if (!value.path || typeof value.path !== 'string') {
            throw new ConfigurationError('Configuration validation failed: output.path must be a string');
          }
        }

        // Custom validation if provided
        if (schema.validation && !schema.validation(value)) {
          throw new ConfigurationError(`Configuration validation failed: field '${field}' failed custom validation`);
        }
      }
    }
  }

  public async mergeConfigs(configPaths: string[]): Promise<BenchmarkConfig> {
    let mergedConfig = { ...this.defaultConfig };

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const parsedConfig = yaml.parse(configContent);
          
          mergedConfig = this.deepMerge(mergedConfig, parsedConfig);
        } catch (error) {
          throw new ConfigurationError(`Failed to merge configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    this.validateConfig(mergedConfig);
    return mergedConfig;
  }

  public async loadConfigWithEnvironment(configPath: string): Promise<BenchmarkConfig> {
    const configPaths = [configPath];
    
    // Look for environment-specific config
    const env = process.env.NODE_ENV;
    if (env) {
      const dir = path.dirname(configPath);
      const basename = path.basename(configPath, path.extname(configPath));
      const ext = path.extname(configPath);
      const envConfigPath = path.join(dir, `${basename}.${env}${ext}`);
      
      if (fs.existsSync(envConfigPath)) {
        configPaths.push(envConfigPath);
      }
    }

    return this.mergeConfigs(configPaths);
  }

  public async loadConfigHierarchy(configPaths: string[]): Promise<BenchmarkConfig> {
    return this.mergeConfigs(configPaths);
  }

  private mergeWithDefaults(config: any): BenchmarkConfig {
    const merged = { ...this.defaultConfig };
    
    for (const [key, value] of Object.entries(config)) {
      if (key in this.configSchema) {
        const schema = this.configSchema[key];
        
        if (key === 'plugins' && Array.isArray(value)) {
          // For plugins, merge arrays instead of replacing
          merged.plugins = [...merged.plugins, ...value];
        } else if (key === 'output' && typeof value === 'object' && value !== null) {
          // For output, merge objects
          merged.output = { ...merged.output, ...value };
        } else {
          (merged as any)[key] = value;
        }
      }
    }

    return merged;
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const [key, value] of Object.entries(source)) {
      if (key === 'plugins' && Array.isArray(value) && Array.isArray(result[key])) {
        // Merge plugin arrays, avoiding duplicates
        const existingPlugins = new Set(result[key]);
        const newPlugins = value.filter(plugin => !existingPlugins.has(plugin));
        result[key] = [...result[key], ...newPlugins];
      } else if (value && typeof value === 'object' && !Array.isArray(value) && 
                 result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        // Deep merge objects
        result[key] = this.deepMerge(result[key], value);
      } else {
        // Direct assignment for primitives and arrays (except plugins)
        result[key] = value;
      }
    }

    return result;
  }

  private validateFieldType(value: any, expectedType: string, fieldName: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return value !== null && typeof value === 'object' && !Array.isArray(value);
      default:
        return true;
    }
  }
}