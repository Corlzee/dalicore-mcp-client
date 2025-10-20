#!/bin/bash
# Analyze interact_with_process and read_process_output usage

LOG_FILE="$HOME/.claude-server-commander/claude_tool_call.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: $LOG_FILE"
    exit 1
fi

echo "==================================================================="
echo "Interactive Process Tool Usage Analysis"
echo "==================================================================="
echo ""

# Get counts
INTERACT_COUNT=$(grep -c "interact_with_process" "$LOG_FILE")
READ_OUTPUT_COUNT=$(grep -c "read_process_output" "$LOG_FILE")

echo "interact_with_process: $INTERACT_COUNT calls"
echo "read_process_output: $READ_OUTPUT_COUNT calls"
echo "Total interactive calls: $((INTERACT_COUNT + READ_OUTPUT_COUNT))"
echo ""

echo "==================================================================="
echo "interact_with_process Usage (all $INTERACT_COUNT calls):"
echo "==================================================================="
echo ""

grep "interact_with_process" "$LOG_FILE" | while IFS='|' read -r timestamp tool args; do
    # Extract just the input field from JSON if possible
    input=$(echo "$args" | grep -o '"input":"[^"]*"' | cut -d'"' -f4)
    pid=$(echo "$args" | grep -o '"pid":[0-9]*' | cut -d':' -f2)
    
    echo "-------------------------------------------------------------------"
    echo "Time: $(echo $timestamp | xargs)"
    echo "PID: $pid"
    if [ -n "$input" ]; then
        echo "Input: $input"
    else
        # If input extraction failed, show full args
        echo "Args: $(echo $args | xargs)"
    fi
    echo ""
done

echo ""
echo "==================================================================="
echo "read_process_output Usage (all $READ_OUTPUT_COUNT calls):"
echo "==================================================================="
echo ""

grep "read_process_output" "$LOG_FILE" | while IFS='|' read -r timestamp tool args; do
    pid=$(echo "$args" | grep -o '"pid":[0-9]*' | cut -d':' -f2)
    timeout=$(echo "$args" | grep -o '"timeout_ms":[0-9]*' | cut -d':' -f2)
    
    echo "-------------------------------------------------------------------"
    echo "Time: $(echo $timestamp | xargs)"
    echo "PID: $pid"
    echo "Timeout: ${timeout:-default} ms"
    echo ""
done

echo ""
echo "==================================================================="
echo "PID Patterns Analysis:"
echo "==================================================================="
echo ""

echo "PIDs used with interact_with_process:"
grep "interact_with_process" "$LOG_FILE" | grep -o '"pid":[0-9]*' | cut -d':' -f2 | sort | uniq -c | sort -rn

echo ""
echo "PIDs used with read_process_output:"
grep "read_process_output" "$LOG_FILE" | grep -o '"pid":[0-9]*' | cut -d':' -f2 | sort | uniq -c | sort -rn

echo ""
echo "==================================================================="
echo "Summary of Input Commands (from interact_with_process):"
echo "==================================================================="
echo ""

grep "interact_with_process" "$LOG_FILE" | grep -o '"input":"[^"]*"' | cut -d'"' -f4 | sort | uniq -c | sort -rn | head -20
