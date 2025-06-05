import { BenchmarkRunner } from '../BenchmarkRunner';
import { PluginLoader } from '../PluginLoader';
import { ConfigManager } from '../ConfigManager';
import { BenchmarkConfig, BenchmarkError, PluginError } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Micro-kernel Components Integration', () => {
    test('should integrate all components for end-to-end workflow', async () => {
      // Setup ConfigManager
      const configManager = new ConfigManager();
      
      // Mock config file
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
plugins:
  - test-plugin
output:
  format: json
  path: ./reports
timeout: 30000
parallel: false
`);

      // Load configuration
      const config = await configManager.loadConfig('/test/config.yaml');
      expect(config.plugins).toEqual(['test-plugin']);
      expect(config.output.format).toBe('json');

      // Setup PluginLoader
      const pluginLoader = new PluginLoader('/test/plugins');
      
      // Mock plugin discovery
      mockFs.readdirSync.mockReturnValue(['test-plugin'] as any);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);
      
      // Verify plugin discovery works
      const manifests = await pluginLoader.discoverPlugins();
      expect(Array.isArray(manifests)).toBe(true);

      // Setup BenchmarkRunner with loaded config
      const benchmarkRunner = new BenchmarkRunner(config);
      expect(benchmarkRunner.getConfig()).toEqual(config);

      // Execute benchmark - should handle plugin loading gracefully
      const results = await benchmarkRunner.run();
      
      // Verify results structure
      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('results');
      expect(results).toHaveProperty('metadata');
      expect(results.metadata.framework).toBe('continue-eval');
    });

    test('should handle end-to-end benchmark execution flow', async () => {
      const configManager = new ConfigManager();
      
      // Create a complete config
      const config: BenchmarkConfig = {
        plugins: ['integration-test-plugin'],
        output: {
          format: 'json',
          path: './integration-reports'
        },
        timeout: 10000,
        parallel: true,
        maxConcurrency: 2,
        verbose: true
      };

      // Validate config through ConfigManager
      expect(() => configManager.validateConfig(config)).not.toThrow();

      // Create BenchmarkRunner
      const runner = new BenchmarkRunner(config);
      
      // Execute benchmark
      const startTime = Date.now();
      const results = await runner.run();
      const executionTime = Date.now() - startTime;

      // Verify execution completed
      expect(results.summary.duration).toBeGreaterThanOrEqual(0);
      expect(results.summary.duration).toBeLessThan(executionTime + 1000); // Allow some margin
      
      // Verify metadata includes environment info
      expect(results.metadata.environment).toHaveProperty('node');
      expect(results.metadata.environment).toHaveProperty('platform');
      expect(results.metadata.environment).toHaveProperty('arch');
      
      // Verify configuration is preserved in metadata
      expect(results.metadata.config).toEqual(config);
    });

    test('should propagate errors between components correctly', async () => {
      const configManager = new ConfigManager();
      
      // Test invalid configuration propagation
      const invalidConfig = {
        plugins: 'not-an-array', // Invalid type
        output: {
          format: 'invalid-format',
          path: 123 // Invalid type
        }
      } as any;

      // ConfigManager should reject invalid config
      expect(() => configManager.validateConfig(invalidConfig))
        .toThrow('Configuration validation failed');

      // Test BenchmarkRunner error handling
      const validConfig: BenchmarkConfig = {
        plugins: ['non-existent-plugin'],
        output: {
          format: 'json',
          path: './reports'
        }
      };

      const runner = new BenchmarkRunner(validConfig);
      const results = await runner.run();

      // Should handle plugin errors gracefully
      expect(results.summary.failed).toBeGreaterThan(0);
      expect(results.metadata.errors).toBeDefined();
      expect(results.metadata.errors!.length).toBeGreaterThan(0);
      expect(results.metadata.errors![0]).toContain('non-existent-plugin');
    });
  });

  describe('Configuration and Plugin Loading Integration', () => {
    test('should load configuration and discover plugins together', async () => {
      const configManager = new ConfigManager();
      const pluginLoader = new PluginLoader('/test/plugins');

      // Mock config with plugin list
      mockFs.existsSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          return filePath.includes('config.yaml') || 
                 filePath.includes('/test/plugins') ||
                 filePath.includes('manifest.json');
        }
        return false;
      });

      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('config.yaml')) {
            return `
plugins:
  - plugin-a
  - plugin-b
output:
  format: yaml
  path: ./custom-reports
`;
          }
          if (filePath.includes('manifest.json')) {
            const pluginName = path.basename(path.dirname(filePath));
            return JSON.stringify({
              name: pluginName,
              version: '1.0.0',
              description: `Test plugin ${pluginName}`,
              entryPoint: 'index.js'
            });
          }
        }
        return '';
      });

      mockFs.readdirSync.mockReturnValue(['plugin-a', 'plugin-b', 'plugin-c'] as any);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);

      // Load config
      const config = await configManager.loadConfig('/test/config.yaml');
      expect(config.plugins).toEqual(['plugin-a', 'plugin-b']);

      // Discover all available plugins
      const availablePlugins = await pluginLoader.discoverPlugins();
      expect(availablePlugins.length).toBe(3);
      expect(availablePlugins.map(p => p.name)).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);

      // Load only configured plugins
      const loadedPlugins = await pluginLoader.loadPlugins(config.plugins);
      
      // Should attempt to load configured plugins
      expect(loadedPlugins.length).toBe(0); // No actual implementations loaded yet
      
      // Should not have errors for valid plugins
      const errors = pluginLoader.getValidationErrors();
      expect(errors.length).toBe(0);
    });

    test('should handle configuration merging with multiple environments', async () => {
      const configManager = new ConfigManager();

      // Mock multiple config files
      mockFs.existsSync.mockImplementation((filePath) => {
        return typeof filePath === 'string' && 
               (filePath.includes('base.yaml') || 
                filePath.includes('development.yaml') || 
                filePath.includes('production.yaml'));
      });

      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('base.yaml')) {
            return `
plugins:
  - core-plugin
output:
  format: json
  path: ./reports
timeout: 30000
`;
          }
          if (filePath.includes('development.yaml')) {
            return `
plugins:
  - dev-plugin
timeout: 5000
verbose: true
maxConcurrency: 1
`;
          }
          if (filePath.includes('production.yaml')) {
            return `
plugins:
  - prod-plugin
timeout: 60000
verbose: false
maxConcurrency: 8
`;
          }
        }
        return '';
      });

      // Test development configuration
      const devConfig = await configManager.mergeConfigs([
        '/config/base.yaml',
        '/config/development.yaml'
      ]);

      expect(devConfig.plugins).toContain('core-plugin');
      expect(devConfig.plugins).toContain('dev-plugin');
      expect(devConfig.timeout).toBe(5000);
      expect(devConfig.verbose).toBe(true);
      expect(devConfig.maxConcurrency).toBe(1);

      // Test production configuration
      const prodConfig = await configManager.mergeConfigs([
        '/config/base.yaml',
        '/config/production.yaml'
      ]);

      expect(prodConfig.plugins).toContain('core-plugin');
      expect(prodConfig.plugins).toContain('prod-plugin');
      expect(prodConfig.timeout).toBe(60000);
      expect(prodConfig.verbose).toBe(false);
      expect(prodConfig.maxConcurrency).toBe(8);

      // Both should maintain base settings
      expect(devConfig.output.format).toBe('json');
      expect(prodConfig.output.format).toBe('json');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle cascading errors gracefully', async () => {
      // Test scenario where config is valid but plugins fail
      const config: BenchmarkConfig = {
        plugins: ['failing-plugin-1', 'failing-plugin-2'],
        output: {
          format: 'json',
          path: './reports'
        }
      };

      const runner = new BenchmarkRunner(config);
      
      // Should not throw, but return error results
      const results = await runner.run();
      
      expect(results.summary.failed).toBe(2);
      expect(results.summary.passed).toBe(0);
      expect(results.summary.totalTests).toBe(2);
      
      // Should have detailed error information
      expect(results.metadata.errors).toBeDefined();
      expect(results.metadata.errors!.length).toBe(2);
      
      // Each error should reference the failing plugin
      expect(results.metadata.errors![0]).toContain('failing-plugin-1');
      expect(results.metadata.errors![1]).toContain('failing-plugin-2');
      
      // Results should include failed test entries
      expect(results.results.length).toBe(2);
      expect(results.results.every(r => r.status === 'failed')).toBe(true);
    });

    test('should maintain system stability during errors', async () => {
      const runner = new BenchmarkRunner({
        plugins: ['unstable-plugin'],
        output: {
          format: 'json',
          path: './reports'
        }
      });

      // Multiple runs should not affect each other
      const results1 = await runner.run();
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const results2 = await runner.run();
      
      expect(results1.summary.failed).toBe(1);
      expect(results2.summary.failed).toBe(1);
      
      // Each run should be independent
      expect(results1.metadata.timestamp.getTime()).not.toEqual(results2.metadata.timestamp.getTime());
      expect(results1.summary.startTime.getTime()).not.toEqual(results2.summary.startTime.getTime());
    });

    test('should handle graceful shutdown during execution', async () => {
      const config: BenchmarkConfig = {
        plugins: ['long-running-plugin'],
        output: {
          format: 'json',
          path: './reports'
        }
      };

      const runner = new BenchmarkRunner(config);
      
      // Start execution
      const executionPromise = runner.run();
      
      // Stop immediately
      runner.stop();
      
      // Should still complete gracefully
      const results = await executionPromise;
      expect(results).toHaveProperty('summary');
      expect(results).toHaveProperty('metadata');
    });
  });
});