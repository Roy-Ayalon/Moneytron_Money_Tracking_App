#!/bin/bash

INPUT=$(cat)
ROOT="/Users/royayalon/Documents/Moneytron_Money_Tracking_App"
LOCK_FILE="/tmp/moneytron_browser_open.lock"

FILE=$(echo "$INPUT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
ti = data.get('tool_input', {})
print(ti.get('file_path', ti.get('path', '')))
" 2>/dev/null)

IS_CLIENT=false
IS_SERVER=false
[[ "$FILE" == *"client/src/"* ]] && IS_CLIENT=true
[[ "$FILE" == *"server/"* ]]     && IS_SERVER=true

if ! $IS_CLIENT && ! $IS_SERVER; then
  exit 0
fi

# Guard: skip if another edit in the same response already opened a tab (<5s ago)
NOW=$(date +%s)
if [ -f "$LOCK_FILE" ]; then
  LAST=$(cat "$LOCK_FILE" 2>/dev/null)
  if [ -n "$LAST" ] && [ $((NOW - LAST)) -le 5 ]; then
    exit 0
  fi
fi
echo "$NOW" > "$LOCK_FILE"

# Ensure Flask is running at :5003
if ! lsof -i :5003 -sTCP:LISTEN -t &>/dev/null; then
  cd "$ROOT"
  source .venv/bin/activate 2>/dev/null || true
  python3 server/new_app.py &
  sleep 2
fi

# Ensure Vite dev server is running at :5173
if ! lsof -i :5173 -sTCP:LISTEN -t &>/dev/null; then
  cd "$ROOT/client" && npm run dev &>/dev/null &
  for i in $(seq 1 10); do
    sleep 1
    lsof -i :5173 -sTCP:LISTEN -t &>/dev/null && break
  done
  # Extra wait for Vite to finish compiling after port is up
  sleep 2
fi

# If a server file changed, give Flask a moment to restart before opening
if $IS_SERVER; then
  sleep 1
fi

# Close all existing project tabs (both dev and direct server), then open a fresh one
osascript <<APPLESCRIPT
  tell application "Google Chrome"
    repeat with w in every window
      set tabsToClose to {}
      repeat with t in every tab of w
        set u to URL of t
        if u starts with "http://localhost:5173" or u starts with "http://127.0.0.1:5003" then
          set end of tabsToClose to t
        end if
      end repeat
      repeat with t in tabsToClose
        close t
      end repeat
    end repeat
    make new tab at end of tabs of window 1
    set URL of active tab of window 1 to "http://localhost:5173/"
    activate
  end tell
APPLESCRIPT
