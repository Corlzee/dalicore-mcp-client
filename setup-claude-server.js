import { homedir, platform } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine OS and set appropriate config path and command
const isWindows = platform() === 'win32';
const claudeConfigPath = isWindows
    ? join(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
    : join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');

// Check if config file exists
if (!existsSync(claudeConfigPath)) {
    console.error('Claude config file not found at:', claudeConfigPath);
    console.error('Please make sure Claude desktop app is installed and has been run at least once.');
    process.exit(1);
}

try {
    // Read existing config
    const configData = readFileSync(claudeConfigPath, 'utf8');
    const config = JSON.parse(configData);

    // Prepare the new server config based on OS
    const serverConfig = isWindows
        ? {
            "command": "cmd.exe",
            "args": [
                "/c",
                `cd /d "${__dirname}" && npm install && npm run start`
            ]
        }
        : {
            "command": "sh",
            "args": [
                "-c",
                `cd "${__dirname}" && npm install && npm run start`
            ]
        };

    // Add or update the terminal server config
    if (!config.mcpServers) {
        config.mcpServers = {};
    }
    
    config.mcpServers.terminal = serverConfig;

    // Write the updated config back
    writeFileSync(claudeConfigPath, JSON.stringify(config, null, 2), 'utf8');
    
    console.log('✅ Successfully added MCP server to Claude configuration!');
    console.log('Configuration location:', claudeConfigPath);
    console.log('\nTo use the server:');
    console.log('1. Restart Claude if it\'s currently running');
    console.log('2. The terminal server will be available in Claude\'s MCP server list');
    
} catch (error) {
    console.error('Error updating Claude configuration:', error);
    process.exit(1);
}
