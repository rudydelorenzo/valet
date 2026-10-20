# Using your deploy hook in CircleCI

Integrate this webhook into your CircleCI pipeline.

## Add the webhook URL as an environment variable

Store the deploy URL as a project environment variable so it's not exposed in your config.

1. Go to **Project Settings → Environment Variables**
2. Click **Add Variable**
3. Name it `DEPLOY_WEBHOOK_URL` and paste the following value:

```url
{{{deployUrl}}}
```

## Deploy job

Add this job to your pipeline to trigger a deploy and wait for it to complete.

```yaml
deploy:
  docker:
    - image: cimg/base:stable
  steps:
    - run:
        name: Trigger deploy
        command: |
          RESPONSE=$(curl -s -X POST "$DEPLOY_WEBHOOK_URL")
          STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl')
          echo "export STATUS_URL=\"$STATUS_URL\"" >> "$BASH_ENV"

    - run:
        name: Wait for deploy
        command: |
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
                       echo "  $STATUS — retrying in ${DELAY}s..."
                       sleep "$DELAY"
                       DELAY=$((DELAY * 2 > 30 ? 30 : DELAY * 2)) ;;
            esac
          done
```

## Full pipeline example

A minimal pipeline that builds and deploys on push to `main`.

```yaml
version: 2.1

jobs:
  build:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run: echo "Building..."

  deploy:
    docker:
      - image: cimg/base:stable
    steps:
      - run:
          name: Trigger deploy
          command: |
            RESPONSE=$(curl -s -X POST "$DEPLOY_WEBHOOK_URL")
            STATUS_URL=$(echo "$RESPONSE" | jq -r '.statusUrl')
            echo "export STATUS_URL=\"$STATUS_URL\"" >> "$BASH_ENV"
      - run:
          name: Wait for deploy
          command: |
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

workflows:
  build-and-deploy:
    jobs:
      - build
      - deploy:
          requires: build
          filters:
            branches:
              only: main
```