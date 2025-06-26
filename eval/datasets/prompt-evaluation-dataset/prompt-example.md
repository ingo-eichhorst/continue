# Code Generation Instructions

## General Guidelines

When generating JavaScript code, follow these specific instructions:

### Input Validation
- Always check if parameters exist before using them
- For array inputs, verify it's actually an array using `Array.isArray()`
- For object inputs, check for null/undefined before accessing properties
- Return appropriate default values for invalid inputs (empty arrays, null, etc.)

### Function Implementation
- Start each function with input validation
- Use clear variable names that describe their purpose
- Implement logical steps in order: validate → process → return
- Add inline comments for non-obvious logic

### Class Implementation
- Initialize all properties in the constructor
- Create validation methods for complex checks (email, age, etc.)
- Use private methods (prefixed with _) for internal operations
- Implement CRUD operations with proper error handling

### Error Messages
- Provide specific error messages that indicate what went wrong
- Include the invalid value in error messages when helpful
- Use Error objects with descriptive messages rather than generic errors

### Testing Considerations
- Write code that can be easily tested
- Avoid side effects in pure functions
- Return predictable data types
- Handle all edge cases mentioned in requirements

## Example Patterns

### Email Validation
```javascript
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
```

### Age Validation
```javascript
function isValidAge(age) {
    return typeof age === 'number' && age > 0 && age < 150;
}
```

### Array Processing
```javascript
function processArray(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => /* condition */).map(item => /* transform */);
}
```