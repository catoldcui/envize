# envize

**Stop juggling `.env` files. Start composing environments.**

envize is a powerful CLI tool that lets you define reusable environment variable profiles and switch between them instantly. Stack multiple profiles together, and envize handles the merging seamlessly.

**✨ Perfect for AI Development**: Easily switch between different AI providers like **Qwen**, **OpenAI**, **Claude**, and other OpenAI-compatible endpoints with just one command!

```bash
# Switch to Qwen AI
envize use qwen

# Switch to OpenAI GPT-4
envize use openai

# Combine staging backend + local database + Claude AI
envize use staging local-db claude-opus

# See what's active
envize status
```

---

## Why envize?

### The Problem
You have `.env.dev`, `.env.staging`, `.env.prod`, and switching means copying files around. Want to use staging APIs but a local database? Manual editing. Want to switch AI models between Qwen, OpenAI, and Claude? More manual editing and potential errors.

### The Solution
Define small, focused profiles and compose them:

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  staging    │ + │  local-db   │ + │   qwen      │
│             │   │             │   │             │
│ API_URL=... │   │ DB_HOST=... │   │ QWEN_API_KEY│
└─────────────┘   └─────────────┘   └─────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Your Shell Env    │
              │                     │
              │ API_URL=staging...  │
              │ DB_HOST=localhost   │
              │ QWEN_API_KEY=sk-... │
              └─────────────────────┘
```

---

## 🚀 AI Provider Switching Made Easy

envize comes with built-in templates for popular AI providers, making it effortless to switch between different AI services:

### Supported AI Providers
- **Qwen** (Alibaba Cloud) - `envize init --template qwen`
- **OpenAI** - `envize init --template openai`  
- **Claude** (Anthropic) - `envize init --template claude`
- **Any OpenAI-compatible provider** - Create custom profiles

### Quick AI Switching Examples

```bash
# Set up Qwen AI
envize init --template qwen
envize edit qwen  # Add your Qwen API key
envize use qwen   # Activate Qwen

# Switch to OpenAI
envize init --template openai
envize edit openai  # Add your OpenAI API key
envize use openai   # Now using OpenAI instead!

# Compare models side-by-side
envize use qwen     # Test with Qwen
envize use openai   # Switch to OpenAI
envize use claude   # Try Claude
```

### Multi-AI Workflows
Combine AI profiles with other environment configurations:

```bash
# Production setup with Qwen AI
envize use production qwen

# Development with local DB and OpenAI
envize use development local-db openai

# Testing with Claude and staging APIs
envize use staging claude
```

---

## Installation

### 1. Install the CLI

```bash
npm install -g envize
```

### 2. Add the shell hook

Add one line to your shell config file:

**bash** (`~/.bashrc`):
```bash
eval "$(envize hook)"
```

**zsh** (`~/.zshrc`):
```bash
eval "$(envize hook)"
```

**fish** (`~/.config/fish/config.fish`):
```fish
envize hook fish | source
```

Then restart your shell or run `source ~/.zshrc` (or your shell's config file).

---

## Quick Start

### Create your first profile

```bash
# Create a profile interactively
envize create my-api

# Or import an existing .env file
envize import .env.development --name dev
```

### Edit the profile

```bash
envize edit my-api
```

This opens the profile in your `$EDITOR`. Profiles use standard `.env` format:

```bash
# @description Development API configuration
# @tags dev, api

API_KEY=sk-dev-xxxxx
API_URL=https://dev.api.example.com
DEBUG=true
```

### Activate it

```bash
envize use my-api
```

That's it! The variables are now in your shell.

---

## Core Concepts

### Profiles

A profile is a named collection of environment variables. Profiles are stored as `.env` files in:

| Location | Path | Use case |
|----------|------|----------|
| **Local** | `.envize/profiles/` | Project-specific, commit to git |
| **Global** | `~/.envize/profiles/` | Personal, shared across projects |

Local profiles override global profiles with the same name.

### Composability

The power of envize is combining profiles:

```bash
# Replace everything with just these profiles
envize use backend-staging frontend-local

# Add a profile to what's already active
envize add debug-mode

# Remove a profile without affecting others
envize unuse debug-mode

# Clear everything
envize reset
```

When profiles have conflicting variables, **last profile wins**:

```bash
envize use base claude-opus
# If both set MODEL, claude-opus wins because it's listed last
```

### Global Mode

By default, profiles only affect the current shell session. Use `-g` to persist across all terminal sessions:

```bash
# These stay active even in new terminals
envize use -g my-defaults
```

---

## Commands

### Switching Profiles

| Command | Description |
|---------|-------------|
| `envize use <profiles...>` | Activate profiles (replaces current set) |
| `envize add <profiles...>` | Add to currently active profiles |
| `envize unuse <profiles...>` | Remove from active profiles |
| `envize reset` | Clear all active profiles |
| `envize refresh` | Reload profiles from disk (if files changed) |

### Viewing State

| Command | Description |
|---------|-------------|
| `envize status` | Show active profiles and variables |
| `envize which <VAR>` | Show which profile sets a variable |
| `envize ls` | List all available profiles |
| `envize explain` | Plain text summary (great for LLM context) |

### Managing Profiles

| Command | Description |
|---------|-------------|
| `envize create <name>` | Create a new profile |
| `envize edit <name>` | Edit a profile in $EDITOR |
| `envize rm <name>` | Delete a profile |
| `envize import <file>` | Import a .env file as a profile |
| `envize export` | Export active env to .env format |

### Templates

| Command | Description |
|---------|-------------|
| `envize init --template <name>` | Create profile from template |
| `envize templates` | List available templates |

### Common Options

| Option | Short | Description |
|--------|-------|-------------|
| `--global` | `-g` | Use global ~/.envize/ instead of local |
| `--json` | | Output as JSON (for scripting) |

---

## Profile Format

Profiles use standard `.env` syntax with optional metadata:

```bash
# @description Claude AI with Opus model for complex tasks
# @tags ai, claude, opus

