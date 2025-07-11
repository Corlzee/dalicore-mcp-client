#!/bin/bash
# Universal git status wrapper with constitutional injection

CWD="$1"
ORIGINAL_CMD="$2"

# Check if in a git repo
if ! git -C "$CWD" rev-parse --git-dir > /dev/null 2>&1; then
    # Not a git repo, just run the command
    eval "$ORIGINAL_CMD"
    exit 0
fi

# Always show current time first
echo "Current Time: $(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')"
echo ""

# Get git timestamps
LAST_COMMIT=$(cd "$CWD" && git log -1 --format="%ar" 2>/dev/null || echo "never")

# Get file timestamps
LAST_TOUCHED=$(cd "$CWD" && find . -type f ! -path "./.git/*" -mmin -43200 -printf '%TY-%Tm-%Td %TH:%TM\n' 2>/dev/null | sort -r | head -1 || echo "unknown")
LAST_EDITED_INFO=$(cd "$CWD" && git log -1 --format="%ar|||" --name-only 2>/dev/null | tr '\n' ' ')
LAST_EDITED_TIME=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f1)
LAST_EDITED_FILE=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f4 | awk '{print $1}')

# Look for CONSTITUTION-CIL.md
CONSTITUTION_FILE="$CWD/CONSTITUTION-CIL.md"
if [ -f "$CONSTITUTION_FILE" ]; then
    # Universal tool checks (< 500ms total)
    TOOL_STATUS=""
    
    # Check 1: Memory System
    CORTEX_CHECK=$(command -v cortex > /dev/null && echo '✓ Cortex' || echo '✗ Cortex')
    
    # Check 2: SurrealDB instances (with ports)
    SURREAL_INSTANCES=$(ps aux | grep -E "[s]urrealdb.*start" | grep -oE ":(8[0-9]{3}|9[0-9]{3})" | sort -u | tr '\n' ' ')
    if [ -n "$SURREAL_INSTANCES" ]; then
        SURREAL_CHECK="✓ SurrealDB$SURREAL_INSTANCES"
    else
        SURREAL_CHECK="✗ SurrealDB"
    fi
    
    # Check 3: Development Runtimes
    RUST_CHECK=$(command -v cargo > /dev/null && echo '✓ Rust' || echo '✗ Rust')
    NODE_CHECK=$(command -v node > /dev/null && echo '✓ Node' || echo '✗ Node')
    PYTHON_CHECK=$(command -v python3 > /dev/null && echo '✓ Python' || echo '✗ Python')
    
    # Check 4: Development Tools
    RIPGREP_CHECK=$(command -v rg > /dev/null && echo '✓ ripgrep' || echo '✗ ripgrep')
    
    # Format output - minimal
    TOOL_STATUS="Memory: ${CORTEX_CHECK}  ${SURREAL_CHECK}\n"
    TOOL_STATUS+="Lang:   ${RUST_CHECK}  ${NODE_CHECK}  ${PYTHON_CHECK}\n"
    TOOL_STATUS+="Tools:  ${RIPGREP_CHECK}"
    
    # Render the constitution with substitutions
    cat "$CONSTITUTION_FILE" | \
        sed "s|{{CURRENT_TIME}}|$(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')|g" | \
        sed "s|{{LAST_COMMIT}}|$LAST_COMMIT|g" | \
        sed "s|{{LAST_TOUCHED}}|$LAST_TOUCHED|g" | \
        sed "s|{{LAST_EDITED_FILE}}|${LAST_EDITED_FILE:-none}|g" | \
        sed "s|{{LAST_EDITED_TIME}}|${LAST_EDITED_TIME:-never}|g" | \
        sed "s|{{TOOL_STATUS}}|$TOOL_STATUS|g"
    
    echo ""
else
    # No constitution file, just show basic timestamps
    echo "Last Commit: $LAST_COMMIT"
    echo "Last File Touch: ${LAST_TOUCHED:-unknown}"
    echo "Last Edit: ${LAST_EDITED_FILE:-none} (${LAST_EDITED_TIME:-never})"
    echo ""
fi

# Run actual git status
eval "$ORIGINAL_CMD"

# Check if repository is dirty (has uncommitted changes)
cd "$CWD"
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Repository has uncommitted changes."
    echo ""
    
    # Auto-inject context for dalicore without prompting
    if [[ "$CWD" == *"dalicore"* ]]; then
        # Show git diff summary first
        echo "UNCOMMITTED CHANGES:"
        git diff --stat
        echo ""
        
        # Load task router if available
        TASK_ROUTER="$CWD/ai-routing/engineering-playbook/1_Developer_Task_Router.md"
        if [ -f "$TASK_ROUTER" ]; then
            echo "TASK ROUTER AVAILABLE:"
            echo "→ To load: cat $TASK_ROUTER"
            echo "→ Or say: 'the way' to follow constitutional SOPs"
        fi
    else
        # For non-dalicore projects, just show diff summary
        echo "UNCOMMITTED CHANGES:"
        git diff --stat
    fi
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi