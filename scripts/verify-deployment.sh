#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Git Pulse — Production Deployment Verification Script
# Polls health check endpoints on Vercel until they match the target version
# or timeout is reached. Updates GitHub Deployment statuses in real time.
# ==============================================================================

SERVICE="all"
TARGET_VERSION=""
TARGET_COMMIT=""
TIMEOUT_SECONDS=600
POLL_INTERVAL=10
INITIAL_DELAY=15
MIN_ROLLOUT_WAIT=20

GH_REPO=""
GH_SERVER_DEPLOY_ID=""
GH_CLIENT_DEPLOY_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service)
      SERVICE="$2"
      shift 2
      ;;
    --version)
      TARGET_VERSION="$2"
      shift 2
      ;;
    --commit)
      TARGET_COMMIT="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    --interval)
      POLL_INTERVAL="$2"
      shift 2
      ;;
    --initial-delay)
      INITIAL_DELAY="$2"
      shift 2
      ;;
    --min-rollout-wait)
      MIN_ROLLOUT_WAIT="$2"
      shift 2
      ;;
    --server-url)
      SERVER_URL="$2"
      shift 2
      ;;
    --client-url)
      CLIENT_URL="$2"
      shift 2
      ;;
    --gh-repo)
      GH_REPO="$2"
      shift 2
      ;;
    --gh-server-deploy-id)
      GH_SERVER_DEPLOY_ID="$2"
      shift 2
      ;;
    --gh-client-deploy-id)
      GH_CLIENT_DEPLOY_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

SERVICE="${SERVICE:-${TARGET_SERVICE:-all}}"
SERVER_URL="${SERVER_URL:-https://git-pulse-server.vercel.app}"
CLIENT_URL="${CLIENT_URL:-https://git-pulse-app.vercel.app}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-600}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"
INITIAL_DELAY="${INITIAL_DELAY:-15}"
MIN_ROLLOUT_WAIT="${MIN_ROLLOUT_WAIT:-20}"

echo "=================================================================="
echo "🚀 Git Pulse Production Deployment Verification"
echo "Target Service       : $SERVICE"
echo "Target Version       : ${TARGET_VERSION:-latest}"
echo "Target Commit        : ${TARGET_COMMIT:-any}"
echo "Server Endpoint      : $SERVER_URL/api/v1/health-full"
echo "Client Endpoint      : $CLIENT_URL/health"
echo "Timeout              : ${TIMEOUT_SECONDS}s (poll every ${POLL_INTERVAL}s)"
echo "Initial Delay        : ${INITIAL_DELAY}s"
echo "Min Rollout Wait     : ${MIN_ROLLOUT_WAIT}s"
echo "GitHub Live Sync     : $([ -n "$GH_REPO" ] && echo "Active" || echo "Inactive")"
echo "=================================================================="

INITIAL_SERVER_VER=$(curl -s --max-time 5 "$SERVER_URL/api/v1/health-full" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).version || 'unreachable'" 2>/dev/null || echo "unreachable")
INITIAL_CLIENT_VER=$(curl -s --max-time 5 "$CLIENT_URL/health" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).version || 'unreachable'" 2>/dev/null || echo "unreachable")

echo "Baseline Live Status:"
echo "  Initial Live Server Version : $INITIAL_SERVER_VER"
echo "  Initial Live Client Version : $INITIAL_CLIENT_VER"

if [ "$INITIAL_DELAY" -gt 0 ]; then
  echo "⏳ Warmup pause (${INITIAL_DELAY}s) for Vercel build queue initiation..."
  sleep "$INITIAL_DELAY"
fi

START_TIME=$(date +%s)
SERVER_OK=false
CLIENT_OK=false

if [ "$SERVICE" = "client" ]; then
  SERVER_OK=true
elif [ "$SERVICE" = "server" ]; then
  CLIENT_OK=true
fi

LAST_SERVER_STATUS=""
LAST_CLIENT_STATUS=""

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if [ "$ELAPSED" -ge "$TIMEOUT_SECONDS" ]; then
    echo "❌ Deployment verification timed out after ${ELAPSED}s!"
    echo "=================================================================="
    echo "Last known server response: $LAST_SERVER_STATUS"
    echo "Last known client response: $LAST_CLIENT_STATUS"
    echo "Please inspect build logs on Vercel Dashboard: https://vercel.com/thanhbas-projects"
    echo "=================================================================="

    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      cat <<EOF >> "$GITHUB_STEP_SUMMARY"
### ❌ Deployment Verification Timed Out
- **Target Service**: \`$SERVICE\`
- **Target Version**: \`$TARGET_VERSION\`
- **Elapsed Time**: ${ELAPSED}s
- **Last Server Status**: \`$LAST_SERVER_STATUS\`
- **Last Client Status**: \`$LAST_CLIENT_STATUS\`
- **Dashboard**: [Vercel Dashboard](https://vercel.com/thanhbas-projects)
EOF
    fi

    if [ -n "$GH_REPO" ]; then
      if [ "$SERVER_OK" = false ] && [ -n "$GH_SERVER_DEPLOY_ID" ]; then
        gh api -X POST "/repos/$GH_REPO/deployments/$GH_SERVER_DEPLOY_ID/statuses" \
          --input - <<< '{"state":"failure","description":"Server verification timed out after '${ELAPSED}'s","log_url":"https://vercel.com/thanhbas-projects"}' || true
      fi
      if [ "$CLIENT_OK" = false ] && [ -n "$GH_CLIENT_DEPLOY_ID" ]; then
        gh api -X POST "/repos/$GH_REPO/deployments/$GH_CLIENT_DEPLOY_ID/statuses" \
          --input - <<< '{"state":"failure","description":"Client verification timed out after '${ELAPSED}'s","log_url":"https://vercel.com/thanhbas-projects"}' || true
      fi
    fi

    exit 1
  fi

  # Check Server Health
  if [ "$SERVER_OK" = false ]; then
    SERVER_RESP=$(curl -s --max-time 10 "$SERVER_URL/api/v1/health-full" 2>/dev/null || echo "")
    LAST_SERVER_STATUS="$SERVER_RESP"
    if [ -n "$SERVER_RESP" ]; then
      STATUS=$(echo "$SERVER_RESP" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).status || ''" 2>/dev/null || echo "")
      VERSION=$(echo "$SERVER_RESP" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).version || ''" 2>/dev/null || echo "")
      DB_STATUS=$(echo "$SERVER_RESP" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).database || ''" 2>/dev/null || echo "")

      if ([ "$STATUS" = "ok" ] || [ "$STATUS" = "degraded" ]) && [ "$DB_STATUS" = "connected" ]; then
        VERSION_MATCH=false
        if [ -z "$TARGET_VERSION" ]; then
          VERSION_MATCH=true
        elif [ "$VERSION" = "$TARGET_VERSION" ]; then
          if [ "$INITIAL_SERVER_VER" = "$TARGET_VERSION" ] && [ "$ELAPSED" -lt "$MIN_ROLLOUT_WAIT" ]; then
            echo "  [${ELAPSED}s] Server returned $VERSION (matching pre-existing version; awaiting rollout min ${MIN_ROLLOUT_WAIT}s...)"
            VERSION_MATCH=false
          else
            VERSION_MATCH=true
          fi
        fi

        if [ "$VERSION_MATCH" = true ]; then
          SERVER_OK=true
          echo "✅ Server verified healthy! Version: $VERSION | DB: $DB_STATUS (${ELAPSED}s)"
          
          if [ -n "$GH_SERVER_DEPLOY_ID" ] && [ -n "$GH_REPO" ]; then
            gh api -X POST "/repos/$GH_REPO/deployments/$GH_SERVER_DEPLOY_ID/statuses" \
              --input - <<< '{"state":"success","environment_url":"'$SERVER_URL'/api/v1/health-full","log_url":"https://vercel.com/thanhbas-projects","description":"Server v'$VERSION' deployed successfully (DB: '$DB_STATUS')"}' || true
          fi
        else
          echo "  [${ELAPSED}s] Server live version: '$VERSION' (waiting for '$TARGET_VERSION')..."
        fi
      else
        echo "  [${ELAPSED}s] Server probe returned non-ok status: '$STATUS'"
      fi
    else
      echo "  [${ELAPSED}s] Server probe unreachable..."
    fi
  fi

  # Check Client Health
  if [ "$CLIENT_OK" = false ]; then
    CLIENT_RESP=$(curl -s --max-time 10 "$CLIENT_URL/health" 2>/dev/null || echo "")
    LAST_CLIENT_STATUS="$CLIENT_RESP"
    if [ -n "$CLIENT_RESP" ]; then
      STATUS=$(echo "$CLIENT_RESP" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).status || ''" 2>/dev/null || echo "")
      VERSION=$(echo "$CLIENT_RESP" | node -p "JSON.parse(require('fs').readFileSync(0,'utf-8')).version || ''" 2>/dev/null || echo "")

      if [ "$STATUS" = "ok" ]; then
        VERSION_MATCH=false
        if [ -z "$TARGET_VERSION" ]; then
          VERSION_MATCH=true
        elif [ "$VERSION" = "$TARGET_VERSION" ]; then
          if [ "$INITIAL_CLIENT_VER" = "$TARGET_VERSION" ] && [ "$ELAPSED" -lt "$MIN_ROLLOUT_WAIT" ]; then
            echo "  [${ELAPSED}s] Client returned $VERSION (matching pre-existing version; awaiting rollout min ${MIN_ROLLOUT_WAIT}s...)"
            VERSION_MATCH=false
          else
            VERSION_MATCH=true
          fi
        fi

        if [ "$VERSION_MATCH" = true ]; then
          CLIENT_OK=true
          echo "✅ Client verified healthy! Version: $VERSION (${ELAPSED}s)"

          if [ -n "$GH_CLIENT_DEPLOY_ID" ] && [ -n "$GH_REPO" ]; then
            gh api -X POST "/repos/$GH_REPO/deployments/$GH_CLIENT_DEPLOY_ID/statuses" \
              --input - <<< '{"state":"success","environment_url":"'$CLIENT_URL'","log_url":"https://vercel.com/thanhbas-projects","description":"Client v'$VERSION' deployed successfully"}' || true
          fi
        else
          echo "  [${ELAPSED}s] Client live version: '$VERSION' (waiting for '$TARGET_VERSION')..."
        fi
      else
        echo "  [${ELAPSED}s] Client probe returned non-ok status: '$STATUS'"
      fi
    else
      echo "  [${ELAPSED}s] Client probe unreachable..."
    fi
  fi

  # Both verified successfully
  if [ "$SERVER_OK" = true ] && [ "$CLIENT_OK" = true ]; then
    echo "=================================================================="
    echo "🎉 ALL TARGET SERVICES DEPLOYED AND HEALTH-CHECKED SUCCESSFULLY!"
    echo "Total rollout duration: ${ELAPSED}s"
    echo "=================================================================="

    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      cat <<EOF >> "$GITHUB_STEP_SUMMARY"
### 🚀 Production Deployment Successful
- **Target Service**: \`$SERVICE\`
- **Target Version**: \`$TARGET_VERSION\`
- **Rollout Duration**: ${ELAPSED}s
- **Server Endpoint**: [$SERVER_URL/api/v1/health]($SERVER_URL/api/v1/health)
- **Client Endpoint**: [$CLIENT_URL]($CLIENT_URL)
- **Status**: 🟢 Live and healthy
EOF
    fi

    exit 0
  fi

  echo "  [${ELAPSED}s] Polling Vercel rollout... (Server OK: $SERVER_OK, Client OK: $CLIENT_OK)"
  sleep "$POLL_INTERVAL"
done
