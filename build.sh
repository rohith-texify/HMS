#!/bin/sh
set -e
echo "Building HMS Backend Binary..."
go build -o server .
cp -f server server. 2>/dev/null || true
chmod +x server server. 2>/dev/null || true
echo "Build complete."

