import { z } from "zod";

// ============================================================================
// DALICORE MCP CLIENT - 7 ESSENTIAL TOOLS
// ============================================================================
// Streamlined tool schemas based on actual usage data:
// - start_process: 34.4% of usage
// - read_file: 29.2% of usage
// - edit_block: 17.0% of usage
// - search_code: 11.2% of usage
// - write_file: 2.2% of usage
// - list_directory: 2.5% of usage
// - search_files: 1.2% of usage
// Total coverage: 97.5% of actual tool usage
// ============================================================================

// Process Management
export const StartProcessArgsSchema = z.object({
  command: z.string(),
  timeout_ms: z.number(),
  shell: z.string().optional(),
});

// File Reading
export const ReadFileArgsSchema = z.object({
  path: z.string(),
  isUrl: z.boolean().optional().default(false),
  offset: z.number().optional().default(0),
  length: z.number().optional().default(1000),
});

// File Writing
export const WriteFileArgsSchema = z.object({
  path: z.string(),
  content: z.string(),
  mode: z.enum(['rewrite', 'append']).default('rewrite'),
});

// File System Operations
export const ListDirectoryArgsSchema = z.object({
  path: z.string(),
});

export const SearchFilesArgsSchema = z.object({
  path: z.string(),
  pattern: z.string(),
  timeoutMs: z.number().optional(),
});

// Code Search
export const SearchCodeArgsSchema = z.object({
  path: z.string(),
  pattern: z.string(),
  filePattern: z.string().optional(),
  ignoreCase: z.boolean().optional(),
  maxResults: z.number().optional(),
  includeHidden: z.boolean().optional(),
  contextLines: z.number().optional(),
  timeoutMs: z.number().optional(),
});

// Code Editing
// Accept both old_string/new_string (correct) and old_str/new_str (what Claude's prompt claims)
export const EditBlockArgsSchema = z.preprocess(
  (args: any) => {
    // Normalize abbreviated parameter names to full names
    if (args && typeof args === 'object') {
      const normalized = { ...args };
      if ('old_str' in args && !('old_string' in args)) {
        normalized.old_string = args.old_str;
        delete normalized.old_str;
      }
      if ('new_str' in args && !('new_string' in args)) {
        normalized.new_string = args.new_str;
        delete normalized.new_str;
      }
      return normalized;
    }
    return args;
  },
  z.object({
    file_path: z.string(),
    old_string: z.string(),
    new_string: z.string(),
    expected_replacements: z.number().optional().default(1),
  })
);
