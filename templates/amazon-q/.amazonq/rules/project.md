# Project Rules

## Overview

This is an AWS project managed with Infrastructure as Code.

## Tech Stack

- **Package Manager**: pnpm
- **Version Manager**: mise

## Commands

```bash
pnpm install          # Install dependencies
pnpm run lint         # Run linters
pnpm test             # Run tests
pnpm run build        # Build
```

## Coding Conventions

- Use ESM (`"type": "module"`)
- Indent: 2 spaces
- Line ending: LF only
- Run linters before committing

## Commit Convention

Conventional Commits required (enforced by commitlint):

```text
<type>[optional scope]: <description>
```

## Branching

GitHub Flow: `main` + feature branches. **squash merge only**.
