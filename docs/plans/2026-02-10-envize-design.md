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

A **profile** is a named set of environment variables stored as a TOML file. The file name is the profile name.

Profiles live in two locations:
- **Global**: `~/.envize/profiles/` — personal, machine-wide
- **Local**: `.envize/profiles/` — project-specific, shareable via git

Local profiles override global profiles with the same file name.

### Profile Format

```toml
# @description: Use Claude {{CLAUDE_MODEL}} for complex coding tasks
# @tags: ai, claude

[env]
CLAUDE_MODEL = "claude-opus-4-6"
ANTHROPIC_API_KEY = "sk-ant-xxxxx"
```

- `@description` (required) — Describes the profile for humans and LLMs. Supports `{{VAR_NAME}}` interpolation from the profile's own values.
- `@tags` (optional) — Comma-separated tags for categorization and search.

### Composability

Multiple profiles can be applied together:

```
envize use claude-opus aws-staging local-db
```

Profiles merge in order. When multiple profiles set the same variable, **last-profile-wins** with a visible warning about the conflict.

### Regex Matching

Apply profiles by pattern:

```
envize use -r "aws-.*"
```

Activates all profiles matching the regex.

## CLI Commands

| Command | Description |
|---|---|
| `envize install` | One-time setup: injects `source ~/.envize/active.sh` into shell config |
| `envize use <profiles...>` | Apply one or more profiles to current shell |
| `envize use -r <pattern>` | Apply all profiles matching a regex pattern |
| `envize use <profiles...> --persist` | Apply and persist across sessions + reboots |
| `envize reset` | Restore shell to pre-envize state |
| `envize reset --persist` | Remove persisted system-level env vars |
| `envize status` | Show active profiles and all set variables with source |
| `envize which <VAR>` | Show which profile set a variable and its value |
| `envize diff <p1> <p2>` | Compare two profiles side by side |
| `envize create <name>` | Create a new profile interactively |
| `envize edit <name>` | Edit an existing profile |
| `envize rm <name>` | Delete a profile |
| `envize ls` | List all available profiles (global + local) |
| `envize ls --verbose` | List profiles with descriptions and tags |
| `envize init --template <name>` | Scaffold a profile from an industry template |
| `envize templates` | List available industry templates |
| `envize explain` | Describe current env state in plain text for LLM context |

All commands support `--json` for structured JSON output.

## Key Components

### 1. Profile Store

Reads/writes TOML profile files from global and local directories. Parses `@description` and `@tags` metadata from comment headers. Resolves `{{VAR_NAME}}` interpolation in descriptions. Local profiles override global profiles with the same filename.

### 2. Profile Resolver

Takes a list of profile names (or regex pattern with `-r`). Resolves from store, merging in order (last wins). Detects conflicts and emits warnings. Outputs a final flat key-value map of env vars to apply.

### 3. Shell Adapter

Snapshots current env state before applying (for `reset`). Generates shell-specific export/unset commands for bash, zsh, and fish.

Two modes:
- **Session**: outputs `eval`-able commands for current shell
- **Persist**: writes to shell hook file + system-level env (see below)

### 4. System Env Writer (for `--persist`)

Applies env vars at both shell and system level for full coverage:

**Shell level:**
- Writes `~/.envize/active.sh` (sourced by shell config, injected during `envize install`)

**System level (platform-specific):**
- **macOS**: `launchctl setenv` for immediate effect + `~/Library/LaunchAgents/com.envize.env.plist` for reboot persistence
- **Linux**: `/etc/environment` or `~/.pam_environment`
- **Windows**: registry via `setx`

First-time confirmation prompt before writing to system-level configs. Remembers user preference after that.

`envize reset --persist` undoes both shell and system-level changes.

### 5. Template Engine

Ships built-in TOML templates for popular services. `envize init --template <name>` copies template to local `.envize/profiles/`, prompting user to fill in placeholder values (marked as `"<your-key-here>"`).

**v1 templates:** Claude, OpenAI, AWS, Supabase, Stripe, Vercel.

### 6. Output Formatter

- Default: human-readable colored terminal output
- `--json`: structured JSON for LLM consumption
- `envize explain`: plain-text summary of current state for pasting into LLM context
- Sensitive values masked by default (`sk-ant-...****`), `--reveal` to show full values

## Setup Flow

```
# Install envize (e.g., via npm, brew, cargo)
$ envize install
  -> Adds `source ~/.envize/active.sh` to ~/.zshrc (or ~/.bashrc)
  -> Creates ~/.envize/profiles/ directory

# Create a profile from template
$ envize init --template claude
  -> Creates .envize/profiles/claude.toml
  -> Prompts for API key and preferred model

# Use it
$ envize use claude
  -> Exports CLAUDE_MODEL, ANTHROPIC_API_KEY to current shell

# Compose profiles
$ envize use claude aws-staging
  -> Merges both profiles, warns on conflicts

# Check what's active
$ envize status
  -> Shows active profiles and all variables with source

# Persist across sessions and reboots
$ envize use claude --persist
  -> Writes to shell config + system-level env
  -> First time: asks for confirmation

# Reset everything
$ envize reset
```