ANTHROPIC_API_KEY=sk-ant-xxxxx
CLAUDE_MODEL=claude-opus-4-5-20251101
```

**Metadata comments:**
- `# @description` - Human-readable description (shown in `envize ls -v`)
- `# @tags` - Comma-separated tags for organization

**Syntax rules:**
- `KEY=value` or `KEY="value"` (quotes optional)
- Comments start with `#`
- Blank lines are ignored

---

## Templates

Quickly scaffold profiles for popular services:

### AI & LLM Templates
```bash
envize init --template qwen      # Qwen AI (Alibaba Cloud)
envize init --template openai    # OpenAI GPT
envize init --template claude    # Anthropic Claude AI
```

### Other Service Templates
```bash
envize init --template aws       # AWS credentials
envize init --template stripe    # Stripe payments
envize init --template supabase  # Supabase backend
envize init --template vercel    # Vercel deployment
```

Templates include placeholder values that you fill in:

```bash
envize init --template qwen
envize edit qwen  # Fill in your Qwen API key
envize use qwen   # Ready to go!
```

---

## Examples

### Example 1: AI Model Comparison

```bash
# Create profiles for different AI providers
envize init --template qwen
envize init --template openai
envize init --template claude

# Edit each with your API keys
envize edit qwen
envize edit openai
envize edit claude

# Quick switch between AI providers
envize use qwen    # Test with Qwen
envize use openai  # Switch to OpenAI
envize use claude  # Try Claude
```

### Example 2: Development vs Production with Different AI

```bash
# Create environment profiles
envize create dev
envize create prod

# Edit each with appropriate URLs/keys
envize edit dev      # API_URL=http://localhost:3000
envize edit prod     # API_URL=https://api.example.com

# Combine with AI providers
envize use dev qwen      # Local dev with Qwen
envize use prod openai   # Production with OpenAI
```

### Example 3: Team Workflow with Shared Configurations

```bash
# Commit shared profiles to git
.envize/profiles/
  staging.env      # Shared staging config (no secrets)
  local-db.env     # Local database settings

# Each developer has personal API keys in global profiles
~/.envize/profiles/
  my-qwen-keys.env     # Personal Qwen API keys (never committed)
  my-openai-keys.env   # Personal OpenAI API keys (never committed)

# Combine them based on needs
envize use staging my-qwen-keys    # Staging with Qwen
envize use staging my-openai-keys  # Staging with OpenAI
```

### Example 4: Docker/CI Export

```bash
# Export current environment to .env for Docker
envize use production qwen
envize export > .env

# Or export specific profiles without activating
envize export --profiles production,qwen > .env
```

---

## Tips

### Check what's active before switching

```bash
envize status
```

### See where a variable comes from

```bash
envize which QWEN_API_KEY
# QWEN_API_KEY=sk-xxx**** (from: qwen)
```

### Refresh after editing profile files

If you edit a profile file directly (not via `envize edit`), refresh to pick up changes:

```bash
envize refresh
```

### Use explain for LLM context

Copy your environment context into an AI chat:

```bash
envize explain | pbcopy  # macOS
envize explain | xclip   # Linux
```

### Working with OpenAI-compatible providers

For any OpenAI-compatible provider (like Azure OpenAI, Ollama, etc.), create a custom profile:

```bash
envize create my-custom-ai
# Add your custom variables:
# OPENAI_API_KEY=your-key
# OPENAI_BASE_URL=https://your-custom-endpoint.com/v1
# OPENAI_MODEL=your-model
envize use my-custom-ai
```

---

## How It Works

envize uses a shell function wrapper (the `eval "$(envize hook)"` line) that intercepts envize commands. When you run `envize use`, the wrapper:

1. Runs `envize use --emit-shell` to get export/unset commands
2. Evals those commands in your current shell
3. Displays a confirmation message

This is the same pattern used by tools like `direnv`, `rbenv`, and `nvm`.

State is tracked in `~/.envize/state.json` so envize knows which profiles are active and can cleanly restore your previous environment on `reset`.

---

## Requirements

- **Node.js** >= 18
- **Shell:** bash, zsh, or fish

---

## Contributing

Want to add support for another AI provider or service? Simply:

1. Fork the repository
2. Add your template to `src/core/TemplateEngine.ts`
3. Create a corresponding `.env` file in the `templates/` directory
4. Submit a pull request!

We welcome contributions for new templates and features.

---

## License

MIT