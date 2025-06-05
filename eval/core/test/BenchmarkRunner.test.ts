import { BenchmarkRunner } from '../BenchmarkRunner';
import { BenchmarkConfig, BenchmarkResults } from '../types';

describe('BenchmarkRunner', () => {
  describe('Interface Foundation', () => {
    test('should be able to instantiate BenchmarkRunner', () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      expect(() => new BenchmarkRunner(config)).not.toThrow();
    });

    test('should have a run() method that returns Promise<BenchmarkResults>', async () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      expect(typeof runner.run).toBe('function');
      
      const result = runner.run();
      expect(result).toBeInstanceOf(Promise);
      
      const benchmarkResults = await result;
      expect(benchmarkResults).toHaveProperty('summary');
      expect(benchmarkResults).toHaveProperty('results');
      expect(benchmarkResults).toHaveProperty('metadata');
    });

    test('should have a stop() method for graceful shutdown', () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      expect(typeof runner.stop).toBe('function');
      expect(() => runner.stop()).not.toThrow();
    });
  });

  describe('Configuration Handling', () => {
    test('should accept configuration object in constructor', () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        },
        timeout: 30000,
        parallel: true
      };
      
      const runner = new BenchmarkRunner(config);
      expect(runner.getConfig()).toEqual(config);
    });

    test('should store and make configuration accessible', () => {
      const config: BenchmarkConfig = {
        plugins: ['test-plugin'],
        output: {
          format: 'yaml',
          path: './custom-reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      const storedConfig = runner.getConfig();
      
      expect(storedConfig.plugins).toEqual(['test-plugin']);
      expect(storedConfig.output.format).toBe('yaml');
      expect(storedConfig.output.path).toBe('./custom-reports');
    });

    test('should throw error for invalid configuration', () => {
      const invalidConfig = {} as BenchmarkConfig;
      
      expect(() => new BenchmarkRunner(invalidConfig)).toThrow('Invalid configuration');
    });
  });

  describe('Benchmark Execution Flow', () => {
    test('should execute run() method with empty plugin list', async () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      const results = await runner.run();
      
      expect(results.summary.totalTests).toBe(0);
      expect(results.summary.passed).toBe(0);
      expect(results.summary.failed).toBe(0);
      expect(results.results).toEqual([]);
    });

    test('should return proper BenchmarkResults structure', async () => {
      const config: BenchmarkConfig = {
        plugins: [],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      const results = await runner.run();
      
      // Verify summary structure
      expect(results.summary).toHaveProperty('totalTests');
      expect(results.summary).toHaveProperty('passed');
      expect(results.summary).toHaveProperty('failed');
      expect(results.summary).toHaveProperty('duration');
      
      // Verify results structure
      expect(Array.isArray(results.results)).toBe(true);
      
      // Verify metadata structure
      expect(results.metadata).toHaveProperty('timestamp');
      expect(results.metadata).toHaveProperty('framework');
      expect(results.metadata.framework).toBe('continue-eval');
    });

    test('should handle errors gracefully during execution', async () => {
      const config: BenchmarkConfig = {
        plugins: ['non-existent-plugin'],
        output: {
          format: 'json',
          path: './reports'
        }
      };
      
      const runner = new BenchmarkRunner(config);
      
      // Should not throw, but return error results
      const results = await runner.run();
      expect(results.summary.failed).toBeGreaterThan(0);
      expect(results.metadata).toHaveProperty('errors');
    });
  });
});