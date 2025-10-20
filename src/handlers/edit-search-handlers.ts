import {
    searchTextInFiles
} from '../tools/search.js';

import {
    SearchCodeArgsSchema,
    EditBlockArgsSchema
} from '../tools/schemas.js';

import { handleEditBlock } from '../tools/edit.js';

import { ServerResult } from '../types.js';
import { capture } from '../utils/capture.js';
import { withTimeout } from '../utils/withTimeout.js';

/**
 * Handle edit_block command
 * Uses the enhanced implementation with multiple occurrence support and fuzzy matching
 */
export { handleEditBlock };

/**
 * Handle search_code command
 */
export async function handleSearchCode(args: unknown): Promise<ServerResult> {
    const parsed = SearchCodeArgsSchema.parse(args);
    const timeoutMs = parsed.timeoutMs || 30000; // 30 seconds default

    // Apply timeout at the handler level
    const searchOperation = async () => {
        return await searchTextInFiles({
            rootPath: parsed.path,
            pattern: parsed.pattern,
            filePattern: parsed.filePattern,
            ignoreCase: parsed.ignoreCase,
            maxResults: parsed.maxResults,
            includeHidden: parsed.includeHidden,
            contextLines: parsed.contextLines,
            // Don't pass timeoutMs down to the implementation
        });
    };

    let results: any[] | null;
    try {
        // Use withTimeout but catch errors to distinguish between timeouts and validation errors
        results = await withTimeout(
            searchOperation(),
            timeoutMs,
            'Code search operation',
            null // Use null to let errors propagate
        );
    } catch (error: any) {
        // Check if this is a path validation error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Path not allowed')) {
            // Propagate path validation errors immediately
            return {
                content: [{type: "text", text: `Error: ${errorMessage}`}],
                isError: true,
            };
        }
        
        // If it's a timeout or other error, try to terminate the ripgrep process
        if ((globalThis as any).currentSearchProcess) {
            try {
                console.log(`Terminating search process (PID: ${(globalThis as any).currentSearchProcess.pid})`);
                (globalThis as any).currentSearchProcess.kill();
                delete (globalThis as any).currentSearchProcess;
            } catch (killError) {
                capture('server_request_error', {
                    error: 'Error terminating search process'
                });
            }
        }
        
        // For timeout errors, return empty results
        if (errorMessage.includes('timed out')) {
            return {
                content: [{type: "text", text: `No matches found or search timed out after ${timeoutMs}ms.`}],
            };
        }
        
        // For other errors, propagate them
        return {
            content: [{type: "text", text: `Error: ${errorMessage}`}],
            isError: true,
        };
    }

    if (!results || results.length === 0) {
        return {
            content: [{type: "text", text: "No matches found"}],
        };
    }

    // Format the results in a VS Code-like format
    let currentFile = "";
    let formattedResults = "";

    results.forEach(result => {
        if (result.file !== currentFile) {
            formattedResults += `\n${result.file}:\n`;
            currentFile = result.file;
        }
        formattedResults += `  ${result.line}: ${result.match}\n`;
    });

    return {
        content: [{type: "text", text: formattedResults.trim()}],
    };
}