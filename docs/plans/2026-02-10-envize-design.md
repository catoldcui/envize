# Envize - Design Document

A CLI tool for developers to easily switch environment variables using composable profiles.

## Pain Points

**Scattered .env files** — Developers maintain multiple `.env.dev`, `.env.staging`, `.env.prod` files and manually copy/rename them. One wrong swap and you're hitting prod.

**No partial switching** — You want to change just the AI model but keep everything else. Current approaches are all-or-nothing file swaps.

**No composability** — "Use Claude Opus + AWS staging + local DB" requires manually editing env vars. There's no way to mix and match reusable groups.

**No visibility into active state** — "Which model am I running against right now?" requires `echo $CLAUDE_MODEL` and hoping you check the right variable.

**Not LLM-friendly** — Existing env tools have unstructured output. LLMs can't easily read or generate configs for them.

**No industry templates** — Every developer manually looks up env var names for Claude, OpenAI, AWS, etc. Common patterns should be one command away.

**Repetitive boilerplate setup** — Every new project requires configuring the same common patterns from scratch. Well-known stacks should be one command away.

## Core Concepts

### Profiles

A **profile** is a named set of environment variables stored as an enhanced `.env` file. The file name (without extension) is the profile name.

Profiles live in two locations:
- **Global**: `~/.envize/profiles/` — personal, machine-wide
- **Local**: `.envize/profiles/` — project-specific, shareable via git

Local profiles override global profiles with the same file name.

### Profile Format

```env
# @description: Use Claude {{CLAUDE_MODEL}} for complex coding tasks
# @tags: ai, claude

CLAUDE_MODEL=claude-opus-4-6
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

Standard dotenv syntax with metadata comments:
- Lines follow `KEY=VALUE` format (quotes optional: `KEY="value"` and `KEY=value` both work)
- `# comments` and blank lines are preserved
- `@description` (required) — Describes the profile for humans and LLMs. Supports `{{VAR_NAME}}` interpolation from the profile's own values.
- `@tags` (optional) — Comma-separated tags for categorization and search.

Profile files use the `.env` extension: `claude.env`, `aws-staging.env`. This means existing `.env` files can be dropped into the profiles directory with minimal or no modification.

### Composability

Multiple profiles can be applied together:

```
envize use claude-opus aws-staging local-db
```

Profiles merge in order. When multiple profiles set the same variable, **last-profile-wins** with a visible warning about the conflict.

Three commands manage the active set:

- **`envize use`** — **replaces** the active set entirely. `envize use claude` deactivates everything else.
- **`envize add`** — **appends** profiles to the active set. `envize add local-db` keeps existing profiles active.
- **`envize remove`** — **removes** specific profiles from the active set, unsetting any variables that were uniquely provided by them. Variables also set by remaining profiles stay active.

## CLI Commands

| Command | Description |
|---|---|
| `envize install` | One-time setup: injects shell function wrapper into shell config |
| `envize use <profiles...>` | Apply one or more profiles to current shell (replaces active set) |
| `envize use <profiles...> --persist` | Apply and persist across shell sessions |
| `envize add <profiles...>` | Add profiles to the currently active set |
| `envize remove <profiles...>` | Remove profiles from the currently active set |
| `envize reset` | Restore shell to pre-envize state (removes all) |
| `envize reset --persist` | Remove persisted env vars from shell hook file |
| `envize status` | Show active profiles and all set variables with source |
| `envize which <VAR>` | Show which profile set a variable and its value |
| `envize create <name>` | Create a new profile interactively |
| `envize edit <name>` | Edit an existing profile |
| `envize rm <name>` | Delete a profile |
| `envize ls` | List all available profiles (global + local) |
| `envize ls --verbose` | List profiles with descriptions and tags |
| `envize init --template <name>` | Scaffold a profile from an industry template |
| `envize templates` | List available industry templates |
| `envize explain` | Describe current env state in plain text for LLM context |
| `envize import <file>` | Import a `.env` file as a new profile |
| `envize export --dotenv` | Export active env state as a `.env` file |

All commands support `--json` for structured JSON output.

## Key Components

### 1. Profile Store

