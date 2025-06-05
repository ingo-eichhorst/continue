# Continue.dev Evaluation Framework

A comprehensive benchmarking and evaluation framework for Continue.dev's AI code assistant capabilities. Built with TypeScript following test-driven development principles and featuring a robust micro-kernel architecture.

## 🏗️ Architecture

The framework follows a **micro-kernel architecture** with modular, testable components:

```
eval/
├── core/                    # Core framework components
│   ├── BenchmarkRunner.ts   # Main benchmark execution engine
│   ├── PluginLoader.ts      # Plugin discovery and loading system
│   ├── ConfigManager.ts     # YAML configuration management
│   ├── MetricsCollector.ts  # Comprehensive metrics collection
│   ├── ErrorHandler.ts      # Advanced error handling system
│   ├── Logger.ts           # Multi-output logging system
│   ├── types.ts            # TypeScript type definitions
│   └── test/               # Comprehensive test suite (77 tests)
├── plugins/                # Benchmarking plugins
├── config/                 # Configuration files
├── reports/                # Generated benchmark reports
└── specs/                  # Design specifications and todos
```

## 🚀 Quick Start

### Prerequisites

- **Node.js**: 18.0.0+ (LTS recommended)
- **TypeScript**: 5.4.3+
- **npm**: Latest version

### Installation

```bash
# Navigate to eval directory
cd eval

# Install dependencies
npm install

# Build the project
npm run build

# Run all tests
npm test

# Run with coverage
npm test -- --coverage
```

## 🧪 Testing

The framework has **comprehensive test coverage** with 77 tests across 7 test suites:

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --testPathPattern=BenchmarkRunner.test.ts
npm test -- --testPathPattern=MetricsCollector.test.ts
npm test -- --testPathPattern=ErrorHandler.test.ts

# Run tests with coverage report
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

### Test Coverage

- **BenchmarkRunner**: 9 tests - Interface, configuration, execution flow
- **PluginLoader**: 10 tests - Plugin discovery, validation, loading
- **ConfigManager**: 10 tests - YAML loading, validation, merging
- **MetricsCollector**: 12 tests - Metrics recording, aggregation, persistence
- **ErrorHandler + Logger**: 27 tests - Error handling, logging, integration
- **Integration**: 8 tests - End-to-end component interaction
- **Setup**: 1 test - Environment validation

## 📊 Core Components

### BenchmarkRunner

The main execution engine for running benchmarks:

```typescript
import { BenchmarkRunner } from './core/BenchmarkRunner';

const config = {
  plugins: ['performance-test', 'accuracy-test'],
  output: { format: 'json', path: './reports' },
  timeout: 30000,
  parallel: true
};

const runner = new BenchmarkRunner(config);
const results = await runner.run();
```

**Features:**
- ✅ Configuration validation
- ✅ Plugin execution orchestration
- ✅ Error handling and recovery
- ✅ Graceful shutdown support

### MetricsCollector

Comprehensive metrics collection and analysis:

```typescript
import { MetricsCollector } from './core/MetricsCollector';

const collector = new MetricsCollector('./metrics');

// Record different metric types
collector.recordLatency('llm-response', 1200);
collector.recordTokenUsage('gpt-4', 500, 250);
collector.recordCustomMetric({
  name: 'accuracy-score',
  value: 0.95,
  timestamp: new Date(),
  labels: { model: 'claude-3', task: 'code-completion' }
});

// Get statistical analysis
const stats = collector.calculateStatistics('llm-response-latency');
console.log(`Mean: ${stats.mean}ms, P95: ${stats.p95}ms`);

// Export in multiple formats
const jsonData = collector.exportMetrics('json');
const csvData = collector.exportMetrics('csv');
const prometheusData = collector.exportMetrics('prometheus');
```

**Features:**
- ✅ Latency and token usage tracking
- ✅ Statistical analysis (mean, median, percentiles)
- ✅ Export to JSON, CSV, Prometheus formats
- ✅ Persistent storage and history tracking
- ✅ Metric definition validation

