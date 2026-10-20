# Using your deploy hook in Github

Integrate this webhook into your GitHub Actions workflow.

## Add the webhook URL as a secret

Store the deploy URL as a repository secret so it's not exposed in your workflow files.

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name it `DEPLOY_WEBHOOK_URL` and paste the following value:

```url
{{{deployUrl}}}
```

## Deploy step

Add this step to your workflow to trigger a deploy after your build completes.

```yaml
- name: Trigger deploy
  id: deploy
  run: |
    RESPONSE=$(curl -s -X POST "$DEPLOY_WEBHOOK_URL")
    STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl')
    echo "status_url=$STATUS_URL" >> "$GITHUB_OUTPUT"
```

## Wait for deploy

Poll the deploy status with exponential backoff until it succeeds or fails.

```yaml
- name: Wait for deploy
  run: |
    STATUS_URL="${{ steps.deploy.outputs.status_url }}"
    DELAY=2
    MAX_RETRIES=10
    RETRIES=0
    while true; do
      STATUS=$(curl -s -H "Accept: text/plain" "$STATUS_URL")
      case "$STATUS" in
        success) echo "Deploy succeeded"; exit 0 ;;
        error)   echo "Deploy failed"; exit 1 ;;
        *)       RETRIES=$((RETRIES + 1))
                 if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
                   echo "Deploy timed out after $MAX_RETRIES retries"; exit 1
                 fi
                 echo "  $STATUS — retrying in ${DELAY}s..."; sleep "$DELAY"
                 DELAY=$((DELAY * 2 > 30 ? 30 : DELAY * 2)) ;;
      esac
    done
```

## Full workflow example

A minimal workflow that builds and deploys on push to `main`.

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: echo "Building..."

      - name: Trigger deploy
        id: deploy
        run: |
          RESPONSE=$(curl -s -X POST "$DEPLOY_WEBHOOK_URL")
          STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl')
          echo "status_url=$STATUS_URL" >> "$GITHUB_OUTPUT"

      - name: Wait for deploy
        run: |
          STATUS_URL="${{ steps.deploy.outputs.status_url }}"
          DELAY=2
          MAX_RETRIES=10
          RETRIES=0
          while true; do
            STATUS=$(curl -s -H "Accept: text/plain" "$STATUS_URL")
            case "$STATUS" in
              success) echo "Deploy succeeded"; exit 0 ;;
              error)   echo "Deploy failed"; exit 1 ;;
              *)       RETRIES=$((RETRIES + 1))
                       if [ "$RETRIES" -ge "$MAX_RETRIES" ]; then
                         echo "Deploy timed out after $MAX_RETRIES retries"; exit 1
                       fi
                       sleep "$DELAY"
                       DELAY=$((DELAY * 2 > 30 ? 30 : DELAY * 2)) ;;
            esac
          done
```