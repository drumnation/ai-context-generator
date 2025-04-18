# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Interactive file tree view in webview for selecting context files.
- Display selected file count, approximate line count, and token count (cl100k_base) in webview.
- Formatted ASCII file tree available for copying.
- Root directory displayed in file trees.

### Changed
- Checkboxes in file tree view now trigger reactive updates to the file content display.

### Fixed
- Path mismatches between file tree generation and file content parsing.
- Improved reliability of webview state and event handling.