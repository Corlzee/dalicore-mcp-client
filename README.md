
# Claude Computer Commander

A secure terminal server that allows Claude to execute commands on your computer with a configurable blacklist of commands for security.

## Features

- Execute terminal commands through Claude
- Configurable command blacklist for security
- Process management (list and kill processes)
- Persistent configuration of allowed commands from chat

## Setup

1. Clone the repository:
```bash
git clone https://github.com/wonderwhy-er/ClaudeComputerCommander.git
cd ClaudeComputerCommander
```

2. Build and setup the server:
```bash
npm run setup
```

This command will:
- install dependencies
- build the server
- create a config file for Claude's desktop app if it doesn't exist
- add MCP server to Claude's config file

## Usage

The server provides the following tools:

- `execute_command`: Execute terminal commands (except blacklisted ones)
- `list_processes`: View all running processes
- `kill_process`: Terminate a process by PID
- `block_command`: Add a command to the blacklist
- `unblock_command`: Remove a command from the blacklist
- `list_blocked_commands`: View all currently blocked commands

## Logs

All server operations are logged to `server.log` with timestamps for auditing and debugging.

# Known issues
- there is some weird issue with errors when starting ~/Library/Logs/Claude/mcp.log
```
2024-12-04T12:49:49.902Z [error] Error in MCP connection to server terminal: SyntaxError: Unexpected token '>', "> tsc && s"... is not valid JSON
    at JSON.parse (<anonymous>)
    at Jbe (/Applications/Claude.app/Contents/Resources/app.asar/.vite/build/index.js:52:189)
    at Xbe.readMessage (/Applications/Claude.app/Contents/Resources/app.asar/.vite/build/index.js:52:115)
    at t0e.processReadBuffer (/Applications/Claude.app/Contents/Resources/app.asar/.vite/build/index.js:53:1842)
    at Socket.<anonymous> (/Applications/Claude.app/Contents/Resources/app.asar/.vite/build/index.js:53:1523)
    at Socket.emit (node:events:519:28)
    at addChunk (node:internal/streams/readable:559:12)
    at readableAddChunkPushByteMode (node:internal/streams/readable:510:3)
    at Readable.push (node:internal/streams/readable:390:5)
    at Pipe.onStreamRead (node:internal/stream_base_commons:191:23)
```
Seen similar issue here https://github.com/modelcontextprotocol/servers/issues/133
Not sure how to fix yet

# Exploration of Antropic Model Context Protocol

This repo was created during YouTube strem of exploring and hacking Claude MCPs: https://youtube.com/live/TlbjFDbl5Us?feature=share

## Plan
- [x] What is Model Context Protocol?
     1. a new standard for connecting AI assistants to the systems where data lives
      
- [x] How it differes from OpenAI CustomGPTs actions?
     1. Local MCP server support in the Claude Desktop apps (ChatGPT can't connect to local ones, only globally hosted ones)
     2. There seem to be more adoption of making such servers
     3. setup on first try is a bit confusing
     4. you need to create file for config claude_desktop_config.json if its not there
     5. OpenAI uses OpenAPI schema to define HTTPS calls, MCP defines tool calls
     6. It seems like Claude Desktop can't work with servers on internet
     7. It is not as straightforward to run for now
        

- [x] Test reference servers
     1. tested https://github.com/modelcontextprotocol/servers
     2. Made it write new terminal server

- [x] Create MCP server that give Claude Terminal Access and test similar to ChatGPT Server Commander
     1. we tried but Claude is not picking up our server and its hard to figure out what is wrong
     2. If you have issues with your MCP you can find logs in (~/Library/Logs/Claude/), there will be logs for individual MCPs and overall MCP log
     3. Turns out you do not need to run server, what you put in to ~/Library/Application Support/Claude/claude_desktop_config.json is command that Claude runs to start MCP itself
     4. Most examples use npx @modelcontextprotocol/server-filesystem style example, which would not work for your MCP as yours is not published on nom like that yet
     5. There are also some issues
      


## License

MIT
