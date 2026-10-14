#!/bin/sh
set -eu

# Validate the Worker before publishing so avoidable syntax/parser failures
# are detected in the build logs rather than after deployment.
node --check app.js
node --check functions/api/catalog.js
node --test tests/cloudflare.test.cjs

mkdir -p dist
cp index.html app.js _routes.json dist/
echo "MarktRadar Cloudflare Free: validation passed, static files ready."
