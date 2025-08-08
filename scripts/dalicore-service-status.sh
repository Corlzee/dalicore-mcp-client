#!/bin/bash
# Enhanced Dalicore service status injection for git status wrapper
# This file gets sourced by universal-git-status-wrapper.sh for dalicore projects

# Function to get service port information
get_service_port() {
    local service=$1
    case "$service" in
        dalicore-db) echo "8000" ;;
        dalicore-test-db) echo "8001" ;;
        dalicore-api) echo "3000" ;;
        dalicore-crm) echo "8083" ;;
        dalicore-llm) echo "8084" ;;
        dalicore-storage) echo "8081" ;;
        dalicore-frontend) echo "5174" ;;
        surreal-alien@*) 
            # Try to get port from running process
            local pid=$(systemctl show "$service.service" -p MainPID --value 2>/dev/null)
            if [ -n "$pid" ] && [ "$pid" != "0" ]; then
                local port=$(ss -tlnp 2>/dev/null | grep "pid=$pid" | grep -oE ':([0-9]+)\s' | grep -oE '[0-9]+' | head -1)
                echo "${port:-????}"
            else
                echo "----"
            fi
            ;;
        founder-*-frontend)
            # Extract port from service definition
            local port=$(systemctl cat "$service.service" 2>/dev/null | grep "PORT=" | cut -d'=' -f2 | tr -d '"')
            echo "${port:-????}"
            ;;
        *) echo "????" ;;
    esac
}

# Function to check if database schema has been modified
get_db_schema_status() {
    local service=$1
    local port=""
    local ns=""
    local db=""
    
    case "$service" in
        dalicore-db)
            port=8000
            ns="dalicore"
            db="dalicore"
            ;;
        dalicore-test-db)
            port=8001
            ns="test"
            db="test"
            ;;
        *)
            echo "-"
            return
            ;;
    esac
    
    # For dalicore-db, export current schema and compare with migration file
    if [ "$service" = "dalicore-db" ]; then
        # Check if schema is consolidated
        local schema_file_count=0
        if [ -d "/home/konverts/projects/dalicore/schemas/core" ]; then
            schema_file_count=$(find /home/konverts/projects/dalicore/schemas/core -name "*.surql" -type f 2>/dev/null | wc -l)
        fi
        
        if [ "$schema_file_count" -gt 1 ]; then
            echo "MULTI"
            return
        elif [ "$schema_file_count" -eq 0 ]; then
            echo "NONE"
            return
        fi
        
        # Export current database schema to temp file
        local temp_export="/tmp/dalicore_db_export_$$.surql"
        surreal export --conn http://127.0.0.1:$port --user root --pass root --ns $ns --db $db 2>/dev/null > "$temp_export"
        
        if [ ! -s "$temp_export" ]; then
            rm -f "$temp_export"
            echo "ERR"
            return
        fi
        
        # Compare line counts as a simple check
        local export_lines=$(wc -l < "$temp_export")
        local migration_lines=$(wc -l < "/home/konverts/projects/dalicore/schemas/core/dalicore.surql" 2>/dev/null || echo 0)
        
        rm -f "$temp_export"
        
        # If line counts are within 25% of each other, consider them synced
        local diff=$((export_lines - migration_lines))
        if [ $diff -lt 0 ]; then
            diff=$((-diff))
        fi
        
        local threshold=$((migration_lines / 4))  # 25% threshold
        if [ $threshold -lt 50 ]; then
            threshold=50  # Minimum threshold of 50 lines
        fi
        
        if [ $diff -le $threshold ]; then
            echo "SYNC"
        else
            echo "DRIFT"
        fi
    else
        # For test-db, just show it exists
        echo "OK"
    fi
}

# Function to check for schema drift
check_schema_drift() {
    local service=$1
    local status=$2
    
    if [ "$service" != "dalicore-db" ]; then
        return 0
    fi
    
    if [ "$status" = "DRIFT" ] || [ "$status" = "MULTI" ] || [ "$status" = "NONE" ]; then
        echo "!"
        return 1
    fi
    
    echo ""
    return 0
}

