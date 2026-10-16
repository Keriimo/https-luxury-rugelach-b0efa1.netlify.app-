#!/bin/sh
set -eu

# Validate the Worker before publishing so avoidable syntax/parser failures
# are detected in the build logs rather than after deployment.
node --check app.js
node --check functions/api/catalog.js
node --check worker.js
node --test tests/cloudflare.test.cjs tests/worker.test.cjs tests/ui.test.cjs

mkdir -p dist
cp index.html app.js dist/
echo "MarktRadar Cloudflare Free: validation passed, static files ready."
