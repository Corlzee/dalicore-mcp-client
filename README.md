# Commander Keen MCP

Enhanced MCP server for Claude Desktop with memory tracking and safety features.

> Fork of [Desktop Commander MCP](https://github.com/wonderwhy-er/DesktopCommanderMCP) by @wonderwhy-er

## Features

### Core Capabilities (from Desktop Commander)
- **Terminal Operations**: Execute commands, manage processes, interactive sessions
- **File Management**: Read, write, edit, search files with smart chunking
- **Code Editing**: Surgical text replacements with fuzzy matching
- **Process Control**: Start, interact with, and manage long-running processes
- **Configuration**: Dynamic server configuration without restarts

### Commander Keen Enhancements
- **Memory System**: Track operations, decisions, and learn from past actions
- **Hindsight Analysis**: `what_should_i_have_done` command for learning from mistakes
- **Safety Guards**: Destructive operations require explicit permission flags
- **Enhanced Journaling**: AI journaling protocol for better context preservation
- **Session Memory**: Better handoff between AI sessions

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Corlzee/Commander-Keen.git
cd Commander-Keen
npm install
npm run build
```

2. Add to Claude Desktop config:

**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "commander-keen": {
      "command": "node",
      "args": ["/absolute/path/to/Commander-Keen/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

## Key Commands

### File Operations
- `read_file` - Read files or URLs with pagination
- `write_file` - Write with smart chunking (rewrite/append modes)
- `edit_block` - Surgical text replacements
- `search_files` - Find files by name
- `search_code` - Search content with ripgrep

### Process Management
- `start_process` - Start programs with input detection
- `interact_with_process` - Send commands to running programs
- `list_sessions` - Show active terminal sessions
- `kill_process` - Terminate by PID

### Memory & Analysis
- `show_my_history` - View recent operations
- `what_should_i_have_done` - Hindsight analysis
- `show_decisions` - Review past decisions
- `show_blockers` - Current blockers
- `what_did_i_do` - File-specific history

### Configuration
- `get_config` - View current configuration
- `set_config_value` - Update settings (allowedDirectories, blockedCommands, etc.)

## Safety Features

- Destructive commands (like `rm`) require `--i-have-explicit-permission-from-user` flag
- Configurable blocked commands list
- Directory access restrictions for file operations
- Comprehensive audit logging

## Configuration Options

- `blockedCommands`: Array of prohibited shell commands
- `defaultShell`: Shell for command execution
- `allowedDirectories`: Paths accessible for file operations
- `fileReadLineLimit`: Max lines per read (default: 1000)
- `fileWriteLineLimit`: Max lines per write (default: 50)
- `telemetryEnabled`: Anonymous usage data collection

## Quick Tips

- Keep write operations under 50 lines to avoid token waste
- Use absolute paths for reliability
- Check `get_config` to see current restrictions
- Memory commands help track what you've done across sessions

## License

MIT