# ClaudeComputerCommander - Exploration of Antropic Model Context Protocol

This repo is for YouTube strem of exploring and hacking Claude MCPs: https://youtube.com/live/TlbjFDbl5Us?feature=share

## Plan
- [ ] What is Model Context Protocol?
     1. a new standard for connecting AI assistants to the systems where data lives
      
- [ ] How it differes from OpenAI CustomGPTs actions?
     1. Local MCP server support in the Claude Desktop apps (ChatGPT can't connect to local ones, only globally hosted ones)
     2. There seem to be more adoption of making such servers
     3. setup on first try is a bit confusing
     4. you need to create file for config claude_desktop_config.json if its not there
     5. OpenAI uses OpenAPI schema to define HTTPS calls, MCP defines tool calls
     6. It seems like Claude Desktop can't work with servers on internet
     7. It is not as straightforward to run for now
        

- [ ] Test reference servers
     1. tested https://github.com/modelcontextprotocol/servers
     2. Made it write new terminal server

- [ ] Create MCP server that give Claude Terminal Access and test similar to ChatGPT Server Commander
     1. we tried but Claude is not picking up our server and its hard to figure out what is wrong
     2. If you have issues with your MCP you can find logs in (~/Library/Logs/Claude/), there will be logs for individual MCPs and overall MCP log
     3. Turns out you do not need to run server, what you put in to ~/Library/Application Support/Claude/claude_desktop_config.json is command that Claude runs to start MCP itself
     4. Most examples use npx @modelcontextprotocol/server-filesystem style example, which would not work for your MCP as yours is not published on nom like that yet 
      

