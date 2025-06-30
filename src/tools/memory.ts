import { z } from 'zod';
import { spawn } from 'child_process';
import { ServerResult } from '../types.js';

// Schema for memory tool arguments
export const MemoryQueryArgsSchema = z.object({
  query_type: z.enum(['history', 'file', 'decisions', 'blockers', 'shouldve', 'context']),
  hours: z.number().optional().default(4),
  file_path: z.string().optional(),
  limit: z.number().optional().default(10)
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

// Show my recent operations
export async function showMyHistory(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    const output = await executeMemoryQuery(['operations', '--last', parsed.limit.toString()]);
    
    return {
      content: [{
        type: "text",
        text: `📜 Your Recent Operations:\n\n${output}\n\nUse these to understand what you've been doing.`
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
    const output = await executeMemoryQuery(['file', parsed.file_path]);
    
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

// What should I have done? (hindsight analysis)
export async function whatShouldIHaveDone(args: unknown): Promise<ServerResult> {
  const parsed = MemoryQueryArgsSchema.parse(args);
  
  try {
    // For hindsight analysis, we need to query the journal entries directly
    // The memory_query.py might not have a 'journal' command with markers, 
    // so let's query the raw database
    const queryCommand = [
      'context',  // Get full context
      '--hours',
      parsed.hours.toString()
    ];
    
    const output = await executeMemoryQuery(queryCommand);
    
    // Parse the output to find journal entries with specific markers
    const lines = output.split('\n');
    const hindsightEntries: string[] = [];
    const markers = ['SHOULDVE', 'WRONG_ASSUMPTION', 'DIDNT_KNOW', 'PREVENTION', 'REWORK'];
    
    let capturing = false;
    let currentEntry = '';
    
    for (const line of lines) {
      if (markers.some(marker => line.includes(`"marker_type": "${marker}"`))) {
        capturing = true;
        currentEntry = line;
      } else if (capturing && line.includes('"content":')) {
        currentEntry += '\n' + line;
        hindsightEntries.push(currentEntry);
        capturing = false;
      }
    }
    
    const formattedOutput = hindsightEntries.length > 0 
      ? hindsightEntries.join('\n\n')
      : 'No hindsight entries found in the last ' + parsed.hours + ' hours.';
    
    return {
      content: [{
        type: "text",
        text: `🤔 Hindsight Analysis - What You Should Have Done:\n\n${output}\n\n` +
              `These are learning opportunities from the last ${parsed.hours} hours.\n` +
              `Review these patterns to avoid similar mistakes.`
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
  try {
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

// Undo last operation (if possible)
export async function undoLastOperation(args: unknown): Promise<ServerResult> {
  // This is a placeholder - would need integration with git or file snapshots
  return {
    content: [{
      type: "text",
      text: `⚠️ Undo Functionality:\n\n` +
            `Direct undo isn't implemented yet, but you can:\n` +
            `1. Use 'show_my_history' to see what was changed\n` +
            `2. Check git status/diff to see modifications\n` +
            `3. Use git checkout to revert if needed\n` +
            `4. The original content might be in this chat context\n\n` +
            `For now, prevention (dry-run, confirmation) is better than cure.`
    }]
  };
}
