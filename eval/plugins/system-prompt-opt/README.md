# System Prompt Optimization Plugin

The System Prompt Optimization Plugin evaluates and compares the effectiveness of different system prompts for code generation tasks. It provides comprehensive metrics including unit test success rates, performance measurements, and LLM-based readability assessments.

## Features

- **Multi-Prompt Comparison**: Test multiple system prompts against the same dataset
- **Cross-Model Evaluation**: Compare prompts across different LLM models
- **Comprehensive Metrics**: Unit tests, performance, readability, and overall scores
- **Statistical Analysis**: Rankings, averages, and success rates
- **Detailed Reporting**: Step-by-step results with comparative summaries

## Usage

### Basic Usage

```bash
npm run benchmark -- benchmark \
  --plugin system-prompt-optimization \
  --models gpt-4,claude-3-sonnet \
  --properties-file plugins/system-prompt-opt/example-properties.json
```

### Properties Configuration

Create a JSON configuration file with the following properties:

```json
{
  "systemPrompts": [
    "You are a JavaScript developer. Write clean, working code.",
    "You are an expert JavaScript developer with deep knowledge of algorithms and best practices...",
    "You are a senior developer focused on high-performance code..."
  ],
  "models": [],
  "requirementsFile": "datasets/system-prompt-optimization-dataset/requirements-example.md",
  "contextFile": "datasets/system-prompt-optimization-dataset/context-example.js",
  "validationModel": "gpt-4"
}
```

### Properties Schema

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `systemPrompts` | array | ✅ | - | Array of system prompts to compare |
| `models` | array | ❌ | `[]` | Model IDs for cross-model comparison (empty = use CLI models) |
| `requirementsFile` | string | ❌ | `""` | Path to requirements document |
| `contextFile` | string | ❌ | `""` | Path to existing code context |
| `validationModel` | string | ❌ | `"gpt-4"` | Model for code quality validation assessment |

## Dataset Format

The plugin uses datasets with the following structure:

```json
{
  "testCases": [
    {
      "id": "binary-search-implementation",
      "input": {
        "prompt": "Implement a binary search function..."
      },
      "expected": {
        "functionality": "Binary search algorithm implementation",
        "unitTest": "const assert = require('assert'); ..."
      },
      "metadata": {
        "language": "javascript",
        "difficulty": "medium",
        "category": "algorithms"
      }
    }
  ]
}
```

## Evaluation Workflow

For each system prompt, the plugin executes:

1. **Code Generation**: Generate code using the enhanced system prompt
2. **Code Extraction**: Extract JavaScript code from LLM response
3. **Unit Testing**: Execute provided unit tests against generated code
4. **Performance Measurement**: Measure code generation duration
5. **Code Quality Validation**: LLM-based code quality evaluation
6. **Comparison Summary**: Statistical analysis and ranking

## Metrics & Scoring

### Individual Metrics
- **Unit Tests**: Pass/fail (binary)
- **Performance**: Normalized by 30-second threshold
- **Code Quality**: 5 criteria rated 1-10, overall threshold 6/10

### Overall Score Calculation
```
Overall Score = (Unit Test Pass × 0.5) + (Performance × 0.3) + (Code Quality × 0.2)
```

### Code Quality Validation Criteria
1. **Code Structure & Organization**: Logical flow, indentation, separation of concerns
2. **Naming Conventions**: Descriptive names, consistent style
3. **Error Handling**: Input validation, edge cases, error recovery
4. **Performance Considerations**: Efficient algorithms, appropriate data structures
5. **Best Practices**: Modern JavaScript, maintainability, testability

## Output Format

The plugin generates detailed results for each prompt variant:

```
[gpt-4] [Prompt 1] Code generation completed in 2340ms
[gpt-4] [Prompt 1] Extracted 423 characters of code
[gpt-4] [Prompt 1] Unit tests passed: All tests completed successfully
[gpt-4] [Prompt 1] Code quality validation: Overall 8/10 (Structure:8/10, Naming:9/10...)
```

And a comprehensive comparison summary:

```
[gpt-4] Prompt Optimization - Best: P2(85%) | Ranking: 1.P2(85%) 2.P1(72%) 3.P3(58%) | 
Stats: Avg:72% Succ:2/3 PerfAvg:89% ReadAvg:76% | Details: P1:✓/89%/73%/72% P2:✓/92%/82%/85% P3:✗/86%/71%/58%
```

## Multi-Model Comparison

When multiple models are specified, results are generated separately for each model, allowing comparison of:
- How the same prompts perform across different models
- Which models respond better to specific prompt styles
- Consistency of prompt effectiveness across model architectures

## Example Datasets

The plugin includes example datasets for common coding tasks:
- Binary search implementation
- Linked list operations
- Async data processing
- Memoized algorithms
- Event emitter patterns

## Best Practices

1. **Prompt Design**: Test prompts with varying levels of detail and specificity
2. **Requirements Files**: Use clear, comprehensive requirements documents
3. **Context Files**: Provide relevant utility functions and patterns
4. **Model Selection**: Test across different model capabilities and sizes
5. **Iteration**: Use results to refine and improve prompt effectiveness

## Troubleshooting

### Common Issues

**No code extracted from response**
- LLM included too much explanatory text
- Check prompt clarity and specificity
- Verify code block formatting in responses

**Unit tests failing**
- Generated code doesn't meet requirements
- Consider more detailed prompts or examples
- Review test case expectations

**Low code quality scores**
- Prompt lacks emphasis on code quality
- Add specific guidelines for naming, structure, error handling
- Include examples of well-structured code

### Debug Options

Use verbose logging to see detailed execution:
```bash
npm run benchmark -- benchmark --plugin system-prompt-optimization --verbose
```

## Contributing

When adding new test cases to the dataset:
1. Include comprehensive unit tests
2. Specify expected functionality clearly
3. Add appropriate metadata (difficulty, category, concepts)
4. Test with multiple prompt styles to ensure validity