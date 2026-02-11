# envize

A CLI tool for developers to easily switch environment variables using composable profiles.

Instead of juggling multiple `.env` files or manually exporting variables, envize lets you define named profiles and activate them with a single command. Profiles are composable -- stack multiple profiles together and envize handles merging and conflict resolution.

## Installation

```bash
npm install -g envize
```

Then run the one-time shell setup:

```bash
envize install
```

This injects a shell wrapper into your shell config (bash, zsh, or fish) so that `envize use` can set environment variables in your current session.

## Quick Start

```bash
# Create a profile
envize create my-api

# Edit it to add variables
envize edit my-api

# Activate it
envize use my-api

# Stack multiple profiles
envize use my-api staging

# See what's active
envize status
```

## Profile Format

Profiles use dotenv format with optional metadata headers:

```bash
# @description My API keys for development
# @tags dev, api

API_KEY=sk-abc123
API_URL=https://api.example.com
```

Profiles are stored in:
- **Local**: `.envize/profiles/` in your project directory
- **Global**: `~/.envize/profiles/` shared across projects

## Commands

| Command | Description |
|---------|-------------|
| `envize use <profiles...>` | Activate one or more profiles (replaces active set) |
| `envize add <profiles...>` | Add profiles to the currently active set |
| `envize unuse <profiles...>` | Remove profiles from the active set |
| `envize create <name>` | Create a new profile interactively |
| `envize edit <name>` | Open a profile in your `$EDITOR` |
| `envize ls` | List all available profiles |
| `envize status` | Show currently active profiles and variables |
| `envize which <variable>` | Show which profile sets a specific variable |
| `envize explain` | Show detailed breakdown of active environment |
| `envize init --template <name>` | Scaffold a profile from a built-in template |
| `envize templates` | List available templates |
| `envize import <file>` | Import variables from a `.env` file into a profile |
| `envize export` | Export active variables to a `.env` file |
| `envize install` | Set up the shell wrapper (one-time) |

## Templates

Quickly scaffold profiles for popular services:

```bash
envize init --template aws
envize init --template openai
envize init --template stripe
envize init --template supabase
envize init --template vercel
envize init --template claude
```

## Options

Most commands support these flags:

- `--global` -- Apply to global `~/.envize/` instead of local project
- `--json` -- Output in JSON format (useful for scripting)

## How It Works

envize uses a shell function wrapper (installed via `envize install`) that intercepts the `envize` command. When you run `envize use`, the wrapper evaluates shell export/unset commands in your current session, making environment variables immediately available without restarting your shell.

State is tracked in `.envize/state.json` so envize knows which profiles are active and can cleanly unset variables when switching profiles.

## Requirements

- Node.js >= 18
- bash, zsh, or fish shell

## License

MIT
