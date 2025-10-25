import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

interface ToolHistoryEntry {
    timestamp: Date;
    toolName: string;
    requestId: string | number;
    path?: string;
    operation?: string;
    details?: string;
    success: boolean;
    errorMessage?: string;
    resultSummary?: string;
}

export interface ToolHistoryOptions {
    filter: 'edits' | 'all';
    limit: number;
    verbose: boolean;
    since?: string;  // "1h", "30m", "2d", or ISO timestamp
    pathFilter?: string;  // Filter by file path
    showFullCommands?: boolean;  // Don't truncate commands
}

const EDIT_TOOLS = ['write_file', 'edit_block'];
const LOG_PATH = join(homedir(), '.config', 'Claude', 'logs', 'mcp-server-dalicore-mcp-client.log');

/**
 * Parse MCP log file for tool call history with result correlation
 */
export function getToolHistory(options: ToolHistoryOptions): string {
    try {
        const logContent = readFileSync(LOG_PATH, 'utf-8');
        const lines = logContent.split('\n');
        
        // Calculate time filter if specified
        const sinceTimestamp = options.since ? parseSinceTime(options.since) : null;
        
        // First pass: Build a map of request IDs to results
        const resultMap = new Map<string | number, any>();
        for (const line of lines) {
            if (!line.includes('Message from server')) continue;
            
            try {
                const jsonMatch = line.match(/\{.*"jsonrpc":"2\.0".*\}/);
                if (!jsonMatch) continue;
                
                const data = JSON.parse(jsonMatch[0]);
                if (data.id !== undefined) {
                    resultMap.set(data.id, data.result || data.error);
                }
            } catch (e) {
                // Skip malformed JSON
            }
        }
        
        // Second pass: Parse tool calls and correlate with results
        const entries: ToolHistoryEntry[] = [];
        
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
                const requestId = data.id;
                
                if (!toolName || requestId === undefined) continue;
                
                // Filter by tool type
                if (options.filter === 'edits' && !EDIT_TOOLS.includes(toolName)) {
                    continue;
                }
                
                // Extract timestamp from log line
                const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
                const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();
                
                // Filter by time if specified
                if (sinceTimestamp && timestamp < sinceTimestamp) {
                    continue;
                }
                
                // Extract operation details
                const args = data.params?.arguments || {};
                const extracted = extractToolDetails(toolName, args, options.showFullCommands);
                
                // Filter by path if specified
                if (options.pathFilter && extracted.path && !extracted.path.includes(options.pathFilter)) {
                    continue;
                }
                
                // Look up the result for this request
                const result = resultMap.get(requestId);
                const { success, errorMessage, resultSummary } = extractResultInfo(toolName, result, args);
                
                entries.push({
                    timestamp,
                    toolName,
                    requestId,
                    path: extracted.path,
                    operation: extracted.operation,
                    details: extracted.details,
                    success,
                    errorMessage,
                    resultSummary,
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
 * Parse "since" time strings like "1h", "30m", "2d" or ISO timestamps
 */
function parseSinceTime(since: string): Date {
    // Try parsing as ISO timestamp first
    const isoDate = new Date(since);
    if (!isNaN(isoDate.getTime())) {
        return isoDate;
    }
    
    // Parse relative time strings (1h, 30m, 2d)
    const match = since.match(/^(\d+)(s|m|h|d)$/);
    if (!match) {
        throw new Error(`Invalid time format: ${since}. Use format like "1h", "30m", "2d" or ISO timestamp`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    const now = Date.now();
    
    let milliseconds = 0;
    switch (unit) {
        case 's': milliseconds = value * 1000; break;
        case 'm': milliseconds = value * 60 * 1000; break;
        case 'h': milliseconds = value * 60 * 60 * 1000; break;
        case 'd': milliseconds = value * 24 * 60 * 60 * 1000; break;
    }
    
    return new Date(now - milliseconds);
}

/**
 * Extract relevant details from tool arguments based on tool type
 */
function extractToolDetails(toolName: string, args: any, showFullCommands = false): {
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
            const cmd = args.command || '';
            // Show full command if requested, otherwise truncate
            details = showFullCommands ? cmd : (cmd.length > 60 ? cmd.substring(0, 57) + '...' : cmd);
            break;
            
        case 'read_file':
            path = args.path;
            operation = 'read';
            if (args.offset || args.length) {
                const offset = args.offset || 0;
                const length = args.length || 'default';
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
            operation = 'list';
            break;
            
        case 'tool_history':
            operation = 'history';
            const filterOpts = [];
            if (args.filter) filterOpts.push(`filter: ${args.filter}`);
            if (args.limit) filterOpts.push(`limit: ${args.limit}`);
            if (args.verbose !== undefined) filterOpts.push(`verbose: ${args.verbose}`);
            details = filterOpts.join(', ');
            break;
            
        default:
            operation = 'unknown';
            const argKeys = Object.keys(args).filter(k => !['path', 'file_path'].includes(k));
            if (argKeys.length > 0) {
                details = `args: ${argKeys.slice(0, 3).join(', ')}`;
            }
    }
    
    return { path, operation, details };
}

/**
 * Extract success/failure and result summary from tool result
 */
function extractResultInfo(toolName: string, result: any, args: any): {
    success: boolean;
    errorMessage?: string;
    resultSummary?: string;
} {
    if (!result) {
        return { success: false, errorMessage: 'No result found' };
    }
    
    // Check for explicit error flag
    if (result.isError) {
        const errorText = result.content?.[0]?.text || 'Unknown error';
        return { success: false, errorMessage: errorText };
    }
    
    // Check for error in content
    const contentText = result.content?.[0]?.text || '';
    if (contentText.toLowerCase().includes('error')) {
        return { success: false, errorMessage: contentText.substring(0, 200) };
    }
    
    // Success - generate summary based on tool type
    let resultSummary = '';
    
    switch (toolName) {
        case 'read_file':
            // Extract line count from metadata or content
            const meta = result._meta;
            if (meta?.linesRead) {
                resultSummary = `Read ${meta.linesRead} lines`;
                if (meta.offset) resultSummary += ` (from line ${meta.startLine})`;
            }
            break;
            
        case 'write_file':
            const lineCount = args.content ? args.content.split('\n').length : 0;
            resultSummary = `Wrote ${lineCount} lines`;
            break;
            
        case 'edit_block':
            if (contentText.includes('Successfully applied')) {
                const match = contentText.match(/(\d+) edit/);
                if (match) {
                    resultSummary = `${match[1]} replacement${match[1] !== '1' ? 's' : ''} applied`;
                }
            }
            break;
            
        case 'start_process':
            // Extract PID and check for completion
            const pidMatch = contentText.match(/PID (\d+)/);
            if (pidMatch) {
                resultSummary = `PID ${pidMatch[1]}`;
                // Check if there's output
                const outputMatch = contentText.match(/Initial output:\n(.+)/);
                if (outputMatch) {
                    const firstLine = outputMatch[1].split('\n')[0];
                    if (firstLine && firstLine.length > 0) {
                        resultSummary += ` → ${firstLine.substring(0, 50)}`;
                    }
                }
            }
            break;
            
        case 'search_code':
            // Count matches in result
            const matches = contentText.split('\n').filter(l => l.match(/^\d+:/)).length;
            resultSummary = matches > 0 ? `Found ${matches} matches` : 'No matches';
            break;
            
        case 'search_files':
            const fileCount = contentText.split('\n').filter(l => l.trim().length > 0).length;
            resultSummary = fileCount > 0 ? `Found ${fileCount} files` : 'No files found';
            break;
            
        case 'list_directory':
            const itemCount = contentText.split('\n').filter(l => l.match(/^\[(FILE|DIR)\]/)).length;
            resultSummary = `${itemCount} items`;
            break;
    }
    
    return { success: true, resultSummary };
}

function formatCompact(entries: ToolHistoryEntry[]): string {
    const lines: string[] = [`RECENT FILESYSTEM EDITS (last ${entries.length}):`];
    
    for (const entry of entries) {
        const timeAgo = getTimeAgo(entry.timestamp);
        const statusIcon = entry.success ? '✓' : '✗';
        const operation = entry.operation ? ` (${entry.operation})` : '';
        const pathPart = entry.path ? `: ${entry.path}` : '';
        const details = entry.details ? ` - ${entry.details}` : '';
        const result = entry.resultSummary ? ` → ${entry.resultSummary}` : '';
        const error = entry.errorMessage ? ` ✗ ${entry.errorMessage.substring(0, 60)}` : '';
        
        lines.push(`[${timeAgo}] ${statusIcon} ${entry.toolName}${operation}${pathPart}${details}${result}${error}`);
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
        lines.push(`  Status: ${entry.success ? '✓ SUCCESS' : '✗ FAILED'}`);
        if (entry.resultSummary) lines.push(`  Result: ${entry.resultSummary}`);
        if (entry.errorMessage) lines.push(`  Error: ${entry.errorMessage}`);
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
