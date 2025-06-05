import { MetricDefinition, MetricData, BenchmarkError } from './types';
import * as fs from 'fs';
import * as path from 'path';

export interface MetricAggregation {
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
}

export interface MetricStatistics {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface MetricsSession {
  sessionId: string;
  timestamp: Date;
  metrics: MetricData[];
}

export class MetricsCollector {
  private metrics: MetricData[] = [];
  private definitions: MetricDefinition[] = [];
  private storageDir: string;

  constructor(storageDir: string = './metrics') {
    this.storageDir = storageDir;
  }

  public recordLatency(operation: string, latencyMs: number): void {
    const metric: MetricData = {
      name: `${operation}-latency`,
      value: latencyMs,
      timestamp: new Date(),
      labels: { operation, type: 'latency' }
    };
    this.metrics.push(metric);
  }

  public recordTokenUsage(model: string, inputTokens: number, outputTokens: number): void {
    const inputMetric: MetricData = {
      name: `${model}-input-tokens`,
      value: inputTokens,
      timestamp: new Date(),
      labels: { model, type: 'input-tokens' }
    };

    const outputMetric: MetricData = {
      name: `${model}-output-tokens`,
      value: outputTokens,
      timestamp: new Date(),
      labels: { model, type: 'output-tokens' }
    };

    this.metrics.push(inputMetric, outputMetric);
  }

  public recordCustomMetric(metric: MetricData): void {
    // Validate against registered definitions if strict mode
    if (this.definitions.length > 0) {
      const definition = this.definitions.find(d => d.name === metric.name);
      if (!definition) {
        throw new BenchmarkError(`Metric definition not found for '${metric.name}'`);
      }
    }

    this.metrics.push({ ...metric });
  }

  public getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  public aggregateMetrics(metricName: string): MetricAggregation {
    const relevantMetrics = this.metrics.filter(m => m.name === metricName);
    
    if (relevantMetrics.length === 0) {
      return {
        count: 0,
        sum: 0,
        mean: 0,
        min: 0,
        max: 0
      };
    }

    const values = relevantMetrics.map(m => Number(m.value));
    const sum = values.reduce((a, b) => a + b, 0);
    const count = values.length;
    const mean = sum / count;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count,
      sum,
      mean,
      min,
      max
    };
  }

  public calculateStatistics(metricName: string): MetricStatistics {
    const relevantMetrics = this.metrics.filter(m => m.name === metricName);
    const values = relevantMetrics.map(m => Number(m.value)).sort((a, b) => a - b);

    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        p95: 0,
        p99: 0,
        stdDev: 0
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    // Calculate median
    const median = values.length % 2 === 0
      ? (values[values.length / 2 - 1] + values[values.length / 2]) / 2
      : values[Math.floor(values.length / 2)];

    // Calculate percentiles
    const p95Index = Math.ceil(values.length * 0.95) - 1;
    const p99Index = Math.ceil(values.length * 0.99) - 1;
    const p95 = values[p95Index] || values[values.length - 1];
    const p99 = values[p99Index] || values[values.length - 1];

    // Calculate standard deviation
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      median,
      p95,
      p99,
      stdDev
    };
  }

  public exportMetrics(format: 'json' | 'csv' | 'prometheus'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.metrics, null, 2);
      
      case 'csv':
        const csvHeader = 'name,value,timestamp,labels\n';
        const csvRows = this.metrics.map(m => {
          const labels = m.labels ? JSON.stringify(m.labels).replace(/"/g, '""') : '';
          return `${m.name},${m.value},${m.timestamp.toISOString()},"${labels}"`;
        }).join('\n');
        return csvHeader + csvRows;
      
      case 'prometheus':
        let prometheusOutput = '';
        const metricGroups = new Map<string, MetricData[]>();
        
        // Group metrics by name
        this.metrics.forEach(m => {
          if (!metricGroups.has(m.name)) {
            metricGroups.set(m.name, []);
          }
          metricGroups.get(m.name)!.push(m);
        });

        // Generate Prometheus format
        metricGroups.forEach((metrics, name) => {
          const sanitizedName = name.replace(/[^a-zA-Z0-9_:]/g, '_');
          prometheusOutput += `# HELP ${sanitizedName} Metric ${name}\n`;
          prometheusOutput += `# TYPE ${sanitizedName} gauge\n`;
          
          metrics.forEach(metric => {
            const labels = metric.labels 
              ? Object.entries(metric.labels)
                  .map(([k, v]) => `${k}="${v}"`)
                  .join(',')
              : '';
            
            const labelString = labels ? `{${labels}}` : '';
            prometheusOutput += `${sanitizedName}${labelString} ${metric.value} ${metric.timestamp.getTime()}\n`;
          });
          prometheusOutput += '\n';
        });

        return prometheusOutput;
      
      default:
        throw new BenchmarkError(`Unsupported export format: ${format}`);
    }
  }

  public async persistMetrics(sessionId?: string): Promise<void> {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const session = sessionId || `session-${Date.now()}`;
    const filePath = path.join(this.storageDir, `${session}.json`);
    
    const sessionData: MetricsSession = {
      sessionId: session,
      timestamp: new Date(),
      metrics: this.metrics
    };

    fs.writeFileSync(filePath, JSON.stringify(sessionData, null, 2));
  }

  public async loadMetrics(sessionId: string): Promise<void> {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      throw new BenchmarkError(`Metrics session not found: ${sessionId}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // Handle both direct metrics array and session data format
    let metricsToLoad: MetricData[];
    if (Array.isArray(data)) {
      // Direct metrics array format
      metricsToLoad = data.map(m => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    } else {
      // Session data format
      const sessionData: MetricsSession = data;
      metricsToLoad = sessionData.metrics || [];
    }
    
    // Merge loaded metrics with current metrics
    this.metrics.push(...metricsToLoad);
  }

  public async getMetricsHistory(): Promise<MetricsSession[]> {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    const files = fs.readdirSync(this.storageDir)
      .filter(file => file.endsWith('.json'))
      .sort();

    const sessions: MetricsSession[] = [];

    for (const file of files) {
      try {
        const filePath = path.join(this.storageDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        let sessionData: MetricsSession;
        if (Array.isArray(data)) {
          // Convert direct metrics array to session format
          sessionData = {
            sessionId: path.basename(file, '.json'),
            timestamp: new Date(),
            metrics: data
          };
        } else {
          // Already in session format
          sessionData = data;
        }
        
        sessions.push(sessionData);
      } catch (error) {
        // Skip invalid files
        continue;
      }
    }

    return sessions;
  }

  public registerMetricDefinition(definition: MetricDefinition): void {
    const existing = this.definitions.find(d => d.name === definition.name);
    if (existing) {
      throw new BenchmarkError(`Metric definition already exists: ${definition.name}`);
    }

    this.definitions.push({ ...definition });
  }

  public getMetricDefinitions(): MetricDefinition[] {
    return [...this.definitions];
  }

  public clearMetrics(): void {
    this.metrics = [];
  }

  public getMetricsByName(name: string): MetricData[] {
    return this.metrics.filter(m => m.name === name);
  }

  public getMetricsByLabel(labelKey: string, labelValue: string): MetricData[] {
    return this.metrics.filter(m => 
      m.labels && m.labels[labelKey] === labelValue
    );
  }
}