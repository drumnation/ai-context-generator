## Code Coverage Task List

### Current Coverage Summary
- Total TypeScript Files: 24
- Files With Tests: 3 (fileService.ts, logger.ts, and extension.ts)
- Files Without Tests: 21
- Actual Coverage: ~12.5% of codebase

### Areas Needing Attention

#### Critical Priority (No Tests)
- [x] Backend Services
  - [x] Add tests for fileService.ts
    - [x] generateFileTree tests
    - [x] combineFiles tests
    - [x] isLargeDirectory tests
    - [x] Error handling tests
  - [ ] Add tests for markdownGenerator.ts
    - [ ] Test markdown generation
    - [ ] Test code block formatting
    - [ ] Test error handling
  - [ ] Add tests for markdownService.ts
    - [ ] Test service initialization
    - [ ] Test markdown processing
    - [ ] Test file handling
  - [ ] Add tests for performanceService.ts
    - [ ] Test performance metrics
    - [ ] Test timing functions
    - [ ] Test data collection

- [ ] Dependency Injection
  - [ ] Add tests for container-base.ts
    - [ ] Test container initialization
    - [ ] Test dependency registration
    - [ ] Test dependency resolution
  - [ ] Add tests for container.ts
    - [ ] Test specific container implementations
    - [ ] Test scoping rules
    - [ ] Test lifecycle management
  - [ ] Add tests for DI types and interfaces
    - [ ] Test type constraints
    - [ ] Test interface implementations

- [ ] Webview Components
  - [ ] Add tests for hooks
    - [ ] Test useAppState hook
    - [ ] Test useFileTree hook
    - [ ] Test useVscodeMessaging hook
  - [ ] Add tests for message handlers
    - [ ] Test message parsing
    - [ ] Test response handling
    - [ ] Test error scenarios
  - [ ] Add tests for VSCode API integration
    - [ ] Test API calls
    - [ ] Test event handling
    - [ ] Test state management

#### High Priority
- [ ] Core Extension
  - [ ] Comprehensive tests for extension.ts activation events
  - [ ] Command registration and execution tests
  - [ ] Extension context management tests

- [ ] Shared Utilities
  - [ ] Complete logger.ts coverage (currently partial)
  - [ ] Add tests for errorHandling.ts
  - [ ] Add tests for config.ts
  - [ ] Add tests for messageTypes.ts

#### Integration Testing
- [ ] Add VS Code command integration tests
  - [ ] Test command registration
  - [ ] Test command execution with various inputs
  - [ ] Test error handling scenarios
  - [ ] Test command state management

#### UI Testing
- [ ] Implement tests for webview
  - [ ] Set up React Testing Library infrastructure
  - [ ] Add component tests
  - [ ] Add hook tests
  - [ ] Test message passing between webview and extension

### Performance Testing
- [ ] Implement performance tests for chunked processing
  - [ ] Test various chunk sizes
  - [ ] Measure processing time and memory usage
  - [ ] Establish performance baselines

### Documentation
- [x] Create test patterns for file system operations
  - [x] Document fs mocking patterns
  - [x] Document error handling patterns
  - [x] Document async/sync testing patterns
- [ ] Create testing documentation for remaining services
  - [ ] Document markdown testing patterns
  - [ ] Document DI testing patterns
  - [ ] Document webview testing patterns

### Success Criteria
- [ ] Phase 1: Achieve basic test coverage (50%)
  - [x] Add tests for FileService
  - [ ] Add tests for MarkdownService
  - [ ] Add tests for PerformanceService
  - [ ] Test core utilities
- [ ] Phase 2: Improve coverage quality (75%)
  - [ ] Add integration tests
  - [ ] Add UI component tests
  - [ ] Cover edge cases
- [ ] Phase 3: Comprehensive coverage (90%+)
  - [ ] Add performance tests
  - [ ] Add end-to-end tests
  - [ ] Cover all error scenarios

### Notes
- ✅ FileService tests demonstrate proper patterns for:
  - Mocking both sync and async fs operations
  - Handling nested async operations
  - Error handling at multiple levels
  - Testing complex file tree structures
- Next focus should be on MarkdownService or PerformanceService
- Follow established patterns from FileService tests
- Use proper mocking for VS Code API
- Consider setting up CI/CD for automated test runs
