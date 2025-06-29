# Dataset Providers Implementation

This document describes the new dataset provider architecture implemented for the evaluation framework, providing support for multiple dataset types including SWE-bench integration.

## Overview

The enhanced dataset system supports:
- **Multiple Dataset Types**: Local JSON, SWE-bench, with extensibility for LiveCodeBench, HumanEval, etc.
- **Backward Compatibility**: Existing string-based dataset configurations continue to work
- **Subset Selection**: Multiple ways to select subsets of test cases for testing and experimentation
- **Plugin Architecture**: Easy extension with new dataset providers

## Architecture

### Core Components

1. **DatasetProviderRegistry** (`/dataset-providers/DatasetProviderRegistry.ts`)
   - Manages all dataset providers
   - Routes dataset loading requests to appropriate providers
   - Handles provider discovery and validation

2. **DatasetProvider Interface** (`/dataset-providers/interfaces.ts`)
   - Standardized interface for all dataset providers
   - Defines load, validate, schema, and capability methods

3. **SubsetSelector** (`/dataset-providers/SubsetSelector.ts`)
   - Handles subset selection logic (indices, range, random, filter)
   - Provides statistics about subset operations

4. **Enhanced DatasetLoader** (`/core/DatasetLoader.ts`)
   - Updated to use provider registry while maintaining backward compatibility
   - Supports both legacy string format and new configuration objects

### Dataset Providers

#### LocalDatasetProvider (`/dataset-providers/LocalDatasetProvider.ts`)
- Handles local JSON datasets from the filesystem
- Maintains full backward compatibility with existing DatasetLoader
- Supports all subset selection options

#### SWEBenchDatasetProvider (`/dataset-providers/SWEBenchDatasetProvider.ts`)
- Loads SWE-bench datasets (currently with mock data)
- Transforms SWE-bench instances to standard TestCase format
- Supports repository filtering and standard subset selection

## Configuration Formats

### Legacy Format (Backward Compatible)
```typescript
// String-based configuration (existing code continues to work)
const dataset = await loader.loadDataset('prompt-evaluation-dataset');
```

### New Configuration Format
```typescript
// Enhanced configuration with subset selection
const dataset = await loader.loadDataset({
  type: 'local',
  name: 'prompt-evaluation-dataset',
  subset: {
    range: { start: 0, end: 5 }
  }
});

// SWE-bench configuration
const sweBenchDataset = await loader.loadDataset({
  type: 'swe-bench',
  name: 'SWE-bench_Lite',
  config: {
    split: 'test',
    repo_filter: ['django/django', 'requests/requests']
  },
  subset: {
    random: { count: 10, seed: 42 }
  }
});
```

## Subset Selection Options

### Index-based Selection
```typescript
subset: {
  indices: [0, 2, 5, 10] // Select specific test cases by index
}
```

### Range-based Selection
```typescript
subset: {
  range: { start: 0, end: 20 } // Select continuous range
}
```

### Random Selection
```typescript
subset: {
  random: { count: 50, seed: 42 } // Random selection with optional seed
}
```

### Filter-based Selection
```typescript
subset: {
  filter: "testCase.metadata.difficulty === 'medium'" // Simple property filtering
}
```

## SWE-bench Integration

### Current Implementation
- **Mock Data**: Currently uses mock SWE-bench data for testing
- **Field Transformation**: Converts SWE-bench format to standard TestCase format
- **Repository Filtering**: Supports filtering by repository names

### Field Mapping
- `instance_id` → `TestCase.id`
- `problem_statement` → `TestCase.input.prompt`
- `repo` → `TestCase.metadata.repository`
- `patch` → `TestCase.expected.output`
- `test_patch` → `TestCase.expected.unitTest`

### Future Enhancement
To complete SWE-bench integration:
1. Add HuggingFace datasets library integration
2. Implement caching for downloaded datasets
3. Add authentication for private datasets
4. Enhance environment setup automation

## Usage Examples

### Testing the Implementation
```bash
# Run the test script to verify functionality
npx tsx test-dataset-providers.ts
```

### Using in Benchmark Configuration
```json
{
  "datasets": [
    {
      "name": "Local Subset Test",
      "config": {
        "type": "local",
        "name": "prompt-evaluation-dataset",
        "subset": {
          "range": { "start": 0, "end": 3 }
        }
      }
    },
    {
      "name": "SWE-bench Sample",
      "config": {
        "type": "swe-bench",
        "name": "SWE-bench_Lite",
        "config": {
          "split": "test",
          "repo_filter": ["django"]
        },
        "subset": {
          "random": { "count": 5, "seed": 42 }
        }
      }
    }
  ]
}
```

## Extension Points

### Adding New Dataset Providers
1. Implement the `DatasetProvider` interface
2. Add field transformation logic
3. Register with the DatasetLoader
4. Update type definitions

```typescript
export class CustomDatasetProvider implements DatasetProvider {
  name = "custom";
  description = "Custom dataset provider";
  supportedTypes = ["custom"];

  canHandle(config: DatasetConfig): boolean {
    return config.type === "custom";
  }

  async load(config: DatasetConfig): Promise<Dataset> {
    // Implementation
  }

  // ... other interface methods
}
```

## Benefits

1. **Extensibility**: Easy to add new dataset types
2. **Backward Compatibility**: All existing code continues to work unchanged
3. **Flexible Testing**: Multiple subset selection options for experimentation
4. **Standardization**: Consistent interface across all dataset types
5. **Validation**: Early error detection and clear error messages
6. **Performance**: Subset selection reduces processing time for large datasets

## Files Created/Modified

### New Files
- `/dataset-providers/interfaces.ts` - Core interfaces and types
- `/dataset-providers/DatasetProviderRegistry.ts` - Provider registry implementation
- `/dataset-providers/LocalDatasetProvider.ts` - Local dataset provider
- `/dataset-providers/SWEBenchDatasetProvider.ts` - SWE-bench provider
- `/dataset-providers/SubsetSelector.ts` - Subset selection utilities
- `/dataset-providers/index.ts` - Module exports
- `/example-swe-bench-config.json` - Example configuration
- `/test-dataset-providers.ts` - Test script

### Modified Files
- `/core/DatasetLoader.ts` - Enhanced to use provider registry
- `/core/types.ts` - Added DatasetConfigInput type