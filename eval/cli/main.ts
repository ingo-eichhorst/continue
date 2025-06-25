#!/usr/bin/env node
// Create a no-op AbortSignal implementation
class NoOpAbortSignal extends EventTarget implements AbortSignal {
  aborted = false;
  reason = undefined;
  onabort = null;
  
  throwIfAborted(): void {
    // No-op
  }
}

const NoOpAbortSignalConstructor = {
  new: () => new NoOpAbortSignal(),
  prototype: NoOpAbortSignal.prototype,
  abort: () => new NoOpAbortSignal(),
  any: () => new NoOpAbortSignal(),
  timeout: () => new NoOpAbortSignal(),
} as any;

globalThis.AbortSignal = NoOpAbortSignalConstructor;

import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { ILLM } from '../../core/index.js';
import { BenchmarkEngine } from '../core/BenchmarkEngine.js';
import { DatasetLoader } from '../core/DatasetLoader.js';
import { ConsoleLogger } from '../core/Logger.js';
import { ModelLoader } from '../core/ModelLoader.js';
import { SessionManager } from '../core/SessionManager.js';
import { Dataset } from '../core/types.js';
import { DockerExecutionEnvironment } from '../execution/DockerRunner.js';
import { LocalExecutionEnvironment } from '../execution/LocalRunner.js';
import { UnifiedDiffPlugin } from '../plugins/unified-diff/UnifiedDiffPlugin.js';

const program = new Command();

program
  .name('continue-eval')
  .description('Continue.dev Benchmarking Framework')
  .version('0.1.0');

