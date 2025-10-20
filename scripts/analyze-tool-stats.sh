#!/bin/bash
# Analyze tool call statistics from Commander-Keen log

LOG_FILE="$HOME/.claude-server-commander/claude_tool_call.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: $LOG_FILE"
    exit 1
fi

echo "==================================================================="
echo "Commander-Keen Tool Call Statistics"
echo "==================================================================="
echo ""
echo "Log file: $LOG_FILE"
echo "Total tool calls: $(wc -l < "$LOG_FILE")"
echo ""
echo "==================================================================="
echo "Tool Usage Breakdown (sorted by frequency):"
echo "==================================================================="
echo ""

# Extract tool names (column 2, after first |), trim whitespace, count occurrences
cat "$LOG_FILE" | cut -d'|' -f2 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort | uniq -c | sort -rn | head -30

echo ""
echo "==================================================================="
echo "Recent activity (last 20 calls):"
echo "==================================================================="
echo ""
tail -20 "$LOG_FILE"
