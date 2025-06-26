import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { BenchmarkPlugin } from "./types.js";
import type { Logger } from "./types.js";

export class PluginLoader {
  private logger: Logger;
  private pluginsDir: string;

  constructor(logger: Logger, pluginsDir: string) {
    this.logger = logger;
    this.pluginsDir = pluginsDir;
  }

  /**
   * Dynamically discovers and loads all plugins from the plugins directory
   */
  async loadPlugins(): Promise<BenchmarkPlugin[]> {
    const plugins: BenchmarkPlugin[] = [];

    try {
      // Read all directories in the plugins folder
      const pluginDirs = await this.getPluginDirectories();
      
      this.logger.info(`Found ${pluginDirs.length} potential plugin directories`);

      for (const pluginDir of pluginDirs) {
        try {
          const plugin = await this.loadPlugin(pluginDir);
          if (plugin) {
            plugins.push(plugin);
            this.logger.info(`Successfully loaded plugin: ${plugin.name}`);
          }
        } catch (error) {
          this.logger.warn(`Failed to load plugin from ${pluginDir}: ${(error as Error).message}`);
        }
      }

      this.logger.info(`Loaded ${plugins.length} plugins total`);
      return plugins;

    } catch (error) {
      this.logger.error(`Failed to scan plugins directory: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Get all subdirectories in the plugins folder
   */
  private async getPluginDirectories(): Promise<string[]> {
    const entries = await readdir(this.pluginsDir);
    const directories: string[] = [];

    for (const entry of entries) {
      const fullPath = join(this.pluginsDir, entry);
      const stats = await stat(fullPath);
      
      if (stats.isDirectory()) {
        directories.push(entry);
      }
    }

    return directories;
  }

  /**
   * Load a single plugin from a directory
   */
  private async loadPlugin(pluginDirName: string): Promise<BenchmarkPlugin | null> {
    const pluginDir = join(this.pluginsDir, pluginDirName);
    
    // Try to find the main plugin file
    const possibleFiles = [
      join(pluginDir, 'index.ts'),
      join(pluginDir, 'index.js'),
      // Try to find TypeScript files that might contain the plugin class
      ...(await this.findTsFiles(pluginDir))
    ];

    for (const filePath of possibleFiles) {
      try {
        const plugin = await this.loadPluginFromFile(filePath);
        if (plugin) {
          return plugin;
        }
      } catch (error) {
        // Continue trying other files
        this.logger.debug(`Failed to load from ${filePath}: ${(error as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Find all TypeScript files in a plugin directory
   */
  private async findTsFiles(pluginDir: string): Promise<string[]> {
    try {
      const entries = await readdir(pluginDir);
      return entries
        .filter(entry => entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
        .map(entry => join(pluginDir, entry));
    } catch (error) {
      return [];
    }
  }

  /**
   * Load a plugin from a specific file
   */
  private async loadPluginFromFile(filePath: string): Promise<BenchmarkPlugin | null> {
    try {
      // Convert file path to file URL for dynamic import
      const fileUrl = pathToFileURL(filePath).href;
      
      // Dynamic import the module
      const module = await import(fileUrl);
      
      // Look for plugin classes in the module
      const plugin = this.extractPluginFromModule(module);
      
      if (plugin && this.isValidPlugin(plugin)) {
        return plugin;
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to import ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Extract a BenchmarkPlugin instance from an imported module
   */
  private extractPluginFromModule(module: any): BenchmarkPlugin | null {
    // Check for default export that's a plugin class
    if (module.default && typeof module.default === 'function') {
      try {
        const instance = new module.default();
        if (this.isValidPlugin(instance)) {
          return instance;
        }
      } catch (error) {
        // Not a valid constructor
      }
    }

    // Check for named exports that could be plugin classes
    for (const [exportName, exportValue] of Object.entries(module)) {
      if (typeof exportValue === 'function' && exportName !== 'default') {
        try {
          const instance = new (exportValue as any)();
          if (this.isValidPlugin(instance)) {
            return instance;
          }
        } catch (error) {
          // Not a valid constructor or not a plugin
        }
      }
    }

    return null;
  }

  /**
   * Validate that an object implements the BenchmarkPlugin interface
   */
  private isValidPlugin(obj: any): obj is BenchmarkPlugin {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.propertiesSchema === 'object' &&
      typeof obj.execute === 'function'
    );
  }
}