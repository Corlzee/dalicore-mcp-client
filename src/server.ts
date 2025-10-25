import {Server} from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListPromptsRequestSchema,
    type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import {zodToJsonSchema} from "zod-to-json-schema";

// Shared constants for tool descriptions
const PATH_GUIDANCE = `IMPORTANT: Always use absolute paths (starting with '/' or drive letter like 'C:\\') for reliability. Relative paths (like './dalicore' or 'src/main.rs') are resolved relative to the defaultWorkingDirectory configuration setting (default: ~/projects). You can check the current defaultWorkingDirectory with system info. Tilde paths (~/...) are expanded to the user's home directory. Unless the user explicitly asks for relative paths, use absolute paths for clarity.`;

const CMD_PREFIX_DESCRIPTION = `This command can be referenced as "DC: ..." or "use Desktop Commander to ..." in your instructions.`;

import {
    StartProcessArgsSchema,
    ReadFileArgsSchema,
    WriteFileArgsSchema,
    ListDirectoryArgsSchema,
    SearchFilesArgsSchema,
    EditBlockArgsSchema,
    SearchCodeArgsSchema,
    ToolHistoryArgsSchema,
} from "./tools/schemas.js";

import { getSystemInfoHeader } from './utils/systemInfo.js';
import {trackToolCall} from './utils/trackTools.js';
import * as handlers from './handlers/index.js';
import {ServerResult} from './types.js';

import {VERSION} from './version.js';
import {capture, capture_call_tool} from "./utils/capture.js";

console.error("Loading server.ts");

export const server = new Server(
    {
        name: "dalicore-mcp-client",
        version: VERSION,
    },
    {
        capabilities: {
            tools: {},
            resources: {},  // Add empty resources capability
            prompts: {},    // Add empty prompts capability
        },
    },
);

// Add handler for resources/list method
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // Return an empty list of resources
    return {
        resources: [],
    };
});

// Add handler for prompts/list method
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    // Return an empty list of prompts
    return {
        prompts: [],
    };
});

console.error("Setting up request handlers...");

