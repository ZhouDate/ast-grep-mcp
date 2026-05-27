# ast-grep-mcp

Standalone MCP server wrapping [ast-grep](https://ast-grep.github.io/) for AI-optimized AST code search and replace.

Extracted from [oh-my-opencode](https://github.com/code-yeongyu/oh-my-openagent).

## Features

- **AI-optimized tool descriptions**: Explicitly warns LLMs that ast-grep is NOT regex
- **Pattern hints on empty results**: Detects regex misuse and language-specific mistakes
- **Workspace sandboxing**: Prevents path traversal and argument injection
- **Output truncation**: 500 match / 1MB caps with JSON repair on truncated output
- **Safe replace**: Dry-run by default, two-pass write (search then update)
- **Bun/Node compatibility**: Spawn shim handles both runtimes

## Installation

```bash
npm install -g @ast-grep/cli
bun install
bun run build
```

## Usage

### As MCP Server (stdio)

```bash
node dist/cli.js
```

### Configure in OpenCode

Add to your `opencode.json`:

```jsonc
{
  "mcpServers": {
    "ast-grep": {
      "command": "node",
      "args": ["path/to/ast-grep-mcp/dist/cli.js"]
    }
  }
}
```

### Environment Variables

- `AST_GREP_WORKSPACE`: Override workspace directory (default: cwd)
- `AST_GREP_DISABLED_TOOLS`: Comma-separated list of tools to disable

## Tools

### search

Search code by AST structure. Parameters:
- `pattern` (required): AST pattern using `$VAR` and `$$$` wildcards
- `lang` (required): Target language (csharp, javascript, typescript, tsx, python, go, rust, etc.)
- `paths` (optional): Paths to search
- `globs` (optional): Include/exclude globs
- `context` (optional): Context lines around matches

### replace

Rewrite code by AST pattern. Dry-run by default. Parameters:
- `pattern` (required): AST pattern to match
- `rewrite` (required): Replacement pattern
- `lang` (required): Target language
- `paths` (optional): Paths to search
- `globs` (optional): Include/exclude globs
- `dryRun` (optional): Preview without applying (default: true)

## License

MIT
