#!/bin/sh
set -eu
mkdir -p dist
cp index.html app.js _routes.json dist/
echo "MarktRadar Cloudflare Free: static files ready in dist/"
