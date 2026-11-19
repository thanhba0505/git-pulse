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
