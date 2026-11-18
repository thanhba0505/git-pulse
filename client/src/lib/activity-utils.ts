import { PrActivity } from '../types';

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
