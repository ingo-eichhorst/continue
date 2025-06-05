# Very Simple Benchmark Specification

## High-Level Objective

- Create the the Benchmark Kernel and a first Benchmark together with that tests the capabilities of the LLM to generate unified diffs and use the apply button function to see if they are properly applied.

## Mid-Level Objective

- The Benchmark Kernel consists of a class that has the methods run and evaluate.
- The Unified Diff Benchmark provides an interface for loading the data-set

## Implementation Notes
- No need to import any external libraries see pyproject.toml for dependencies.
- Comment every function.
- For typer commands add usage examples starting with `uv run main <func name dash sep and params>`
- When code block is given in low-level tasks, use it without making changes (Task 4).
- Carefully review each low-level task for exact code changes.

## Context

### Beginning context
- `src/spec_based_ai_coding/main.py`
- `pyproject.toml` (readonly)

### Ending context
- `src/spec_based_ai_coding/main.py`
- `pyproject.toml`
- `src/spec_based_ai_coding/llm.py` (new file)
- `src/spec_based_ai_coding/word_counter.py` (new file)
- `src/spec_based_ai_coding/data_types.py` (new file)
- `src/spec_based_ai_coding/constants.py` (new file)

## Low-Level Tasks

1. Create a end 2 end test case
```aider
CREATE eval/src/benchmark.test.ts:
    CREATE a test to verify that a unified diff can be applied to a codebase
        Load the function from: core/edit/lazy/unifiedDiffApply.ts
        Add a simple test case with codebase and unified diff with a simple change
        Instantiate the Benchmark class from eval/src/benchmark.ts
        Run the benchmark
        Assert that the output is a report with the expected contents
```

2. Create a Benchmark Class
```aider
CREATE eval/src/benchmark.ts:
    CREATE Benchmark class
        constructor(name: str, description: str, type: str)
        run() -> Report
```
