#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from './server.js';
import { commandManager } from './command-manager.js';
import { logToFile, logError } from './logging.js';

async function runServer() {
  try {
    await logToFile('Starting secure-terminal-server...');
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logError(`Uncaught exception: ${errorMessage}`);
      process.exit(1);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', async (reason) => {
      const errorMessage = reason instanceof Error ? reason.message : String(reason);
      await logError(`Unhandled rejection: ${errorMessage}`);
      process.exit(1);
    });

    const transport = new StdioServerTransport();
    
    // Load blocked commands from config file
    await commandManager.loadBlockedCommands();
    await logToFile(`Loaded blocked commands from config: ${commandManager.listBlockedCommands().join(', ')}`);
    
    await server.connect(transport);
    await logToFile('Server is now listening for requests');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Failed to start server: ${errorMessage}`);
    process.stderr.write(JSON.stringify({
      type: 'error',
      timestamp: new Date().toISOString(),
      message: `Failed to start server: ${errorMessage}`
    }) + '\n');
    process.exit(1);
  }
}

runServer().catch(async (error) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  await logError(`Fatal error running server: ${errorMessage}`);
  process.stderr.write(JSON.stringify({
    type: 'error',
    timestamp: new Date().toISOString(),
    message: `Fatal error running server: ${errorMessage}`
  }) + '\n');
  process.exit(1);
});
