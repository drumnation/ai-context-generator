module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    project: "./tsconfig.json"
  },
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: "import",
        format: ["camelCase", "PascalCase"]
      }
    ],
    curly: "warn",
    eqeqeq: "warn",
    "no-throw-literal": "warn"
  },
  env: {
    node: true,
    browser: true,
    es2021: true
  },
  ignorePatterns: ["out", "dist", "**/*.d.ts", "webpack.config.ts"]
};
