import { TestCase } from '../core/types.js';
import { SubsetConfig } from './interfaces.js';

/**
 * Utility class for selecting subsets of test cases from datasets
 */
export class SubsetSelector {
  /**
   * Apply subset configuration to a list of test cases
   */
  static applySubset(testCases: TestCase[], subsetConfig: SubsetConfig): TestCase[] {
    if (!subsetConfig) {
      return testCases;
    }

    let filteredCases = testCases;

    // Apply filter function if provided
    if (subsetConfig.filter) {
      try {
        // For security, we only support basic property filtering via JSON config
        // Complex filtering should be done via indices/range/random selection
        filteredCases = testCases.filter((testCase, index) => {
          // Simple property-based filtering (e.g., "metadata.difficulty === 'medium'")
          return this.evaluateFilter(testCase, subsetConfig.filter!, index);
        });
      } catch (error) {
        throw new Error(`Invalid filter expression: ${(error as Error).message}`);
      }
    }

    // Apply index-based selection
    if (subsetConfig.indices) {
      this.validateIndices(subsetConfig.indices, filteredCases.length);
      filteredCases = subsetConfig.indices.map(index => filteredCases[index]).filter(tc => tc !== undefined);
    }

    // Apply range-based selection
    if (subsetConfig.range) {
      const { start, end } = subsetConfig.range;
      this.validateRange(start, end, filteredCases.length);
      filteredCases = filteredCases.slice(start, end);
    }

    // Apply random selection
    if (subsetConfig.random) {
      const { count, seed } = subsetConfig.random;
      this.validateRandomCount(count, filteredCases.length);
      filteredCases = this.selectRandom(filteredCases, count, seed);
    }

    return filteredCases;
  }

  /**
   * Validate that indices are within bounds
   */
  private static validateIndices(indices: number[], totalCount: number): void {
    const invalidIndices = indices.filter(index => index < 0 || index >= totalCount);
    if (invalidIndices.length > 0) {
      throw new Error(`Invalid indices [${invalidIndices.join(', ')}] for dataset with ${totalCount} test cases`);
    }
  }

  /**
   * Validate that range is valid
   */
  private static validateRange(start: number, end: number, totalCount: number): void {
    if (start < 0) {
      throw new Error(`Range start ${start} cannot be negative`);
    }
    if (end > totalCount) {
      throw new Error(`Range end ${end} exceeds dataset size ${totalCount}`);
    }
    if (start >= end) {
      throw new Error(`Range start ${start} must be less than end ${end}`);
    }
  }

  /**
   * Validate that random count is reasonable
   */
  private static validateRandomCount(count: number, totalCount: number): void {
    if (count <= 0) {
      throw new Error(`Random count ${count} must be positive`);
    }
    if (count > totalCount) {
      throw new Error(`Random count ${count} exceeds dataset size ${totalCount}`);
    }
  }

  /**
   * Select random test cases with optional seed for reproducibility
   */
  private static selectRandom(testCases: TestCase[], count: number, seed?: number): TestCase[] {
    const shuffled = [...testCases];
    
    // Simple seeded random shuffle using linear congruential generator
    if (seed !== undefined) {
      let rng = seed;
      for (let i = shuffled.length - 1; i > 0; i--) {
        // LCG parameters (same as used in glibc)
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        const j = Math.floor((rng / 0x7fffffff) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    } else {
      // Use Math.random() for non-seeded shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
    }

    return shuffled.slice(0, count);
  }

  /**
   * Evaluate a simple filter expression against a test case
   * Supports basic property access and equality/inequality comparisons
   */
  private static evaluateFilter(testCase: TestCase, filterExpr: string, index: number): boolean {
    // For security, we only support a limited set of safe filter operations
    // This is a simplified implementation - in production, consider using a proper expression parser
    
    // Replace placeholders
    const expr = filterExpr
      .replace(/\bindex\b/g, index.toString())
      .replace(/\btestCase\.(\w+(?:\.\w+)*)\b/g, (_, path) => {
        return JSON.stringify(this.getNestedProperty(testCase, path));
      });

    // Basic safety check - only allow simple comparisons
    if (!/^[^;{}()]*$/.test(expr)) {
      throw new Error(`Unsafe filter expression: ${filterExpr}`);
    }

    try {
      // This is a simplified evaluation - in production, use a proper expression parser
      return new Function('return ' + expr)();
    } catch (error) {
      throw new Error(`Failed to evaluate filter: ${filterExpr}`);
    }
  }

  /**
   * Get nested property value from an object using dot notation
   */
  private static getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get statistics about subset selection
   */
  static getSubsetStats(originalCount: number, subsetCount: number, subsetConfig: SubsetConfig): {
    originalCount: number;
    selectedCount: number;
    reductionPercent: number;
    selectionMethod: string;
  } {
    const reductionPercent = originalCount > 0 ? ((originalCount - subsetCount) / originalCount) * 100 : 0;
    
    let selectionMethod = "none";
    if (subsetConfig.indices) selectionMethod = "indices";
    else if (subsetConfig.range) selectionMethod = "range";
    else if (subsetConfig.random) selectionMethod = "random";
    else if (subsetConfig.filter) selectionMethod = "filter";

    return {
      originalCount,
      selectedCount: subsetCount,
      reductionPercent: Math.round(reductionPercent * 100) / 100,
      selectionMethod
    };
  }
}