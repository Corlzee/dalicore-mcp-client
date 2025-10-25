import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface ToolHistoryEntry {
    timestamp: Date;
    toolName: string;
    path?: string;
    operation?: string;
    details?: string;
    success: boolean;
}

export interface ToolHistoryOptions {
    filter: 'edits' | 'all';
    limit: number;
    verbose: boolean;
}

const EDIT_TOOLS = ['write_file', 'edit_block'];
const LOG_PATH = join(homedir(), '.config', 'Claude', 'logs', 'mcp-server-dalicore-mcp-client.log');

/**
 * Parse MCP log file for tool call history
 */
export function getToolHistory(options: ToolHistoryOptions): string {
    try {
        const logContent = readFileSync(LOG_PATH, 'utf-8');
        const lines = logContent.split('\n');
        
        const entries: ToolHistoryEntry[] = [];
        
        // Parse log lines in reverse (most recent first)
        for (let i = lines.length - 1; i >= 0 && entries.length < options.limit * 2; i--) {
            const line = lines[i];
            
            // Look for tool call messages
            if (!line.includes('tools/call')) continue;
            
            try {
                // Extract JSON from log line
                const jsonMatch = line.match(/\{.*"method":"tools\/call".*\}/);
                if (!jsonMatch) continue;
                
                const data = JSON.parse(jsonMatch[0]);
                const toolName = data.params?.name;
                
                if (!toolName) continue;
                
                // Filter by tool type
                if (options.filter === 'edits' && !EDIT_TOOLS.includes(toolName)) {
                    continue;
                }
                
                // Extract timestamp from log line
                const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
                const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
                
                // Extract operation details based on tool type
                const args = data.params?.arguments || {};
                const extracted = extractToolDetails(toolName, args);
                
                entries.push({
                    timestamp,
                    toolName,
                    path: extracted.path,
                    operation: extracted.operation,
                    details: extracted.details,
                    success: true, // We'll assume success if it's in the log
                });
                
                if (entries.length >= options.limit) break;
                
            } catch (parseError) {
                // Skip malformed JSON lines
                continue;
            }
        }
        
        // Format output
        if (entries.length === 0) {
            return 'No tool history found matching the filter criteria.';
        }
        
        return options.verbose ? formatVerbose(entries) : formatCompact(entries);
        
    } catch (error) {
        return `Error reading tool history: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * Extract relevant details from tool arguments based on tool type
 */
function extractToolDetails(toolName: string, args: any): {
    path?: string;
    operation: string;
    details: string;
} {
    let path: string | undefined;
    let operation = '';
    let details = '';
    
    switch (toolName) {
        case 'write_file':
            path = args.path;
            operation = args.mode === 'append' ? 'append' : 'write';
            const lineCount = args.content ? args.content.split('\n').length : 0;
            details = `${lineCount} lines`;
            break;
            
        case 'edit_block':
            path = args.file_path;
            operation = 'edit';
            const replacements = args.expected_replacements || 1;
            details = `${replacements} replacement${replacements !== 1 ? 's' : ''}`;
            break;
            
        case 'start_process':
            operation = 'exec';
            // Truncate long commands
            const cmd = args.command || '';
            details = cmd.length > 60 ? cmd.substring(0, 57) + '...' : cmd;
            break;
            
        case 'read_file':
            path = args.path;
            operation = 'read';
            if (args.offset || args.length) {
                const offset = args.offset || 0;
                const length = args.length || 'all';
                details = `offset: ${offset}, length: ${length}`;
            }
            break;
            
        case 'search_code':
            path = args.path;
            operation = 'search';
            details = `pattern: "${args.pattern || ''}"`;
            if (args.filePattern) {
                details += `, files: ${args.filePattern}`;
            }
            break;
            
        case 'search_files':
            path = args.path;
            operation = 'find';
            details = `pattern: "${args.pattern || ''}"`;
            break;
            
        case 'list_directory':
            path = args.path;
            operation = 'ls';
            break;
            
        case 'tool_history':
            operation = 'history';
            details = `filter: ${args.filter || 'edits'}, limit: ${args.limit || 10}`;
            break;
            
        default:
            // Generic fallback - try to extract path and show available args
            path = args.path || args.file_path;
            operation = 'unknown';
            const argKeys = Object.keys(args).filter(k => !['path', 'file_path'].includes(k));
            if (argKeys.length > 0) {
                details = `args: ${argKeys.slice(0, 3).join(', ')}`;
            }
    }
    
    return { path, operation, details };
}

function formatCompact(entries: ToolHistoryEntry[]): string {
    const lines: string[] = [`RECENT FILESYSTEM EDITS (last ${entries.length}):`];
    
    for (const entry of entries) {
        const timeAgo = getTimeAgo(entry.timestamp);
        const operation = entry.operation ? ` (${entry.operation})` : '';
        const pathPart = entry.path ? `: ${entry.path}` : '';
        const details = entry.details ? ` - ${entry.details}` : '';
        lines.push(`[${timeAgo}] ${entry.toolName}${operation}${pathPart}${details}`);
    }
    
    return lines.join('\n');
}

function formatVerbose(entries: ToolHistoryEntry[]): string {
    const lines: string[] = [`RECENT FILESYSTEM EDITS (last ${entries.length}):\n`];
    
    for (const entry of entries) {
        const timeAgo = getTimeAgo(entry.timestamp);
        lines.push(`[${timeAgo}] ${entry.toolName}`);
        if (entry.path) lines.push(`  Path: ${entry.path}`);
        if (entry.operation) lines.push(`  Operation: ${entry.operation}`);
        if (entry.details) lines.push(`  Details: ${entry.details}`);
        lines.push(`  Status: ${entry.success ? 'SUCCESS' : 'FAILED'}`);
        lines.push('');
    }
    
    return lines.join('\n');
}

function getTimeAgo(timestamp: Date): string {
    const now = Date.now();
    const diff = now - timestamp.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}
