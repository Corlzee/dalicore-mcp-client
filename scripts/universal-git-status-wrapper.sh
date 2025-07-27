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
echo ""
echo "SESSION CONTEXT"
echo ""
echo "Current Time: $(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')"

# Get git timestamps
LAST_COMMIT=$(cd "$CWD" && git log -1 --format="%ar" 2>/dev/null || echo "never")
echo "Last Commit: $LAST_COMMIT"

# Get file timestamps
LAST_TOUCHED=$(cd "$CWD" && find . -type f ! -path "./.git/*" -mmin -43200 -printf '%TY-%Tm-%Td %TH:%TM\n' 2>/dev/null | sort -r | head -1 || echo "unknown")
echo "Last Touch: ${LAST_TOUCHED:-unknown}"

# Get last edited file info
LAST_EDITED_INFO=$(cd "$CWD" && git log -1 --format="%ar|||" --name-only 2>/dev/null | tr '\n' ' ')
LAST_EDITED_TIME=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f1)
LAST_EDITED_FILE=$(echo "$LAST_EDITED_INFO" | cut -d'|' -f4 | awk '{print $1}')
echo "Last Edit: ${LAST_EDITED_FILE:-none} (${LAST_EDITED_TIME:-never})"
echo ""

# Tool Status
echo "TOOL STATUS"
echo ""

# Universal tool checks (< 500ms total)
TOOL_STATUS=""

# Check 1: Memory System
CORTEX_CHECK=$(command -v cortex > /dev/null && echo 'OK Cortex' || echo 'NO Cortex')

# Check 2: Dalicore Services Status
SERVICE_STATUS=""
if [[ "$CWD" == *"dalicore"* ]]; then
    # Check all dalicore and alien services
    SERVICE_LIST=$(systemctl list-units --type=service --all --no-legend | grep -E "(dalicore-|alien-)" | awk '{print $1, $3}')
    
    if [ -n "$SERVICE_LIST" ]; then
        while IFS=' ' read -r service_name status; do
            # Get short name without .service
            short_name=$(echo "$service_name" | sed 's/\.service$//' | sed 's/dalicore-//' | sed 's/alien-//')
            
            case "$status" in
                active)
                    SERVICE_STATUS="$SERVICE_STATUS ✓$short_name"
                    ;;
                inactive|dead)
                    # Don't show inactive watchers
                    if [[ ! "$service_name" =~ -watcher\.service$ ]]; then
                        SERVICE_STATUS="$SERVICE_STATUS ✗$short_name"
                    fi
                    ;;
                activating)
                    SERVICE_STATUS="$SERVICE_STATUS ↻$short_name"
                    ;;
                failed)
                    SERVICE_STATUS="$SERVICE_STATUS ⚠$short_name"
                    ;;
            esac
        done <<< "$SERVICE_LIST"
        
        if [ -n "$SERVICE_STATUS" ]; then
            SERVICE_CHECK="Services:$SERVICE_STATUS"
        else
            SERVICE_CHECK="Services: all inactive"
        fi
    else
        SERVICE_CHECK="Services: none found"
    fi
else
    # Not in dalicore, check for SurrealDB processes
    SURREAL_COUNT=$(ps aux | grep -E "[s]urreal start" | wc -l)
    if [ "$SURREAL_COUNT" -gt 0 ]; then
        SERVICE_CHECK="SurrealDB: $SURREAL_COUNT instance(s) running"
    else
        SERVICE_CHECK="SurrealDB: not running"
    fi
fi

# Check 3: Development Runtimes
RUST_CHECK=$(command -v cargo > /dev/null && echo 'OK Rust' || echo 'NO Rust')
NODE_CHECK=$(command -v node > /dev/null && echo 'OK Node' || echo 'NO Node')
PYTHON_CHECK=$(command -v python3 > /dev/null && echo 'OK Python' || echo 'NO Python')

# Check 4: Development Tools
RIPGREP_CHECK=$(command -v rg > /dev/null && echo 'OK ripgrep' || echo 'NO ripgrep')

# Format output for substitution
TOOL_STATUS_FORMATTED="Memory: ${CORTEX_CHECK}\nLang:   ${RUST_CHECK}  ${NODE_CHECK}  ${PYTHON_CHECK}\nTools:  ${RIPGREP_CHECK}\n${SERVICE_CHECK}"

