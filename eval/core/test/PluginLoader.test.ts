import { PluginLoader } from '../PluginLoader';
import { IBenchmarkPlugin, PluginManifest } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('PluginLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Interface Foundation', () => {
    test('should be able to instantiate PluginLoader', () => {
      const pluginsPath = '/test/plugins';
      expect(() => new PluginLoader(pluginsPath)).not.toThrow();
    });

    test('should have a loadPlugins() method that returns Promise<IBenchmarkPlugin[]>', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      expect(typeof loader.loadPlugins).toBe('function');
      
      // Mock empty directory
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = loader.loadPlugins(['test-plugin']);
      expect(result).toBeInstanceOf(Promise);
      
      const plugins = await result;
      expect(Array.isArray(plugins)).toBe(true);
    });

    test('should have a discoverPlugins() method for automatic discovery', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      expect(typeof loader.discoverPlugins).toBe('function');
      
      // Mock empty directory
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      
      const result = loader.discoverPlugins();
      expect(result).toBeInstanceOf(Promise);
      
      const manifest = await result;
      expect(Array.isArray(manifest)).toBe(true);
    });
  });

  describe('Plugin Discovery', () => {
    test('should find plugins in plugins directory', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      // Mock directory with plugin files
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['plugin1', 'plugin2', 'not-a-plugin.txt'] as any);
      mockFs.lstatSync.mockImplementation((filePath) => ({
        isDirectory: () => typeof filePath === 'string' && !filePath.endsWith('.txt')
      }) as any);
      
      // Mock manifest files
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('manifest.json')) {
          return JSON.stringify({
            name: path.basename(path.dirname(filePath)),
            version: '1.0.0',
            description: 'Test plugin',
            entryPoint: 'index.js'
          });
        }
        return '';
      });
      
      const manifests = await loader.discoverPlugins();
      expect(manifests.length).toBe(2);
      expect(manifests[0].name).toBe('plugin1');
      expect(manifests[1].name).toBe('plugin2');
    });

    test('should ignore non-plugin files', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      // Mock directory with mixed content
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['plugin1', 'readme.txt', '.hidden', 'plugin2'] as any);
      mockFs.lstatSync.mockImplementation((filePath) => ({
        isDirectory: () => typeof filePath === 'string' && 
          !filePath.endsWith('.txt') && 
          !filePath.includes('.hidden')
      }) as any);
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('manifest.json')) {
          return JSON.stringify({
            name: path.basename(path.dirname(filePath)),
            version: '1.0.0',
            description: 'Test plugin',
            entryPoint: 'index.js'
          });
        }
        return '';
      });
      
      const manifests = await loader.discoverPlugins();
      expect(manifests.length).toBe(2);
      expect(manifests.every((m: any) => ['plugin1', 'plugin2'].includes(m.name))).toBe(true);
    });

    test('should handle empty plugin directory', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([]);
      
      const manifests = await loader.discoverPlugins();
      expect(manifests).toEqual([]);
    });

    test('should handle non-existent plugin directory', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      mockFs.existsSync.mockReturnValue(false);
      
      const manifests = await loader.discoverPlugins();
      expect(manifests).toEqual([]);
    });
  });

  describe('Plugin Validation', () => {
    test('should validate plugins before loading', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      // Mock plugin discovery
      mockFs.existsSync.mockImplementation((filePath) => {
        // Mock directory and manifest file existence
        if (typeof filePath === 'string') {
          return filePath.includes('/test/plugins') || filePath.includes('manifest.json');
        }
        return false;
      });
      
      mockFs.readdirSync.mockReturnValue(['valid-plugin', 'invalid-plugin'] as any);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath === '/test/plugins/valid-plugin/manifest.json') {
            return JSON.stringify({
              name: 'valid-plugin',
              version: '1.0.0',
              description: 'Valid test plugin',
              entryPoint: 'index.js'
            });
          }
          if (filePath === '/test/plugins/invalid-plugin/manifest.json') {
            return JSON.stringify({
              name: 'invalid-plugin'
              // Missing required fields: version, description, entryPoint
            });
          }
        }
        return '';
      });
      
      const result = await loader.loadPlugins(['valid-plugin', 'invalid-plugin']);
      
      // Should only load valid plugins
      expect(result.length).toBe(0); // No actual implementations loaded yet
      
      // Should track validation errors
      const errors = loader.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((err: any) => err.includes('invalid-plugin'))).toBe(true);
    });

    test('should reject invalid plugins with clear error messages', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['bad-plugin'] as any);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('manifest.json')) {
          return 'invalid json';
        }
        return '';
      });
      
      await loader.loadPlugins(['bad-plugin']);
      
      const errors = loader.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('bad-plugin');
      expect(errors[0]).toContain('manifest');
    });

    test('should check plugin interface compliance', async () => {
      const pluginsPath = '/test/plugins';
      const loader = new PluginLoader(pluginsPath);
      
      // This test verifies that the manifest validation checks required fields
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue(['incomplete-plugin'] as any);
      mockFs.lstatSync.mockReturnValue({ isDirectory: () => true } as any);
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('manifest.json')) {
          return JSON.stringify({
            name: 'incomplete-plugin'
            // Missing version, description, entryPoint
          });
        }
        return '';
      });
      
      await loader.loadPlugins(['incomplete-plugin']);
      
      const errors = loader.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('incomplete-plugin');
    });
  });
});