# Dalicore MCP Client

**Streamlined Model Context Protocol (MCP) server with 7 essential tools for file operations, code editing, and command execution.**

Built for efficiency based on real usage data - covers 97.5% of actual workflow with minimal overhead.

---

## Why This Fork?

**Original:** Desktop Commander MCP had 25+ tools  
**Problem:** Only 7 tools accounted for 97.5% of actual usage  
**Solution:** Stripped down to essentials, added helpful guidance

**Data-driven design:**
- Analyzed 12,302 actual tool calls
- Kept the 7 most-used tools (97.5% coverage)
- Cut 288 lines of bloat (46% reduction)
- Added system awareness and helpful error messages

---

## The 7 Essential Tools

### Process Management
**`start_process`** - Execute commands with smart state detection  
- 34.4% of all usage
- Primary tool for running builds, tests, scripts
- Detects REPL prompts and completion states

### File Operations
**`read_file`** - Read files with pagination, tail support, and URL fetching  
- 29.2% of all usage
- Handles images (PNG, JPEG, GIF, WebP)
- Supports offset/length for large files

**`write_file`** - Write files with automatic chunking  
- 2.2% of all usage
- Rewrite or append modes
- Smart 25-30 line chunks to avoid token waste

### Code Editing
**`edit_block`** - Surgical text replacements with fuzzy matching  
- 17.0% of all usage
- Character-level diff feedback
- Multiple occurrence support

### Searching
**`search_code`** - Fast content search with ripgrep  
- 11.2% of all usage
- Context lines, file patterns, regex support
- Structured output for easy parsing

**`search_files`** - Find files by name pattern  
- 1.2% of all usage
- Glob pattern support
- Recursive directory traversal

### File System
**`list_directory`** - List files and directories  
- 2.5% of all usage
- Clear [FILE] and [DIR] markers
- Path validation

---

## What We Cut (and Why)

**Removed ~18 tools that accounted for only 2.5% of usage:**

❌ `get_config` / `set_config_value` → Just edit config file with `edit_block`  
❌ `read_multiple_files` → Use multiple `read_file` calls  
❌ `create_directory` → Use `start_process("mkdir -p /path")`  
❌ `move_file` → Use `start_process("mv src dst")`  
❌ `interact_with_process` / `read_process_output` → Use one-shot commands or temp scripts  
❌ `list_processes` / `kill_process` → Use `start_process("ps aux")` / `start_process("kill PID")`  
❌ And more...

**Philosophy:** Use `start_process` with OS commands instead of wrapping every shell command as a separate tool.

---

## Smart Features

### System Awareness
System info is automatically sent to the LLM on every connection:
- Operating system and architecture
- Default shell (bash, zsh, cmd, powershell)
- Allowed directories
- Path separator and case sensitivity
- OS-appropriate command guidance

**No separate tool needed** - Claude knows your environment automatically.

### Helpful Blocked Command Messages

When you try to use a blocked command, you get helpful alternatives:

**Example:**
```
🚫 SED COMMAND BLOCKED

You tried: sed -n '100,200p' file.txt

**What to use instead:**
  ✅ read_file(path, { offset: 100, length: 101 })
  
For building files from pieces:
  ✅ start_process("head -100 file.txt > newfile.txt")
  
**You already have these tools - use them!**
```

Teaches best practices instead of just saying "no."

---

## Installation

### Prerequisites
- Node.js 18+ 
- npm

### Setup

1. **Clone the repository:**
```bash
git clone https://github.com/Corlzee/dalicore-mcp-client.git
cd dalicore-mcp-client
npm install
npm run build
```

