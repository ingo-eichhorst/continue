import { MetricsCollector } from '../MetricsCollector';
import { MetricDefinition, MetricData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock filesystem for testing
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('MetricsCollector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Interface Foundation', () => {
    test('should be able to instantiate MetricsCollector', () => {
      expect(() => new MetricsCollector()).not.toThrow();
    });

    test('should be able to record latency metrics', async () => {
      const collector = new MetricsCollector();
      
      expect(typeof collector.recordLatency).toBe('function');
      
      // Should not throw when recording latency
      expect(() => collector.recordLatency('test-operation', 100)).not.toThrow();
      
      // Should be able to get recorded metrics
      const metrics = collector.getMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      
      const latencyMetric = metrics.find(m => m.name === 'test-operation-latency');
      expect(latencyMetric).toBeDefined();
      expect(latencyMetric!.value).toBe(100);
    });

    test('should be able to record token usage metrics', () => {
      const collector = new MetricsCollector();
      
      expect(typeof collector.recordTokenUsage).toBe('function');
      
      // Should not throw when recording token usage
      expect(() => collector.recordTokenUsage('gpt-4', 500, 250)).not.toThrow();
      
      const metrics = collector.getMetrics();
      const inputTokens = metrics.find(m => m.name === 'gpt-4-input-tokens');
      const outputTokens = metrics.find(m => m.name === 'gpt-4-output-tokens');
      
      expect(inputTokens).toBeDefined();
      expect(inputTokens!.value).toBe(500);
      expect(outputTokens).toBeDefined();
      expect(outputTokens!.value).toBe(250);
    });

    test('should be able to record custom metrics', () => {
      const collector = new MetricsCollector();
      
      expect(typeof collector.recordCustomMetric).toBe('function');
      
      const customMetric: MetricData = {
        name: 'custom-score',
        value: 95.5,
        timestamp: new Date(),
        labels: { model: 'test-model', version: '1.0' }
      };
      
      expect(() => collector.recordCustomMetric(customMetric)).not.toThrow();
      
      const metrics = collector.getMetrics();
      const found = metrics.find(m => m.name === 'custom-score');
      expect(found).toBeDefined();
      expect(found!.value).toBe(95.5);
      expect(found!.labels).toEqual({ model: 'test-model', version: '1.0' });
    });
  });

  describe('Metrics Aggregation', () => {
    test('should aggregate metrics across multiple runs', () => {
      const collector = new MetricsCollector();
      
      // Record multiple latency metrics
      collector.recordLatency('test-operation', 100);
      collector.recordLatency('test-operation', 150);
      collector.recordLatency('test-operation', 200);
      
      const aggregated = collector.aggregateMetrics('test-operation-latency');
      
      expect(aggregated).toHaveProperty('count');
      expect(aggregated).toHaveProperty('sum');
      expect(aggregated).toHaveProperty('mean');
      expect(aggregated).toHaveProperty('min');
      expect(aggregated).toHaveProperty('max');
      
      expect(aggregated.count).toBe(3);
      expect(aggregated.sum).toBe(450);
      expect(aggregated.mean).toBe(150);
      expect(aggregated.min).toBe(100);
      expect(aggregated.max).toBe(200);
    });

    test('should calculate statistical measures (mean, median, percentiles)', () => {
      const collector = new MetricsCollector();
      
      // Record values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      for (let i = 1; i <= 10; i++) {
        collector.recordLatency('stats-test', i * 10);
      }
      
      const stats = collector.calculateStatistics('stats-test-latency');
      
      expect(stats).toHaveProperty('mean');
      expect(stats).toHaveProperty('median');
      expect(stats).toHaveProperty('p95');
      expect(stats).toHaveProperty('p99');
      expect(stats).toHaveProperty('stdDev');
      
      expect(stats.mean).toBe(55);
      expect(stats.median).toBe(55);
      expect(stats.p95).toBeGreaterThan(90);
      expect(stats.p99).toBeGreaterThan(95);
    });

    test('should export metrics in different formats', () => {
      const collector = new MetricsCollector();
      
      collector.recordLatency('export-test', 100);
      collector.recordTokenUsage('gpt-4', 300, 150);
      
      // JSON format
      const jsonExport = collector.exportMetrics('json');
      expect(typeof jsonExport).toBe('string');
      const parsed = JSON.parse(jsonExport);
      expect(Array.isArray(parsed)).toBe(true);
      
      // CSV format
      const csvExport = collector.exportMetrics('csv');
      expect(typeof csvExport).toBe('string');
      expect(csvExport).toContain('name,value,timestamp');
      
      // Prometheus format
      const prometheusExport = collector.exportMetrics('prometheus');
      expect(typeof prometheusExport).toBe('string');
      expect(prometheusExport).toContain('# HELP');
      expect(prometheusExport).toContain('# TYPE');
    });
  });

  describe('Metrics Persistence', () => {
    test('should persist metrics to disk', async () => {
      const collector = new MetricsCollector('./test-metrics');
      
      collector.recordLatency('persist-test', 100);
      collector.recordTokenUsage('model-test', 200, 100);
      
      mockFs.writeFileSync.mockImplementation(() => {});
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      
      await collector.persistMetrics();
      
      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
      
      const writeCall = mockFs.writeFileSync.mock.calls[0];
      expect(writeCall[0]).toMatch(/\.json$/);
      expect(typeof writeCall[1]).toBe('string');
    });

    test('should load metrics from storage', async () => {
      const collector = new MetricsCollector('./test-metrics');
      
      const mockMetrics = [
        {
          name: 'loaded-metric',
          value: 42,
          timestamp: new Date().toISOString()
        }
      ];
      
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockMetrics));
      
      await collector.loadMetrics('test-session');
      
      const metrics = collector.getMetrics();
      const loadedMetric = metrics.find(m => m.name === 'loaded-metric');
      expect(loadedMetric).toBeDefined();
      expect(loadedMetric!.value).toBe(42);
    });

    test('should track metrics history', async () => {
      const collector = new MetricsCollector('./test-metrics');
      
      // Mock multiple metric files
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        'session-1.json',
        'session-2.json',
        'session-3.json'
      ] as any);
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string') {
          if (filePath.includes('session-1')) {
            return JSON.stringify([{ name: 'test', value: 10, timestamp: '2023-01-01T00:00:00Z' }]);
          }
          if (filePath.includes('session-2')) {
            return JSON.stringify([{ name: 'test', value: 20, timestamp: '2023-01-02T00:00:00Z' }]);
          }
          if (filePath.includes('session-3')) {
            return JSON.stringify([{ name: 'test', value: 30, timestamp: '2023-01-03T00:00:00Z' }]);
          }
        }
        return '[]';
      });
      
      const history = await collector.getMetricsHistory();
      
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(3);
      expect(history[0]).toHaveProperty('sessionId');
      expect(history[0]).toHaveProperty('metrics');
      expect(history[0]).toHaveProperty('timestamp');
    });
  });

  describe('Metric Definitions', () => {
    test('should register metric definitions', () => {
      const collector = new MetricsCollector();
      
      const definition: MetricDefinition = {
        name: 'test-counter',
        type: 'counter',
        description: 'A test counter metric',
        unit: 'count'
      };
      
      expect(() => collector.registerMetricDefinition(definition)).not.toThrow();
      
      const definitions = collector.getMetricDefinitions();
      expect(definitions).toContainEqual(definition);
    });

    test('should validate metrics against definitions', () => {
      const collector = new MetricsCollector();
      
      const definition: MetricDefinition = {
        name: 'validated-metric',
        type: 'gauge',
        description: 'A validated gauge metric'
      };
      
      collector.registerMetricDefinition(definition);
      
      // Valid metric should not throw
      expect(() => collector.recordCustomMetric({
        name: 'validated-metric',
        value: 100,
        timestamp: new Date()
      })).not.toThrow();
      
      // Invalid metric type should throw
      expect(() => collector.recordCustomMetric({
        name: 'unknown-metric',
        value: 100,
        timestamp: new Date()
      })).toThrow('Metric definition not found');
    });
  });
});