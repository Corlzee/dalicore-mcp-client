#!/bin/bash
# Universal git status wrapper with dynamic constitutional injection

CWD="$1"
ORIGINAL_CMD="$2"

# Check if in a git repo
if ! git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
    # Not a git repo, just run the command
    eval "$ORIGINAL_CMD"
    exit 0
fi

# Always show session context
echo "════════════════════════════════════════════════════════════════════"
echo "SESSION CONTEXT"
echo "════════════════════════════════════════════════════════════════════"
echo "• Current Time: $(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')"

# Get git timestamps
LAST_COMMIT=$(cd "$CWD" && git log -1 --format="%ar" 2>/dev/null || echo "never")
echo "• Last Commit: $LAST_COMMIT"

# Get file timestamps
LAST_TOUCHED=$(cd "$CWD" && find . -type f ! -path "./.git/*" -mmin -43200 -printf '%TY-%Tm-%Td %TH:%TM\n' 2>/dev/null | sort -r | head -1 || echo "unknown")
echo "• Last Touch: ${LAST_TOUCHED:-unknown}"

# Get last edited file info
LAST_EDITED_INFO=$(cd "$CWD" && git log -1 --format="%ar|||" --name-only 2>/dev/null | tr '\n' ' ')
LAST_EDITED_TIME=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f1)
LAST_EDITED_FILE=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f4 | awk '{print $1}')
echo "• Last Edit: ${LAST_EDITED_FILE:-none} (${LAST_EDITED_TIME:-never})"
echo ""
# Tool Status
echo "TOOL STATUS"
echo "════════════════════════════════════════════════════════════════════"

# Universal tool checks (< 500ms total)
TOOL_STATUS=""

# Check 1: Memory System
CORTEX_CHECK=$(command -v cortex > /dev/null && echo '✓ Cortex' || echo '✗ Cortex')

# Check 2: SurrealDB instances (with database identification)
SURREAL_DETAILS=$(ps aux | grep -E "[s]urreal start" | while read line; do
    PORT=$(echo "$line" | grep -oE ":(8[0-9]{3}|9[0-9]{3})" | tr -d ':')
    
    # Try to identify the database from the command
    if echo "$line" | grep -q "dalicore.db"; then
        echo "dalicore:$PORT"
    elif echo "$line" | grep -q "testing.db"; then
        echo "testing:$PORT"
    elif echo "$line" | grep -q "peppal.db"; then
        echo "peppal:$PORT"
    elif echo "$line" | grep -q "cortex.db"; then
        echo "cortex:$PORT"
    else
        # Try to extract DB name from file path or rocksdb path
        DB_NAME=$(echo "$line" | grep -oE "file://[^ ]+|rocksdb://[^ ]+" | sed 's/.*\///' | sed 's/\.db$//')
        if [ -n "$DB_NAME" ]; then
            echo "$DB_NAME:$PORT"
        else
            echo "unknown:$PORT"
        fi
    fi
done | tr '\n' ', ' | sed 's/,$//')

if [ -n "$SURREAL_DETAILS" ]; then
    SURREAL_CHECK="✓ SurrealDB ($SURREAL_DETAILS)"
else
    SURREAL_CHECK="✗ SurrealDB"
fi

# Check 3: Development Runtimes
RUST_CHECK=$(command -v cargo > /dev/null && echo '✓ Rust' || echo '✗ Rust')
NODE_CHECK=$(command -v node > /dev/null && echo '✓ Node' || echo '✗ Node')
PYTHON_CHECK=$(command -v python3 > /dev/null && echo '✓ Python' || echo '✗ Python')

# Check 4: Development Tools
RIPGREP_CHECK=$(command -v rg > /dev/null && echo '✓ ripgrep' || echo '✗ ripgrep')

# Format output for substitution
TOOL_STATUS_FORMATTED="Memory: ${CORTEX_CHECK}  ${SURREAL_CHECK}\nLang:   ${RUST_CHECK}  ${NODE_CHECK}  ${PYTHON_CHECK}\nTools:  ${RIPGREP_CHECK}"

# Display tool status
echo "Memory: ${CORTEX_CHECK}  ${SURREAL_CHECK}"
echo "Lang:   ${RUST_CHECK}  ${NODE_CHECK}  ${PYTHON_CHECK}"
echo "Tools:  ${RIPGREP_CHECK}"
echo "════════════════════════════════════════════════════════════════════"
echo ""
# Look for constitution files in order of precedence
CONSTITUTION_FILE=""
PROJECT_NAME=$(basename "$CWD")