Reads/writes `.env` profile files from global and local directories. Parses `@description` and `@tags` metadata from comment headers. Resolves `{{VAR_NAME}}` interpolation in descriptions. Local profiles override global profiles with the same filename.

### 2. Profile Resolver

Takes a list of profile names. Resolves from store, merging in order (last wins). Detects conflicts and emits warnings. Outputs a final flat key-value map of env vars to apply.

### 3. Shell Adapter

A child process cannot modify the parent shell's environment. Envize solves this with a **shell function wrapper** — the same battle-tested pattern used by direnv, rbenv, pyenv, and nvm.

#### Shell Function Wrapper

`envize install` injects a shell function into the user's rc file. This function intercepts mutating commands (`use`, `add`, `remove`, `reset`) and `eval`s the binary's stdout. Non-mutating commands (`ls`, `status`, `explain`) pass through directly.

**bash/zsh:**
```bash
envize() {
  case "$1" in
    use|add|remove|reset)
      local output
      output="$(command envize "$@" --emit-shell 2>/dev/null)"
      if [ $? -eq 0 ]; then
        eval "$output"
        command envize "$@" --emit-human 1>&2
      else
        command envize "$@" 1>&2
      fi
      ;;
    *)
      command envize "$@"
      ;;
  esac
}
```

**fish:**
```fish
function envize
  switch $argv[1]
    case use add remove reset
      set -l output (command envize $argv --emit-shell 2>/dev/null)
      if test $status -eq 0
        eval $output
        command envize $argv --emit-human 1>&2
      else
        command envize $argv 1>&2
      end
    case '*'
      command envize $argv
  end
end
```

#### Binary Output Modes

The `envize` binary itself never modifies the parent shell. For mutating commands (`use`, `reset`), it supports these output modes:

