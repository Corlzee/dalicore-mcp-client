/**
 * Get helpful alternative suggestions for blocked commands
 * Teaches Claude to use the right tools instead of just blocking
 */
export function getBlockedCommandHelp(command: string): string {
    const baseCommand = command.trim().split(' ')[0].toLowerCase();
    const fullCommand = command.trim();
    
    // Extract what the user was trying to do
    const isSedRead = fullCommand.includes(' -n ') || fullCommand.includes('sed -n');
    const isSedEdit = fullCommand.includes(' -i') || fullCommand.includes('s/');
    const isAwkLineRange = /awk.*NR/.test(fullCommand);
    
    switch (baseCommand) {
        case 'sed':
            if (isSedRead) {
                return `🚫 SED COMMAND BLOCKED

You tried: ${command}

**Why blocked:** sed is blocked to prevent accidental file corruption.

**What to use instead:**

For extracting line ranges:
  ✅ read_file(path, { offset: START_LINE, length: NUM_LINES })
  
  Example: To get lines 100-200:
  read_file("/path/file.txt", { offset: 100, length: 101 })

For viewing end of file:
  ✅ read_file(path, { offset: -20 })  // Last 20 lines
  
For quick previews:
  ✅ start_process("head -50 /path/file.txt")
  ✅ start_process("tail -50 /path/file.txt")

For building new files from pieces:
  ✅ start_process("head -100 /path/file.txt > /path/newfile.txt")
  ✅ start_process("tail -50 /path/file.txt >> /path/newfile.txt")
  
  This lets you copy specific line ranges without sed!

**You already have these tools - use them!**`;
            } else if (isSedEdit) {
                return `🚫 SED COMMAND BLOCKED

You tried: ${command}

**Why blocked:** sed -i edits files in-place and is dangerous.

**What to use instead:**

For surgical code edits:
  ✅ edit_block(file_path, old_string, new_string)
  
  Example:
  edit_block(
    "/path/file.txt",
    "const x = 10;",
    "const x = 20;"
  )

For finding patterns first:
  ✅ search_code("/path", "pattern") 
  Then use edit_block to replace

For global replacements:
  1. search_code to find all occurrences
  2. edit_block with expected_replacements parameter
  
**edit_block has fuzzy matching and shows diffs - much safer!**`;
            } else {
                return `🚫 SED COMMAND BLOCKED

You tried: ${command}

**Why blocked:** sed is blocked to prevent accidental file corruption.

**What to use instead:**
- For reading: read_file with offset/length
- For editing: edit_block for surgical changes
- For searching: search_code to find patterns

Run 'get_config' to see full list of blocked commands.`;
            }
            
        case 'awk':
            if (isAwkLineRange) {
                return `🚫 AWK COMMAND BLOCKED

You tried: ${command}

**Why blocked:** awk is blocked to prevent complex text processing errors.

**What to use instead:**

For extracting line ranges:
  ✅ read_file(path, { offset: START_LINE, length: NUM_LINES })

For data processing:
  ✅ Write a Python/Node script and run with start_process
  
  Example:
  write_file("/tmp/process.py", "import sys\\nfor line in sys.stdin: print(line.upper())")
  start_process("cat file.txt | python3 /tmp/process.py")

**Use the tools you have!**`;
            } else {
                return `🚫 AWK COMMAND BLOCKED

You tried: ${command}

**Why blocked:** awk is blocked to prevent complex text processing errors.

**Alternatives:**
- For reading: read_file with offset/length
- For data processing: Write Python/Node scripts
- For pattern matching: search_code

**Tip:** For complex data work, write a script and run it!`;
            }
            
        case 'rm':
            return `🚫 RM COMMAND BLOCKED

You tried: ${command}

**Why blocked:** rm is EXTREMELY dangerous and blocked by default.

**What to use instead:**

For removing files safely:
  ⚠️ Ask the user first: "Should I delete /path/file.txt?"
  ⚠️ If they approve, they can run it manually

For cleaning build artifacts:
  ✅ start_process("git clean -fdx")  // If in git repo
  
**NEVER try to delete files without explicit user approval!**`;
            
        case 'mv':
            return `🚫 MV COMMAND BLOCKED

You tried: ${command}

**Why blocked:** mv can overwrite files and is blocked by default.

**What to do:**
  ⚠️ Ask the user: "Should I move X to Y?"
  ⚠️ If they approve, they can run it manually

**Tip:** For renaming in git repos, suggest 'git mv' which is safer.`;
            
        case 'chmod':
        case 'chown':
            return `🚫 ${baseCommand.toUpperCase()} COMMAND BLOCKED

You tried: ${command}

**Why blocked:** Permission changes can break system security.

**What to do:**
  ⚠️ Tell the user: "You need to run: ${command}"
  ⚠️ They can execute it manually if needed

**Never modify permissions without explicit approval!**`;
            
        default:
            return `🚫 COMMAND BLOCKED: ${baseCommand}

You tried: ${command}

**Why blocked:** This command is in the blocked list.

**What to do:**
1. Check if there's a safer alternative tool
2. Ask the user if they want to run it manually
3. Use 'get_config' to see all blocked commands

**Available tools:** read_file, write_file, edit_block, search_code, start_process, list_directory, search_files`;
    }
}