# Check for project-specific constitution first
if [ -f "$CWD/CONSTITUTION.md" ]; then
    CONSTITUTION_FILE="$CWD/CONSTITUTION.md"
    echo "📜 LOADING PROJECT CONSTITUTION: $PROJECT_NAME"
    echo "════════════════════════════════════════════════════════════════════"
    
    # If it has placeholders, replace them
    if grep -q "{{" "$CONSTITUTION_FILE"; then
        cat "$CONSTITUTION_FILE" | \
            sed "s|{{CURRENT_TIME}}|$(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')|g" | \
            sed "s|{{LAST_COMMIT}}|$LAST_COMMIT|g" | \
            sed "s|{{LAST_TOUCHED}}|$LAST_TOUCHED|g" | \
            sed "s|{{LAST_EDITED_FILE}}|${LAST_EDITED_FILE:-none}|g" | \
            sed "s|{{LAST_EDITED_TIME}}|${LAST_EDITED_TIME:-never}|g" | \
            sed "s|{{TOOL_STATUS}}|$TOOL_STATUS_FORMATTED|g"
    else
        # No placeholders, just display it
        cat "$CONSTITUTION_FILE"
    fi
    echo ""
    echo "════════════════════════════════════════════════════════════════════"
elif [ -f "$CWD/CONSTITUTION-CIL.md" ]; then
    # Legacy support for CONSTITUTION-CIL.md
    CONSTITUTION_FILE="$CWD/CONSTITUTION-CIL.md"
    echo "📜 LOADING PROJECT CONSTITUTION (CIL): $PROJECT_NAME"
    echo "════════════════════════════════════════════════════════════════════"
    
    cat "$CONSTITUTION_FILE" | \
        sed "s|{{CURRENT_TIME}}|$(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')|g" | \
        sed "s|{{LAST_COMMIT}}|$LAST_COMMIT|g" | \
        sed "s|{{LAST_TOUCHED}}|$LAST_TOUCHED|g" | \
        sed "s|{{LAST_EDITED_FILE}}|${LAST_EDITED_FILE:-none}|g" | \
        sed "s|{{LAST_EDITED_TIME}}|${LAST_EDITED_TIME:-never}|g" | \
        sed "s|{{TOOL_STATUS}}|$TOOL_STATUS_FORMATTED|g"
    
    echo ""
    echo "════════════════════════════════════════════════════════════════════"
else
    # No constitution found, just show a generic reminder
    echo "📋 PROJECT: $PROJECT_NAME"
    echo "════════════════════════════════════════════════════════════════════"
    echo "No CONSTITUTION.md found in this project."
    echo "Consider adding one to define project philosophy and guidelines."
    echo "════════════════════════════════════════════════════════════════════"
fi

echo ""

# Run actual git status
echo "GIT STATUS"
echo "════════════════════════════════════════════════════════════════════"
eval "$ORIGINAL_CMD"
echo "════════════════════════════════════════════════════════════════════"
# Project-specific features
if [[ "$CWD" == *"dalicore"* ]]; then
    # Auto-start Cortex for dalicore if needed
    if [ "$CORTEX_CHECK" = "✓ Cortex" ] && ! echo "$SURREAL_DETAILS" | grep -q "cortex:9009"; then
        if [ -f "/home/konverts/projects/cortex/cortex_no_voice.sh" ]; then
            (cd /home/konverts/projects/cortex && nohup ./cortex_no_voice.sh >/dev/null 2>&1 &) >/dev/null 2>&1
            sleep 2
        fi
    fi
    
    # Show dalicore-specific guidance
    echo ""
    echo "💡 DALICORE QUICK ACTIONS"
    echo "════════════════════════════════════════════════════════════════════"
    
    # Check repository status
    cd "$CWD"
    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
        # Has uncommitted changes
        echo "📝 You have uncommitted changes:"
        git diff --stat | head -10
        echo ""
    fi
    
    # Show task router info
    TASK_ROUTER="$CWD/ai-routing/engineering-playbook/1_Developer_Task_Router.md"
    if [ -f "$TASK_ROUTER" ]; then
        echo "→ Say 'the way' to follow constitutional SOPs"
        echo "→ Or: cat $TASK_ROUTER"
    fi
    
    echo "→ Journal: /home/konverts/projects/dalicore/AIJOURNAL.md"
    echo "→ Architecture: /home/konverts/projects/dalicore/ARCHITECTURE.md"
    echo "════════════════════════════════════════════════════════════════════"
fi

# Cortex session management (for any project with clean working tree)
if command -v cortex > /dev/null 2>&1 && [ -z "$(cd "$CWD" && git status --porcelain 2>/dev/null)" ]; then
    # Clean working tree - check/create Cortex session
    CURRENT_SESSION=$(cat ~/.config/cortex/current_session.txt 2>/dev/null || echo "")
    
    if [ -z "$CURRENT_SESSION" ] || ! cortex history --hours 0.1 >/dev/null 2>&1; then
        # Start new session
        NEW_SESSION=$(cortex session start 2>/dev/null | grep -oE "session:[a-z0-9]+")
        if [ -n "$NEW_SESSION" ]; then
            mkdir -p ~/.config/cortex
            echo "$NEW_SESSION" > ~/.config/cortex/current_session.txt
            export CORTEX_SESSION="$NEW_SESSION"
            echo ""
            echo "📍 Started new Cortex session: $NEW_SESSION"
        fi
    fi
fi