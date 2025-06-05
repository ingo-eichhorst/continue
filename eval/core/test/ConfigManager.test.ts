import { ConfigManager } from '../ConfigManager';
import { BenchmarkConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('YAML Loading', () => {
    test('should be able to instantiate ConfigManager', () => {
      expect(() => new ConfigManager()).not.toThrow();
    });

    test('should load YAML configuration files', async () => {
      const configManager = new ConfigManager();
      
      // Mock YAML config file
      const mockConfig = {
        plugins: ['test-plugin'],
        output: {
          format: 'json',
          path: './reports'
        },
        timeout: 30000
      };
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
plugins:
  - test-plugin
output:
  format: json
  path: ./reports
timeout: 30000
`);
      
      const config = await configManager.loadConfig('/test/config.yaml');
      
      expect(config.plugins).toEqual(['test-plugin']);
      expect(config.output.format).toBe('json');
      expect(config.output.path).toBe('./reports');
      expect(config.timeout).toBe(30000);
    });

    test('should handle missing configuration files gracefully', async () => {
      const configManager = new ConfigManager();
      
      mockFs.existsSync.mockReturnValue(false);
      
      const config = await configManager.loadConfig('/nonexistent/config.yaml');
      
      // Should return default configuration
      expect(config).toHaveProperty('plugins');
      expect(config).toHaveProperty('output');
      expect(Array.isArray(config.plugins)).toBe(true);
    });

    test('should validate configuration schema', async () => {
      const configManager = new ConfigManager();
      
      // Mock invalid config file
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
plugins: "not-an-array"
output:
  format: invalid-format
`);
      
      await expect(configManager.loadConfig('/test/invalid-config.yaml'))
        .rejects.toThrow('Configuration validation failed');
    });
  });

  describe('Configuration Validation', () => {
    test('should validate configuration schema correctly', async () => {
      const configManager = new ConfigManager();
      
      const validConfig: BenchmarkConfig = {
        plugins: ['plugin1', 'plugin2'],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      expect(() => configManager.validateConfig(validConfig)).not.toThrow();
    });

    test('should reject invalid configurations', () => {
      const configManager = new ConfigManager();
      
      const invalidConfig = {
        plugins: 'not-an-array', // Should be array
        output: {
          format: 'invalid-format', // Should be json, yaml, or xml
          path: 123 // Should be string
        }
      } as any;
      
      expect(() => configManager.validateConfig(invalidConfig))
        .toThrow('Configuration validation failed');
    });

    test('should apply default values when missing', async () => {
      const configManager = new ConfigManager();
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
plugins:
  - test-plugin
output:
  format: json
  path: ./reports
# timeout is missing, should get default
`);
      
      const config = await configManager.loadConfig('/test/minimal-config.yaml');
      
      expect(config.timeout).toBeDefined();
      expect(typeof config.timeout).toBe('number');
      expect(config.parallel).toBeDefined();
      expect(typeof config.parallel).toBe('boolean');
    });
  });

  describe('Configuration Merging', () => {
    test('should merge multiple configuration files', async () => {
      const configManager = new ConfigManager();
      
      // Mock base config
      mockFs.existsSync.mockImplementation((filePath) => {
        return typeof filePath === 'string' && 
               (filePath.includes('base-config.yaml') || filePath.includes('override-config.yaml'));
      });
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('base-config.yaml')) {
            return `
plugins:
  - base-plugin
output:
  format: json
  path: ./reports
timeout: 30000
`;
          }
          if (filePath.includes('override-config.yaml')) {
            return `
plugins:
  - override-plugin
timeout: 60000
parallel: true
`;
          }
        }
        return '';
      });
      
      const config = await configManager.mergeConfigs([
        '/test/base-config.yaml',
        '/test/override-config.yaml'
      ]);
      
      // Should merge plugins array
      expect(config.plugins).toContain('base-plugin');
      expect(config.plugins).toContain('override-plugin');
      
      // Should override timeout
      expect(config.timeout).toBe(60000);
      
      // Should add new properties
      expect(config.parallel).toBe(true);
      
      // Should keep base properties not overridden
      expect(config.output.format).toBe('json');
    });

    test('should handle environment-specific overrides', async () => {
      const configManager = new ConfigManager();
      
      // Set environment variable
      process.env.NODE_ENV = 'test';
      
      mockFs.existsSync.mockImplementation((filePath) => {
        return typeof filePath === 'string' && 
               (filePath.includes('config.yaml') || filePath.includes('config.test.yaml'));
      });
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('config.test.yaml')) {
            return `
timeout: 5000
verbose: true
`;
          }
          if (filePath.includes('config.yaml')) {
            return `
plugins:
  - prod-plugin
output:
  format: json
  path: ./reports
timeout: 30000
`;
          }
        }
        return '';
      });
      
      const config = await configManager.loadConfigWithEnvironment('/test/config.yaml');
      
      // Should override timeout for test environment
      expect(config.timeout).toBe(5000);
      
      // Should add test-specific properties
      expect(config.verbose).toBe(true);
      
      // Should keep base properties
      expect(config.plugins).toContain('prod-plugin');
      
      // Clean up
      delete process.env.NODE_ENV;
    });

    test('should respect configuration hierarchy', async () => {
      const configManager = new ConfigManager();
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('global.yaml')) {
            return `
timeout: 10000
maxConcurrency: 5
`;
          }
          if (filePath.includes('project.yaml')) {
            return `
timeout: 20000
output:
  format: yaml
  path: ./project-reports
`;
          }
          if (filePath.includes('local.yaml')) {
            return `
timeout: 30000
verbose: true
`;
          }
        }
        return '';
      });
      
      const config = await configManager.loadConfigHierarchy([
        '/global/global.yaml',
        '/project/project.yaml', 
        '/local/local.yaml'
      ]);
      
      // Local should override project and global
      expect(config.timeout).toBe(30000);
      
      // Project should override global
      expect(config.output.format).toBe('yaml');
      
      // Global should provide base values
      expect(config.maxConcurrency).toBe(5);
      
      // Local additions should be preserved
      expect(config.verbose).toBe(true);
    });
  });
});