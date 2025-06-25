# Continue.dev Benchmarking Framework - High-Level Architecture

## Design Overview

Based on GitHub issue #4906 and community feedback, this architecture implements a **micro-kernel design** focused on **diff generation/application testing** that lives entirely within the `/eval` directory. The framework supports both local and remote data sources while maintaining simplicity for "at home" testing.

## Components

### Entry Point CLI
- CLI param resolution
- Config Loading

### MicroKernel Core
**Benchmark Engine**

- Input (cli, env, .env file, config-file, benchmark-plugin-defaults):
  - "--continue" last session or "--continue 123" any session by id
  - "--benchmark <benchmark-name>" benchmark
  - models(list or .env file)
  - dataset(can be a default dataset)
  - execution environment (defaults to local)
  - "--report" (defaults to console)

    // 1. Load the BenchmarkPlugin by name
    // 2. ConfigLoader.loadConfigs(argv, env, config-files, benchmark-plugin-defaults);
    // 3. Load the dataset with source code, system-prompts, and unit-tests, ... (maybe use a default dataset)
    // 4. Load the models
    // 5. Validate properties for benchmark (benchmark props, dataset)
    // 6. Execute the benchmark
    // 7. Generate report from the results

**Session management**
- Persist in ./eval/.sessions/<session-id>.json
- Session uuid is provided when benchmark is started
- Session is persistend after every test case execution
- If benchmark dies, the session is picked up. all testcases that have been executed are skipped

#### Error Handling
- If one tests errors out persist the session and exit

### Benchmark Plugins
**One Shot Generation**
- Provide general Plugin generation System Prompt
- Add details in query for the benchmark you want to create

**BenchmarkPlugin Interface**

```typescript
interface BenchmarkPlugin {
  name: string;
  description: string;
  propertiesSchema: Record<string, PropertySchema>;

  execute(context: BenchmarkContext): Promise<BenchmarkResult>;
}

interface BenchmarkContext {
  models: Model[];
  dataset: Dataset;
  session: BenchmarkSession;
  properties: Record<string, any>;
  executionEnvironment: ExecutionEnvironment;
}
```

#### Unified Diff

```typescript
// plugins/unified-diff-testing.ts
export class UnifiedDiffBenchmark implements BenchmarkPlugin {
  name = "unified-diff-testing";
  description = "Evaluates quality of generated diffs";

  propertiesSchema = {
    systemPrompt: {
      type: "string",
      required: true
      default: "You are a helpful assistant that generates unified diffs."
    }
  };

  defaultDataset = "../datasets/diff-dataset";

  datasetSchema = {
    sourceCode: {
      type: "string",
      required: true
    },
    unitTests: {
      type: "string",
      required: true
    }
  };

  async execute(context: BenchmarkContext): Promise<BenchmarkResult> {
    // 2. For each test case, generate diff via LLM
    // 3. Apply diff to source code
    // 4. Run unit tests on modified code in ExecutionEnvironment
    // 5. Save session state and run next test
    // 6. Return results
  }
}
```


#### System Prompt Optimization
```typescript

// properties: 
// - maxImprovementRuns = 0 
// - qualityThreshold = 0.8
// - testPassThreshold = 1.0
// - maxPromptLength = 1000

// 1. For each test case, generate completion for system prompt, source code, and unit tests
// 2. Analyze completion for correctness and quality
// 3. Suggest a system prompt improvement based on analysis if quality is low or unit test fails
// 4. Collect all results (positive and negative) and create an optimized system prompt
// 5. Take the system prompt and rerun the benchmark
// 6. Return results
```

#### Prompt Evaluation
```typescript

// properties:
// - systemPrompt = ""
// - rulesFiles = []
// - promptFiles = []

// 1. provide rulesfiles or .prompt files to evaluate
// 2. Execute every prompt from the dataset
// 3. Analyze completion for correctness and quality
// 4. Return results

```

### Data-Set Plugins
**Data-Set Interface**
- Data validation and schema enforcement
- Metadata description and required schema should come from the Plugin
- Methods: load(), verify()

```typescript
interface Dataset {
  testCases: TestCase[];
  metadata: DatasetMetadata;
}
```

### Adapters

#### LLM Adapter
**LLM Adapter Interface**

#### Code Execution Plugin
**Code Generation Interface**

```typescript
interface ExecutionEnvironment {
  runCode(code: string, language: string): Promise<ExecutionResult>;
}
```

##### Container Execution

##### CLI Execution

### Directory Structure

```
benchmark-engine/
├── core/
│   ├── engine.ts           # Main benchmark engine
│   ├── plugin-registry.ts  # Plugin loading/management
│   ├── config-loader.ts    # Load ENV, CLI, and file configs
│   └── dataset-loader.ts   # Dataset handling
├── plugins/
│   ├── unified-diff/
│   ├── system-prompt-opt/
│   └── prompt-evaluation/
├── datasets/
│   ├── diff-dataset/
│   └── swe-dataset/
├── execution/
│   ├── docker-runner.ts
│   └── local-runner.ts
└── cli/
    └── main.ts
```