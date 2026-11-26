import { PrActivity, PrState } from '../types';

export interface PrStateVisualStyle {
  normalized: PrState;
  badgeClass: string;
  iconClass: string;
  dotClass: string;
}

const PR_STATE_STYLES: Record<PrState, Omit<PrStateVisualStyle, 'normalized'>> = {
  draft: {
    badgeClass: 'bg-[#6e7681]/20 text-[#b1bac4] border border-[#6e7681]/45',
    iconClass: 'text-[#8b949e]',
    dotClass: 'bg-[#8b949e]',
  },
  open: {
    badgeClass: 'bg-[#238636]/20 text-[#3fb950] border border-[#2ea043]/40',
    iconClass: 'text-[#3fb950]',
    dotClass: 'bg-[#3fb950]',
  },
  merged: {
    badgeClass: 'bg-[#8957e5]/20 text-[#ab7df8] border border-[#8957e5]/45',
    iconClass: 'text-[#ab7df8]',
    dotClass: 'bg-[#ab7df8]',
  },
  closed: {
    badgeClass: 'bg-[#da3633]/20 text-[#ff7b72] border border-[#f85149]/40',
    iconClass: 'text-[#f85149]',
    dotClass: 'bg-[#f85149]',
  },
  direct_commits: {
    badgeClass: 'bg-sky-500/15 text-sky-300 border border-sky-500/35',
    iconClass: 'text-sky-400',
    dotClass: 'bg-sky-400',
  },
};

export function getPrStateStyle(rawState: string): PrStateVisualStyle {
  const s = rawState.toLowerCase();
  const normalized: PrState =
    s === 'draft' || s === 'open' || s === 'merged' || s === 'closed' || s === 'direct_commits'
      ? s
      : 'closed';
  return {
    normalized,
    ...PR_STATE_STYLES[normalized],
  };
}

export function getPrKey(pr: PrActivity): string {
  if (pr.activityType === 'direct_commits') {
    return `${pr.repo}#branch:${pr.headBranch || 'main'}`;
  }
  return `${pr.repo}#${pr.number}`;
}

export function getTaskItemKey(repo: string, prNumber: number): string {
  return `${repo}#${prNumber}`;
}

export interface ParsedPullRequestRef {
  owner: string;
  repo: string;
  number: number;
}

const GITHUB_PR_URL_RE =
  /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/pull\/(\d+)(?:[/?#].*)?$/i;
const GITHUB_PR_SHORT_RE = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)$/;

/** Parse `https://github.com/owner/repo/pull/123` or `owner/repo#123` into structured repo/number parts. */
export function parsePullRequestRef(raw: string): ParsedPullRequestRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = GITHUB_PR_URL_RE.exec(trimmed) ?? GITHUB_PR_SHORT_RE.exec(trimmed);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  const prNumber = Number.parseInt(match[3], 10);
  if (!owner || !repo || !Number.isSafeInteger(prNumber) || prNumber <= 0) {
    return null;
  }

  return { owner, repo, number: prNumber };
}

export function toTaskItemInput(pr: PrActivity) {
  return {
    repo: pr.repo,
    prNumber: pr.number,
    title:
      pr.activityType === 'direct_commits' ? `${pr.repo} (${pr.headBranch || pr.title})` : pr.title,
    prUrl: pr.prUrl,
    state: pr.state,
    ownerType: pr.ownerType,
  };
}

export function formatRelativeTime(isoDate: string | undefined, locale: 'vi' | 'en'): string {
  if (!isoDate) return '';
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) return '';

  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    numeric: 'auto',
    style: 'narrow',
  });

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, 'second');
  }
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }
  const diffHours = Math.round(diffSeconds / 3600);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }
  const diffDays = Math.round(diffSeconds / 86400);
  return rtf.format(diffDays, 'day');
}

export interface ExpirationInfo {
  label: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining?: number;
  formattedDate?: string;
  badgeClass: string;
}

export function formatExpiration(
  expiresAt?: string | Date | null,
  locale: 'vi' | 'en' = 'vi',
): ExpirationInfo {
  if (!expiresAt) {
    return {
      label: locale === 'vi' ? 'Không thời hạn' : 'No expiration',
      isExpired: false,
      isExpiringSoon: false,
      badgeClass: 'text-slate-400 bg-slate-800/60 border-slate-700/60',
    };
  }

  const targetDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const targetTime = targetDate.getTime();
  if (Number.isNaN(targetTime)) {
    return {
      label: locale === 'vi' ? 'Không thời hạn' : 'No expiration',
      isExpired: false,
      isExpiringSoon: false,
      badgeClass: 'text-slate-400 bg-slate-800/60 border-slate-700/60',
    };
  }

  const dateStr = targetDate.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const now = Date.now();
  const diffMs = targetTime - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs <= 0 || diffDays <= 0) {
    return {
      label: locale === 'vi' ? `Đã hết hạn (${dateStr})` : `Expired (${dateStr})`,
      isExpired: true,
      isExpiringSoon: false,
      daysRemaining: 0,
      formattedDate: dateStr,
      badgeClass: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
    };
  }

  if (diffDays <= 7) {
    return {
      label:
        locale === 'vi'
          ? `Hết hạn sau ${diffDays} ngày (${dateStr})`
          : `Expires in ${diffDays}d (${dateStr})`,
      isExpired: false,
      isExpiringSoon: true,
      daysRemaining: diffDays,
      formattedDate: dateStr,
      badgeClass: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    };
  }

  return {
    label:
      locale === 'vi'
        ? `Hết hạn: ${dateStr} (còn ${diffDays} ngày)`
        : `Expires: ${dateStr} (${diffDays}d left)`,
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: diffDays,
    formattedDate: dateStr,
    badgeClass: 'text-slate-300 bg-slate-800/80 border-slate-700/70',
  };
}
