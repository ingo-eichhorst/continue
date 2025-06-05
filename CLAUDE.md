# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Continue is an open-source AI code assistant providing chat, autocomplete, edit, and agent functionality for VS Code and JetBrains IDEs. The project follows a multi-component architecture with shared TypeScript core and IDE-specific extensions.

## Architecture

### Core Components
- **`/core`**: Shared TypeScript library containing LLM providers, context systems, autocomplete engine, and configuration management
- **`/extensions/vscode`**: VS Code extension (TypeScript) with webview providers and IDE integration  
- **`/extensions/intellij`**: JetBrains extension (Kotlin/Gradle) currently in alpha
- **`/gui`**: React 18 + Vite frontend with Redux state management and Tailwind CSS
- **`/binary`**: Standalone Continue server for non-IDE usage with cross-platform distribution
- **`/sync`**: Rust-based codebase indexing engine using Merkle trees for efficient differential updates

### Key Architecture Patterns
- **Message-based communication** via well-defined TypeScript protocols (`/core/protocol`)
- **Plugin architecture** for context providers, LLM providers, and tools
- **IDE Interface abstraction** enabling multi-IDE support
- **Configuration system** supporting both JSON and YAML formats with profile management

## Essential Development Commands

### Root Level
```bash
npm run tsc:watch                    # Watch TypeScript compilation across all projects
npm run tsc:watch:gui               # Watch GUI only
npm run tsc:watch:vscode            # Watch VS Code extension only
npm run tsc:watch:core              # Watch core only
```

### Core (`/core`)
```bash
npm test                            # Jest tests with ES modules
npm run test:coverage               # Test coverage reports
npm run build:npm                   # Build NPM package
npm run lint && npm run lint:fix    # Lint and auto-fix
```

### VS Code Extension (`/extensions/vscode`)
```bash
npm run esbuild-watch               # Development bundling with hot reload
npm run package                    # Create .vsix package for distribution
npm run e2e:all                     # End-to-end tests
```

### GUI (`/gui`)
```bash
npm run dev                         # Vite development server
npm run build                       # Production build
npm run test                        # Vitest tests
```

### Documentation (`/docs`)
```bash
npm run start                       # Docusaurus development server
npm run build                       # Static site generation
```

## Development Setup

### VS Code Development
1. Install dependencies via VS Code task: `install-all-dependencies`
2. Debug extension: Run & Debug → "Launch extension" (opens new VS Code window with extension loaded)
3. Breakpoints work in both `core` and `extensions/vscode`
4. GUI hot reload: Run `gui:dev` task alongside extension debugging

### Requirements
- Node.js 20.19.0+ (LTS)
- TypeScript (ES modules throughout)
- Prettier (required for formatting)

## Key Technical Details

### Configuration System
- **Model Roles**: Specialized models for chat, autocomplete, edit, apply, embed, rerank
- **Context Providers**: Extensive ecosystem including file-based, codebase search, external APIs, and documentation
- **Profile Management**: Multiple configuration profiles with YAML migration support

### LLM Provider Support
Supports 30+ providers including OpenAI, Anthropic, Google Gemini, local providers (Ollama, LM Studio), and enterprise solutions (AWS Bedrock, Azure).

### Testing Strategy
- **Core**: Jest with ES modules support
- **Extensions**: VS Code Extension Tester framework
- **GUI**: Vitest for React components
- **E2E**: Automated browser testing

### Performance Features
- Incremental indexing with Merkle trees
- Real-time LLM response streaming  
- Multi-layer caching (LRU, file system, embeddings)
- Smart completion debouncing

### Message-Based Architecture
Components communicate via TypeScript protocols in `/core/protocol` with messenger pattern abstraction enabling IDE-agnostic core functionality.