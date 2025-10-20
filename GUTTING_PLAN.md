# Gutting Plan for server.ts

## Current State
- ~600 lines
- 20+ tools defined
- Complex imports

## Target State  
- ~300 lines
- 7 tools only
- Clean imports
- System info in tool descriptions

## Strategy
1. Keep everything before ListToolsRequestSchema handler (lines 1-58)
2. Replace entire tools array (lines 59-560) with 7 streamlined tools + system info
3. Keep everything after (CallToolRequestSchema handler onwards)

## The 7 Tools to Keep
1. start_process
2. read_file
3. write_file
4. edit_block  
5. search_code
6. list_directory
7. search_files

## Next Steps
1. ✅ Update imports (done)
2. ✅ Update server name (done)
3. ⏳ Rewrite ListToolsRequestSchema handler with 7 tools + system info
4. ⏳ Update CallToolRequestSchema handler to only handle 7 tools
5. ⏳ Test build
