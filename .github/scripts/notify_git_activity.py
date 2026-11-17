#!/usr/bin/env python3
import json
import os
import sys
import urllib.request
import urllib.error

gateway_url = os.environ.get("GATEWAY_URL", "https://central-gateway-server.vercel.app/api/v1")
gateway_secret = os.environ.get("GATEWAY_SECRET_KEY")

event_name = os.environ.get("EVENT_NAME", "")
actor = os.environ.get("ACTOR", "")
ref_name = os.environ.get("REF_NAME", "")
head_commit = os.environ.get("HEAD_COMMIT", "")
short_sha = head_commit[:7] if head_commit else ""
repo_slug = os.environ.get("REPO", "thanhba0505/git-pulse")

payload = None

if event_name == "create":
    ref_type = os.environ.get("REF_TYPE", "")
    if ref_type == "branch":
        base_branch = os.environ.get("BASE_BRANCH", "develop")
        compare_url = f"https://github.com/{repo_slug}/compare/{base_branch}...{ref_name}"
        project_name = repo_slug.split("/")[-1] if "/" in repo_slug else "git-pulse"
        payload = {
            "project": project_name,
            "eventType": "branch_created",
            "actor": actor,
            "refName": ref_name,
            "baseBranch": base_branch,
            "compareUrl": compare_url,
        }

elif event_name == "pull_request":
    pr_number = os.environ.get("PR_NUMBER", "")
    pr_title = os.environ.get("PR_TITLE", "")
    pr_url = os.environ.get("PR_URL", "")
    action = os.environ.get("PR_ACTION", "")
    is_merged = os.environ.get("PR_MERGED", "false") == "true"
    head_ref = os.environ.get("PR_HEAD_REF", "")
    base_ref = os.environ.get("PR_BASE_REF", "")

    project_name = repo_slug.split("/")[-1] if "/" in repo_slug else "git-pulse"
    payload = {
        "project": project_name,
        "eventType": "pull_request",
        "actor": actor,
        "prNumber": pr_number,
        "prTitle": pr_title,
        "prUrl": pr_url,
        "prAction": action,
        "prMerged": is_merged,
        "prHeadRef": head_ref,
        "prBaseRef": base_ref,
    }

elif event_name == "push":
    compare_url = os.environ.get("COMPARE_URL", "")
    commits_raw = os.environ.get("COMMITS_JSON", "[]")

    try:
        commits = json.loads(commits_raw) if commits_raw else []
    except Exception:
        commits = []

    lines = []
    if isinstance(commits, list):
        for c in commits[:5]:
            c_sha = c.get("id", "")[:7]
            msg = c.get("message", "").split("\n")[0].strip()
            lines.append(f"• {c_sha}: {msg}")
        if len(commits) > 5:
            lines.append(f"... and {len(commits) - 5} more commit(s)")

    if not lines:
        lines.append(f"• {short_sha}: Update {ref_name}")

    project_name = repo_slug.split("/")[-1] if "/" in repo_slug else "git-pulse"
    payload = {
        "project": project_name,
        "eventType": "push",
        "actor": actor,
        "refName": ref_name,
        "headCommit": head_commit,
        "commitCount": str(len(commits) if isinstance(commits, list) and commits else 1),
        "commitLines": lines,
        "compareUrl": compare_url,
    }

if payload:
    target_endpoint = f"{gateway_url}/notifications/slack/git"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if gateway_secret:
        headers["Authorization"] = f"Bearer {gateway_secret}"

    req = urllib.request.Request(
        target_endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode("utf-8")
            print(f"Git activity alert dispatched successfully to Central Gateway: {resp.status} {resp_body}")
    except urllib.error.HTTPError as e:
        error_content = e.read().decode("utf-8")
        print(f"Failed to dispatch git activity alert to Central Gateway: HTTP {e.code} {e.reason}\n{error_content}", file=sys.stderr)
    except Exception as e:
        print(f"Unexpected error notifying Central Gateway: {e}", file=sys.stderr)
else:
    print(f"Skipping notification for unhandled event: {event_name}")