server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
        console.error("Generating tools list...");
        
        // Get system info to prepend to first tool
        const systemInfo = await getSystemInfoHeader();
        
        return {
            tools: [
                // Process Management
                {
                    name: "start_process",
                    description: systemInfo + `
                        Start a new terminal process with intelligent state detection.
                        
                        🚨 PRIMARY TOOL FOR FILE ANALYSIS AND DATA PROCESSING
                        This is the ONLY correct tool for analyzing local files (CSV, JSON, logs, etc.).
                        The analysis tool CANNOT access local files and WILL FAIL - always use processes for file-based work.
                        
                        ⚠️ CRITICAL RULE: For ANY local file work, ALWAYS use this tool, NEVER use analysis/REPL tool.
                        
                        REQUIRED WORKFLOW FOR LOCAL FILES:
                        1. start_process("python3 -c 'import pandas as pd; df = pd.read_csv(\"/path/file.csv\"); print(df.head())'")
                        
                        Or for complex analysis, write a script:
                        1. write_file("/tmp/analyze.py", "script content")
                        2. start_process("python3 /tmp/analyze.py")
                        
                        SMART DETECTION:
                        - Detects REPL prompts (>>>, >, $, etc.)
                        - Identifies when process is waiting for input
                        - Recognizes process completion vs timeout
                        - Early exit prevents unnecessary waiting
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(StartProcessArgsSchema),
                },
                
                // File Reading
                {
                    name: "read_file",
                    description: `
                        Read the contents of a file from the file system or a URL with optional offset and length parameters.
                        
                        Prefer this over 'start_process' with cat/type for viewing files.
                        
                        Supports partial file reading with:
                        - 'offset' (start line, default: 0)
                          * Positive: Start from line N (0-based indexing)
                          * Negative: Read last N lines from end (tail behavior)
                        - 'length' (max lines to read, default: 1000)
                          * Used with positive offsets for range reading
                          * Ignored when offset is negative (reads all requested tail lines)
                        
                        Examples:
                        - offset: 0, length: 10     → First 10 lines
                        - offset: 100, length: 5    → Lines 100-104
                        - offset: -20               → Last 20 lines  
                        - offset: -5, length: 10    → Last 5 lines (length ignored)
                        
                        Performance optimizations:
                        - Large files with negative offsets use reverse reading for efficiency
                        - Large files with deep positive offsets use byte estimation
                        - Small files use fast readline streaming
                        
                        When reading from the file system, only works within allowed directories.
                        Can fetch content from URLs when isUrl parameter is set to true
                        (URLs are always read in full regardless of offset/length).
                        
                        Handles text files normally and image files are returned as viewable images.
                        Recognized image types: PNG, JPEG, GIF, WebP.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(ReadFileArgsSchema),
                },
                
                // File Writing
                {
                    name: "write_file",
                    description: `
                        Write or append to file contents. 

                        🎯 CHUNKING IS STANDARD PRACTICE: Always write files in chunks of 25-30 lines maximum.
                        This is the normal, recommended way to write files - not an emergency measure.

                        STANDARD PROCESS FOR ANY FILE:
                        1. FIRST → write_file(filePath, firstChunk, {mode: 'rewrite'})  [≤30 lines]
                        2. THEN → write_file(filePath, secondChunk, {mode: 'append'})   [≤30 lines]
                        3. CONTINUE → write_file(filePath, nextChunk, {mode: 'append'}) [≤30 lines]

                        ⚠️ ALWAYS CHUNK PROACTIVELY - don't wait for performance warnings!

                        WHEN TO CHUNK (always be proactive):
                        1. Any file expected to be longer than 25-30 lines
                        2. When writing multiple files in sequence
                        3. When creating documentation, code files, or configuration files
                        
                        HANDLING CONTINUATION ("Continue" prompts):
                        If user asks to "Continue" after an incomplete operation:
                        1. Read the file to see what was successfully written
                        2. Continue writing ONLY the remaining content using {mode: 'append'}
                        3. Keep chunks to 25-30 lines each
                        
                        Files over 50 lines will generate performance notes but are still written successfully.
                        Only works within allowed directories.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(WriteFileArgsSchema),
                },
                
                // Code Editing
                {
                    name: "edit_block",
                    description: `
                        Apply surgical text replacements to files.
                        
                        BEST PRACTICE: Make multiple small, focused edits rather than one large edit.
                        Each edit_block call should change only what needs to be changed - include just enough 
                        context to uniquely identify the text being modified.
                        
                        Takes:
                        - file_path: Path to the file to edit
                        - old_string: Text to replace (also accepts old_str as alias)
                        - new_string: Replacement text (also accepts new_str as alias)
                        - expected_replacements: Optional parameter for number of replacements
                        
                        By default, replaces only ONE occurrence of the search text.
                        To replace multiple occurrences, provide the expected_replacements parameter with
                        the exact number of matches expected.
                        
                        UNIQUENESS REQUIREMENT: When expected_replacements=1 (default), include the minimal
                        amount of context necessary (typically 1-3 lines) before and after the change point,
                        with exact whitespace and indentation.
                        
                        When editing multiple sections, make separate edit_block calls for each distinct change
                        rather than one large replacement.
                        
                        When a close but non-exact match is found, a character-level diff is shown in the format:
                        common_prefix{-removed-}{+added+}common_suffix to help you identify what's different.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(EditBlockArgsSchema),
                },
                
                // Code Search
                {
                    name: "search_code",
                    description: `
                        Search for text/code patterns within file contents using ripgrep.
                        
                        Use this instead of 'start_process' with grep/find for searching code content.
                        Fast and powerful search similar to VS Code search functionality.
                        
                        Supports regular expressions, file pattern filtering, and context lines.
                        Has a default timeout of 30 seconds which can be customized.
                        Only searches within allowed directories.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(SearchCodeArgsSchema),
                },
                
                // File System - List Directory
                {
                    name: "list_directory",
                    description: `
                        Get a detailed listing of all files and directories in a specified path.
                        
                        Use this instead of 'start_process' with ls/dir commands.
                        Results distinguish between files and directories with [FILE] and [DIR] prefixes.
                        Only works within allowed directories.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(ListDirectoryArgsSchema),
                },
                
                // File System - Search Files
                {
                    name: "search_files",
                    description: `
                        Search for files by name pattern using glob syntax.
                        
                        Use this instead of 'start_process' with find commands for finding files by name.
                        Supports wildcards (* and ?) and recursive directory traversal.
                        Has a configurable timeout (default: no timeout).
                        Only searches within allowed directories.
                        
                        ${PATH_GUIDANCE}
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(SearchFilesArgsSchema),
                },
                
                // Tool History
                {
                    name: "tool_history",
                    description: `
                        Get a history of recent tool calls with success/failure status and result summaries.
                        
                        Useful for:
                        - Remembering what files were edited recently
                        - Checking if operations succeeded or failed
                        - Reviewing command output and results
                        - Finding specific file operations
                        - Debugging failed operations
                        
                        Filter options:
                        - filter: "edits" (default) = Only write_file and edit_block operations
                        - filter: "all" = All tool calls
                        
                        Time filtering:
                        - since: "1h" / "30m" / "2d" = Show only operations from last N time
                        - since: ISO timestamp = Show operations after specific time
                        
                        Path filtering:
                        - pathFilter: "/path/to/file" = Only show operations on files matching path
                        
                        Display options:
                        - verbose: true = Show full details with status and results
                        - verbose: false (default) = Compact one-line format
                        - showFullCommands: true = Don't truncate long commands
                        
                        Results show:
                        - ✓/✗ Success/failure indicators
                        - Result summaries (lines read/written, matches found, etc.)
                        - Error messages for failed operations
                        - Timestamps as human-readable relative times
                        
                        ${CMD_PREFIX_DESCRIPTION}`,
                    inputSchema: zodToJsonSchema(ToolHistoryArgsSchema)
                },
            ],
        };
    } catch (error) {
        console.error("Error in list_tools request handler:", error);
        throw error;
    }
});

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<ServerResult> => {
    try {
        const {name, arguments: args} = request.params;
        capture_call_tool('server_call_tool', {
            name
        });
        
        // Track tool call
        trackToolCall(name, args);

        // Using a more structured approach with dedicated handlers
        switch (name) {
            // Process Management
            case "start_process":
                return await handlers.handleStartProcess(args);

            // File Reading
            case "read_file":
                return await handlers.handleReadFile(args);

            // File Writing
            case "write_file":
                return await handlers.handleWriteFile(args);

            // Code Editing
            case "edit_block":
                return await handlers.handleEditBlock(args);

            // Code Search
            case "search_code":
                return await handlers.handleSearchCode(args);

            // File System Operations
            case "list_directory":
                return await handlers.handleListDirectory(args);

            case "search_files":
                return await handlers.handleSearchFiles(args);

            case "tool_history":
                return await handlers.handleToolHistory(args);

            default:
                return {
                    content: [{type: "text", text: `Unknown tool: ${name}`}],
                    isError: true,
                };
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            content: [{type: "text", text: `Error calling tool ${request.params.name}: ${errorMessage}`}],
            isError: true,
        };
    }
});

export default server;