program
  .command('benchmark')
  .description('Run a benchmark')
  .option('-p, --plugin <name>', 'Benchmark plugin to run')
  .option('-m, --models <models>', 'Comma-separated list of model IDs', 'gpt-4')
  .option('-d, --dataset <path>', 'Path to dataset file or directory')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--continue <sessionId>', 'Continue from existing session')
  .option('-e, --execution-env <type>', 'Execution environment (local|docker)', 'docker')
  .option('-o, --output <format>', 'Output format (console|json)', 'console')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be executed without running')
  .action(async (options) => {
    try {
      await runBenchmark(options);
    } catch (error) {
      console.error(chalk.red('Benchmark failed:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list-sessions')
  .description('List all benchmark sessions')
  .option('-v, --verbose', 'Show detailed session information')
  .action(async (options) => {
    await listSessions(options);
  });

program
  .command('show-session <sessionId>')
  .description('Show details of a specific session')
  .action(async (sessionId: string) => {
    await showSession(sessionId);
  });

program
  .command('validate-env')
  .description('Validate execution environment requirements')
  .option('-e, --execution-env <type>', 'Environment to validate (local|docker|all)', 'all')
  .action(async (options) => {
    await validateEnvironment(options);
  });

program
  .command('list-models')
  .description('List available models from Continue configuration')
  .option('-v, --verbose', 'Show detailed model information')
  .action(async (options) => {
    await listModels(options);
  });

program
  .command('list-datasets')
  .description('List available datasets')
  .option('-v, --verbose', 'Show detailed dataset information')
  .action(async (options) => {
    await listDatasets(options);
  });

async function runBenchmark(options: any): Promise<void> {
  const logger = new ConsoleLogger(options.verbose);
  const sessionsDir = join(process.cwd(), '.sessions');
  const sessionManager = new SessionManager(sessionsDir, logger);
  
  await sessionManager.initialize();
  
  const engine = new BenchmarkEngine(logger, sessionManager);
  
  // Register available plugins
  engine.registerPlugin(new UnifiedDiffPlugin());
  
  logger.info('Continue.dev Benchmarking Framework');
  logger.info('====================================');
  
  // Determine plugin to run
  let pluginName = options.plugin;
  if (!pluginName) {
    const availablePlugins = engine.listPlugins();
    if (availablePlugins.length === 1) {
      pluginName = availablePlugins[0];
      logger.info(`Auto-selected plugin: ${pluginName}`);
    } else {
      throw new Error('Multiple plugins available. Please specify --plugin option.');
    }
  }
  
  const plugin = engine.getPlugin(pluginName);
  if (!plugin) {
    throw new Error(`Plugin '${pluginName}' not found. Available: ${engine.listPlugins().join(', ')}`);
  }
  
  // Check for session continuation
  if (options.continue) {
    const session = await sessionManager.loadSession(options.continue);
    if (!session) {
      throw new Error(`Session '${options.continue}' not found`);
    }
    
    logger.info(`Continuing session: ${session.id}`);
    logger.info(`Plugin: ${session.pluginName}`);
    logger.info(`Progress: ${session.progress.completedTestCases}/${session.progress.totalTestCases} completed`);
    
    // Load models and dataset from session config
    const models = await loadModelsFromConfig(session.config.models, logger);
    const dataset = await loadDataset(session.config.dataset, logger);
    const executionEnv = createExecutionEnvironment(session.config.executionEnvironment, logger);
    
    const spinner = ora('Resuming benchmark execution...').start();
    
    try {
      const result = await engine.executeBenchmark(
        session.pluginName,
        models,
        dataset,
        executionEnv,
        session.config.properties,
        session.id
      );
      
      spinner.succeed('Benchmark completed successfully');
      await displayResults(result, options.output, logger);
      
    } catch (error) {
      spinner.fail('Benchmark failed');
      throw error;
    }
    
    return;
  }
  
  // New benchmark execution
  const models = await loadModels(options.models, logger);
  const dataset = await loadDataset(options.dataset || plugin.defaultDataset, logger);
  const executionEnv = createExecutionEnvironment(options.executionEnv, logger);
  
  if (options.dryRun) {
    logger.info('DRY RUN - Would execute:');
    logger.info(`  Plugin: ${pluginName}`);
    logger.info(`  Models: ${models.map(m => m.uniqueId).join(', ')}`);
    logger.info(`  Dataset: ${dataset.name} (${dataset.testCases.length} test cases)`);
    logger.info(`  Execution: ${executionEnv.type}`);
    logger.info(`  Total test cases: ${models.length * dataset.testCases.length}`);
    return;
  }
  
  // Validate environment
  await validateExecutionEnvironment(executionEnv, logger);
  
  const spinner = ora('Running benchmark...').start();
  
  try {
    const result = await engine.executeBenchmark(
      pluginName,
      models,
      dataset,
      executionEnv,
      {} // Default properties
    );
    
    spinner.succeed('Benchmark completed successfully');
    await displayResults(result, options.output, logger);
    
  } catch (error) {
    spinner.fail('Benchmark failed');
    throw error;
  }
}

async function loadModels(modelString: string, logger: ConsoleLogger): Promise<ILLM[]> {
  const modelIds = modelString.split(',').map(id => id.trim());
  const modelLoader = new ModelLoader(logger);

  try {
    return await modelLoader.loadModels(modelIds);
  } catch (error) {
    logger.error('Failed to load models from Continue configuration', error as Error);
    throw error;
  }
}

async function loadModelsFromConfig(modelIds: string[], logger: ConsoleLogger): Promise<ILLM[]> {
  return loadModels(modelIds.join(','), logger);
}

async function loadDataset(datasetPath: string, logger: ConsoleLogger): Promise<Dataset> {
  // Ensure we're using the eval directory as base for dataset loading
  // Get the directory where this script is located (eval/cli) and go up to eval directory
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const evalDir = dirname(currentDir); // Go up from eval/cli to eval
  logger.debug(`Loading dataset from base directory: ${evalDir}`);
  
  const datasetLoader = new DatasetLoader(logger, evalDir);
  
  try {
    return await datasetLoader.loadDataset(datasetPath);
  } catch (error) {
    logger.error(`Failed to load dataset from ${datasetPath}`, error as Error);
    logger.warn('Falling back to mock dataset');
    throw error;
  }
}

function createExecutionEnvironment(type: string, logger: ConsoleLogger): LocalExecutionEnvironment | DockerExecutionEnvironment {
  switch (type) {
    case 'local':
      return new LocalExecutionEnvironment();
    case 'docker':
      return new DockerExecutionEnvironment();
    default:
      throw new Error(`Unknown execution environment: ${type}`);
  }
}

async function validateExecutionEnvironment(env: any, logger: ConsoleLogger): Promise<void> {
  const validation = await env.validateEnvironment();
  
  if (!validation.valid) {
    logger.error(`Execution environment validation failed. Missing: ${validation.missing.join(', ')}`);
    throw new Error('Environment validation failed');
  }
  
  logger.info(`Execution environment (${env.type}) validated successfully`);
}

async function displayResults(result: any, format: string, logger: ConsoleLogger): Promise<void> {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Console format
  console.log('\n' + chalk.bold('Benchmark Results'));
  console.log('=================');
  console.log(`Plugin: ${chalk.cyan(result.pluginName)}`);
  console.log(`Session: ${chalk.gray(result.sessionId)}`);
  console.log(`Duration: ${chalk.yellow(Math.round(result.duration / 1000))}s`);
  console.log(`Test Cases: ${chalk.green(result.testCases.length)}`);
  
  const passed = result.testCases.filter((tc: any) => tc.status === 'completed' && 
    tc.validationResults?.every((vr: any) => vr.passed)).length;
  const failed = result.testCases.filter((tc: any) => tc.status === 'failed').length;
  const withErrors = result.testCases.filter((tc: any) => tc.error).length;
  
  console.log(`Passed: ${chalk.green(passed)}`);
  console.log(`Failed: ${chalk.red(failed)}`);
  console.log(`With Errors: ${chalk.red(withErrors)}`);
  console.log(`Success Rate: ${chalk.bold(((passed / result.testCases.length) * 100).toFixed(1))}%`);
  
  // Show detailed results for each test case
  console.log('\n' + chalk.bold('Test Case Details:'));
  result.testCases.forEach((tc: any, index: number) => {
    console.log(`\n${index + 1}. ${chalk.cyan(tc.testCaseId)}`);
    console.log(`   Status: ${tc.status === 'completed' ? chalk.green(tc.status) : chalk.red(tc.status)}`);
    
    if (tc.validationResults) {
      console.log(`   Validations:`);
      tc.validationResults.forEach((vr: any) => {
        const status = vr.passed ? chalk.green('✓') : chalk.red('✗');
        console.log(`     ${status} ${vr.type}: ${vr.details}`);
      });
    }
    
    if (tc.error) {
      console.log(`   Error: ${chalk.red(tc.error.message)}`);
    }
    
    if (tc.llmResponse) {
      console.log(`   LLM Response (${tc.llmResponse.content.length} chars): ${tc.llmResponse.content.substring(0, 100)}...`);
    }
  });
  
  if (result.summary.recommendations.length > 0) {
    console.log('\n' + chalk.bold('Recommendations:'));
    result.summary.recommendations.forEach((rec: string) => {
      console.log(`  • ${rec}`);
    });
  }
}

async function listSessions(options: any): Promise<void> {
  const logger = new ConsoleLogger(options.verbose);
  const sessionsDir = join(process.cwd(), '.sessions');
  const sessionManager = new SessionManager(sessionsDir, logger);
  
  await sessionManager.initialize();
  const sessions = sessionManager.listSessions();
  
  if (sessions.length === 0) {
    console.log('No sessions found.');
    return;
  }
  
  console.log(chalk.bold('Benchmark Sessions'));
  console.log('==================');
  
  sessions.forEach(session => {
    const status = session.status === 'completed' ? chalk.green(session.status) :
                  session.status === 'failed' ? chalk.red(session.status) :
                  session.status === 'running' ? chalk.blue(session.status) :
                  chalk.yellow(session.status);
    
    console.log(`${chalk.cyan(session.id.substring(0, 8))} ${status} ${session.pluginName} (${session.startTime.toISOString()})`);
    
    if (options.verbose) {
      console.log(`  Progress: ${session.progress.completedTestCases}/${session.progress.totalTestCases}`);
      console.log(`  Models: ${session.config.models.join(', ')}`);
      console.log('');
    }
  });
}

async function showSession(sessionId: string): Promise<void> {
  const logger = new ConsoleLogger(false);
  const sessionsDir = join(process.cwd(), '.sessions');
  const sessionManager = new SessionManager(sessionsDir, logger);
  
  await sessionManager.initialize();
  const session = await sessionManager.loadSession(sessionId);
  
  if (!session) {
    console.error(chalk.red(`Session '${sessionId}' not found`));
    return;
  }
  
  console.log(chalk.bold('Session Details'));
  console.log('===============');
  console.log(`ID: ${chalk.cyan(session.id)}`);
  console.log(`Plugin: ${session.pluginName}`);
  console.log(`Status: ${session.status}`);
  console.log(`Started: ${session.startTime.toISOString()}`);
  console.log(`Last Update: ${session.lastUpdateTime.toISOString()}`);
  console.log(`Progress: ${session.progress.completedTestCases}/${session.progress.totalTestCases}`);
  console.log(`Models: ${session.config.models.join(', ')}`);
}

async function validateEnvironment(options: any): Promise<void> {
  const logger = new ConsoleLogger(true);
  
  const environments = options.executionEnv === 'all' 
    ? ['local', 'docker'] 
    : [options.executionEnv];
  
  for (const envType of environments) {
    console.log(chalk.bold(`Validating ${envType} environment...`));
    
    const env = createExecutionEnvironment(envType, logger);
    const validation = await env.validateEnvironment();
    
    if (validation.valid) {
      console.log(chalk.green(`✓ ${envType} environment is valid`));
    } else {
      console.log(chalk.red(`✗ ${envType} environment is invalid`));
      console.log(chalk.yellow(`  Missing: ${validation.missing.join(', ')}`));
    }
  }
}

async function listModels(options: any): Promise<void> {
  const logger = new ConsoleLogger(options.verbose);
  const modelLoader = new ModelLoader(logger);
  
  try {
    console.log(chalk.bold('Available Models'));
    console.log('================');
    
    const availableModels = await modelLoader.listAvailableModels();
    
    if (availableModels.length === 0) {
      console.log(chalk.gray('No models found in Continue configuration.'));
      console.log(chalk.gray('Make sure you have a .continue/config.json or .continue/config.ts file.'));
      return;
    }
    
    availableModels.forEach((model, index) => {
      console.log(`${index + 1}. ${chalk.cyan(model)}`);
    });
    
    console.log(`\nTotal: ${chalk.green(availableModels.length)} models available`);
    
    if (options.verbose) {
      console.log('\nTo use a model in benchmarks, specify it with:');
      console.log(chalk.gray('  npm run benchmark -- benchmark --models <model-name>'));
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to list models:'), (error as Error).message);
    console.log(chalk.gray('Falling back to default models: gpt-4, gpt-3.5-turbo, claude-3-sonnet'));
  }
}

async function listDatasets(options: any): Promise<void> {
  const logger = new ConsoleLogger(options.verbose);
  const datasetLoader = new DatasetLoader(logger, process.cwd());
  
  try {
    console.log(chalk.bold('Available Datasets'));
    console.log('==================');
    
    const availableDatasets = await datasetLoader.listAvailableDatasets();
    
    if (availableDatasets.length === 0) {
      console.log(chalk.gray('No datasets found in ./datasets directory.'));
      console.log(chalk.gray('Create datasets in ./datasets/ folder with dataset.json files.'));
      return;
    }
    
    for (const datasetName of availableDatasets) {
      try {
        const dataset = await datasetLoader.loadDataset(datasetName);
        console.log(`${chalk.cyan(datasetName)}: ${dataset.description || 'No description'}`);
        
        if (options.verbose) {
          console.log(`  Version: ${dataset.version || 'unknown'}`);
          console.log(`  Test Cases: ${dataset.testCases.length}`);
          console.log(`  Language: ${dataset.metadata?.language || 'unknown'}`);
          console.log(`  Difficulty: ${dataset.metadata?.difficulty || 'unknown'}`);
          if (dataset.metadata?.tags?.length) {
            console.log(`  Tags: ${dataset.metadata.tags.join(', ')}`);
          }
          console.log('');
        }
      } catch (error) {
        console.log(`${chalk.red(datasetName)}: ${chalk.gray('Error loading dataset')}`);
        if (options.verbose) {
          console.log(`  Error: ${(error as Error).message}`);
          console.log('');
        }
      }
    }
    
    console.log(`\nTotal: ${chalk.green(availableDatasets.length)} datasets available`);
    
    if (options.verbose) {
      console.log('\nTo use a dataset in benchmarks, specify it with:');
      console.log(chalk.gray('  npm run benchmark -- benchmark --dataset <dataset-name>'));
    }
    
  } catch (error) {
    console.error(chalk.red('Failed to list datasets:'), (error as Error).message);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

program.parse();