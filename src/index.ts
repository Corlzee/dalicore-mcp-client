#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import os from 'os';
import process from 'process';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);
const CONFIG_FILE = path.join(process.cwd(), 'config.json');
const LOG_FILE = path.join(process.cwd(), 'server.log');

// Load blocked commands from config file
async function loadBlockedCommands(): Promise<Set<string>> {
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    return new Set(config.blockedCommands);
  } catch (error) {
    return new Set(); // Return empty set if config file doesn't exist
  }
}

// Save blocked commands to config file
async function saveBlockedCommands(commands: Set<string>): Promise<void> {
  try {
    const config = {
      blockedCommands: Array.from(commands)
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
  }
}

// Initialize blocked commands
const BLOCKED_COMMANDS = new Set<string>();

// Validate command before execution
function validateCommand(command: string): boolean {
  const baseCommand = command.split(' ')[0].toLowerCase().trim();
  return !BLOCKED_COMMANDS.has(baseCommand);
}

// Schema definitions
const ExecuteCommandArgsSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
});

const KillProcessArgsSchema = z.object({
  pid: z.number(),
});

const BlockCommandArgsSchema = z.object({
  command: z.string(),
});

const UnblockCommandArgsSchema = z.object({
  command: z.string(),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

interface ProcessInfo {
  pid: number;
  command: string;
  cpu: string;
  memory: string;
}

// Server setup
const server = new Server(
  {
    name: "secure-terminal-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool implementations
async function executeCommand(command: string, args: string[] = []): Promise<{stdout: string; stderr: string}> {
  if (!validateCommand(command)) {
    throw new Error(`Command not allowed: ${command}. Blocked commands are: ${Array.from(BLOCKED_COMMANDS).join(', ')}`);
  }

  try {
    const { stdout, stderr } = await execAsync(`${command} ${args.join(' ')}`);
    return { stdout, stderr };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Command execution failed: ${error.message}`);
    }
    throw error;
  }
}

async function listProcesses(): Promise<ProcessInfo[]> {
  const command = os.platform() === 'win32' ? 'tasklist' : 'ps aux';
  try {
    const { stdout } = await execAsync(command);
    const processes = stdout.split('\n')
      .slice(1)
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          pid: parseInt(parts[1]),
          command: parts[parts.length - 1],
          cpu: parts[2],
          memory: parts[3],
        };
      });
    return processes;
  } catch (error) {
    throw new Error('Failed to list processes');
  }
}

// Log to file
async function logToFile(message: string): Promise<void> {
  try {
    await fs.appendFile(LOG_FILE, `${new Date().toISOString()} - ${message}\n`, 'utf-8');
  } catch (error) {
    console.error(`Failed to log to file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  await logToFile('Processing execute_command request');
  return {
    tools: [
      {
        name: "execute_command",
        description:
          "Execute a terminal command. All commands are allowed except for potentially dangerous ones. " +
          "Returns command output and error streams. Use list_blocked_commands to see current blacklist.",
        inputSchema: zodToJsonSchema(ExecuteCommandArgsSchema) as ToolInput,
      },
      {
        name: "list_processes",
        description:
          "List all running processes. Returns process information including PID, " +
          "command name, CPU usage, and memory usage.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "kill_process",
        description:
          "Terminate a running process by PID. Use with caution as this will " +
          "forcefully terminate the specified process.",
        inputSchema: zodToJsonSchema(KillProcessArgsSchema) as ToolInput,
      },
      {
        name: "block_command",
        description:
          "Add a command to the blacklist. Once blocked, the command cannot be executed until unblocked.",
        inputSchema: zodToJsonSchema(BlockCommandArgsSchema) as ToolInput,
      },
      {
        name: "unblock_command",
        description:
          "Remove a command from the blacklist. Once unblocked, the command can be executed normally.",
        inputSchema: zodToJsonSchema(UnblockCommandArgsSchema) as ToolInput,
      },
      {
        name: "list_blocked_commands",
        description:
          "List all currently blocked commands.",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;
    logToFile(`Received request for tool '${name}' with arguments: ${JSON.stringify(args)}`);

    switch (name) {
      case "execute_command": {
        await logToFile('Processing execute_command request');
        const parsed = ExecuteCommandArgsSchema.safeParse(args);
        if (!parsed.success) {
          await logToFile(`Invalid arguments for execute_command: ${parsed.error}`);
          throw new Error(`Invalid arguments for execute_command: ${parsed.error}`);
        }
        const { stdout, stderr } = await executeCommand(parsed.data.command, parsed.data.args || []);
        await logToFile(`Executed command: ${parsed.data.command} ${parsed.data.args.join(' ')}`);
        return {
          content: [{ 
            type: "text", 
            text: `stdout:\n${stdout}\nstderr:\n${stderr}` 
          }],
        };
      }

      case "list_processes": {
        await logToFile('Processing list_processes request');
        const processes = await listProcesses();
        await logToFile(`Retrieved ${processes.length} processes`);
        return {
          content: [{ 
            type: "text", 
            text: processes.map(p => 
              `PID: ${p.pid}, Command: ${p.command}, CPU: ${p.cpu}, Memory: ${p.memory}`
            ).join('\n') 
          }],
        };
      }

      case "kill_process": {
        await logToFile('Processing kill_process request');
        const parsed = KillProcessArgsSchema.safeParse(args);
        if (!parsed.success) {
          await logToFile(`Invalid arguments for kill_process: ${parsed.error}`);
          throw new Error(`Invalid arguments for kill_process: ${parsed.error}`);
        }
        process.kill(parsed.data.pid);
        await logToFile(`Killed process ${parsed.data.pid}`);
        return {
          content: [{ type: "text", text: `Successfully terminated process ${parsed.data.pid}` }],
        };
      }

      case "block_command": {
        await logToFile('Processing block_command request');
        const parsed = BlockCommandArgsSchema.safeParse(args);
        if (!parsed.success) {
          await logToFile(`Invalid arguments for block_command: ${parsed.error}`);
          throw new Error(`Invalid arguments for block_command: ${parsed.error}`);
        }
        const command = parsed.data.command.toLowerCase().trim();
        if (BLOCKED_COMMANDS.has(command)) {
          await logToFile(`Attempted to block already blocked command: ${command}`);
          return {
            content: [{ 
              type: "text", 
              text: `Command '${command}' is already blocked.` 
            }],
          };
        }
        BLOCKED_COMMANDS.add(command);
        await saveBlockedCommands(BLOCKED_COMMANDS);
        await logToFile(`Added '${command}' to blocked commands`);
        return {
          content: [{ 
            type: "text", 
            text: `Command '${command}' has been blocked. Current blocked commands: ${Array.from(BLOCKED_COMMANDS).join(', ')}` 
          }],
        };
      }

      case "unblock_command": {
        await logToFile('Processing unblock_command request');
        const parsed = UnblockCommandArgsSchema.safeParse(args);
        if (!parsed.success) {
          await logToFile(`Invalid arguments for unblock_command: ${parsed.error}`);
          throw new Error(`Invalid arguments for unblock_command: ${parsed.error}`);
        }
        const command = parsed.data.command.toLowerCase().trim();
        if (!BLOCKED_COMMANDS.has(command)) {
          await logToFile(`Attempted to unblock non-blocked command: ${command}`);
          return {
            content: [{ 
              type: "text", 
              text: `Command '${command}' is not blocked.` 
            }],
          };
        }
        BLOCKED_COMMANDS.delete(command);
        await saveBlockedCommands(BLOCKED_COMMANDS);
        await logToFile(`Removed '${command}' from blocked commands`);
        return {
          content: [{ 
            type: "text", 
            text: `Command '${command}' has been unblocked. Current blocked commands: ${Array.from(BLOCKED_COMMANDS).join(', ')}` 
          }],
        };
      }

      case "list_blocked_commands": {
        await logToFile('Processing list_blocked_commands request');
        const blockedList = Array.from(BLOCKED_COMMANDS).sort();
        await logToFile(`Listed ${blockedList.length} blocked commands`);
        return {
          content: [{ 
            type: "text", 
            text: blockedList.length > 0 
              ? `Currently blocked commands:\n${blockedList.join('\n')}`
              : "No commands are currently blocked."
          }],
        };
      }

      default:
        await logToFile(`Unknown tool requested: ${name}`);
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logToFile(`Error handling tool call request: ${errorMessage}`);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  try {
    await logToFile('Starting secure-terminal-server...');
    const transport = new StdioServerTransport();
    
    // Load blocked commands from config file
    const loadedCommands = await loadBlockedCommands();
    loadedCommands.forEach(cmd => BLOCKED_COMMANDS.add(cmd));
    await logToFile(`Loaded blocked commands from config: ${Array.from(loadedCommands).join(', ')}`);
    
    await server.connect(transport);
    await logToFile('Server is now listening for requests');
  } catch (error) {
    await logToFile(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

runServer().catch(async (error) => {
  await logToFile(`Fatal error running server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});