# Function to get the actual running binary's age (or last edit for frontends/databases)
get_running_binary_age() {
    local service=$1
    
    # Special handling for database services - show schema status
    if [[ "$service" == "dalicore-db" ]] || [[ "$service" == "dalicore-test-db" ]]; then
        get_db_schema_status "$service"
        return
    fi
    
    # Special handling for frontend services - show last edit time
    if [[ "$service" == *"frontend"* ]]; then
        local frontend_dir=""
        case "$service" in
            dalicore-frontend)
                frontend_dir="/home/konverts/projects/dalicore/frontend"
                ;;
            founder-*-frontend)
                # Extract founder name and find the directory
                local founder_name=$(echo "$service" | sed 's/founder-//' | sed 's/-frontend//')
                frontend_dir="/home/konverts/projects/founders/$founder_name/frontend"
                ;;
        esac
        
        if [ -n "$frontend_dir" ] && [ -d "$frontend_dir" ]; then
            # Find the most recently modified file in src directory
            local last_mod=$(find "$frontend_dir/src" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.svelte" -o -name "*.css" \) -printf '%T@\n' 2>/dev/null | sort -rn | head -1)
            
            if [ -n "$last_mod" ]; then
                local current_time=$(date +%s)
                local age_seconds=$(echo "$current_time - $last_mod" | bc | cut -d. -f1)
                
                if [ $age_seconds -lt 60 ]; then
                    echo "${age_seconds}s"
                elif [ $age_seconds -lt 3600 ]; then
                    echo "$((age_seconds / 60))m"
                elif [ $age_seconds -lt 86400 ]; then
                    echo "$((age_seconds / 3600))h"
                else
                    echo "$((age_seconds / 86400))d"
                fi
                return
            fi
        fi
        echo "-"
        return
    fi
    
    # For non-frontend services, check the actual running binary
    local pid=$(systemctl show "$service.service" -p MainPID --value 2>/dev/null)
    
    if [ -z "$pid" ] || [ "$pid" = "0" ]; then
        echo "-"
        return
    fi
    
    # Get the actual binary path from the running process
    local binary_path=$(readlink -f /proc/$pid/exe 2>/dev/null)
    
    if [ -z "$binary_path" ] || [ ! -f "$binary_path" ]; then
        # Fallback: try to get from systemctl show
        binary_path=$(systemctl show "$service.service" -p ExecMainStartPre -p ExecStart 2>/dev/null | grep -oE '/[^ ]+/(dalicore-api|crm-service|dalicore-llm|dalicore-storage-service)' | head -1)
        
        if [ -z "$binary_path" ] || [ ! -f "$binary_path" ]; then
            echo "-"
            return
        fi
    fi
    
    # Get the modification time of the actual running binary
    local mod_time=$(stat -c %Y "$binary_path" 2>/dev/null)
    
    if [ -z "$mod_time" ]; then
        echo "-"
        return
    fi
    
    local current_time=$(date +%s)
    local age_seconds=$((current_time - mod_time))
    
    if [ $age_seconds -lt 60 ]; then
        echo "${age_seconds}s"
    elif [ $age_seconds -lt 3600 ]; then
        echo "$((age_seconds / 60))m"
    elif [ $age_seconds -lt 86400 ]; then
        echo "$((age_seconds / 3600))h"
    else
        echo "$((age_seconds / 86400))d"
    fi
}

