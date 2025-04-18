# AI Context Generator for VS Code

<p align="center">
  <img src="images/icon.png" alt="AI Context Generator Icon" width="128" height="128">
</p>

<p align="center">
  Effortlessly gather and refine code context from any folder for your AI assistants!
</p>

---

**Tired of manually copying file after file for your AI prompts?** Modern codebases often favor smaller, focused files – great for organization and AI comprehension, but tedious to share! AI Context Generator bridges this gap, letting you package the full context of a folder into a single block, perfect for large-context AI models.

## ✨ Features

*   **One-Click Context:** Right-click any folder in the Explorer and select `Create AI Context (Folder)`.
*   **Interactive File Selection:** A webview opens showing a file tree of the selected folder.
    *   Easily **select or deselect** individual files or entire subfolders using checkboxes.
    *   Tailor the context precisely to what your AI needs.
*   **Live Preview:** The combined code content updates instantly as you make selections.
*   **Formatted Output:**
    *   Copy a clean, **formatted file tree**.
    *   Copy the **combined code content** of only the selected files, complete with markdown code fences and language identifiers.
    *   Copy **both** the tree and the code with a single click.
*   **Smart Ignoring:** Automatically ignores common folders like `.git`, `node_modules`, `dist`, etc. (Configurable in settings).

## 🤔 Why Use This?

*   **Feed Large Context Models:** AI assistants like Gemini, ChatGPT, and Claude thrive on comprehensive context but have interfaces that often require pasting files individually. This tool lets you grab the structure and content of an entire feature or folder at once.
*   **Embrace Modular Code:** Works beautifully with projects that follow best practices – separating concerns into multiple smaller files and folders. Easily collect context without losing the structure.
*   **One-Click Multi-File Copy:** Select a folder, optionally refine the file selection in the interactive view, and copy the complete file tree *and* the combined, formatted code of *all* selected files to your clipboard instantly.
*   **Perfect for Web UIs:** Stop the copy-paste-copy-paste cycle! Paste the complete, structured context directly into the web interfaces of your favorite large language models.
*   **Faster than Manual:** Dramatically speeds up the process of providing context compared to selecting and copying files one by one.

## 🚀 Getting Started

1.  **Install:** Find "AI Context Generator" in the VS Code Extensions Marketplace and click `Install`.
2.  **Use:**
    *   Right-click on any folder in the VS Code Explorer.
    *   Select `Create AI Context (Folder)` from the menu.
    *   The AI Context webview panel will open.
3.  **Refine & Copy:**
    *   Use the checkboxes in the `File Tree` section to select the files you want to include.
    *   Use the `Copy` buttons to grab the formatted file tree, the combined code of selected files, or both.

## ⚙️ Configuration

You can customize which folders are ignored by modifying the `aiContextGenerator.ignoreFolders` setting in your VS Code `settings.json`.

## Default Ignored Folders

By default, the extension ignores:

```json
[
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".vscode",
  ".idea",
  "__pycache__",
  "*.pyc",
  "*.pyo",
  "*.pyd",
  "*.so",
  "*.DS_Store"
]
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1.  **Issues:** Report bugs or suggest features on the [GitHub Issue Tracker](https://github.com/drumnation/ai-context-generator/issues).
2.  **Pull Requests:** Fork the repo, make your changes, and submit a PR.

---

*Icon courtesy of [Parzival' 1997 - Flaticon](https://www.flaticon.com/free-icons/generative).*"