# Display tool status
echo "Memory: ${CORTEX_CHECK}"
echo "Lang:   ${RUST_CHECK}  ${NODE_CHECK}  ${PYTHON_CHECK}"
echo "Tools:  ${RIPGREP_CHECK}"
echo "${SERVICE_CHECK}"
echo ""

# Look for constitution files in order of precedence
CONSTITUTION_FILE=""
PROJECT_NAME=$(basename "$CWD")

# Check for project-specific constitution first
if [ -f "$CWD/CONSTITUTION.md" ]; then
    CONSTITUTION_FILE="$CWD/CONSTITUTION.md"
    echo "LOADING PROJECT CONSTITUTION: $PROJECT_NAME"
    echo ""
    
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
elif [ -f "$CWD/CONSTITUTION-CIL.md" ]; then
    # Legacy support for CONSTITUTION-CIL.md
    CONSTITUTION_FILE="$CWD/CONSTITUTION-CIL.md"
    echo "LOADING PROJECT CONSTITUTION (CIL): $PROJECT_NAME"
    echo ""
    
    cat "$CONSTITUTION_FILE" | \
        sed "s|{{CURRENT_TIME}}|$(TZ='America/New_York' date '+%A, %B %d, %Y %I:%M %p EST')|g" | \
        sed "s|{{LAST_COMMIT}}|$LAST_COMMIT|g" | \
        sed "s|{{LAST_TOUCHED}}|$LAST_TOUCHED|g" | \
        sed "s|{{LAST_EDITED_FILE}}|${LAST_EDITED_FILE:-none}|g" | \
        sed "s|{{LAST_EDITED_TIME}}|${LAST_EDITED_TIME:-never}|g" | \
        sed "s|{{TOOL_STATUS}}|$TOOL_STATUS_FORMATTED|g"
    
    echo ""
else
    # No constitution found, just show a generic reminder
    echo "PROJECT: $PROJECT_NAME"
    echo ""
    echo "No CONSTITUTION.md found in this project."
    echo "Consider adding one to define project philosophy and guidelines."
    echo ""
fi

echo ""

# Run actual git status
echo "GIT STATUS"
echo ""
eval "$ORIGINAL_CMD"
echo ""