# Function to check if built binary differs from running binary
check_binary_mismatch() {
    local service=$1
    local age=$2
    
    # Check for schema drift on database services
    if [ "$service" = "dalicore-db" ]; then
        check_schema_drift "$service" "$age"
        return
    fi
    
    local expected_path=""
    
    case "$service" in
        dalicore-api)
            expected_path="/home/konverts/projects/dalicore/target/release/dalicore-api"
            ;;
        dalicore-crm)
            expected_path="/home/konverts/projects/dalicore-crm/target/release/crm-service"
            ;;
        dalicore-llm)
            expected_path="/home/konverts/projects/dalicore-llm/target/release/dalicore-llm"
            ;;
        dalicore-storage)
            expected_path="/home/konverts/projects/dalicore-storage-service/target/release/dalicore-storage-service"
            ;;
        *)
            return 0
            ;;
    esac
    
    if [ ! -f "$expected_path" ]; then
        return 0
    fi
    
    # Get the PID of the running service
    local pid=$(systemctl show "$service.service" -p MainPID --value 2>/dev/null)
    
    if [ -z "$pid" ] || [ "$pid" = "0" ]; then
        return 0
    fi
    
    # Get the actual binary path from the running process
    local running_path=$(readlink -f /proc/$pid/exe 2>/dev/null)
    
    if [ -z "$running_path" ]; then
        return 0
    fi
    
    # Compare the running binary with the built binary
    if [ "$running_path" != "$expected_path" ]; then
        # Check if the built binary is newer
        local running_time=$(stat -c %Y "$running_path" 2>/dev/null || echo 0)
        local built_time=$(stat -c %Y "$expected_path" 2>/dev/null || echo 0)
        
        if [ $built_time -gt $running_time ]; then
            echo "!"  # Built binary is newer than running
            return 1
        fi
    else
        # Same path, check if file was modified after service started
        local service_start_time=$(systemctl show "$service.service" -p ActiveEnterTimestamp --value 2>/dev/null | xargs -I {} date -d "{}" +%s 2>/dev/null || echo 0)
        local binary_mod_time=$(stat -c %Y "$expected_path" 2>/dev/null || echo 0)
        
        if [ $binary_mod_time -gt $service_start_time ] && [ $service_start_time -gt 0 ]; then
            echo "!"  # Binary was rebuilt after service started
            return 1
        fi
    fi
    
    echo ""
    return 0
}

