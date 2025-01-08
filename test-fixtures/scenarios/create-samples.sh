#!/bin/bash

# Empty Project
cat > empty-project/README.md << EOL
# Empty Project

This is an empty project for testing the AI Context Generator extension.
No files or complex structure, just this README.
EOL

# Nested Project
cat > nested-project/README.md << EOL
# Nested Project

This project demonstrates a nested directory structure with various components.
EOL

# Create some sample files in nested project
echo "export const formatDate = (date: Date): string => date.toISOString();" > nested-project/src/utils/dateUtils.ts
echo "export interface Config { debug: boolean; }" > nested-project/src/config/types.ts
echo "export const Button = () => <button>Click me</button>;" > nested-project/src/components/Button.tsx
echo "describe('Button', () => { it('renders', () => {}) });" > nested-project/test/components/Button.test.tsx
echo "# API Documentation" > nested-project/docs/api.md

# Large Project
cat > large-project/README.md << EOL
# Large Project

A larger project structure with multiple components, services, and utilities.
EOL

# Components
echo "export const Button = () => <button>Click me</button>;" > large-project/src/components/Button.tsx
echo "export const Card = () => <div>Card Content</div>;" > large-project/src/components/Card.tsx
echo "export const Modal = () => <div>Modal Content</div>;" > large-project/src/components/Modal.tsx

# Services
echo "export const fetchData = async () => { /* ... */ };" > large-project/src/services/api.ts
echo "export const authenticate = () => { /* ... */ };" > large-project/src/services/auth.ts
echo "export const store = { get: () => {}, set: () => {} };" > large-project/src/services/storage.ts

# Utils
echo "export const formatDate = (date: Date) => date.toISOString();" > large-project/src/utils/format.ts
echo "export const validateEmail = (email: string) => /.+@.+/.test(email);" > large-project/src/utils/validate.ts
echo "export const debounce = (fn: Function) => { /* ... */ };" > large-project/src/utils/helpers.ts

# Types
echo "export interface User { id: string; name: string; };" > large-project/src/types/user.ts
echo "export interface Config { theme: 'light' | 'dark'; };" > large-project/src/types/config.ts 