### ConfigManager

YAML-based configuration with environment support:

```typescript
import { ConfigManager } from './core/ConfigManager';

const configManager = new ConfigManager();

// Load configuration with environment overrides
const config = await configManager.loadConfigWithEnvironment('./config.yaml');

// Merge multiple configuration files
const mergedConfig = await configManager.mergeConfigs([
  './base-config.yaml',
  './env-specific.yaml'
]);
```

**Features:**
- ✅ YAML configuration parsing
- ✅ Schema validation with defaults
- ✅ Environment-specific overrides
- ✅ Configuration merging and hierarchy

### PluginLoader

Dynamic plugin discovery and loading system:

```typescript
import { PluginLoader } from './core/PluginLoader';

const loader = new PluginLoader('./plugins');

// Discover available plugins
const availablePlugins = await loader.discoverPlugins();

// Load specific plugins
const loadedPlugins = await loader.loadPlugins(['accuracy-test', 'performance-test']);

// Validate plugins
const errors = loader.getValidationErrors();
```

**Features:**
- ✅ Automatic plugin discovery
- ✅ Manifest validation
- ✅ Plugin interface compliance checking
- ✅ Detailed error reporting

### ErrorHandler & Logger

Advanced error handling with integrated logging:

```typescript
import { ErrorHandler, Logger } from './core';

const logger = new Logger('INFO');
const errorHandler = new ErrorHandler();

// Integrate logger with error handler
errorHandler.setLogger((level, message, context) => {
  logger.log(level, message, context);
});

// Handle errors with context
errorHandler.handleError(
  new BenchmarkError('Plugin execution failed'),
  { pluginName: 'test-plugin', sessionId: 'abc123' }
);

// Get error statistics
const stats = errorHandler.getErrorStatistics();
```

**Features:**
- ✅ Custom error types with recovery strategies
- ✅ Structured logging with multiple outputs
- ✅ Error categorization and statistics
- ✅ Context tracking and debugging support

## 📁 Configuration

### Basic Configuration (config.yaml)

```yaml
plugins:
  - accuracy-evaluator
  - performance-benchmarker
  - code-quality-analyzer

output:
  format: json
  path: ./reports

timeout: 30000
parallel: true
maxConcurrency: 4
verbose: true

# Environment-specific overrides
# config.development.yaml, config.production.yaml
```

### Plugin Manifest (plugins/example/manifest.json)

```json
{
  "name": "example-plugin",
  "version": "1.0.0",
  "description": "Example benchmarking plugin",
  "entryPoint": "index.js",
  "dependencies": ["typescript", "jest"],
  "config": {
    "testCases": 100,
    "timeout": 5000
  }
}
```

## 🔌 Plugin Development

### Creating a Plugin

1. **Create plugin directory**: `plugins/my-plugin/`
2. **Add manifest.json**: Plugin metadata and configuration
3. **Implement IBenchmarkPlugin interface**:

```typescript
import { IBenchmarkPlugin, BenchmarkResult } from '../../core/types';

export class MyPlugin implements IBenchmarkPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  description = 'My custom benchmark plugin';

  async initialize(): Promise<void> {
    // Plugin initialization logic
  }

  async execute(config: any): Promise<BenchmarkResult[]> {
    // Benchmark execution logic
    return [
      {
        testId: 'test-1',
        testName: 'My Test',
        status: 'passed',
        duration: 1000,
        metrics: { accuracy: 0.95 }
      }
    ];
  }

  async cleanup(): Promise<void> {
    // Cleanup logic
  }
}
```

## 📈 Metrics and Reporting

### Available Metrics

- **Latency Metrics**: Response times, execution duration
- **Token Usage**: Input/output tokens for LLM operations
- **Custom Metrics**: Accuracy, throughput, error rates
- **System Metrics**: Memory usage, CPU utilization

### Export Formats

