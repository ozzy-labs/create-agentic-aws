# Contributing

Thank you for your interest in contributing to `create-agentic-aws`!

## Development Setup

### Prerequisites

- [mise](https://mise.jdx.dev/) — manages Node.js, pnpm, and all dev tools

### Getting Started

```bash
git clone https://github.com/ozzy-labs/create-agentic-aws.git
cd create-agentic-aws
mise install       # Install all tools (Node.js 24, pnpm 10, linters, etc.)
pnpm install       # Install dependencies
```

### Verify Setup

```bash
pnpm run build     # Build with tsdown
pnpm test          # Run all tests (vitest)
pnpm run typecheck # TypeScript type checking
pnpm run lint      # Biome lint
```

## Coding Conventions

- **Language**: TypeScript (ESM, strict mode, NodeNext module resolution)
- **Imports**: Use `import type` for type-only imports (`verbatimModuleSyntax`)
- **Indent**: 2 spaces (TS/JS/JSON/YAML)
- **Line endings**: LF only
- **Max line width**: 100 (Biome)
- **YAML extension**: `.yaml` (not `.yml`, unless a tool requires it)

## Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint:

```text
<type>[optional scope]: <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

## Branch Strategy

GitHub Flow with **squash merge only**.

```text
main ← feature branch (e.g., feat/add-elasticache)
```

Branch naming: `<type>/<short-description>`

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes and ensure all checks pass
3. Push and open a PR against `main`
4. PR title follows the commit convention format
5. Reference related issues with `Closes #N`

### Before Submitting

```bash
pnpm run lint:all  # All linters + typecheck + gitleaks
pnpm test          # All tests pass
pnpm run build     # Build succeeds
```

## Adding a New Preset

See [docs/preset-guide.md](docs/preset-guide.md) for a step-by-step guide.

## Git Hooks (lefthook)

Hooks run automatically — do not skip with `--no-verify`:

- **commit-msg**: commitlint validates message format
- **pre-commit**: Biome, shellcheck, shfmt, taplo, markdownlint, yamlfmt, yamllint, actionlint, gitleaks
- **pre-push**: TypeScript typecheck

## Running Tests

```bash
pnpm test              # Run all tests
pnpm run test:watch    # Watch mode
pnpm run verify        # Smoke tests only (quick validation)
```

## Project Structure

```text
src/              # CLI source code
src/presets/      # Preset definitions
templates/        # Template file assets (copied to output)
tests/            # Test files
docs/             # Documentation
```
