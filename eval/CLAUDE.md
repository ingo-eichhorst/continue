# CLAUDE.md - Evaluation Framework

This file provides guidance for working with the evaluation framework in the `/eval` directory.

## Overview

The evaluation framework is designed to benchmark and test Continue's AI code assistant functionality across different scenarios and datasets.

## Directory Structure

- **`/datasets`**: Test datasets for various evaluation scenarios
  - `/diff-dataset`: Dataset for testing diff generation and code modification capabilities
- **`/specs`**: Specification documents and feature requirements
  - `features.md`: Core features and capabilities to evaluate
  - `specs.md`: Detailed specifications for evaluation framework

## Development Commands

Currently, the evaluation framework is in development. Key files have been removed as part of restructuring.

## Dataset Format

### Diff Dataset (`/datasets/diff-dataset/dataset.json`)
Contains test cases for evaluating code modification and diff generation capabilities. Each entry includes:
- Input code snippets
- Expected modifications
- Target outcomes for evaluation

## Usage Notes

- This evaluation framework is separate from the main Continue codebase
- Datasets should be version controlled to ensure reproducible evaluations
- Results and metrics should be documented for comparison across different model versions

## Configuration

The evaluation framework will support configuration for:
- Model selection and parameters
- Dataset selection and filtering
- Evaluation metrics and scoring
- Output formatting and reporting