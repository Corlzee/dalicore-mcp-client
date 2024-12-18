import { spawn } from 'child_process';
import { TerminalSession, CommandExecutionResult, ActiveSession } from './types.js';
import { DEFAULT_COMMAND_TIMEOUT } from './config.js';

export class TerminalManager {
  private sessions: Map<number, TerminalSession> = new Map();
  
  async executeCommand(command: string, timeoutMs: number = DEFAULT_COMMAND_TIMEOUT): Promise<CommandExecutionResult> {
    const process = spawn(command, [], { shell: true });
    let output = '';
    
    // Ensure process.pid is defined before proceeding
    if (!process.pid) {
      throw new Error('Failed to get process ID');
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
          output,
          isBlocked: true
        });
      }, timeoutMs);

      process.on('exit', () => {
        if (process.pid) {
          this.sessions.delete(process.pid);
        }
        resolve({
          pid: process.pid!,
          output,
          isBlocked: false
        });
      });
    });
  }

  getNewOutput(pid: number): string | null {
    const session = this.sessions.get(pid);
    if (!session) {
      return null;
    }

    const output = session.lastOutput;
    session.lastOutput = '';
    return output;
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
      console.error(`Failed to terminate process ${pid}:`, error);
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
}

export const terminalManager = new TerminalManager();
