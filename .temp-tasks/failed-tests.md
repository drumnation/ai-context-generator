# Failed Tests Task List

## Instructions
- Work on tests one at a time
- Run individual tests after each fix to verify
- Mark tests as complete once they pass
- Keep track of any dependencies between tests

### How to Run Individual Tests
```bash
# Run a single test (replace <test-name> with the exact test name in quotes)
pnpm jest -t "<test-name>"

# Run all tests in a specific file
pnpm jest <path-to-test-file>

# Run with test name pattern (useful for partial matches)
pnpm jest -t "detectChanges.*new files"

# Run tests quietly (reduce output verbosity)
pnpm jest -t "<test-name>" --silent --verbose false
# or combine with file path
pnpm jest <path-to-test-file> -t "<test-name>" --silent --verbose false
```

Example commands for each test suite:
```bash
# IncrementalUpdateService unit tests (quiet mode)
pnpm jest src/backend/services/__tests__/incrementalUpdateService.test.ts -t "should detect new files with progress tracking" --silent --verbose false

# Incremental Update E2E tests (quiet mode)
pnpm jest src/test/e2e/incrementalUpdate.e2e.test.ts -t "should generate tree incrementally" --silent --verbose false

# StreamingFileService E2E tests (quiet mode)
pnpm jest src/test/e2e/streamingFileService.e2e.test.ts -t "should cache and reuse file tree results" --silent --verbose false

# IncrementalUpdateService E2E tests (quiet mode)
pnpm jest src/test/e2e/incrementalUpdateService.e2e.test.ts -t "should detect new files in real filesystem" --silent --verbose false
```

## IncrementalUpdateService Test Suite (src/backend/services/__tests__/incrementalUpdateService.test.ts)
- [x] 1. `detectChanges › should detect new files with progress tracking`
- [x] 2. `detectChanges › should process files in parallel chunks`
- [x] 3. `detectChanges › should handle errors gracefully with proper error messages`
- [x] 4. `detectChanges › should detect deleted files`
- [x] 5. `detectChanges › should detect modified files`
- [x] 6. `detectChanges › should respect state validity duration`
- [x] 7. `detectChanges › should handle partial updates efficiently`
- [x] 8. `detectChanges › should optimize scanning based on file patterns`
- [x] 9. `file state management › should clear file states`
- [x] 10. `file state management › should handle state validity duration`
- [x] 11. `getAllFiles › should return all files in directory`
- [x] 12. `getAllFiles › should handle empty directories`

## Incremental Update E2E Tests (src/test/e2e/incrementalUpdate.e2e.test.ts)
- [x] 13. `File Tree Generation › should generate tree incrementally`

## StreamingFileService E2E Tests (src/test/e2e/streamingFileService.e2e.test.ts)
- [x] 14. `Caching Behavior › should cache and reuse file tree results`

## IncrementalUpdateService E2E Tests (src/test/e2e/incrementalUpdateService.e2e.test.ts)
- [x] 15. `should detect new files in real filesystem`
- [x] 16. `should detect modified files in real filesystem`
- [x] 17. `should handle multiple concurrent changes in real filesystem`
- [x] should maintain state across multiple scans in real filesystem
- [x] should detect new files in real filesystem
- [x] should detect modified files in real filesystem
- [x] should detect deleted files in real filesystem
- [x] should handle multiple concurrent changes in real filesystem
- [x] should respect file pattern filtering
- [x] should handle custom file patterns
- [x] should maintain cache state across scans
- [x] should handle symlinks without infinite loops

## Progress
Total Failed Tests: 19
Tests Passed: 21
Tests Remaining: 0

## Notes
- Fixed pattern matching in `matchesMatch` method to handle `**/*` pattern
- Added proper file state tracking for new and modified files
- Improved error handling and logging
- Fixed state validity duration check to include threshold value (>= instead of >)
- Optimized partial updates to process files in chunks efficiently
- Fixed file pattern optimization with proper glob pattern handling and directory traversal
- File state clearing functionality working correctly
- State validity duration handling working correctly
- getAllFiles functionality working correctly
- Empty directory handling working correctly
- Incremental tree generation working correctly
- Caching behavior working correctly
- Real filesystem file detection working correctly
- Modified file detection in real filesystem working correctly
- Concurrent changes handling working correctly
- Fixed file pattern filtering by simplifying pattern matching:
  - Replaced complex regex patterns with direct path checks
  - Hardcoded common excluded directories (node_modules, dist, build, .git)
  - Added separate handling for custom include patterns
  - Applied exclusion checks at both directory and file levels
- Fixed custom file pattern handling with simplified path-based checks
- Fixed cache state maintenance:
  - Added explicit state initialization for new files
  - Added check for missing state on existing files
  - Separated new file handling from changed file handling
  - Added early return after handling new files
- Fixed symlink handling:
  - Added tracking of visited paths to prevent infinite loops
  - Added proper symlink resolution using realpath
  - Added specific handling for directory and file symlinks
  - Added error handling for broken symlinks
  - Added logging for symlink handling and path skipping

🎉 All tests are now passing!