2. **Add to Claude Desktop config:**

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "dalicore-mcp-client": {
      "command": "node",
      "args": ["/absolute/path/to/dalicore-mcp-client/dist/index.js"]
    }
  }
}
```

3. **Restart Claude Desktop**

---

## Configuration

Config file location: `~/.config/commander-keen/config.json`

### Key Settings

```json
{
  "blockedCommands": ["rm", "sudo", "chmod", "chown"],
  "defaultShell": "bash",
  "allowedDirectories": [
    "/home/user/projects",
    "/home/user/documents"
  ],
  "readOnlyDirectories": ["/home/user/reference"],
  "fileReadLineLimit": 1000,
  "fileWriteLineLimit": 50,
  "telemetryEnabled": true
}
```

### Configuration Options

- **`blockedCommands`**: Array of prohibited shell commands
- **`defaultShell`**: Shell for `start_process` (bash, zsh, cmd, powershell)
- **`allowedDirectories`**: Paths accessible for file operations (empty array = all access)
- **`readOnlyDirectories`**: Paths with read-only access
- **`fileReadLineLimit`**: Max lines per `read_file` call
- **`fileWriteLineLimit`**: Max lines per `write_file` call
- **`telemetryEnabled`**: Anonymous usage tracking

### Editing Config

Use `edit_block` on the config file:
```javascript
edit_block(
  "~/.config/commander-keen/config.json",
  '"allowedDirectories": [...]',
  '"allowedDirectories": [..., "/new/path"]'
)
```

---

## Usage Examples

### Running Commands
```javascript
start_process("npm run build", 30000)
start_process("python3 script.py", 10000, "bash")
```

### Reading Files
```javascript
// First 50 lines
read_file("/path/file.txt", { offset: 0, length: 50 })

// Last 20 lines (tail)
read_file("/path/file.txt", { offset: -20 })

// Lines 100-200
read_file("/path/file.txt", { offset: 100, length: 101 })

// From URL
read_file("https://example.com/data.json", { isUrl: true })
```

### Writing Files
```javascript
// Create new file
write_file("/path/file.txt", "content", { mode: "rewrite" })

// Append to file
write_file("/path/file.txt", "more content", { mode: "append" })
```

### Editing Code
```javascript
edit_block(
  "/path/file.js",
  "const x = 10;",
  "const x = 20;"
)

// Multiple replacements
edit_block(
  "/path/file.js",
  "console.log",
  "logger.info",
  { expected_replacements: 5 }
)
```

### Searching
```javascript
// Search code content
search_code("/path", "TODO", { 
  filePattern: "*.js",
  contextLines: 2 
})

// Find files by name
search_files("/path", "*.test.js")
```

---

## Best Practices

### File Writing
- **Always chunk files >30 lines** into multiple `write_file` calls
- Use `rewrite` for first chunk, `append` for rest
- Keeps token usage low and improves reliability

### Path Usage
- **Use absolute paths** (`/home/user/file.txt`)
- Relative paths depend on current directory (unreliable)
- Tilde paths (`~/file.txt`) may not work in all contexts

### Command Execution
- For one-shot tasks, use `start_process` directly
- For complex workflows, write temp scripts and execute
- For data analysis, write Python/Node scripts instead of trying to use REPLs

### Blocked Commands
- If a command is blocked, read the error message
- It will suggest the correct tool or approach
- Commands like `sed`, `awk`, `rm` are blocked for safety

---

## Architecture

### Server Components
- **server.ts** (332 lines) - MCP protocol handler, 7 tool definitions
- **schemas.ts** (88 lines) - Zod validation schemas  
- **handlers/** - Individual tool implementations
- **utils/systemInfo.ts** - OS detection and info generation
- **utils/blockedCommandHelp.ts** - Helpful error messages

### Design Principles
1. **Data-driven**: Keep only what's actually used
2. **Helpful errors**: Teach best practices when blocking
3. **System aware**: Automatically provide environment context
4. **Minimal overhead**: 7 tools, 332 lines, fast startup

---

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Testing
```bash
npm test
```

### Debugging
```bash
npm run start:debug
```

Then attach debugger on port 9229.

---

## Statistics

Based on 12,302 actual tool calls:
- **Top 5 tools:** 93% of usage
- **Top 7 tools:** 97.5% of usage
- **Other 18 tools:** 2.5% of usage

**Decision:** Keep the 7, cut the 18.

---

## Contributing

This is a focused, streamlined fork. If you want to add tools:
1. Check if `start_process` can do it
2. Provide usage data showing demand
3. Follow the "essential tools only" philosophy

---

## License

MIT

---

## Credits

- **Original:** [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) by @wonderwhy-er
- **Data Analysis & Streamlining:** Dalicore Team
- **Philosophy:** Less is more (when backed by data)

---

## Support

- **Issues:** https://github.com/Corlzee/dalicore-mcp-client/issues
- **Docs:** https://docs.claude.com (general MCP documentation)

---

**Built for Dalicore. Focused. Efficient. Data-driven.**
