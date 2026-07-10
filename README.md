# Composer Markdown Editor

A desktop Markdown editor built with Electron and React. It supports both local and remote (SSH/SFTP) workspaces, live preview, Git integration, and an outline panel.

## Features

- **Local & Remote Workspaces**
  - Open local folders via the native file dialog or drag-and-drop.
  - Connect to remote servers over SSH/SFTP and browse remote directories.
  - Recently used local folders and SSH connections are remembered.

- **Markdown Editing**
  - WYSIWYG editor powered by [Milkdown](https://milkdown.dev/).
  - Source editor powered by [CodeMirror](https://codemirror.net/).
  - Live preview with support for Mermaid diagrams and KaTeX math.

- **Outline Panel**
  - Automatic heading extraction for quick navigation.

- **Git Integration**
  - View repository status, stage/unstage changes, and commit from the Git panel.
  - Supports repositories inside subdirectories of the opened workspace.

- **UI**
  - Resizable workspace (left) and outline (right) columns.
  - Double-click the resize divider to hide/show a column.
  - Light/dark theme toggle.
  - Native application menu with recent files/folders/SSH connections.

## Tech Stack

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) / [electron-vite](https://electron-vite.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand) for state management
- [simple-git](https://github.com/steveukx/git-js) for Git operations
- [ssh2](https://github.com/mscdex/ssh2) for SSH/SFTP

## Getting Started

### Prerequisites

- Node.js 20+
- npm or pnpm

### Install

```bash
cd composer-markdown-editor
npm install
```

### Development

```bash
# Default dev script
npm run dev

# Linux VMs / rootless containers without a working GPU
npm run dev:linux
```

### Build

```bash
npm run build
```

### Package

```bash
# Current platform
npm run dist

# Specific platform
npm run dist:linux
npm run dist:win
npm run dist:mac
```

### Lint & Format

```bash
npm run lint
npm run format
```

## Project Structure

```
src/
├── components/        # React components (editor, sidebar, git, modals)
├── main/              # Electron main process code
│   ├── git/           # Git operations
│   ├── ipc/           # IPC handler registration
│   ├── settings/      # Persistent settings store
│   ├── ssh/           # SSH/SFTP client
│   ├── index.ts       # Main entry
│   ├── menu.ts        # Native application menu
│   └── window.ts      # Main window creation
├── preload/           # Preload script exposing electronAPI
├── renderer/          # Renderer entry (App.tsx)
├── services/          # Renderer-side service clients
├── stores/            # Zustand stores
├── types/             # Shared TypeScript types
└── utils/             # Utilities
```

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). See [LICENSE](./LICENSE) for details.
