import { terminalManager } from '../terminal-manager.js';
import { commandManager } from '../command-manager.js';
import { logToFile } from '../logging.js';
import { ExecuteCommandArgsSchema, ReadOutputArgsSchema, ForceTerminateArgsSchema, ListSessionsArgsSchema } from './schemas.js';

export async function executeCommand(args: unknown) {
  await logToFile('Processing execute_command request');
  const parsed = ExecuteCommandArgsSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for execute_command: ${parsed.error}`);
  }

  if (!commandManager.validateCommand(parsed.data.command)) {
    throw new Error(`Command not allowed: ${parsed.data.command}`);
  }

  const result = await terminalManager.executeCommand(
    parsed.data.command,
    parsed.data.timeout_ms
  );
  
  await logToFile(`Executed command: ${parsed.data.command} with PID ${result.pid}`);
  return {
    content: [{
      type: "text",
      text: `Command started with PID ${result.pid}\nInitial output:\n${result.output}${
        result.isBlocked ? '\nCommand is still running. Use read_output to get more output.' : ''
      }`
    }],
  };
}

export async function readOutput(args: unknown) {
  await logToFile('Processing read_output request');
  const parsed = ReadOutputArgsSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for read_output: ${parsed.error}`);
  }

  const output = terminalManager.getNewOutput(parsed.data.pid);
  return {
    content: [{
      type: "text",
      text: output === null
        ? `No session found for PID ${parsed.data.pid}`
        : output || 'No new output available'
    }],
  };
}

export async function forceTerminate(args: unknown) {
  await logToFile('Processing force_terminate request');
  const parsed = ForceTerminateArgsSchema.safeParse(args);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for force_terminate: ${parsed.error}`);
  }

  const success = terminalManager.forceTerminate(parsed.data.pid);
  return {
    content: [{
      type: "text",
      text: success
        ? `Successfully initiated termination of session ${parsed.data.pid}`
        : `No active session found for PID ${parsed.data.pid}`
    }],
  };
}

export async function listSessions() {
  await logToFile('Processing list_sessions request');
  const sessions = terminalManager.listActiveSessions();
  return {
    content: [{
      type: "text",
      text: sessions.length === 0
        ? 'No active sessions'
        : sessions.map(s =>
            `PID: ${s.pid}, Blocked: ${s.isBlocked}, Runtime: ${Math.round(s.runtime / 1000)}s`
          ).join('\n')
    }],
  };
}