- **JSON**: Structured data for programmatic analysis
- **CSV**: Spreadsheet-compatible format
- **Prometheus**: Time-series monitoring integration

### Statistical Analysis

- Mean, median, standard deviation
- Percentiles (P95, P99)
- Min/max values
- Trend analysis over time

## 🛠️ Development

### Project Structure

```
eval/
├── core/                   # Framework core
│   ├── *.ts               # Implementation files
│   ├── test/              # Test suites
│   └── types.ts           # Type definitions
├── plugins/               # Plugin ecosystem
├── config/                # Configuration templates
├── reports/               # Generated reports
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── jest.config.js         # Test configuration
└── README.md              # This file
```

### Development Scripts

```bash
npm run build          # Compile TypeScript
npm run test           # Run test suite
npm run test:coverage  # Run tests with coverage
npm run lint           # Lint code
npm run lint:fix       # Fix linting issues
npm run dev            # Development mode
npm run clean          # Clean build artifacts
```

### Testing Strategy

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **End-to-End Tests**: Full workflow validation
- **TDD Approach**: Tests written before implementation

## 🚀 Usage Examples

### Basic Benchmark Execution

```typescript
import { BenchmarkRunner, ConfigManager } from './core';

async function runBenchmark() {
  // Load configuration
  const configManager = new ConfigManager();
  const config = await configManager.loadConfig('./config.yaml');
  
  // Create and run benchmark
  const runner = new BenchmarkRunner(config);
  const results = await runner.run();
  
  console.log(`Executed ${results.summary.totalTests} tests`);
  console.log(`Success rate: ${results.summary.passed / results.summary.totalTests * 100}%`);
}
```

### Custom Metrics Collection

```typescript
import { MetricsCollector } from './core/MetricsCollector';

const collector = new MetricsCollector('./metrics');

// Define custom metrics
collector.registerMetricDefinition({
  name: 'code-quality-score',
  type: 'gauge',
  description: 'Code quality assessment score',
  unit: 'score'
});

// Record metrics during evaluation
collector.recordCustomMetric({
  name: 'code-quality-score',
  value: 8.5,
  timestamp: new Date(),
  labels: { 
    language: 'typescript',
    complexity: 'medium'
  }
});

// Export for analysis
await collector.persistMetrics('evaluation-session-1');
```

## 🤝 Contributing

1. **Follow TDD**: Write tests before implementation
2. **Maintain Coverage**: Keep test coverage above 85%
3. **Code Quality**: Use TypeScript, ESLint, Prettier
4. **Documentation**: Update README and inline docs
5. **Testing**: Ensure all tests pass before committing

### Commit Guidelines

```bash
git commit -m "feat: add new metrics collection feature

- Implement histogram metrics support
- Add percentile calculations
- Update tests and documentation

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## 📋 Roadmap

### Phase 1: Core Framework ✅
- [x] Micro-kernel architecture
- [x] Basic benchmark execution
- [x] Configuration management
- [x] Plugin system foundation

### Phase 2: Advanced Features ✅
- [x] Comprehensive metrics collection
- [x] Advanced error handling
- [x] Structured logging system
- [x] Statistical analysis

### Phase 3: Plugin Ecosystem (Next)
- [ ] LLM accuracy evaluation plugins
- [ ] Performance benchmarking plugins
- [ ] Code quality assessment plugins
- [ ] Integration with Continue.dev

### Phase 4: Monitoring & Analytics (Future)
- [ ] Real-time dashboard
- [ ] Trend analysis
- [ ] Automated reporting
- [ ] Performance alerts

## 📄 License

Apache 2.0 License - see [LICENSE](../LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/continuedev/continue/issues)
- **Documentation**: See `/specs` directory for detailed specifications
- **Tests**: 77 comprehensive tests with 86%+ coverage

---

**Built with ❤️ for the Continue.dev community**

This framework provides the foundation for evaluating and benchmarking AI code assistant capabilities with enterprise-grade reliability and comprehensive observability.