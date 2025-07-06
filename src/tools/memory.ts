import { z } from 'zod';
import { spawn } from 'child_process';
import { ServerResult } from '../types.js';

// Schema for memory tool arguments
export const MemoryQueryArgsSchema = z.object({
  query_type: z.enum(['history', 'file', 'decisions', 'blockers', 'shouldve', 'context']),
  hours: z.number().optional().default(4),
  file_path: z.string().optional(),
  limit: z.number().optional().default(10),
  session_id: z.string().optional()
});

export const UndoArgsSchema = z.object({
  file_path: z.string().optional()
});

// Execute cortex command
function executeCortexCommand(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const cortexPath = '/home/konverts/bin/cortex';
    const proc = spawn(cortexPath, args);
    
    let output = '';
    let error = '';
    
    proc.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Cortex command failed: ${error || output}`));
      } else {
        resolve(output);
      }
    });
  });
}

// Show my recent operations
export async function showMyHistory(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Use history command with hours parameter
    const output = await executeCortexCommand(['history', '--hours', parsed.hours.toString()]);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying memory: ${error}`
      }],
      isError: true
    };
  }
}

// What did I do to this file?
export async function whatDidIDo(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  if (!parsed.file_path) {
    return {
      content: [{
        type: "text",
        text: "Error: file_path is required for file history query"
      }],
      isError: true
    };
  }
  
  try {
    const cmdArgs = ['file', parsed.file_path];
    if (parsed.hours) {
      cmdArgs.push('--hours', parsed.hours.toString());
    }
    
    const output = await executeCortexCommand(cmdArgs);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying file history: ${error}`
      }],
      isError: true
    };
  }
}

// What should I have done? (hindsight analysis)
export async function whatShouldIHaveDone(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Use shouldve command
    const output = await executeCortexCommand(['shouldve', '--hours', parsed.hours.toString()]);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying hindsight: ${error}`
      }],
      isError: true
    };
  }
}

// Show recent decisions
export async function showDecisions(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    const output = await executeCortexCommand(['decisions', '--hours', parsed.hours.toString()]);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying decisions: ${error}`
      }],
      isError: true
    };
  }
}

// Show current blockers
export async function showBlockers(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Blockers command uses hours parameter in Rust version
    const output = await executeCortexCommand(['blockers', '--hours', parsed.hours.toString()]);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying blockers: ${error}`
      }],
      isError: true
    };
  }
}

// Show current context
export async function showContext(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Use context command (verbose mode for more details)
    const output = await executeCortexCommand(['context', '--verbose']);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error querying context: ${error}`
      }],
      isError: true
    };
  }
}

// Natural language query (new feature!)
export async function queryMemory(query: string): Promise<ServerResult> {
  try {
    const output = await executeCortexCommand(['query', query]);
    
    return {
      content: [{
        type: "text",
        text: output
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error with query: ${error}`
      }],
      isError: true
    };
  }
}

// Undo last operation (guidance only)
export async function undoLastOperation(args: unknown): Promise<ServerResult> {
  const parsed = UndoArgsSchema.parse(args);
  
  let guidance = `⚠️ Undo Functionality:\n\n` +
                 `Direct undo isn't implemented yet, but you can:\n`;
  
  if (parsed.file_path) {
    guidance += `\nFor file: ${parsed.file_path}\n`;
    guidance += `1. Use 'cortex file ${parsed.file_path}' to see all operations\n`;
    guidance += `2. Check 'git diff ${parsed.file_path}' for uncommitted changes\n`;
    guidance += `3. Use 'git checkout -- ${parsed.file_path}' to revert\n`;
  } else {
    guidance += `1. Use 'cortex history' to see recent operations\n`;
    guidance += `2. Check 'git status' and 'git diff' for changes\n`;
    guidance += `3. Use git commands to revert as needed\n`;
  }
  
  guidance += `\nFor safety, always review changes before reverting!`;
  
  return {
    content: [{
      type: "text",
      text: guidance
    }]
  };
}