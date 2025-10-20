import { terminalManager } from '../terminal-manager.js';
import { commandManager } from '../command-manager.js';
import { StartProcessArgsSchema } from './schemas.js';
// Interactive process schemas removed during tool gutting
// import { ReadProcessOutputArgsSchema, InteractWithProcessArgsSchema, ForceTerminateArgsSchema, ListSessionsArgsSchema } from './schemas.js';
import { capture } from "../utils/capture.js";
import { ServerResult } from '../types.js';
import { analyzeProcessState, cleanProcessOutput, formatProcessStateMessage } from '../utils/process-detection.js';
import { getBlockedCommandHelp } from '../utils/blockedCommandHelp.js';

/**
 * Start a new process (renamed from execute_command)
 * Includes early detection of process waiting for input
 */
export async function startProcess(args: unknown): Promise<ServerResult> {
  const parsed = StartProcessArgsSchema.safeParse(args);
  if (!parsed.success) {
    capture('server_start_process_failed');
    return {
      content: [{ type: "text", text: `Error: Invalid arguments for start_process: ${parsed.error}` }],
      isError: true,
    };
  }

  try {
    const commands = commandManager.extractCommands(parsed.data.command).join(', ');
    capture('server_start_process', {
      command: commandManager.getBaseCommand(parsed.data.command),
      commands: commands
    });
  } catch (error) {
    capture('server_start_process', {
      command: commandManager.getBaseCommand(parsed.data.command)
    });
  }

  const isAllowed = await commandManager.validateCommand(parsed.data.command);
  if (!isAllowed) {
    // Special handling for sudo commands
    const baseCommand = parsed.data.command.trim().split(' ')[0].toLowerCase();
    if (baseCommand === 'sudo') {
      return {
        content: [{ 
          type: "text", 
          text: `🚨 SUDO COMMAND BLOCKED! 🚨

I need to run a sudo command but don't have permission.

The command I tried to run:
\`\`\`bash
${parsed.data.command}
\`\`\`

**What you need to do:**
1. Review the command above carefully
2. If you approve, please run it in your terminal yourself
3. Then tell me the result so I can continue

**Alternative:** For Dalicore services, I can use these safe commands without sudo:
- \`/home/konverts/projects/dalicore/bin/dalicore-service <action> <service>\`
- \`/home/konverts/projects/dalicore/bin/dalicore-restart <name>\`
- \`/home/konverts/projects/dalicore/bin/dalicore-status\`

Should I use one of the wrapper commands instead, or would you like to run the sudo command yourself?` 
        }],
        isError: true,
      };
    }
    
    // For other blocked commands, provide helpful alternatives
    return {
      content: [{ type: "text", text: getBlockedCommandHelp(parsed.data.command) }],
      isError: true,
    };
  }

  const result = await terminalManager.executeCommand(
    parsed.data.command,
    parsed.data.timeout_ms,
    parsed.data.shell
  );

  if (result.pid === -1) {
    return {
      content: [{ type: "text", text: result.output }],
      isError: true,
    };
  }

  // Analyze the process state to detect if it's waiting for input
  const processState = analyzeProcessState(result.output, result.pid);
  
  let statusMessage = '';
  if (processState.isWaitingForInput) {
    statusMessage = `\n🔄 ${formatProcessStateMessage(processState, result.pid)}`;
  } else if (processState.isFinished) {
    statusMessage = `\n✅ ${formatProcessStateMessage(processState, result.pid)}`;
  } else if (result.isBlocked) {
    statusMessage = '\n⏳ Process is running. Use read_process_output to get more output.';
  }

  return {
    content: [{
      type: "text",
      text: `Process started with PID ${result.pid}\nInitial output:\n${result.output}${statusMessage}`
    }],
  };
}
