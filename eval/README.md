# Continue.dev Benchmarking Framework

A comprehensive benchmarking framework for evaluating LLM performance in Continue.dev coding tasks.

## Overview

This framework implements a micro-kernel architecture focused on evaluating LLM capabilities across various coding tasks including diff generation, system prompt optimization, and context evaluation.

## Quick Start

### Installation

```bash
cd eval
npm install
npm run build
```

### Basic Usage

Run a unified diff benchmark:
```bash
npm run benchmark -- benchmark --plugin unified-diff-testing
```

Resume from a previous session:
```bash
npm run benchmark -- benchmark --continue <session-id>
```

List all sessions:
```bash
npm run benchmark -- list-sessions
```

### Command Reference

```bash
# Run benchmarks
npm run benchmark -- benchmark [options]
  -p, --plugin <name>          Benchmark plugin to run
  -m, --models <models>        Comma-separated list of model IDs
  -d, --dataset <path>         Path to dataset file or directory
  -e, --execution-env <type>   Execution environment (local|docker)
  -o, --output <format>        Output format (console|json)
  -v, --verbose                Enable verbose logging
  --continue <sessionId>       Continue from existing session
  --dry-run                    Show execution plan without running

# Session management
npm run benchmark -- list-sessions [-v]
npm run benchmark -- show-session <sessionId>
npm run benchmark -- cleanup [--days <number>]

# Environment validation
npm run benchmark -- validate-env [-e <type>]
```

## Architecture

### Core Components

- **BenchmarkEngine**: Main orchestrator managing benchmark execution
- **SessionManager**: Handles persistent session storage and recovery
- **PluginSystem**: Extensible plugin architecture for different benchmark types
- **ExecutionEnvironments**: Local and Docker-based code execution

### Available Plugins

#### Unified Diff Testing (`unified-diff-testing`)
Evaluates LLM ability to generate and apply unified diffs correctly.

**Features:**
- Tests diff format validation
- Verifies diff application success
- Syntax validation of modified code
- Content verification against expected changes

**Dataset**: 10 JavaScript examples covering:
- Error handling additions
- Documentation additions
- Class method additions
- Code style improvements
- Syntax modernization

## Execution Environments

### Local Environment (`local`)
- Fast execution for development and testing
- Requires local language runtimes (Node.js, Python, etc.)
- **Security**: No isolation - use only with trusted code

### Docker Environment (`docker`) - Default
- Secure sandboxed execution
- Isolated filesystem and network
- Resource limits and timeouts
- Automatic image management

## Configuration

### Model Configuration
Models are loaded from Continue.dev's configuration system. Currently supports mock models for testing.

### Dataset Format
Datasets are JSON files with the following structure:

```json
{
  "name": "dataset-name",
  "description": "Dataset description",
  "version": "1.0.0",
  "metadata": {
    "language": "javascript",
    "difficulty": "easy",
    "tags": ["functions", "classes"]
  },
  "testCases": [
    {
      "id": "test-001",
      "name": "Test case name",
      "input": {
        "prompt": "Task description",
        "sourceCode": "...",
        "modificationPrompt": "..."
      },
      "expected": {
        "diffShouldApply": true,
        "expectedChanges": ["keyword1", "keyword2"]
      }
    }
  ]
}
```

## Session Management

The framework supports robust session management with automatic recovery:

- **Persistent Storage**: Sessions stored in `.sessions/` directory
- **Automatic Recovery**: Resume interrupted benchmarks
- **Progress Tracking**: Real-time progress updates
- **Error Handling**: Graceful degradation and retry logic

### Session States
- `running`: Actively executing test cases
- `paused`: Manually paused execution
- `completed`: All test cases finished successfully
- `failed`: Execution failed with unrecoverable error

## Metrics and Evaluation

### Functional Metrics
- **Success Rate**: Percentage of test cases that pass all validations
- **Pass@k**: Following HumanEval standards (k=1,5,10)
- **Validation Breakdown**: Individual validation step success rates

### Performance Metrics
- **Latency**: Response time statistics (average, median, P95)
- **Token Usage**: Prompt and completion token consumption
- **Cost Estimation**: Approximate cost per benchmark run
- **Throughput**: Test cases completed per unit time

### Quality Metrics
- **Syntax Correctness**: Percentage of syntactically valid outputs
- **Format Compliance**: Adherence to expected output formats
- **Content Accuracy**: Presence of expected changes/features

## Development

### Adding New Plugins

1. Create plugin directory: `plugins/my-plugin/`
2. Implement `BenchmarkPlugin` interface:

```typescript
export class MyPlugin implements BenchmarkPlugin {
  name = 'my-plugin';
  description = 'Plugin description';
  
  propertiesSchema = {
    // Define configurable properties
  };
  
  async execute(context: BenchmarkContext): Promise<BenchmarkResult> {
    // Implement benchmark logic
  }
}
```

3. Register plugin in CLI: `engine.registerPlugin(new MyPlugin())`

### Creating Datasets

1. Create dataset directory: `datasets/my-dataset/`
2. Add `dataset.json` with test cases
3. Reference from plugin: `defaultDataset = '../datasets/my-dataset'`

### Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Planned Features

### System Prompt Optimization Plugin
- Test multiple system prompts against datasets
- Iterative prompt improvement based on results
- Statistical analysis of prompt effectiveness

### Prompt Evaluation Plugin
- Test different `.continuerules` and `.prompt` files
- Compare context configuration strategies
- Measure code quality improvements

### Advanced Features
- Parallel test execution
- Web-based dashboard
- Integration with Continue.dev's model ecosystem
- Support for additional programming languages

## Contributing

1. Follow Continue.dev's coding standards
2. Add tests for new functionality
3. Update documentation
4. Ensure compatibility with existing plugins

## License

Apache 2.0 - See Continue.dev main project for details.