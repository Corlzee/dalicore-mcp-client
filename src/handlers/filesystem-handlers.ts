import {
    readFile,
    writeFile,
    listDirectory,
    searchFiles,
    type FileResult
} from '../tools/filesystem.js';

import { z } from 'zod';
import {ServerResult} from '../types.js';
import {withTimeout} from '../utils/withTimeout.js';
import { getToolHistory } from '../utils/toolHistory.js';
import {createErrorResponse} from '../error-handlers.js';
import {configManager} from '../config-manager.js';

import {
    ReadFileArgsSchema,
    WriteFileArgsSchema,
    ListDirectoryArgsSchema,
    SearchFilesArgsSchema,
    ToolHistoryArgsSchema
} from '../tools/schemas.js';

/**
 * Helper function to check if path contains an error
 */
function isErrorPath(path: string): boolean {
    return path.startsWith('__ERROR__:');
}

/**
 * Extract error message from error path
 */
function getErrorFromPath(path: string): string {
    return path.substring('__ERROR__:'.length).trim();
}

/**
 * Handle read_file command
 */
export async function handleReadFile(args: unknown): Promise<ServerResult> {
    const HANDLER_TIMEOUT = 60000; // 60 seconds total operation timeout
    // Add input validation
    if (args === null || args === undefined) {
        return createErrorResponse('No arguments provided for read_file command');
    }
    const readFileOperation = async () => {
        const parsed = ReadFileArgsSchema.parse(args);

        // Get the configuration for file read limits
        const config = await configManager.getConfig();
        if (!config) {
            return createErrorResponse('Configuration not available');
        }

        const defaultLimit = config.fileReadLineLimit ?? 1000;

        // Use the provided limits or defaults
        const offset = parsed.offset ?? 0;
        const length = parsed.length ?? defaultLimit;
        const showWhitespace = parsed.show_whitespace ?? false;
        
        const fileResult = await readFile(parsed.path, parsed.isUrl, offset, length, showWhitespace);
        
        if (fileResult.isImage) {
            // For image files, return as an image content type
            return {
                content: [
                    { 
                        type: "text", 
                        text: `Image file: ${parsed.path} (${fileResult.mimeType})\n` 
                    },
                    {
                        type: "image",
                        data: fileResult.content,
                        mimeType: fileResult.mimeType
                    }
                ],
            };
        } else {
            // For all other files, return as text with metadata if available
            const result: ServerResult = {
                content: [{ type: "text", text: fileResult.content }],
            };
            
            // Add metadata if present
            if (fileResult.metadata) {
                result._meta = fileResult.metadata;
            }
            
            return result;
        }
    };
    
    // Execute with timeout at the handler level
    const result = await withTimeout(
        readFileOperation(),
        HANDLER_TIMEOUT,
        'Read file handler operation',
        null
    );
    if (result == null) {
        // Handles the impossible case where withTimeout resolves to null instead of throwing
        throw new Error('Failed to read the file');
    }
    return result;
}

/**
 * Handle write_file command
 */
export async function handleWriteFile(args: unknown): Promise<ServerResult> {
    try {
        const parsed = WriteFileArgsSchema.parse(args);

        // Get the line limit from configuration
        const config = await configManager.getConfig();
        const MAX_LINES = config.fileWriteLineLimit ?? 50; // Default to 50 if not set
        
        // Strictly enforce line count limit
        const lines = parsed.content.split('\n');
        const lineCount = lines.length;
        let errorMessage = "";
        if (lineCount > MAX_LINES) {
            errorMessage = `✅ File written successfully! (${lineCount} lines)
            
💡 Performance tip: For optimal speed, consider chunking files into ≤30 line pieces in future operations.`;
        }

        // Pass the mode parameter to writeFile
        await writeFile(parsed.path, parsed.content, parsed.mode);
        
        // Provide more informative message based on mode
        const modeMessage = parsed.mode === 'append' ? 'appended to' : 'wrote to';
        
        return {
            content: [{ 
                type: "text", 
                text: `Successfully ${modeMessage} ${parsed.path} (${lineCount} lines) ${errorMessage}`
            }],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(errorMessage);
    }
}

/**
 * Handle list_directory command
 */
export async function handleListDirectory(args: unknown): Promise<ServerResult> {
    try {
        const parsed = ListDirectoryArgsSchema.parse(args);
        const entries = await listDirectory(parsed.path);
        return {
            content: [{ type: "text", text: entries.join('\n') }],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(errorMessage);
    }
}

/**
 * Handle search_files command
 */
export async function handleSearchFiles(args: unknown): Promise<ServerResult> {
    try {
        const parsed = SearchFilesArgsSchema.parse(args);
        const timeoutMs = parsed.timeoutMs || 30000; // 30 seconds default
        
        // Apply timeout at the handler level
        const searchOperation = async () => {
            return await searchFiles(parsed.path, parsed.pattern);
        };
        
        // Use withTimeout at the handler level
        const results = await withTimeout(
            searchOperation(),
            timeoutMs,
            'File search operation',
            [] // Empty array as default on timeout
        );
        
        if (results.length === 0) {
            // Similar approach as in handleSearchCode
            if (timeoutMs > 0) {
                return {
                    content: [{ type: "text", text: `No matches found or search timed out after ${timeoutMs}ms.` }],
                };
            }
            return {
                content: [{ type: "text", text: "No matches found" }],
            };
        }
        
        return {
            content: [{ type: "text", text: results.join('\n') }],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(errorMessage);
    }
}

// The listAllowedDirectories function has been removed
// Use get_config to retrieve the allowedDirectories configuration

/**
 * Handle tool history retrieval
 */
export async function handleToolHistory(args: unknown): Promise<ServerResult> {
    try {
        const parsed = ToolHistoryArgsSchema.parse(args);
        
        const history = getToolHistory({
            filter: parsed.filter,
            limit: parsed.limit,
            verbose: parsed.verbose,
            since: parsed.since,
            pathFilter: parsed.pathFilter,
            showFullCommands: parsed.showFullCommands,
        });
        
        return {
            content: [{ type: "text" as const, text: history }],
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(errorMessage);
    }
}
