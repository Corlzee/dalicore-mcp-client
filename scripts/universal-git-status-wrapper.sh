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
    
    # Auto-start Cortex if not running (for dalicore project only)
    if [[ "$CWD" == *"dalicore"* ]] && [ "$CORTEX_CHECK" = "✓ Cortex" ]; then
        # Check if Cortex DB is running on 9009
        if ! echo "$SURREAL_DETAILS" | grep -q "cortex:9009"; then
            # Try to start Cortex SurrealDB silently
            if [ -f "/home/konverts/projects/cortex/cortex_no_voice.sh" ]; then
                # Start in background, suppress all output
                (cd /home/konverts/projects/cortex && nohup ./cortex_no_voice.sh >/dev/null 2>&1 &) >/dev/null 2>&1
                
                # Wait a bit for it to start
                sleep 3
                
                # Re-check SurrealDB instances
                SURREAL_DETAILS=$(ps aux | grep -E "[s]urreal start" | while read line; do
                    PORT=$(echo "$line" | grep -oE ":(8[0-9]{3}|9[0-9]{3})" | tr -d ':')
                    
                    if echo "$line" | grep -q "dalicore.db"; then
                        echo "dalicore:$PORT"
                    elif echo "$line" | grep -q "testing.db"; then
                        echo "testing:$PORT"
                    elif echo "$line" | grep -q "peppal.db"; then
                        echo "peppal:$PORT"
                    elif echo "$line" | grep -q "cortex.db"; then
                        echo "cortex:$PORT"
                    else
                        DB_NAME=$(echo "$line" | grep -oE "file://[^ ]+|rocksdb://[^ ]+" | sed 's/.*\///' | sed 's/\.db$//')
                        if [ -n "$DB_NAME" ]; then
                            echo "$DB_NAME:$PORT"
                        else
                            echo "unknown:$PORT"
                        fi
                    fi
                done | tr '\n' ', ' | sed 's/,$//')
                
                # Update the check to show new status
                if [ -n "$SURREAL_DETAILS" ]; then
                    SURREAL_CHECK="✓ SurrealDB ($SURREAL_DETAILS)"
                fi
            fi
        fi
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
    
    # Cortex session management for clean working tree
    SESSION_STATUS=""
    # Re-check after potential auto-start
    CORTEX_DB_RUNNING=$(echo "$SURREAL_DETAILS" | grep -q "cortex:9009" && echo "true" || echo "false")
    
    if [ "$CORTEX_DB_RUNNING" = "true" ] && command -v cortex > /dev/null 2>&1; then
        # Check if working tree is clean (we'll check this properly later)
        if [ -z "$(cd "$CWD" && git status --porcelain 2>/dev/null)" ]; then
            # Clean working tree - manage Cortex session
            CURRENT_SESSION=$(cat ~/.config/cortex/current_session.txt 2>/dev/null || echo "")
            
            if [ -z "$CURRENT_SESSION" ]; then
                # Start new session
                NEW_SESSION=$(cortex session start 2>/dev/null | grep -oE "session:[a-z0-9]+")
                if [ -n "$NEW_SESSION" ]; then
                    mkdir -p ~/.config/cortex
                    echo "$NEW_SESSION" > ~/.config/cortex/current_session.txt
                    export CORTEX_SESSION="$NEW_SESSION"
                    SESSION_STATUS="📍 New Cortex session: $NEW_SESSION"
                fi
            else
                # Validate existing session is still active
                if cortex history --hours 0.1 >/dev/null 2>&1; then
                    SESSION_STATUS="📍 Active Cortex session: $CURRENT_SESSION"
                else
                    # Session might be stale, create new one
                    NEW_SESSION=$(cortex session start 2>/dev/null | grep -oE "session:[a-z0-9]+")
                    if [ -n "$NEW_SESSION" ]; then
                        echo "$NEW_SESSION" > ~/.config/cortex/current_session.txt
                        export CORTEX_SESSION="$NEW_SESSION"
                        SESSION_STATUS="📍 New Cortex session: $NEW_SESSION (replaced stale)"
                    fi
                fi
            fi
        fi
    fi
    
    # Render the constitution with substitutions
    cat "$CONSTITUTION_FILE" | \
        sed "s|{{CURRENT_TIME}}|$(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')|g" | \
        sed "s|{{LAST_COMMIT}}|$LAST_COMMIT|g" | \
        sed "s|{{LAST_TOUCHED}}|$LAST_TOUCHED|g" | \
        sed "s|{{LAST_EDITED_FILE}}|${LAST_EDITED_FILE:-none}|g" | \
        sed "s|{{LAST_EDITED_TIME}}|${LAST_EDITED_TIME:-never}|g" | \
        sed "s|{{TOOL_STATUS}}|$TOOL_STATUS|g"
    
    # Show session status if available
    if [ -n "$SESSION_STATUS" ]; then
        echo ""
        echo "$SESSION_STATUS"
    fi
    
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
else
    # Repository is clean - still show task router for dalicore
    if [[ "$CWD" == *"dalicore"* ]]; then
        TASK_ROUTER="$CWD/ai-routing/engineering-playbook/1_Developer_Task_Router.md"
        if [ -f "$TASK_ROUTER" ]; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "✓ Working tree clean"
            echo ""
            echo "TASK ROUTER:"
            echo "→ To load: cat $TASK_ROUTER"
            echo "→ Or say: 'the way' to follow constitutional SOPs"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        fi
    fi
fi