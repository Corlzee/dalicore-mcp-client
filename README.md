# Claude Computer Commander

A terminal server that allows Claude to execute commands on your computer and manage processes through Model Context Protocol (MCP).

## Features

- Execute terminal commands with output streaming
- Command timeout and background execution support
- Process management (list and kill processes)
- Session management for long-running commands

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
- Install dependencies
- Build the server
- Create a config file for Claude's desktop app if it doesn't exist
- Add MCP server to Claude's config file if its not there
- It will also add [Puppeteer fir browser automation](https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer) and [File editing servers](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- Afterwards start the Claude and you should have access

## Usage

The server provides the following tools:

- `execute_command`: Execute terminal commands with configurable timeout
  - Commands that don't complete within the timeout continue running in background
  - Use `read_output` to get new output from long-running commands
- `read_output`: Get new output from a running command by PID
- `force_terminate`: Stop a running command session
- `list_sessions`: View all currently running command sessions
- `list_processes`: View all system processes
- `kill_process`: Terminate a process by PID

## Handling Long-Running Commands

When executing commands that may take a while to complete:

1. The `execute_command` tool will return after a timeout (default: 1 second) with initial output
2. If the command is still running, it continues in the background
3. Use `read_output` with the returned PID to get any new output
4. Use `force_terminate` to stop a running command if needed

# Model Context Protocol Integration

This project demonstrates the integration with Anthropic's Model Context Protocol (MCP), which allows AI assistants to interact with local systems. Key differences from OpenAI's Custom GPT actions:

- Local server support in Claude Desktop (vs. only internet-hosted actions in ChatGPT)
- Uses MCP tool calls instead of OpenAPI schemas
- Runs locally through Claude Desktop's MCP system

Created as part of exploring Claude MCPs: https://youtube.com/live/TlbjFDbl5Us

## License

MIT
