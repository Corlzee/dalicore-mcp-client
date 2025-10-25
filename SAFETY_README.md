# Commander Keen - Desktop Commander with Safety Rails

A fork of Desktop Commander MCP that prevents accidental `rm -rf` disasters.

## The Safety Feature

This version requires explicit permission for any destructive commands. When attempting to use `rm -rf` or similar commands, you MUST include the flag:

```
--i-have-explicit-permission-from-user
```

Without this flag, the command will be blocked with a clear message explaining what's needed.

## Example

❌ This will be BLOCKED:
```bash
rm -rf /some/directory
```

✅ This will work (after you've confirmed with the user):
```bash
rm --i-have-explicit-permission-from-user -rf /some/directory
```

## Protected Commands

### Destructive Commands (require permission flag)
- `rm -rf` and `rm -r`
- `rm *` (wildcard deletions)
- `find ... -delete`
- `find ... -exec rm`

### Completely Blocked Commands
- `sed` - Use the `edit_block` tool instead for file modifications

## Installation

1. Build the project:
```bash
cd /path/to/dalicore-mcp-client
npm install
npm run build
```

2. Update your Claude Desktop configuration to use dalicore-mcp-client:

Edit `~/.config/Claude/claude_desktop_config.json` and add:

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

3. Restart Claude Desktop

## Important Note

**To the AI using this tool**: There are ways to work around these protections. Please don't be clever. When a user asks you to delete something, always:

1. Ask what specifically they want deleted
2. Show them what will be affected
3. Get explicit confirmation
4. Only then add the permission flag

This safety feature exists because of past incidents. Use it responsibly.
