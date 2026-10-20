# Using your deploy hook with Bash

Integrate this webhook anywhere.

## Full pipeline

A complete script that triggers a deploy and polls with exponential backoff until it succeeds or fails. Drop this into your CI pipeline or run it directly.

```bash
#!/bin/bash
set -e

DEPLOY_URL="{{{deployUrl}}}"

# Trigger deploy and capture the status polling URL
echo "Triggering deploy..."
RESPONSE=$(curl -s -X POST "$DEPLOY_URL")
STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl')

if [ -z "$STATUS_URL" ]; then
  echo "Failed to get status URL from response"
  exit 1
fi

# Poll with exponential backoff until terminal status
DELAY=2
MAX_RETRIES=10
RETRIES=0
while true; do
  STATUS=$(curl -s -H "Accept: text/plain" "$STATUS_URL")
  case "$STATUS" in
    success)
      echo "Deploy succeeded"
      exit 0
      ;;
    error)
      echo "Deploy failed"
      exit 1
      ;;
    *)
      RETRIES=$((RETRIES + 1))
      if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
        echo "Deploy timed out after $MAX_RETRIES retries"
        exit 1
      fi
      echo "  $STATUS — retrying in ${DELAY}s..."
      sleep "$DELAY"
      DELAY=$((DELAY * 2 > 30 ? 30 : DELAY * 2))
      ;;
  esac
done
```

## Trigger a deploy

Send a POST request to kick off a deployment. The response includes a `statusUrl` you can poll to track progress.

```bash
curl -s -X POST "{{{deployUrl}}}"
```

## Check deploy status

Use the `statusUrl` from the trigger response. It returns a plain-text status: `queued`, `running`, `success`, or `error`.

```bash
# Replace EVENT_ID with the eventId from the trigger response
curl -s "{{{deployUrl}}}/status/EVENT_ID"
```