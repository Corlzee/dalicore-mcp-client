import os from 'os';
import path from 'path';
import { configManager } from '../config-manager.js';

/**
 * Generate system information header for tool descriptions
 * This is sent to the LLM via MCP protocol automatically
 */
export async function getSystemInfoHeader(): Promise<string> {
    const config = await configManager.getConfig();
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const isMac = platform === 'darwin';
    const isLinux = platform === 'linux';
    
    // Get platform-specific name
    let platformName = 'Unknown';
    if (isWindows) platformName = 'Windows';
    else if (isMac) platformName = 'macOS';
    else if (isLinux) platformName = 'Linux';
    
    // Get shell info
    const defaultShell = config.defaultShell || (isWindows ? 'cmd' : 'bash');
    
    // Get default working directory
    const defaultWorkingDir = config.defaultWorkingDirectory || path.join(os.homedir(), 'projects');
    
    // Get directory restrictions
    const allowedDirs = config.allowedDirectories && config.allowedDirectories.length > 0
        ? config.allowedDirectories.join(', ')
        : 'All directories';
    
    return `
═══════════════════════════════════════════════════════════
                    SYSTEM INFORMATION
═══════════════════════════════════════════════════════════
OS: ${platformName} (${platform})
Architecture: ${os.arch()}
Default Shell: ${defaultShell}
Default Working Directory: ${defaultWorkingDir}
Home Directory: ${os.homedir()}
Path Separator: ${path.sep}
Case Sensitive Filesystem: ${!isWindows}
Allowed Directories: ${allowedDirs}
═══════════════════════════════════════════════════════════

IMPORTANT - Use OS-appropriate commands:
${isWindows ? 
`• Windows Commands: dir, mkdir, move, del, type, copy
• Path format: C:\\Users\\... (backslashes)
• Line endings: CRLF (\\r\\n)` :
`• Unix Commands: ls, mkdir -p, mv, rm, cat, cp
• Path format: /home/... (forward slashes)
• Line endings: LF (\\n)`
}

CRITICAL PATH RULES:
• Always use ABSOLUTE paths (start with '/' or 'C:\\')
• Relative paths like './dalicore' or 'src/main.rs' resolve relative to: ${defaultWorkingDir}
• Tilde paths (~/) are expanded to: ${os.homedir()}
• Unless explicitly requested, use absolute paths for clarity

═══════════════════════════════════════════════════════════
`;
}

/**
 * Get a shorter system info string for inline use
 */
export async function getSystemInfoShort(): Promise<string> {
    const config = await configManager.getConfig();
    const platform = os.platform();
    const isWindows = platform === 'win32';
    const shell = config.defaultShell || (isWindows ? 'cmd' : 'bash');
    
    return `Running on ${platform} with ${shell} shell. ${isWindows ? 'Use Windows commands (dir, move, etc.)' : 'Use Unix commands (ls, mv, etc.)'}`;
}
