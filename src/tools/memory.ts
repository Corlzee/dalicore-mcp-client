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

// Execute memory query
function executeMemoryQuery(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonPath = '/home/konverts/projects/map4/tools/ai-memory/memory_query.py';
    const proc = spawn('python3', [pythonPath, ...args]);
    
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
        reject(new Error(`Memory query failed: ${error}`));
      } else {
        resolve(output);
      }
    });
  });
}

// Show my recent operations (using context command)
export async function showMyHistory(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Use context command to get recent session info
    const output = await executeMemoryQuery(['context']);
    
    return {
      content: [{
        type: "text",
        text: `📜 Your Recent Context:\n\n${output}\n\nThis shows your most recent session activity.`
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
    const output = await executeMemoryQuery(['file', '--file', parsed.file_path]);
    
    return {
      content: [{
        type: "text",
        text: `📁 Operations on ${parsed.file_path}:\n\n${output}`
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

// What should I have done? (search journal for hindsight markers)
export async function whatShouldIHaveDone(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // Use a direct database query through a custom script
    const journalQueryPath = '/home/konverts/projects/map4/tools/ai-memory/journal_hindsight.py';
    
    const proc = spawn('python3', [journalQueryPath, '--hours', parsed.hours.toString()]);
    
    let output = '';
    let error = '';
    
    return new Promise((resolve) => {
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code !== 0 || output.trim() === '') {
          // Fallback: explain what this command is for
          resolve({
            content: [{
              type: "text",
              text: `🤔 Hindsight Analysis:\n\n` +
                    `This command searches your AI journal for learning moments:\n` +
                    `- SHOULDVE: Better approaches you realized later\n` +
                    `- WRONG_ASSUMPTION: Assumptions that proved false\n` +
                    `- DIDNT_KNOW: Critical info discovered too late\n` +
                    `- PREVENTION: What would have prevented issues\n` +
                    `- REWORK: What you had to redo\n\n` +
                    `No hindsight entries found in the last ${parsed.hours} hours.\n` +
                    `(Or the journal_hindsight.py script doesn't exist yet)`
            }]
          });
        } else {
          resolve({
            content: [{
              type: "text",
              text: `🤔 Hindsight Analysis - What You Should Have Done:\n\n${output}\n\n` +
                    `These are learning opportunities from the last ${parsed.hours} hours.\n` +
                    `Review these patterns to avoid similar mistakes.`
            }]
          });
        }
      });
    });
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
    const output = await executeMemoryQuery(['decisions', '--hours', parsed.hours.toString()]);
    
    return {
      content: [{
        type: "text",
        text: `🎯 Recent Decisions (last ${parsed.hours} hours):\n\n${output}`
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
    // Blockers command doesn't use hours parameter in the current implementation
    const output = await executeMemoryQuery(['blockers']);
    
    return {
      content: [{
        type: "text",
        text: `🚧 Current Blockers:\n\n${output}\n\nThese issues need resolution.`
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

// Show full context (new command for comprehensive memory dump)
export async function showContext(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    const cmdArgs = ['context'];
    if (parsed.session_id) {
      cmdArgs.push('--session', parsed.session_id);
    }
    
    const output = await executeMemoryQuery(cmdArgs);
    
    return {
      content: [{
        type: "text",
        text: `🧠 Full Context:\n\n${output}`
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

// Undo last operation (guidance only)
export async function undoLastOperation(args: unknown): Promise<ServerResult> {
  const parsed = UndoArgsSchema.parse(args);
  
  let guidance = `⚠️ Undo Functionality:\n\n` +
                 `Direct undo isn't implemented yet, but you can:\n`;
  
  if (parsed.file_path) {
    guidance += `\nFor file: ${parsed.file_path}\n`;
    guidance += `1. Use 'what_did_i_do --file_path "${parsed.file_path}"' to see changes\n`;
    guidance += `2. Check 'git diff ${parsed.file_path}' for uncommitted changes\n`;
    guidance += `3. Use 'git checkout -- ${parsed.file_path}' to revert\n`;
  } else {
    guidance += `1. Use 'show_my_history' to see recent operations\n`;
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