# Function to get alien database info and check for modifications
get_alien_db_info() {
    local port=$1
    # Query the core database for the company name
    local query="SELECT company_name FROM alien_databases WHERE port = $port;"
    local company=$(echo "$query" | surreal sql --conn http://127.0.0.1:8000 --user root --pass root --ns dalicore --db dalicore --json 2>/dev/null | jq -r '.[].[0].company_name' 2>/dev/null)
    
    if [ -n "$company" ] && [ "$company" != "null" ]; then
        echo "$company"
    else
        echo "unknown"
    fi
}

# Enhanced service status for Dalicore
if [[ "$CWD" == *"dalicore"* ]]; then
    echo ""
    echo "DALICORE SERVICE STATUS"
    echo ""
    
    # Table header  
    echo "Service              Port   Status  Schema/Age"
    echo "-------------------- ------ ------- ----------"
    
    # Core services in order
    CORE_SERVICES="dalicore-db dalicore-test-db dalicore-api dalicore-crm dalicore-llm dalicore-storage dalicore-frontend"
    
    SCHEMA_WARNING=""
    for service in $CORE_SERVICES; do
        status=$(systemctl is-active "$service" 2>/dev/null || echo "not-found")
        port=$(get_service_port "$service")
        age=$(get_running_binary_age "$service")
        mismatch=$(check_binary_mismatch "$service" "$age")
        
        # Format service name (20 chars)
        formatted_name=$(printf "%-20s" "$service")
        
        # Format port (6 chars)
        formatted_port=$(printf "%-6s" "$port")
        
        # Format status with symbol (7 chars)
        case "$status" in
            active)
                formatted_status="✓ run  "
                ;;
            inactive|dead)
                formatted_status="✗ stop "
                ;;
            activating)
                formatted_status="↻ start"
                ;;
            failed)
                formatted_status="⚠ fail "
                ;;
            not-found)
                formatted_status="- n/a  "
                ;;
            *)
                formatted_status="? unk  "
                ;;
        esac
        
        # Format age with mismatch indicator (10 chars)
        if [ "$age" = "MULTI" ]; then
            formatted_age="MULTI!    "
            SCHEMA_WARNING="consolidation"
        elif [ "$age" = "NONE" ]; then
            formatted_age="NO SCHEMA!"
            SCHEMA_WARNING="missing"
        elif [ "$age" = "DRIFT" ] && [ "$mismatch" = "!" ]; then
            formatted_age="DRIFT!    "
            SCHEMA_WARNING="drift"
        elif [ "$age" = "SYNC" ]; then
            formatted_age="SYNC ✓    "
        elif [ "$mismatch" = "!" ]; then
            formatted_age=$(printf "%-9s%s" "$age" "⚠")
        else
            formatted_age=$(printf "%-10s" "$age")
        fi
        
        echo "$formatted_name $formatted_port $formatted_status $formatted_age"
    done
    
    echo ""
    echo "Legend: SYNC = schema matches file, DRIFT = schema modified in DB"
    echo "        ⚠ = newer binary available (needs restart)"
    
    if [ "$SCHEMA_WARNING" = "drift" ]; then
        echo ""
        echo "⚠️  SCHEMA DRIFT DETECTED: Database schema doesn't match migration file!"
        echo "   The database has been modified directly. To fix:"
        echo "   1. Export current schema with Surrealist to dalicore root"
        echo "   2. I'll update schemas/core/dalicore.surql"
    elif [ "$SCHEMA_WARNING" = "consolidation" ]; then
        echo ""
        echo "⚠️  SCHEMA CONSOLIDATION NEEDED: Multiple schema files detected!"
        echo "   Consolidate into: schemas/core/dalicore.surql"
    elif [ "$SCHEMA_WARNING" = "missing" ]; then
        echo ""
        echo "⚠️  NO SCHEMA FILE: Migration file not found!"
        echo "   Export schema and save to: schemas/core/dalicore.surql"
    fi
    
    # Check for alien databases
    ALIEN_DBS=$(systemctl list-units 'surreal-alien@*' --no-legend 2>/dev/null | awk '{print $1}' | sed 's/\.service$//')
    if [ -n "$ALIEN_DBS" ]; then
        echo ""
        echo "Alien Databases:"
        for alien_db in $ALIEN_DBS; do
            status=$(systemctl is-active "$alien_db" 2>/dev/null)
            port=$(get_service_port "$alien_db")
            
            # Get company name
            if [ "$port" != "----" ] && [ "$port" != "????" ]; then
                company_info=$(get_alien_db_info "$port")
            else
                # Extract UUID for display if we can't get the port
                short_uuid=$(echo "$alien_db" | grep -oE '[a-f0-9]{8}' | head -1)
                company_info="${short_uuid}..."
            fi
            
            case "$status" in
                active)
                    if [ "$port" != "----" ]; then
                        echo "  ✓ $company_info (port $port)"
                    else
                        echo "  ✓ $company_info (port unknown)"
                    fi
                    ;;
                *)
                    echo "  ✗ $company_info (stopped)"
                    ;;
            esac
        done
    fi
    
    # Check for founder frontends
    FOUNDER_FRONTENDS=$(systemctl list-units 'founder-*-frontend' --no-legend 2>/dev/null | awk '{print $1}' | sed 's/\.service$//')
    if [ -n "$FOUNDER_FRONTENDS" ]; then
        echo ""
        echo "Founder Frontends:"
        for frontend in $FOUNDER_FRONTENDS; do
            status=$(systemctl is-active "$frontend" 2>/dev/null)
            port=$(get_service_port "$frontend")
            name=$(echo "$frontend" | sed 's/founder-//' | sed 's/-frontend//')
            
            case "$status" in
                active)
                    echo "  ✓ $name (port $port)"
                    ;;
                *)
                    echo "  ✗ $name (stopped)"
                    ;;
            esac
        done
    fi
    
    echo ""
    echo "SUDO-FREE COMMANDS"
    echo "• systemctl start/stop/restart/status dalicore-*"
    echo "• journalctl -u dalicore-* -f"
    echo "• /home/konverts/projects/dalicore/scripts/services/dalicore-*"
    echo ""
    
    # Short service status line for TOOL_STATUS substitution
    SERVICE_STATUS=""
    for service in $CORE_SERVICES; do
        status=$(systemctl is-active "$service" 2>/dev/null || echo "not-found")
        short_name=$(echo "$service" | sed 's/dalicore-//')
        
        case "$status" in
            active)
                SERVICE_STATUS="$SERVICE_STATUS ✓$short_name"
                ;;
            inactive|dead)
                SERVICE_STATUS="$SERVICE_STATUS ✗$short_name"
                ;;
            activating)
                SERVICE_STATUS="$SERVICE_STATUS ↻$short_name"
                ;;
            failed)
                SERVICE_STATUS="$SERVICE_STATUS ⚠$short_name"
                ;;
        esac
    done
    
    SERVICE_CHECK="Services:$SERVICE_STATUS"
fi
