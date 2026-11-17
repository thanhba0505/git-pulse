#!/usr/bin/env python3
"""
Tự động tính toán phiên bản tiếp theo và tạo/cập nhật bản Draft Release cho Central Gateway,
liệt kê toàn bộ commits và PRs kể từ tag phát hành chính thức gần nhất.
Được chuẩn hóa dựa trên nexus release architecture.
"""

from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT_DIR = Path(__file__).resolve().parent.parent.parent


def run(cmd: list[str]) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT_DIR)
    if res.returncode != 0:
        print(f"Command failed: {' '.join(cmd)}\nStderr: {res.stderr}")
        raise subprocess.CalledProcessError(res.returncode, cmd, res.stdout, res.stderr)
    return res.stdout.strip()


def get_repo_slug() -> str:
    """Lấy repository slug theo định dạng owner/repo."""
    if repo := os.environ.get("GITHUB_REPOSITORY"):
        return repo
    try:
        remote_url = run(["git", "config", "--get", "remote.origin.url"])
        if "github.com" in remote_url:
            cleaned = re.sub(r"^(https://github\.com/|git@github\.com:)", "", remote_url)
            return cleaned.removesuffix(".git").strip()
    except Exception:
        pass
    return "thanhba0505/git-pulse"


def get_current_pkg_version() -> str:
    """Lấy version hiện tại từ root package.json."""
    pkg_file = ROOT_DIR / "package.json"
    if pkg_file.exists():
        with open(pkg_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data.get("version", "0.1.0")
    return "0.1.0"


def main() -> None:
    repo = get_repo_slug()
    pkg_version = get_current_pkg_version()

    # 1. Lấy tag release chính thức gần nhất (không tính draft)
    try:
        run(["git", "fetch", "--tags", "--force"])
    except Exception:
        pass

    latest_tag = None
    try:
        # Kiểm tra qua git tags
        tags_raw = run(["git", "tag", "--sort=-v:refname"]).splitlines()
        for t in tags_raw:
            t = t.strip()
            if re.match(r"^v?\d+\.\d+\.\d+$", t):
                latest_tag = t
                break
    except Exception:
        latest_tag = None

    # Nếu không tìm thấy qua git tag, thử kiểm tra gh release list
    if not latest_tag:
        try:
            rel_output = run(["gh", "release", "list", "--json", "isDraft,tagName"])
            releases = json.loads(rel_output)
            published = [r for r in releases if not r.get("isDraft")]
            if published:
                latest_tag = published[0]["tagName"]
        except Exception:
            latest_tag = None

    if latest_tag:
        print(f"📌 Latest published tag: {latest_tag}")
        commit_range = f"{latest_tag}..HEAD"
    else:
        print("📌 Chưa có tag phát hành chính thức. Thu thập toàn bộ commits từ khởi tạo dự án.")
        commit_range = "HEAD"

    # 2. Lấy danh sách commits (bỏ merge commits nếu có)
    git_log_cmd = [
        "git",
        "log",
        commit_range,
        "--no-merges",
        "--pretty=format:%h|%H|%an|%s",
    ]
    commits_raw = run(git_log_cmd)

    if not commits_raw.strip():
        print("ℹ️ Không có commit mới để cập nhật draft release.")
        return

    all_commits: list[tuple[str, str, str, str]] = []
    for line in commits_raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("|", 3)
        if len(parts) == 4:
            all_commits.append((parts[0], parts[1], parts[2], parts[3]))

    # Lọc bỏ các commit tự động hoặc không cần thiết trong release notes
    commits = [
        c
        for c in all_commits
        if "[skip ci]" not in c[3] and not c[3].startswith("chore(release):")
    ]

    if not commits:
        print("ℹ️ Không có commit tính năng hoặc sửa lỗi cần hiển thị.")
        return

    # 3. Tính toán phiên bản tiếp theo theo SemVer
    if latest_tag:
        m = re.match(r"^v?(\d+)\.(\d+)\.(\d+)", latest_tag)
        if m:
            major, minor, patch = map(int, m.groups())
        else:
            major, minor, patch = (0, 1, 0)

        has_major = any(
            "BREAKING" in c[3] or "feat!:" in c[3] or "fix!:" in c[3]
            for c in commits
        )
        has_minor = any(
            re.match(r"^[a-z0-9]+\s+feat(\([^)]+\))?:", c[3], re.IGNORECASE)
            or re.match(r"^feat(\([^)]+\))?:", c[3], re.IGNORECASE)
            for c in commits
        )

        if has_major:
            next_version = f"{major + 1}.0.0"
        elif has_minor:
            next_version = f"{major}.{minor + 1}.0"
        else:
            next_version = f"{major}.{minor}.{patch + 1}"
    else:
        next_version = pkg_version

    next_tag = f"v{next_version}"
    print(f"🎯 Target release version: {next_tag}")

    # 4. Phân loại commits theo Conventional Commits
    features: list[str] = []
    fixes: list[str] = []
    refactors: list[str] = []
    docs: list[str] = []
    maintenance: list[str] = []

    for short_h, full_h, author, msg in commits:
        line = f"• {msg} ([`{short_h}`](https://github.com/{repo}/commit/{full_h})) by @{author}"
        msg_clean = msg.strip()

        if re.match(r"^feat(\([^)]+\))?!?:", msg_clean, re.IGNORECASE):
            features.append(line)
        elif re.match(r"^fix(\([^)]+\))?!?:", msg_clean, re.IGNORECASE):
            fixes.append(line)
        elif re.match(r"^(perf|refactor)(\([^)]+\))?!?:", msg_clean, re.IGNORECASE):
            refactors.append(line)
        elif re.match(r"^docs?(\([^)]+\))?!?:", msg_clean, re.IGNORECASE):
            docs.append(line)
        else:
            maintenance.append(line)

    # 6. Soạn thảo Release Notes
    today_str = datetime.now().strftime("%Y-%m-%d")
    body_parts = [f"## ✨ Central Gateway {next_tag} ({today_str})\n"]

    if features:
        body_parts.append("### 🚀 Tính năng mới & Mô phỏng (Features)")
        body_parts.extend(features)
        body_parts.append("")

    if fixes:
        body_parts.append("### 🐛 Sửa lỗi (Bug Fixes)")
        body_parts.extend(fixes)
        body_parts.append("")

    if refactors:
        body_parts.append("### ⚡ Hiệu năng & Tái cấu trúc (Performance & Refactor)")
        body_parts.extend(refactors)
        body_parts.append("")

    if docs:
        body_parts.append("### 📚 Tài liệu (Documentation)")
        body_parts.extend(docs)
        body_parts.append("")

    if maintenance:
        body_parts.append("### 🔧 Bảo trì & CI/CD (Maintenance)")
        body_parts.extend(maintenance)
        body_parts.append("")

    body_parts.append("---")
    body_parts.append(
        "*Central Gateway — Centralized Notification Gateway & Cloud Infrastructure Hub.*"
    )

    if latest_tag:
        body_parts.append(
            f"\n**Full Changelog**: https://github.com/{repo}/compare/{latest_tag}...{next_tag}"
        )
    else:
        body_parts.append(
            f"\n**Full Changelog**: https://github.com/{repo}/commits/{next_tag}"
        )

    body = "\n".join(body_parts).strip() + "\n"
    title = f"✨ Central Gateway {next_tag}"

    # 7. Kiểm tra và cập nhật bản Draft Release trên GitHub
    releases_json = run(["gh", "release", "list", "--json", "isDraft,tagName,name"])
    try:
        releases = json.loads(releases_json)
    except Exception:
        releases = []

    existing_draft = next((r for r in releases if r.get("isDraft")), None)

    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".md") as tmp:
        tmp.write(body)
        tmp_path = tmp.name

    try:
        if existing_draft:
            draft_tag = existing_draft["tagName"]
            print(f"🔄 Đang cập nhật bản nháp có sẵn ({draft_tag}) -> {next_tag}...")
            run([
                "gh",
                "release",
                "edit",
                draft_tag,
                "--draft",
                "--tag",
                next_tag,
                "--target",
                "main",
                "--title",
                title,
                "--notes-file",
                tmp_path,
            ])
        else:
            print(f"✨ Đang tạo bản nháp mới ({next_tag})...")
            run([
                "gh",
                "release",
                "create",
                next_tag,
                "--draft",
                "--target",
                "main",
                "--title",
                title,
                "--notes-file",
                tmp_path,
            ])
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    print(f"✅ Cập nhật Draft Release {next_tag} thành công với đầy đủ {len(commits)} commits!")


if __name__ == "__main__":
    main()
