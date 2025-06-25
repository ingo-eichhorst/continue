# Feature List for Continue.dev Benchmarking

## Version 0.1

- Continue.dev is an AI coding assistent that is tighlty integrated in your IDE. (VS code and JetBrains)
- I considts of multiple modules. We are mostly concerned with the core module to test functionality sharded between IDEs
- Benchmarks can analyse any core functionality from continue.dev that involves LLMs
- Additional Benchmarks should be simple to implement by a One-Shot Prompt (preferably as plugin infrastructure and micro kernel)
- The functionality that should be analysed
- Every benchmark should have a fixed set of properties (like name and description) and an extendable set of custom properties (like a system prompt) all properties can be optional or required depending on the benchmark. For a benchmark involving LLMs a list of system prompts could a required property. In that case all systems in the list would be tested agains the all test-cases. 

### Benchmarking and Evaluation Framework

- The system must evaluate LLM performance across various coding tasks that involve LLMs
- It uses the LLM adapter logic build into the code of continue.dev
- Use cases are the benchmarking of algorithms, debugging, refactoring, documentation generation, and edge case handling
- It is used for independent testing of each Continue.dev feature involving LLMs
- Benchmark-Plugins can be loaded from external sources by providing an URL to a git repository (consider security implications)

### Secure Execution Environment

- The system can be used in a unsecure mode, which starts the benchmarks and the execution of the code in one go and a docker-based isolation mode for secure execution of LLM-generated code as sandboxed environment to prevent security risks
- The secure docker environment is the default

### Comprehensive Metrics

- Performance metrics: latency, cost, accuracy
- Support for custom metrics
- Statistical reporting capabilities (the system should be as scientific as possible)

### Dataset Management

- The system provides data in the repository and an adapter to include external datasets

### Specific Benchmark Types

- For every benchmark a demo data set is generated for testing purposes

#### Unified Diff Generation Testing

- To evaluate the quality of generated diffs the benchmark uses the function in /continue/core/edit/lazy/unifiedDiffApply.ts
- The input data for the test concists of an input-prompt, the original source code, the context that is provided alongside the input-prompt.
- This input data is send to the LLM through the LLM integration provided by continue.dev
- The result is then taken and the part that is concerned with a diff is sent to the function in /continue/core/edit/lazy/unifiedDiffApply.ts
- The function will either return the applied diff (success) or an error.
- If the function returns an error test fails.

#### System Prompt Optimization

- Generate source code from a given input prompt
- Input data: requirements document and existing code as context
- It is possible to specify a list of system prompts that will be compared against each other.
- The effectivness of a completion is measured by running the result agains a unit-test which is part of the data-set. Other metrics are execution duration and readability (judged by another LLM validator)
- There should be additionally a parameter of various models that are compared with the same system-promt and input data for every test-case
- The aim is to identify optimal prompts for specific coding tasks
- The result should be usable to derive updated system prompts that lead to improved output, which again can be refined.

#### Prompt Evaluation

- Evaluate the quality of resulting code whan using different .continuerules or .prompt files as context.
- The Input are a list of .promts and/or .continuerules files as context that are a property of the benchmark. Those are used to call the LLM adapter of continue.dev core. Also a combination of .prompt and .comtinuerules is possible.

### Other Requirements

### Sequential Execution

- For the first phase the execution of tests is performed sequiential, one after another
- It should be easely possible to restart the benchmark in case it has errored out
- Reasons for erroring out are a non responding LLM after 3 tries or a unecpected crash of the benchmark. 
- If the app is called with a --continue flag it should continue where it left of. The session data is stored in a local session file

### Reporting System

- For the first phase a report is only generated on the terminal. 
