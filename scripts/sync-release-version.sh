#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Git Pulse — Synchronize Monorepo Version on Official Release
# Runs ONLY when a release is officially published, updating package.json across
# workspaces and README.md, then pushing the official release commit to main.
# ==============================================================================

TARGET_TAG="${1:-}"

if [ -z "$TARGET_TAG" ]; then
  echo "::error::Target tag is required (e.g. v0.3.1)"
  exit 1
fi

TARGET_VERSION="${TARGET_TAG#v}"

echo "=================================================================="
echo "🎯 Official Release Version Synchronization"
echo "Target Tag     : $TARGET_TAG"
echo "Target Version : $TARGET_VERSION"
echo "=================================================================="

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  echo "• Configuring Git author..."
  git config user.name "github-actions[bot]"
  git config user.email "github-actions[bot]@users.noreply.github.com"

  # Switch to branch main to avoid detached HEAD
  git checkout -B main origin/main

  # Merge develop into main if origin/develop exists
  git fetch origin develop || true
  if git rev-parse --verify origin/develop >/dev/null 2>&1; then
    echo "• Merging origin/develop into main..."
    git merge origin/develop --no-ff -m "chore(release): merge develop into main for $TARGET_TAG" || {
      echo "::warning::Merge conflict or develop already up to date with main. Continuing..."
    }
  fi
fi

CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")

if [ "$CURRENT_VERSION" = "$TARGET_VERSION" ]; then
  echo "✅ Monorepo version is already $TARGET_VERSION."
else
  echo "• Updating package.json across workspaces and README.md..."

  node -e '
    const fs = require("fs");
    const targetVer = process.argv[1];
    const files = ["package.json", "client/package.json", "server/package.json"];
    for (const f of files) {
      if (fs.existsSync(f)) {
        const data = JSON.parse(fs.readFileSync(f, "utf-8"));
        data.version = targetVer;
        fs.writeFileSync(f, JSON.stringify(data, null, 2) + "\n");
        console.log(`  ✓ ${f} -> ${targetVer}`);
      }
    }

    // Automatically update version in README.md
    if (fs.existsSync("README.md")) {
      let readme = fs.readFileSync("README.md", "utf-8");
      readme = readme.replace(/(img\.shields\.io\/badge\/version-v)[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9]+)/g, `$1${targetVer}$2`);
      readme = readme.replace(/(<!-- VERSION -->v?)[0-9]+\.[0-9]+\.[0-9]+(<!-- \/VERSION -->)/g, `$1${targetVer}$2`);
      readme = readme.replace(/(\*\*Version\*\*:\s*`v?)[0-9]+\.[0-9]+\.[0-9]+(`)/g, `$1${targetVer}$2`);
      fs.writeFileSync("README.md", readme);
      console.log(`  ✓ README.md -> v${targetVer}`);
    }
  ' "$TARGET_VERSION"
fi

if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
  echo "• Committing official release version bump to main..."
  git add package.json client/package.json server/package.json README.md
  git commit -m "chore(release): v${TARGET_VERSION} [skip ci]" || echo "No version changes to commit"
  
  echo "• Pushing release commit to main..."
  git push origin main

  echo "• Pushing updated tag $TARGET_TAG to point to the release commit..."
  git tag -fa "$TARGET_TAG" -m "Release $TARGET_TAG"
  git push origin "$TARGET_TAG" --force || echo "::warning::Tag update on remote skipped or already pinned"

  echo "• Syncing release commit back to develop..."
  if git rev-parse --verify origin/develop >/dev/null 2>&1; then
    git checkout -B develop origin/develop
    git merge main --no-ff -m "chore(release): sync release $TARGET_TAG back to develop [skip ci]" || echo "::warning::Could not merge main into develop"
    git push origin develop || echo "::warning::Could not push release sync to develop"
  fi

  echo "✅ Official release $TARGET_TAG successfully synced and committed to main and develop."
else
  echo "ℹ️ Local environment detected. Files updated without auto-commit."
fi
