import { simpleGit } from 'simple-git';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Logger } from './types.js';

/**
 * Configuration for repository management
 */
export interface RepositoryConfig {
  cacheDir?: string;
  maxCacheSize?: number;
  cloneTimeout?: number;
  enableCaching?: boolean;
  githubToken?: string;
}

/**
 * Information about a cloned repository
 */
export interface ClonedRepository {
  repoName: string;
  commit: string;
  localPath: string;
  cloneTime: Date;
  lastAccessed: Date;
}

/**
 * Service for managing Git repository operations including cloning, checkout, and file reading
 */
export class RepositoryManager {
  private logger: Logger;
  private config: Required<RepositoryConfig>;
  private clonedRepos: Map<string, ClonedRepository> = new Map();
  private clonePromises: Map<string, Promise<string>> = new Map();

  constructor(logger: Logger, config: RepositoryConfig = {}) {
    this.logger = logger;
    this.config = {
      cacheDir: config.cacheDir || join(tmpdir(), 'swe-bench-repos'),
      maxCacheSize: config.maxCacheSize || 50,
      cloneTimeout: config.cloneTimeout || 300000, // 5 minutes
      enableCaching: config.enableCaching !== false,
      githubToken: config.githubToken || '',
    };

    this.ensureCacheDirectory();
    this.loadExistingRepos();
  }

  /**
   * Get the file content from a repository at a specific commit
   */
  async getFileContent(
    repoName: string,
    commit: string,
    filePath: string
  ): Promise<string | null> {
    try {
      const repoPath = await this.ensureRepositoryCloned(repoName, commit);
      const fullFilePath = join(repoPath, filePath);

      if (!existsSync(fullFilePath)) {
        this.logger.debug(`File not found: ${filePath} in ${repoName}@${commit}`);
        return null;
      }

      const content = readFileSync(fullFilePath, 'utf-8');
      this.updateLastAccessed(repoName, commit);
      
      this.logger.debug(`Read file ${filePath} (${content.length} characters) from ${repoName}@${commit}`);
      return content;

    } catch (error) {
      this.logger.error(`Failed to get file content for ${filePath} in ${repoName}@${commit}:`, error as Error);
      return null;
    }
  }

  /**
   * Get multiple file contents from a repository at a specific commit
   */
  async getMultipleFileContents(
    repoName: string,
    commit: string,
    filePaths: string[]
  ): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    try {
      const repoPath = await this.ensureRepositoryCloned(repoName, commit);

      for (const filePath of filePaths) {
        const fullFilePath = join(repoPath, filePath);
        
        if (existsSync(fullFilePath)) {
          results[filePath] = readFileSync(fullFilePath, 'utf-8');
        } else {
          results[filePath] = null;
        }
      }

      this.updateLastAccessed(repoName, commit);
      this.logger.debug(`Read ${filePaths.length} files from ${repoName}@${commit}`);

    } catch (error) {
      this.logger.error(`Failed to get multiple file contents from ${repoName}@${commit}:`, error as Error);
      // Return null for all files on error
      for (const filePath of filePaths) {
        results[filePath] = null;
      }
    }

