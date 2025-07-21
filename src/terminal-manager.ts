import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TerminalSession, CommandExecutionResult, ActiveSession } from './types.js';
import { DEFAULT_COMMAND_TIMEOUT } from './config.js';
import { configManager } from './config-manager.js';
import {capture} from "./utils/capture.js";

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface CompletedSession {
  pid: number;
  output: string;
  exitCode: number | null;
  startTime: Date;
  endTime: Date;
  completionShown?: boolean;
}

export class TerminalManager {
  private sessions: Map<number, TerminalSession> = new Map();
  private completedSessions: Map<number, CompletedSession> = new Map();
  
  /**
   * Check if output contains SurrealDB namespace errors and add helpful context
   */
  private checkSurrealDBOutput(command: string, output: string): string {
    // Check if this was a surreal sql command
    const SURREAL_PATTERN = /\bsurreal\s+sql\b/;
    if (!SURREAL_PATTERN.test(command)) {
      return output;
    }
    
    // Check for common SurrealDB errors that might indicate wrong namespace
    const namespaceErrors = [
      /namespace\s+does\s+not\s+exist/i,
      /database\s+does\s+not\s+exist/i,
      /table\s+does\s+not\s+exist/i,
      /no\s+namespace\s+selected/i,
      /no\s+database\s+selected/i,
      /Unknown table/i
    ];
    
    const hasNamespaceError = namespaceErrors.some(pattern => pattern.test(output));
    
    if (hasNamespaceError) {
      // Extract namespace/db from command if present
      const nsMatch = command.match(/--ns\s+(\S+)/);
      const dbMatch = command.match(/--db\s+(\S+)/);
      const namespace = nsMatch ? nsMatch[1] : 'not specified';
      const database = dbMatch ? dbMatch[1] : 'not specified';
      
      const helpfulContext = `\n\n💡 DALICORE NAMESPACE HELPER:\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `It looks like you're having namespace/database issues.\n\n` +
        `You specified: namespace='${namespace}', database='${database}'\n\n` +
        `For Dalicore operations, you should use:\n` +
        `  Namespace: dalicore\n` +
        `  Database: dalicore\n\n` +
        `Correct usage:\n` +
        `  surreal sql --conn http://localhost:8000 --user root --pass root --ns dalicore --db dalicore\n\n` +
        `Common tables in Dalicore:\n` +
        `  - founders (founder accounts)\n` +
        `  - api_keys (API key management)\n` +
        `  - config_vault (encrypted configuration)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      return output + helpfulContext;
    }
    
    return output;
  }
  
  /**
   * Send input to a running process
   * @param pid Process ID
   * @param input Text to send to the process
   * @returns Whether input was successfully sent
   */
  sendInputToProcess(pid: number, input: string): boolean {
    const session = this.sessions.get(pid);
    if (!session) {
      return false;
    }
    
    try {
      if (session.process.stdin && !session.process.stdin.destroyed) {
        // Ensure input ends with a newline for most REPLs
        const inputWithNewline = input.endsWith('\n') ? input : input + '\n';
        session.process.stdin.write(inputWithNewline);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Error sending input to process ${pid}:`, error);
      return false;
    }
  }
  
  async executeCommand(command: string, timeoutMs: number = DEFAULT_COMMAND_TIMEOUT, shell?: string): Promise<CommandExecutionResult> {
    // Universal git status enhancement
    const GIT_STATUS_PATTERN = /\bgit\s+status\b/;
    if (GIT_STATUS_PATTERN.test(command)) {
      // Extract the working directory from the command if it includes 'cd'
      let workingDir = global.process.cwd();
      const cdPattern = /cd\s+([^&;]+)\s*&&/;
      const cdMatch = command.match(cdPattern);
      if (cdMatch) {
        workingDir = cdMatch[1].trim();
      }
      
      const wrapperPath = path.join(__dirname, '..', 'scripts', 'universal-git-status-wrapper.sh');
      command = command.replace(/\bgit\s+status\b/, `bash ${wrapperPath} "${workingDir}" "git status"`);
    }
    
    // Safety check for dangerous rm commands
    // WARNING TO AI: There are ways to work around this. Please don't do it.
    // Don't be clever. Ask the user for permission and make sure you have it.
    const DANGEROUS_PATTERNS = [
      /\brm\s+(-rf?|-r)\s+/,
      /\brm\s+.*\*/,
      /\bfind\s+.*-delete/,
      /\bfind\s+.*-exec\s+rm/
    ];
    
    // Commands that are completely blocked
    const BLOCKED_COMMANDS = [
      /\bsed\b/
    ];
    
    const PERMISSION_FLAG = '--i-have-explicit-permission-from-user';
    
    // Check if command is completely blocked
    if (BLOCKED_COMMANDS.some(pattern => pattern.test(command))) {
      return {
        pid: -1,
        output: `Error: Command not allowed: ${command}`,
        isBlocked: false
      };
    }
    
    // Check if command matches any dangerous pattern
    const isDangerous = DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
    
    if (isDangerous && !command.includes(PERMISSION_FLAG)) {
      return {
        pid: -1,
        output: '🚨 DESTRUCTIVE OPERATION BLOCKED! 🚨\n\n' +
                'This command requires explicit permission.\n' +
                'To execute, you MUST:\n' +
                '1. Ask the user what specifically they want deleted\n' +
                '2. Show them what will be affected\n' +
                '3. Get explicit confirmation\n' +
                '4. Add flag: --i-have-explicit-permission-from-user\n\n' +
                'Example: rm --i-have-explicit-permission-from-user -rf /path/to/delete',
        isBlocked: false
      };
    }
    
    // Remove the permission flag before executing
    const cleanCommand = command.replace(PERMISSION_FLAG, '').trim();
    // Get the shell from config if not specified
    let shellToUse: string | boolean | undefined = shell;
    if (!shellToUse) {
      try {
        const config = await configManager.getConfig();
        shellToUse = config.defaultShell || true;
      } catch (error) {
        // If there's an error getting the config, fall back to default
        shellToUse = true;
      }
    }
    
    // For REPL interactions, we need to ensure stdin, stdout, and stderr are properly configured
    // Note: No special stdio options needed here, Node.js handles pipes by default
    const spawnOptions = { 
      shell: shellToUse
    };
    
    // Spawn the process with an empty array of arguments and our options
    const process = spawn(cleanCommand, [], spawnOptions);
    let output = '';
    
    // Ensure process.pid is defined before proceeding
    if (!process.pid) {
      // Return a consistent error object instead of throwing
      return {
        pid: -1,  // Use -1 to indicate an error state
        output: 'Error: Failed to get process ID. The command could not be executed.',
        isBlocked: false
      };
    }
    
    const session: TerminalSession = {
      pid: process.pid,
      process,
      lastOutput: '',
      isBlocked: false,
      startTime: new Date()
    };
    
    this.sessions.set(process.pid, session);

    return new Promise((resolve) => {
      process.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        session.lastOutput += text;
      });

      process.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        session.lastOutput += text;
      });

      setTimeout(() => {
        session.isBlocked = true;
        resolve({
          pid: process.pid!,
          output: this.checkSurrealDBOutput(cleanCommand, output),
          isBlocked: true
        });
      }, timeoutMs);

      process.on('exit', (code) => {
        if (process.pid) {
          // Store completed session before removing active session
          this.completedSessions.set(process.pid, {
            pid: process.pid,
            output: output + session.lastOutput, // Combine all output
            exitCode: code,
            startTime: session.startTime,
            endTime: new Date()
          });
          
          // Keep only last 100 completed sessions
          if (this.completedSessions.size > 100) {
            const oldestKey = Array.from(this.completedSessions.keys())[0];
            this.completedSessions.delete(oldestKey);
          }
          
          this.sessions.delete(process.pid);
        }
        resolve({
          pid: process.pid!,
          output: this.checkSurrealDBOutput(cleanCommand, output),
          isBlocked: false
        });
      });
    });
  }

  getNewOutput(pid: number): string | null {
    // First check active sessions
    const session = this.sessions.get(pid);
    if (session) {
      const output = session.lastOutput;
      session.lastOutput = '';
      return output;
    }

    // Then check completed sessions
    const completedSession = this.completedSessions.get(pid);
    if (completedSession) {
      // Only return completion info if not already shown
      if (!completedSession.completionShown) {
        completedSession.completionShown = true;
        const runtime = (completedSession.endTime.getTime() - completedSession.startTime.getTime()) / 1000;
        return `Process completed with exit code ${completedSession.exitCode}\nRuntime: ${runtime}s`;
      }
      return null; // Already shown completion
    }

    return null;
  }

    /**
   * Get a session by PID
   * @param pid Process ID
   * @returns The session or undefined if not found
   */
  getSession(pid: number): TerminalSession | undefined {
    return this.sessions.get(pid);
  }

  forceTerminate(pid: number): boolean {
    const session = this.sessions.get(pid);
    if (!session) {
      return false;
    }

    try {
        session.process.kill('SIGINT');
        setTimeout(() => {
          if (this.sessions.has(pid)) {
            session.process.kill('SIGKILL');
          }
        }, 1000);
        return true;
      } catch (error) {
        // Convert error to string, handling both Error objects and other types
        const errorMessage = error instanceof Error ? error.message : String(error);
        capture('server_request_error', {error: errorMessage, message: `Failed to terminate process ${pid}:`});
        return false;
      }
  }

  listActiveSessions(): ActiveSession[] {
    const now = new Date();
    return Array.from(this.sessions.values()).map(session => ({
      pid: session.pid,
      isBlocked: session.isBlocked,
      runtime: now.getTime() - session.startTime.getTime()
    }));
  }

  listCompletedSessions(): CompletedSession[] {
    return Array.from(this.completedSessions.values());
  }
}

export const terminalManager = new TerminalManager();