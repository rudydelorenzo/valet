#!/usr/bin/env bash
#
# Push a throwaway image to the deploytest repo, then optionally trigger
# a Valet deploy hook — the quick way to exercise the deploy flow
# end-to-end against a test stack.
#
# Unlike the old sed-the-Dockerfile dance, the version stamp is applied
# via `docker build --label`, so no files are mutated between runs. The
# label still changes the image config (and therefore the digest), so
# every push is a genuinely new image for the stack to pull.
#
# Usage:
#   ./push.sh                     build + push
#   ./push.sh <hook-url>          build + push, then POST the hook
#
# Environment overrides:
#   REGISTRY   registry host        (default: none — omitting it targets Docker Hub)
#   IMAGE      image name           (default: deploy-test-image)
#   TAG        tag                  (default: latest)
#   PLATFORM   target platform      (default: linux/amd64)
#   HOOK_URL   hook to trigger      (default: none; overridable via $1)
set -euo pipefail

HOOK_URL="${1:-${HOOK_URL:-}}"
REGISTRY="${REGISTRY:-}"
IMAGE="${IMAGE:-deploytest}"
TAG="${TAG:-latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

cd "$(dirname "$0")"

REF="${REGISTRY:+$REGISTRY/}$IMAGE:$TAG"
V="$(date +%s)"

echo "==> Building and pushing $REF ($PLATFORM, v=$V)"
docker buildx build \
  --platform "$PLATFORM" \
  --label "v=$V" \
  --provenance=false \
  -t "$REF" \
  --push \
  .

if [ -n "$HOOK_URL" ]; then
  echo "==> Triggering deploy hook"
  curl -sS -X POST "$HOOK_URL"
  echo
fi
