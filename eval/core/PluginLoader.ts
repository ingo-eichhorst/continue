import { IBenchmarkPlugin, PluginManifest, PluginError } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class PluginLoader {
  private pluginsPath: string;
  private validationErrors: string[] = [];

  constructor(pluginsPath: string) {
    this.pluginsPath = pluginsPath;
  }

  public async loadPlugins(pluginNames: string[]): Promise<IBenchmarkPlugin[]> {
    this.validationErrors = [];
    const plugins: IBenchmarkPlugin[] = [];

    // First discover available plugins
    const availableManifests = await this.discoverPlugins();
    const availablePluginMap = new Map<string, PluginManifest>();
    
    for (const manifest of availableManifests) {
      availablePluginMap.set(manifest.name, manifest);
    }

    // Load requested plugins
    for (const pluginName of pluginNames) {
      try {
        // Check if plugin directory exists
        const pluginPath = path.join(this.pluginsPath, pluginName);
        if (!fs.existsSync(pluginPath) || !fs.lstatSync(pluginPath).isDirectory()) {
          this.validationErrors.push(`Plugin '${pluginName}' not found in plugins directory`);
          continue;
        }

        // Check if manifest exists
        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          this.validationErrors.push(`Plugin '${pluginName}': manifest.json not found`);
          continue;
        }

        // Try to parse manifest
        let manifest: PluginManifest;
        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
          manifest = JSON.parse(manifestContent) as PluginManifest;
        } catch (parseError) {
          this.validationErrors.push(`Plugin '${pluginName}': invalid manifest.json - ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          continue;
        }

        // Validate manifest
        const validationError = this.validateManifest(manifest);
        if (validationError) {
          this.validationErrors.push(`Plugin '${pluginName}': ${validationError}`);
          continue;
        }

        // TODO: Actually load and instantiate the plugin
        // For now, we just validate but don't load actual implementations
        // This will be implemented when we have actual plugin modules

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.validationErrors.push(`Failed to load plugin '${pluginName}': ${errorMessage}`);
      }
    }

    return plugins;
  }

  public async discoverPlugins(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    // Check if plugins directory exists
    if (!fs.existsSync(this.pluginsPath)) {
      return manifests;
    }

    try {
      const entries = fs.readdirSync(this.pluginsPath);
      
      for (const entry of entries) {
        const entryPath = path.join(this.pluginsPath, entry);
        
        // Skip non-directories and hidden files
        if (!fs.lstatSync(entryPath).isDirectory() || entry.startsWith('.')) {
          continue;
        }

        // Look for manifest.json in the plugin directory
        const manifestPath = path.join(entryPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        try {
          const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent) as PluginManifest;
          
          // Basic validation
          const validationError = this.validateManifest(manifest);
          if (!validationError) {
            manifests.push(manifest);
          }
        } catch (error) {
          // Skip plugins with invalid manifests during discovery
          continue;
        }
      }
    } catch (error) {
      // Handle filesystem errors gracefully
      return manifests;
    }

    return manifests;
  }

  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  private validateManifest(manifest: PluginManifest): string | null {
    if (!manifest.name || typeof manifest.name !== 'string') {
      return 'manifest must have a valid name field';
    }

    if (!manifest.version || typeof manifest.version !== 'string') {
      return 'manifest must have a valid version field';
    }

    if (!manifest.description || typeof manifest.description !== 'string') {
      return 'manifest must have a valid description field';
    }

    if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
      return 'manifest must have a valid entryPoint field';
    }

    return null;
  }
}