# Project-specific features
if [[ "$CWD" == *"dalicore"* ]]; then
    # Check if cargo watch is running for dalicore
    # Look for various patterns: cargo watch, the full command, or the alias
    # Check if any dalicore watcher services are active
    WATCHER_SERVICES="dalicore-api-watcher dalicore-crm-watcher dalicore-frontend-watcher dalicore-storage-watcher"
    WATCHERS_ACTIVE=0
    
    for service in $WATCHER_SERVICES; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            WATCHERS_ACTIVE=$((WATCHERS_ACTIVE + 1))
        fi
    done
    
    # Also check for legacy cargo watch processes
    CARGO_WATCH_RUNNING=$(ps aux | grep -E "(cargo.*watch.*dalicore|cargo.*watch.*build.*release|dalicore-watch)" | grep -v grep | wc -l)
    
    if [ "$WATCHERS_ACTIVE" -eq 0 ] && [ "$CARGO_WATCH_RUNNING" -eq 0 ]; then
        echo ""
        echo "⚠️  DEVELOPMENT WATCHERS NOT RUNNING ⚠️"
        echo ""
        echo "No file watchers are active. Your services won't auto-rebuild!"
        echo ""
        echo "Start watchers with systemctl:"
        echo "  sudo systemctl start dalicore-api-watcher"
        echo "  sudo systemctl start dalicore-crm-watcher"
        echo "  sudo systemctl start dalicore-frontend-watcher"
        echo "  sudo systemctl start dalicore-storage-watcher"
        echo ""
        echo "Or start all at once:"
        echo "  sudo systemctl start dalicore-*-watcher"
        echo ""
    else
        # Show which watchers are active
        echo -n "Dev Watch: ✓ "
        if [ "$WATCHERS_ACTIVE" -gt 0 ]; then
            echo -n "$WATCHERS_ACTIVE systemd watcher(s)"
        fi
        if [ "$CARGO_WATCH_RUNNING" -gt 0 ] && [ "$WATCHERS_ACTIVE" -gt 0 ]; then
            echo -n " + "
        fi
        if [ "$CARGO_WATCH_RUNNING" -gt 0 ]; then
            echo -n "cargo watch"
        fi
        echo " active"
        echo ""
    fi
    
    # Auto-start Cortex for dalicore if needed
    if [ "$CORTEX_CHECK" = "OK Cortex" ] && ! echo "$SURREAL_DETAILS" | grep -q "cortex:9009"; then
        if [ -f "/home/konverts/projects/cortex/cortex_no_voice.sh" ]; then
            (cd /home/konverts/projects/cortex && nohup ./cortex_no_voice.sh >/dev/null 2>&1 &) >/dev/null 2>&1
            sleep 2
        fi
    fi
    
    # Show dalicore-specific guidance
    echo ""
    echo "DALICORE QUICK ACTIONS"
    echo ""
    
    # Check repository status
    cd "$CWD"
    # Check for untracked files, excluding AIJOURNAL.md
    UNTRACKED_FILES=$(git ls-files --others --exclude-standard | grep -v "^AIJOURNAL.md$")
    if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$UNTRACKED_FILES" ]; then
        # Has uncommitted changes
        echo "You have uncommitted changes:"
        git diff --stat | head -10
        echo ""
    fi
    
    # Show task router info based on git state
    # For projects in /home/konverts/projects/, use the dalicore task router
    if [[ "$CWD" == "/home/konverts/projects/"* ]]; then
        TASK_ROUTER="/home/konverts/projects/dalicore/docs/ai-routing/engineering-playbook/1_Developer_Task_Router.md"
    else
        # For other locations, look for a local task router
        TASK_ROUTER="$CWD/docs/ai-routing/engineering-playbook/1_Developer_Task_Router.md"
    fi
    if [ -f "$TASK_ROUTER" ]; then
        # Check for untracked files, excluding AIJOURNAL.md
        UNTRACKED_FILES=$(git ls-files --others --exclude-standard | grep -v "^AIJOURNAL.md$")
        if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$UNTRACKED_FILES" ]; then
            # Dirty tree - show dirty section
            echo ""
            sed -n '/<!-- DIRTY_TREE_START -->/,/<!-- DIRTY_TREE_END -->/p' "$TASK_ROUTER" | grep -v "<!--"
            echo ""
        else
            # Clean tree - show clean section
            echo ""
            sed -n '/<!-- CLEAN_TREE_START -->/,/<!-- CLEAN_TREE_END -->/p' "$TASK_ROUTER" | grep -v "<!--"
            echo ""
        fi
    fi
    
    echo "Journal: /home/konverts/projects/dalicore/AIJOURNAL.md"
    echo "Architecture: /home/konverts/projects/dalicore/ARCHITECTURE.md"
    echo ""
    
    # Run documentation verification
    echo "DOCUMENTATION VERIFICATION"
    echo ""
    
    VERIFY_SCRIPT="$CWD/scripts/verify_docs.sh"
    if [ -f "$VERIFY_SCRIPT" ] && [ -x "$VERIFY_SCRIPT" ]; then
        # Run verification and capture output
        VERIFY_OUTPUT=$("$VERIFY_SCRIPT" 2>&1)
        
        # Check if there are any issues (looking for red X marks)
        if echo "$VERIFY_OUTPUT" | grep -q "\[0;31m✗\|Found [0-9]* issues"; then
            # Issues found - show summary
            echo "Documentation issues detected!"
            echo ""
            # Extract just the failures
            echo "$VERIFY_OUTPUT" | grep "\[0;31m✗" | sed 's/\[0;31m//' | sed 's/\[0m//'
            echo ""
            # Get the summary line
            echo "$VERIFY_OUTPUT" | grep "Found [0-9]* issues" | sed 's/\[0;31m//' | sed 's/\[0m//'
        else
            # All good
            echo "All documentation verified - no drift detected!"
        fi
    else
        echo "Verification script not found or not executable"
    fi
    echo ""
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
            echo "Started new Cortex session: $NEW_SESSION"
        fi
    fi
fi