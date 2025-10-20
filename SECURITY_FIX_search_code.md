# Security Fix: search_code Error Handling

## Issue
The `search_code` tool was silently swallowing path validation errors and returning "No matches found" instead of showing the actual security error.

## Root Cause
In `/src/handlers/edit-search-handlers.ts`, the `withTimeout()` function was called with `defaultValue = []` (empty array), which caused ALL errors—including path validation errors—to be caught and replaced with an empty result array.

```typescript
// BEFORE (buggy)
const results = await withTimeout(
    searchOperation(),
    timeoutMs,
    'Code search operation',
    [] // Empty array swallows ALL errors!
);
```

## Security Impact
- **Path validation was WORKING** - unauthorized paths were blocked correctly
- **UX was BROKEN** - users saw "No matches found" instead of "Path not allowed"
- Made debugging difficult and obscured security behavior

## Fix Applied
Changed the handler to:
1. Use `null` as defaultValue so errors propagate
2. Catch errors explicitly and check error type
3. Propagate path validation errors with proper error message
4. Only swallow timeout errors (return empty results)
5. Propagate all other errors

```typescript
// AFTER (fixed)
let results: any[] | null;
try {
    results = await withTimeout(
        searchOperation(),
        timeoutMs,
        'Code search operation',
        null // Let errors propagate
    );
} catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Propagate path validation errors immediately
    if (errorMessage.includes('Path not allowed')) {
        return {
            content: [{type: "text", text: `Error: ${errorMessage}`}],
            isError: true,
        };
    }
    
    // Handle timeouts gracefully
    if (errorMessage.includes('timed out')) {
        return {
            content: [{type: "text", text: `No matches found or search timed out after ${timeoutMs}ms.`}],
        };
    }
    
    // Propagate other errors
    return {
        content: [{type: "text", text: `Error: ${errorMessage}`}],
        isError: true,
    };
}
```

## Test Cases

### Before Fix
```bash
search_code("/etc", "root")
# Result: "No matches found or search timed out after 30000ms."
# WRONG - should show path validation error
```

### After Fix
```bash
search_code("/etc", "root")
# Result: "Error: Path not allowed: /etc. Must be within one of these directories: /home/konverts/projects, /home/konverts/projects2, /home/konverts/.config/Claude/logs"
# CORRECT - shows actual security error
```

## Files Modified
- `/src/handlers/edit-search-handlers.ts` - Fixed error handling in `handleSearchCode()`

## Build Status
✅ TypeScript compilation successful
✅ No breaking changes to existing functionality
✅ Security validation still working correctly

## Date
2025-10-19
