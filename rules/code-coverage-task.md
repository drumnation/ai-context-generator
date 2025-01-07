## Code Coverage Task List

### Current Coverage Summary
- Total TypeScript Files: 24
- Files With Tests: 4 (fileService.ts, logger.ts, extension.ts, and performanceService.ts)
- Files Without Tests: 20
- Actual Coverage: ~16.7% of codebase

### Areas Needing Attention

#### Critical Priority (No Tests)
- [x] Backend Services
  - [x] Add tests for fileService.ts
    - [x] generateFileTree tests
    - [x] combineFiles tests
    - [x] isLargeDirectory tests
    - [x] Error handling tests
  - [x] Add tests for performanceService.ts
    - [x] Operation tracking tests
    - [x] Memory usage monitoring tests
    - [x] Directory scanning profiling tests
    - [x] Error handling and cleanup tests
  - [ ] Add tests for markdownGenerator.ts
    - [ ] Test markdown generation
    - [ ] Test code block formatting
    - [ ] Test error handling
  - [ ] Add tests for markdownService.ts
    - [ ] Test service initialization
    - [ ] Test markdown processing
    - [ ] Test file handling

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
- [x] Implement performance tests for chunked processing
  - [x] Test various chunk sizes
  - [x] Measure processing time and memory usage
  - [x] Establish performance baselines

### Documentation
- [x] Create test patterns for file system operations
  - [x] Document fs mocking patterns
  - [x] Document error handling patterns
  - [x] Document async/sync testing patterns
- [x] Create test patterns for performance monitoring
  - [x] Document memory usage tracking
  - [x] Document operation timing patterns
  - [x] Document error handling in performance tests
- [ ] Create testing documentation for remaining services
  - [ ] Document markdown testing patterns
  - [ ] Document DI testing patterns
  - [ ] Document webview testing patterns

### Success Criteria
- [ ] Phase 1: Achieve basic test coverage (50%)
  - [x] Add tests for FileService
  - [x] Add tests for PerformanceService
  - [ ] Add tests for MarkdownService
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
- ✅ PerformanceService tests demonstrate proper patterns for:
  - Memory usage tracking and monitoring
  - Operation timing and profiling
  - Error handling and cleanup
  - Nested operation tracking
- Next focus should be on MarkdownService or container tests
- Follow established patterns from FileService and PerformanceService tests
- Use proper mocking for VS Code API
- Consider setting up CI/CD for automated test runs
