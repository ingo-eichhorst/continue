# Debugging the Evaluation Framework

## VS Code Debugger Setup

Two debug configurations have been added to `.vscode/launch.json`:

### 1. Debug Eval Benchmark (Pre-configured)
- **Name**: "Debug Eval Benchmark"
- **Command**: Runs SWE-bench evaluation with GPT-4o
- **Args**: Pre-set to `benchmark --plugin prompt-evaluation --dataset swe-bench --dataset-source SWE-bench_Lite --models GPT-4o --verbose`

### 2. Debug Eval Benchmark (Custom Args)
- **Name**: "Debug Eval Benchmark (Custom Args)"  
- **Command**: Runs with no arguments - you can modify the args in launch.json
- **Args**: Empty - customize as needed

## How to Debug

1. **Set Breakpoints**: Click in the gutter next to line numbers in any TypeScript file to set breakpoints
2. **Start Debugging**: 
   - Open VS Code Command Palette (`Cmd+Shift+P`)
   - Type "Debug: Start Debugging" or press `F5`
   - Select "Debug Eval Benchmark" from the dropdown
3. **Step Through Code**: Use the debug controls to step over/into/out of functions

## Key Files to Debug

### Entry Point
- `eval/cli/main.ts:144` - `runBenchmark()` function
- `eval/cli/main.ts:244` - Dataset loading with auto-repo-cloning logic

### Repository Management  
- `eval/core/RepositoryManager.ts:153` - `ensureRepositoryCloned()`
- `eval/core/RepositoryManager.ts:187` - `cloneRepository()`
- `eval/core/RepositoryManager.ts:84` - `getMultipleFileContents()`

### Dataset Loading
- `eval/dataset-providers/SWEBenchDatasetProvider.ts:35` - `load()` method
- `eval/dataset-providers/SWEBenchDatasetProvider.ts:397` - `transformToTestCase()`

### Plugin Execution
- `eval/plugins/prompt-evaluation/PromptEvaluationPlugin.ts:426` - `executeTestCase()`
- `eval/plugins/prompt-evaluation/PromptEvaluationPlugin.ts:106` - `executeDiffApplicationStep()`

## Debugging Tips

1. **Repository Cloning**: Set breakpoints in `RepositoryManager.ts` to see repo cloning in action
2. **Auto-enabling Logic**: Break at `main.ts:339` to see auto-repo-cloning decision
3. **Diff Application**: Break at `PromptEvaluationPlugin.ts:469` to debug diff patch application
4. **Source Code Parsing**: Break at `PromptEvaluationPlugin.ts:225` to see multi-file parsing

## Environment Variables

The debugger runs with the same environment as your shell, so make sure you have:
- OpenAI API key configured (`OPENAI_API_KEY`)
- GitHub token if needed (`GITHUB_TOKEN`)

## Common Debug Scenarios

### Scenario 1: Repository Not Cloning
- Break at `RepositoryManager.ts:187` in `cloneRepository()`
- Check `repoUrl` and `localPath` variables
- Step through git commands

### Scenario 2: Diff Patch Not Applying  
- Break at `PromptEvaluationPlugin.ts:106` in `executeDiffApplicationStep()`
- Check `baseSourceCode` content
- Inspect `diffFilePaths` array
- Step through file-by-file patching

### Scenario 3: Auto-enabling Not Working
- Break at `main.ts:339` where auto-enabling logic runs
- Check `repositoryOptions` object
- Verify `datasetType === "swe-bench"` condition