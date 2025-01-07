# Code Standards

## TypeScript Requirements
- Strict mode enabled
- No 'any' - use 'unknown'
- Readonly/immutable types preferred 
- Type guards over assertions
- Exhaustive checks with 'never'
- Generics for reusable code

## Naming
- PascalCase: Components, Types, Interfaces
- camelCase: Variables, Functions
- UPPER_CASE: Constants
- kebab-case: Files

## Component Structure
```tsx
./components/{ComponentName}/
  ├── {ComponentName}.tsx         # JSX/TSX
  ├── {ComponentName}.types.ts    # Types/interfaces
  ├── {ComponentName}.styles.ts   # Styled components
  ├── {ComponentName}.hook.ts     # Custom hooks
  ├── {ComponentName}.logic.ts    # Business logic
  ├── components/                 # Subcomponents
  │   └── index.ts               # Barrel exports
  └── index.ts                   # Main export
```

## Error Handling
- Error boundaries for component tree
- Try/catch for async operations
- User-friendly error messages
- Logging for debugging
- Edge case handling

## Performance
- Memoize expensive operations
- Prevent unnecessary rerenders
- Lazy load where appropriate
- Stable keys for lists
- Profile before optimizing

## Documentation 
- JSDoc for public APIs
- Props documentation
- Usage examples
- Changelog updates 
- Storybook stories

# Additional Coding Guidelines

## Functional Programming
- DRY: Avoid code duplication
- KISS: Keep code simple and focused
- YAGNI: Implement only essential features

## SOLID for FP
- Single Responsibility: One task per function
- Open/Closed: Extend through composition
- Liskov Substitution: Handle valid inputs consistently
- Interface Segregation: Minimal input requirements
- Dependency Inversion: Use higher-order functions

## Modular Design
- Pure, testable functions
- Function composition
- Separate side effects
- Immutable data handling

## Clean Code
- Descriptive naming
- Logical organization
- Prefer functional methods
- Minimize dependencies
- Self-documenting code