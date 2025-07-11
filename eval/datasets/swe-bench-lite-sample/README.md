# SWE-bench Lite Sample Dataset

This dataset contains the first 2 test cases from SWE-bench Lite, converted to the local dataset format for testing and development purposes.

## Contents

- **astropy__astropy-12907**: Bug fix for separability matrix computation in nested CompoundModels
- **astropy__astropy-14182**: Adding header rows support to RestructuredText output

## Usage

Run the evaluation using this local dataset:

```bash
# Test with local dataset (no repository cloning needed)
npm run dev -- benchmark --plugin prompt-evaluation --dataset local --dataset-source swe-bench-lite-sample --models GPT-4o --verbose

# Compare with live SWE-bench (with repository cloning)
npm run dev -- benchmark --plugin prompt-evaluation --dataset swe-bench --dataset-source SWE-bench_Lite --models GPT-4o --verbose
```

## Dataset Structure

Each test case includes:
- **Problem Statement**: Description of the bug or feature request
- **Repository Context**: Base commit, repository name, failing tests
- **Expected Output**: The correct unified diff patch
- **Unit Tests**: Test patches to verify the fix

## Benefits

1. **Faster Development**: No need to download from HuggingFace
2. **Consistent Testing**: Same test cases every time
3. **Offline Work**: Works without internet connection
4. **Debug-Friendly**: Small, focused dataset for testing changes

## Original Sources

- **Source**: SWE-bench Lite from HuggingFace (`SWE-bench/SWE-bench_Lite`)
- **API Endpoint**: `https://datasets-server.huggingface.co/rows?dataset=SWE-bench/SWE-bench_Lite&config=default&split=test&offset=0&length=2`
- **Total SWE-bench Lite Cases**: 300 (this dataset contains the first 2)

## Test Case Details

### Case 1: astropy__astropy-12907
- **Repository**: astropy/astropy
- **Issue**: Separability matrix bug in nested CompoundModels
- **File Modified**: `astropy/modeling/separable.py`
- **Key Change**: Fix coordinate matrix calculation by using `right` instead of `1`

### Case 2: astropy__astropy-14182  
- **Repository**: astropy/astropy
- **Issue**: Missing header_rows support in RestructuredText output
- **File Modified**: `astropy/io/ascii/rst.py`
- **Key Change**: Add header_rows parameter to RST class constructor