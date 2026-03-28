# Git Workflow Rules

## Branch

- Create new branches from `main`
- Naming: `<type>/<short-description>` (e.g. `feat/add-auth`, `fix/login-error`)

## Commit

Conventional Commits format:

```text
<type>[optional scope]: <description>
```

## PR

- Merge method: **squash merge only**
- Delete feature branch after merge

## Prohibited

- Direct push to `main`
- `--force` push
- Staging `.env` files
- Skipping hooks with `--no-verify`
