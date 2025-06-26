# Code Generation Requirements

## Objective
Generate high-quality, production-ready JavaScript code that follows best practices and is thoroughly tested.

## Functional Requirements

### Code Quality Standards
1. **Error Handling**: All functions must include proper error handling for edge cases
2. **Input Validation**: Validate all input parameters and handle invalid inputs gracefully
3. **Performance**: Optimize for time and space complexity where applicable
4. **Readability**: Use descriptive variable names and clear logic flow

### Implementation Guidelines
1. **Function Design**: 
   - Single responsibility principle
   - Pure functions where possible
   - Clear parameter and return types
   
2. **Class Design**:
   - Encapsulation of related functionality
   - Proper constructor initialization
   - Method chaining where appropriate
   
3. **Async Programming**:
   - Use async/await for asynchronous operations
   - Proper error handling with try/catch
   - Concurrent execution when beneficial

### Testing Requirements
1. **Edge Cases**: Handle empty inputs, null/undefined values, boundary conditions
2. **Error Scenarios**: Test error conditions and recovery
3. **Performance**: Ensure algorithms meet expected time complexity
4. **Compatibility**: Code should work in Node.js environment

## Technical Constraints
- **Runtime**: Node.js compatible
- **Style**: Modern ES6+ JavaScript features preferred
- **Dependencies**: Minimize external dependencies, use built-in functions
- **Memory**: Efficient memory usage, avoid memory leaks

## Deliverables
Each implementation should include:
1. Complete, working code
2. Proper error handling
3. Clear documentation via code comments
4. Optimization for the specified use case