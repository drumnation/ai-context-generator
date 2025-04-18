---
description: Use this rule whenever a third-party UI component (e.g., from Mantine) is detected being used directly in a page, feature, or layout file. This includes layout primitives (e.g., Box, Flex, Grid) or visual inputs (e.g., TextInput, Select, Button) that are not wrapped in project-specific atomic components.  Also trigger during UI refactor, design system setup, or when adding new components that should follow atomic design and long-term maintainability principles.
globs: 
alwaysApply: false
---
# Rule: Atomic Component Refactor Strategy

## Purpose
Ensure all third-party UI components (e.g., Mantine, MUI) are consistently wrapped in custom components that follow Atomic Design principles. This enables safe, scalable, and maintainable UI development while minimizing ripple effects during refactors.

## Behavior

When working on UI code:
- ✅ **Wrap raw third-party components** in local components (e.g., `@/atoms/Button`, `@/molecules/CardItem`)
- ✅ **Refactor existing inline usage** of third-party components into wrapped equivalents
- ✅ **Extract logic, styling, and props** into our own abstraction layer
- ✅ **Group components by atomic category** (`atoms`, `molecules`, `organisms`, etc.)
- ✅ **Add Storybook stories** for each wrapped component
- ✅ **Write functional snapshot tests** where applicable (via Storybook or test framework)

## Why This Matters
- 📦 **Update Flexibility**: If library syntax changes, only wrapper updates are needed
- 🔁 **Swap Flexibility**: Swapping out Mantine or other libraries becomes easier
- 🔍 **Code Search**: Easier to locate and understand usage across the app
- ✨ **Central Styling**: Theming and layout behavior lives in one place

## Trigger Conditions
This rule is agent-requested or invoked manually when:
- 🔍 A third-party component is found used directly in a page or feature
- 🧼 A cleanup/refactor is underway
- 🧱 A new component is added but not organized into the atomic system

## Best Practices
- Place all wrapped components in `src/ui/atoms`, `molecules`, `organisms`
- Avoid leaking third-party props outside the wrapper unless explicitly needed
- When in doubt, wrap it — even layout utilities like `Box`, `Flex`, `Grid`

## Related Prompts
- `consult-mantine-ui-cheatsheet.prompt.md`
- `refactor-to-atomic-component.prompt.md`

## Notes
This rule ensures component hygiene and makes AI-led refactoring safe and efficient.
