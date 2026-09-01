#!/usr/bin/env bash
# Starts a development Python HTTP server on port 8000 (or another specified port)
# and optionally opens the default web browser.
# The server is automatically killed when this script exits.

set -e

USAGE="Usage: $0 [--open] [port]"
port=8000
open_browser=false

while [[ $# -gt 0 ]]; do
  case "$1" in
  --open)
    open_browser=true
    shift
    ;;
  -*)
    echo "Unknown option: $1"
    echo "$USAGE"
    exit 1
    ;;
  *)
    port="$1"
    shift
    ;;
  esac
done

# Start the server in the background
python3 -m http.server "$port" &
server_pid=$!

# Kill the server when this script exits
cleanup() {
  kill "$server_pid" 2>/dev/null
}

trap cleanup EXIT

# Open the browser if requested
if [[ "$open_browser" == true ]]; then
  url="http://localhost:$port"

  if command -v open >/dev/null 2>&1; then
    open "$url" # macOS
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" # Linux
  elif command -v start >/dev/null 2>&1; then
    start "$url" # Windows/Git Bash
  else
    echo "Server running at $url"
  fi
fi

echo "Server running at http://localhost:$port"
echo "Press Ctrl+C to stop."

# Keep the script running while the server is alive
wait "$server_pid"
