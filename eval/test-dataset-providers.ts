/**
 * Simple test script to verify dataset provider functionality
 */
import { DatasetLoader } from './core/DatasetLoader.js';
import { LocalDatasetProvider, SWEBenchDatasetProvider } from './dataset-providers/index.js';

// Mock logger for testing
const mockLogger = {
  debug: (msg: string, data?: any) => console.log(`[DEBUG] ${msg}`, data || ''),
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string, data?: any) => console.log(`[WARN] ${msg}`, data || ''),
  error: (msg: string, error?: Error) => console.log(`[ERROR] ${msg}`, error?.message || '')
};

async function testDatasetProviders() {
  console.log('Testing Dataset Providers...\n');

  const loader = new DatasetLoader(mockLogger, process.cwd());

  // Register SWE-bench provider
  loader.registerProvider(new SWEBenchDatasetProvider(mockLogger));

  // Test 1: Load local dataset with legacy string format
  console.log('Test 1: Legacy local dataset loading');
  try {
    const dataset1 = await loader.loadDataset('prompt-evaluation-dataset');
    console.log(`✓ Loaded ${dataset1.name} with ${dataset1.testCases.length} test cases\n`);
  } catch (error) {
    console.log(`✗ Failed: ${(error as Error).message}\n`);
  }

  // Test 2: Load local dataset with new config format
  console.log('Test 2: New config format local dataset');
  try {
    const dataset2 = await loader.loadDataset({
      type: 'local',
      name: 'prompt-evaluation-dataset',
      subset: {
        range: { start: 0, end: 1 }
      }
    });
    console.log(`✓ Loaded ${dataset2.name} with ${dataset2.testCases.length} test cases (subset)\n`);
  } catch (error) {
    console.log(`✗ Failed: ${(error as Error).message}\n`);
  }

  // Test 3: SWE-bench dataset (mock data)
  console.log('Test 3: SWE-bench dataset with mock data');
  try {
    const dataset3 = await loader.loadDataset({
      type: 'swe-bench',
      name: 'SWE-bench_Lite',
      config: {
        split: 'test',
        repo_filter: ['django/django']
      },
      subset: {
        random: { count: 1, seed: 42 }
      }
    });
    console.log(`✓ Loaded ${dataset3.name} with ${dataset3.testCases.length} test cases\n`);
    
    if (dataset3.testCases.length > 0) {
      const testCase = dataset3.testCases[0];
      console.log(`Sample test case: ${testCase.id}`);
      console.log(`Repository: ${testCase.metadata?.repository}`);
      console.log(`Description: ${testCase.description?.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`✗ Failed: ${(error as Error).message}\n`);
  }

  // Test 4: Provider information
  console.log('Test 4: Provider information');
  const providerInfo = loader.getProviderInfo();
  console.log('Available providers:');
  providerInfo.forEach(provider => {
    console.log(`  - ${provider.name}: ${provider.description} (types: ${provider.types.join(', ')})`);
  });
  console.log();

  // Test 5: Validation
  console.log('Test 5: Configuration validation');
  const validConfig = await loader.validateDataset({
    type: 'local',
    name: 'prompt-evaluation-dataset'
  });
  console.log(`Local config valid: ${validConfig}`);

  const invalidConfig = await loader.validateDataset({
    type: 'swe-bench',
    name: '', // Invalid: empty name
    config: {
      split: 'invalid' as any // Invalid split
    }
  });
  console.log(`Invalid config valid: ${invalidConfig}`);

  console.log('\nTesting completed!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testDatasetProviders().catch(console.error);
}