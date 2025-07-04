import { spawn } from 'child_process';
import { readFile } from './filesystem.js';

/**
 * Cortex Memory Integration for Commander Keen MCP
 * 
 * This module integrates with the new Cortex memory system (Rust/SurrealDB)
 * to automatically capture AIJOURNAL entries and other memory-worthy events.
 */

// Configuration
const CORTEX_BINARY = '/home/konverts/projects/cortex/target/debug/cortex_memory';
const AIJOURNAL_PATTERN = /AIJOURNAL\.md$/i;

// Memory marker patterns to extract from journal
const MARKER_PATTERNS = {
    USER: /^USER:\s*(.+)$/m,
    INTENT: /^INTENT:\s*(.+)$/m,
    ACTION: /^ACTION:\s*(.+)$/m,
    FOUND: /^FOUND:\s*(.+)$/m,
    DECISION: /^DECISION:\s*(.+)$/m,
    PATTERN: /^PATTERN:\s*(.+)$/m,
    REWORK: /^REWORK:\s*(.+)$/m,
    WRONG_ASSUMPTION: /^WRONG_ASSUMPTION:\s*(.+)$/m,
    SHOULDVE: /^SHOULDVE:\s*(.+)$/m,
    BLOCKED: /^BLOCKED:\s*(.+)$/m,
    DIDNT_KNOW: /^DIDNT_KNOW:\s*(.+)$/m,
    NEXT: /^NEXT:\s*(.+)$/m
};

// Active session tracking
let currentSessionId: string | null = null;

/**
 * Start a new Cortex session
 */
async function startCortexSession(): Promise<string | null> {
    return new Promise((resolve) => {
        const proc = spawn(CORTEX_BINARY, ['session', 'start'], {
            env: { ...process.env, PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH}` }
        });
        
        let output = '';
        proc.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                // Extract session ID from output
                const match = output.match(/Started session: (session:[a-z0-9]+)/);
                if (match) {
                    console.log(`[Cortex] Started session: ${match[1]}`);
                    resolve(match[1]);
                } else {
                    console.error('[Cortex] Could not parse session ID from output');
                    resolve(null);
                }
            } else {
                console.error('[Cortex] Failed to start session');
                resolve(null);
            }
        });
    });
}

/**
 * Parse AIJOURNAL content and extract memories
 */
function parseAIJournal(content: string): Array<{marker: string, content: string}> {
    const memories = [];
    
    for (const [marker, pattern] of Object.entries(MARKER_PATTERNS)) {
        const matches = content.matchAll(new RegExp(pattern.source, 'gm'));
        for (const match of matches) {
            if (match[1]) {
                memories.push({
                    marker,
                    content: match[1].trim()
                });
            }
        }
    }
    
    return memories;
}

/**
 * Add a memory to Cortex
 */
async function addMemoryToCortex(marker: string, content: string, files: string[] = []): Promise<boolean> {
    if (!currentSessionId) {
        currentSessionId = await startCortexSession();
        if (!currentSessionId) return false;
    }
    
    return new Promise((resolve) => {
        const args = [
            'add',
            content,
            '--marker', marker,
            '--session', currentSessionId
        ];
        
        // Add files if provided
        if (files.length > 0) {
            files.forEach(file => {
                args.push('--files', file);
            });
        }
        
        const proc = spawn(CORTEX_BINARY, args as string[], {
            env: { ...process.env, PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH}` }
        });
        
        let output = '';
        let error = '';
        
        proc.stdout.on('data', (data: Buffer) => {
            output += data.toString();
        });
        
        proc.stderr.on('data', (data: Buffer) => {
            error += data.toString();
        });
        
        proc.on('close', (code: number | null) => {
            if (code === 0) {
                console.log(`[Cortex] Added memory: [${marker}] ${content.substring(0, 50)}...`);
                resolve(true);
            } else {
                console.error(`[Cortex] Failed to add memory: ${error || output}`);
                resolve(false);
            }
        });
    });
}

/**
 * Process a file write event - main integration point
 */
export async function onFileWrite(filePath: string, content: string): Promise<void> {
    // Check if this is an AIJOURNAL file
    if (!AIJOURNAL_PATTERN.test(filePath)) {
        return;
    }
    
    console.log(`[Cortex] Processing AIJOURNAL write: ${filePath}`);
    
    try {
        // Parse the journal content
        const memories = parseAIJournal(content);
        
        if (memories.length === 0) {
            console.log('[Cortex] No memory markers found in journal');
            return;
        }
        
        console.log(`[Cortex] Found ${memories.length} memories to process`);
        
        // Add each memory to Cortex
        for (const memory of memories) {
            await addMemoryToCortex(memory.marker, memory.content, [filePath]);
        }
        
    } catch (error) {
        console.error('[Cortex] Error processing AIJOURNAL:', error);
    }
}

/**
 * Initialize Cortex integration
 */
export async function initializeCortex(): Promise<void> {
    console.log('[Cortex] Initializing memory integration...');
    
    // Check if Cortex binary exists
    try {
        const fs = await import('fs/promises');
        await fs.access(CORTEX_BINARY);
        console.log('[Cortex] Binary found at:', CORTEX_BINARY);
    } catch {
        console.warn('[Cortex] Binary not found - memory integration disabled');
        return;
    }
    
    // Start a session
    currentSessionId = await startCortexSession();
    if (currentSessionId) {
        console.log('[Cortex] Integration ready');
    } else {
        console.warn('[Cortex] Failed to start session - integration disabled');
    }
}

/**
 * Shutdown Cortex integration
 */
export async function shutdownCortex(): Promise<void> {
    if (currentSessionId) {
        console.log('[Cortex] Ending session:', currentSessionId);
        // TODO: Implement session end command
        currentSessionId = null;
    }
}