| Flag | Stdout | Stderr | Used by |
|---|---|---|---|
| `--emit-shell` | Shell-specific export/unset commands | Nothing | Shell function wrapper (eval'd) |
| `--emit-human` | Nothing | Human-readable confirmation message | Shell function wrapper (displayed) |
| `--json` | Structured JSON of applied changes | Nothing | LLM integrations, scripts |
| *(none)* | Human-readable output | Warnings/errors | Direct invocation (no eval) |

When invoked without `--emit-shell` (e.g., user calls the binary directly without the wrapper), mutating commands print a human-readable summary but **do not** output eval-able shell commands — preventing confusion when the function wrapper is missing.

#### Shell Command Generation

Generates shell-specific export/unset commands for bash, zsh, and fish. All values are **single-quoted and sanitized** to prevent shell injection (backticks, `$(...)`, etc. in env var values must not execute).

Two modes:
- **Session**: outputs export/unset commands via `--emit-shell` for the wrapper to eval
- **Persist**: writes to shell hook file + system-level env (see below)

### 4. State Manager

Tracks what is currently active so `status`, `reset`, and `which` have a source of truth. State is stored in `~/.envize/state.json`:

```json
{
  "active_profiles": ["claude-opus", "aws-staging"],
  "variables": {
    "CLAUDE_MODEL": { "value": "claude-opus-4-6", "source": "claude-opus" },
    "AWS_PROFILE": { "value": "staging", "source": "aws-staging" }
  },
  "snapshot": {
    "CLAUDE_MODEL": null,
    "AWS_PROFILE": "production"
  },
  "applied_at": "2026-02-10T01:30:00Z"
}
```

- `active_profiles` — ordered list of currently applied profiles.
- `variables` — every env var set by envize, with which profile set it.
- `snapshot` — pre-envize values for each variable (`null` = was not set). Used by `reset` to restore previous state.
- `applied_at` — timestamp for diagnostics.

Updated on every `envize use` and `envize reset`. Read by `status`, `which`, and `explain`.

### 5. System Env Writer (for `--persist`)

Writes env vars to the shell hook file for cross-session persistence:

- Writes `~/.envize/active.sh` containing export statements for the persisted variables
- The shell function wrapper sources this file on shell startup (injected during `envize install`)

`envize reset --persist` clears `~/.envize/active.sh` and removes persisted variables.

> **v2 scope (deferred from v1):** System-level persistence via `launchctl setenv` (macOS), `/etc/environment` (Linux), and registry `setx` (Windows). These are higher-risk operations that require platform-specific testing and privilege escalation handling.

### 6. Template Engine

Ships built-in `.env` templates for popular services. `envize init --template <name>` copies template to local `.envize/profiles/`, prompting user to fill in placeholder values (marked as `<your-key-here>`).

**v1 templates:** Claude, OpenAI, AWS, Supabase, Stripe, Vercel.

### 7. Dotenv Bridge

Since profiles already use dotenv syntax, interop with existing `.env` files is near-frictionless.

**Import** (`envize import`):
```
$ envize import .env.staging --name staging
  -> Copies file to .envize/profiles/staging.env
  -> Adds @description and @tags metadata comments if missing
```

Existing `.env` files can also be dropped directly into `.envize/profiles/` and used immediately — import just handles the copy + metadata prompting.

**Export** (`envize export`):
```
$ envize export --dotenv > .env
  -> Merges active profiles into a single .env file
  -> Respects masking by default (use --reveal for real values)

$ envize export --dotenv --profiles claude aws-staging > .env
  -> Exports specific profiles without activating them
```

This enables teams that need `.env` files for Docker, docker-compose, or IDE compatibility to generate them from envize profiles.

### 8. Output Formatter

- Default: human-readable colored terminal output
- `--json`: structured JSON for LLM consumption
- `envize explain`: plain-text summary of current state for pasting into LLM context
- Sensitive values masked by default (`sk-ant-...****`), `--reveal` to show full values

## Setup Flow

```
# Install envize (e.g., via npm, brew, cargo)
$ envize install
  -> Detects shell (bash/zsh/fish)
  -> Injects shell function wrapper into ~/.zshrc (or ~/.bashrc, config.fish)
  -> Creates ~/.envize/profiles/ directory
  -> Creates ~/.envize/active.sh (for persist mode)

# Create a profile from template
$ envize init --template claude
  -> Creates .envize/profiles/claude.env
  -> Prompts for API key and preferred model

# Use it — the shell function wrapper handles eval transparently
$ envize use claude
  -> Shell function intercepts, runs `envize use claude --emit-shell`
  -> Evals the export commands in the current shell
  -> Displays confirmation: "Activated: claude (2 variables set)"

# Compose profiles
$ envize use claude aws-staging
  -> Merges both profiles, warns on conflicts
  -> Exports all variables to current shell

# Check what's active
$ envize status
  -> Shows active profiles and all variables with source

# Persist across shell sessions
$ envize use claude --persist
  -> Writes exports to ~/.envize/active.sh
  -> Sourced automatically on new shell sessions

# Reset everything
$ envize reset
  -> Shell function intercepts, evals unset commands
  -> Restores pre-envize state

# Import existing .env file
$ envize import .env.staging --name staging
  -> Copies .env, adds metadata, creates .envize/profiles/staging.env

# Export back to .env for Docker/IDE compatibility
$ envize export --dotenv > .env
```

## v1 Scope

### Included in v1

- **Platforms:** macOS, Linux
- **Shells:** bash, zsh, fish
- **Core commands:** `install`, `use`, `add`, `remove`, `reset`, `status`, `which`, `ls`, `create`, `edit`, `rm`
- **Composability:** multi-profile merging with last-wins conflict resolution
- **Persist mode:** shell-level only (`~/.envize/active.sh`)
- **State tracking:** `~/.envize/state.json` for active profile state
- **Dotenv bridge:** `import` and `export --dotenv`
- **Templates:** Claude, OpenAI, AWS, Supabase, Stripe, Vercel
- **Output:** human-readable, `--json`, `explain`, value masking

### Deferred to v2

- **Windows support** — cmd.exe, PowerShell, and WSL are effectively three separate platforms
- **System-level persistence** — `launchctl setenv` (macOS), `/etc/environment` (Linux), registry (Windows)
- **Regex matching** (`-r`) — glob matching may be sufficient; regex risks activating unintended profiles
- **`envize diff`** — useful but not essential for core workflow
- **Keychain/secrets manager integration** — referencing system keychain, 1Password, etc. from profiles
- **Directory-based auto-switching** — direnv-style `.envrc` equivalent