    return results;
  }

  /**
   * Extract file paths from a diff patch
   */
  static extractFilePathsFromDiff(diffPatch: string): string[] {
    const filePaths: string[] = [];
    const lines = diffPatch.split('\n');

    for (const line of lines) {
      // Match diff headers like "diff --git a/file.py b/file.py"
      const gitDiffMatch = line.match(/^diff --git a\/(.+) b\/(.+)/);
      if (gitDiffMatch) {
        filePaths.push(gitDiffMatch[1]);
        continue;
      }

      // Match unified diff headers like "--- a/file.py"
      const unifiedDiffMatch = line.match(/^--- a\/(.+)/);
      if (unifiedDiffMatch) {
        filePaths.push(unifiedDiffMatch[1]);
        continue;
      }

      // Match "+++ b/file.py" (but only if we haven't seen this file yet)
      const newFileMatch = line.match(/^\+\+\+ b\/(.+)/);
      if (newFileMatch && !filePaths.includes(newFileMatch[1])) {
        filePaths.push(newFileMatch[1]);
      }
    }

    return [...new Set(filePaths)]; // Remove duplicates
  }

  /**
   * Ensure a repository is cloned and checked out to the specified commit
   */
  private async ensureRepositoryCloned(repoName: string, commit: string): Promise<string> {
    const cacheKey = `${repoName}@${commit}`;
    
    // Check if already cloned and cached
    if (this.clonedRepos.has(cacheKey)) {
      const repo = this.clonedRepos.get(cacheKey)!;
      if (existsSync(repo.localPath)) {
        return repo.localPath;
      } else {
        // Path doesn't exist anymore, remove from cache
        this.clonedRepos.delete(cacheKey);
      }
    }

    // Check if clone is already in progress
    if (this.clonePromises.has(cacheKey)) {
      return await this.clonePromises.get(cacheKey)!;
    }

    // Start new clone operation
    const clonePromise = this.cloneRepository(repoName, commit);
    this.clonePromises.set(cacheKey, clonePromise);

    try {
      const localPath = await clonePromise;
      return localPath;
    } finally {
      this.clonePromises.delete(cacheKey);
    }
  }

  /**
   * Clone a repository and checkout the specified commit
   */
  private async cloneRepository(repoName: string, commit: string): Promise<string> {
    const repoUrl = this.getRepositoryUrl(repoName);
    const localPath = join(this.config.cacheDir, `${repoName.replace('/', '_')}_${commit.substring(0, 8)}`);

    try {
      this.logger.info(`Cloning repository ${repoName} at commit ${commit}...`);

      // Ensure cache directory management
      await this.manageCacheSize();

      // Create local directory
      if (existsSync(localPath)) {
        rmSync(localPath, { recursive: true, force: true });
      }
      mkdirSync(localPath, { recursive: true });

      // Initialize git
      const git = simpleGit({
        timeout: {
          block: this.config.cloneTimeout,
        },
      });

      // Clone with full history to ensure we can checkout any commit
      await git.clone(repoUrl, localPath);

      // Navigate to cloned directory and checkout specific commit
      const repoGit = simpleGit(localPath);
      
      try {
        // Try to checkout the commit directly
        await repoGit.checkout(commit);
      } catch (checkoutError) {
        // If direct checkout fails, fetch all branches and try again
        this.logger.debug(`Direct checkout failed, fetching all branches for ${commit}`);
        await repoGit.fetch(['--all']);
        
        try {
          await repoGit.checkout(commit);
        } catch (secondError) {
          // Last resort: fetch with unshallow to get complete history
          this.logger.debug(`Still failed, trying unshallow for ${commit}`);
          await repoGit.fetch(['--unshallow']);
          await repoGit.checkout(commit);
        }
      }

      // Verify we're on the correct commit
      const currentCommit = await repoGit.revparse(['HEAD']);
      if (!currentCommit.startsWith(commit.substring(0, 7))) {
        throw new Error(`Failed to checkout commit ${commit}, currently on ${currentCommit}`);
      }

      // Cache the repository info
      const repoInfo: ClonedRepository = {
        repoName,
        commit,
        localPath,
        cloneTime: new Date(),
        lastAccessed: new Date(),
      };

      this.clonedRepos.set(`${repoName}@${commit}`, repoInfo);
      this.logger.info(`Successfully cloned ${repoName}@${commit} to ${localPath}`);

      return localPath;

    } catch (error) {
      // Clean up on failure
      if (existsSync(localPath)) {
        rmSync(localPath, { recursive: true, force: true });
      }
      
      throw new Error(`Failed to clone ${repoName}@${commit}: ${(error as Error).message}`);
    }
  }

  /**
   * Get the full GitHub URL for a repository
   */
  private getRepositoryUrl(repoName: string): string {
    const baseUrl = this.config.githubToken 
      ? `https://${this.config.githubToken}@github.com`
      : 'https://github.com';
    
    return `${baseUrl}/${repoName}.git`;
  }

  /**
   * Manage cache size by removing old repositories
   */
  private async manageCacheSize(): Promise<void> {
    if (!this.config.enableCaching || this.clonedRepos.size < this.config.maxCacheSize) {
      return;
    }

    // Sort by last accessed time (oldest first)
    const repoEntries = Array.from(this.clonedRepos.entries())
      .sort(([,a], [,b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    // Remove oldest repositories until under limit
    const toRemove = this.clonedRepos.size - this.config.maxCacheSize + 10; // Remove extra for buffer
    
    for (let i = 0; i < toRemove && i < repoEntries.length; i++) {
      const [key, repo] = repoEntries[i];
      
      try {
        if (existsSync(repo.localPath)) {
          rmSync(repo.localPath, { recursive: true, force: true });
        }
        this.clonedRepos.delete(key);
        this.logger.debug(`Removed cached repository: ${key}`);
      } catch (error) {
        this.logger.warn(`Failed to remove cached repository ${key}:`, error as Error);
      }
    }
  }

  /**
   * Update last accessed time for a repository
   */
  private updateLastAccessed(repoName: string, commit: string): void {
    const key = `${repoName}@${commit}`;
    const repo = this.clonedRepos.get(key);
    if (repo) {
      repo.lastAccessed = new Date();
    }
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!existsSync(this.config.cacheDir)) {
      mkdirSync(this.config.cacheDir, { recursive: true });
      this.logger.debug(`Created repository cache directory: ${this.config.cacheDir}`);
    }
  }

  /**
   * Load existing repositories from cache directory
   */
  private loadExistingRepos(): void {
    if (!existsSync(this.config.cacheDir)) {
      return;
    }

    // This is a simplified version - in production you might want to
    // store repository metadata in a separate file to properly restore cache
    this.logger.debug(`Repository cache directory: ${this.config.cacheDir}`);
  }

  /**
   * Clean up all cached repositories
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up repository cache...');
    
    for (const [key, repo] of this.clonedRepos.entries()) {
      try {
        if (existsSync(repo.localPath)) {
          rmSync(repo.localPath, { recursive: true, force: true });
        }
      } catch (error) {
        this.logger.warn(`Failed to cleanup repository ${key}:`, error as Error);
      }
    }
    
    this.clonedRepos.clear();
    this.logger.info('Repository cleanup completed');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalRepos: number; cacheDir: string; maxSize: number } {
    return {
      totalRepos: this.clonedRepos.size,
      cacheDir: this.config.cacheDir,
      maxSize: this.config.maxCacheSize,
    };
  }
}