import { DEFAULT_FETCH_PREFERENCES, normalizeFetchPreferences } from '../settings/settings.types';
import {
  buildPrSearchQueryString,
  matchesWorkspacePreferences,
  normalizePrNode,
  resolveOwnerType,
  resolvePrState,
} from './github-activity.helpers';

describe('github-activity.helpers', () => {
  describe('resolvePrState', () => {
    it('prioritizes draft over open state', () => {
      expect(resolvePrState({ state: 'OPEN', isDraft: true, merged: false })).toBe('draft');
    });

    it('detects merged state from boolean or mergedAt timestamp', () => {
      expect(resolvePrState({ state: 'CLOSED', isDraft: false, merged: true })).toBe('merged');
      expect(
        resolvePrState({
          state: 'closed',
          isDraft: false,
          mergedAt: '2026-11-18T10:00:00Z',
        }),
      ).toBe('merged');
    });

    it('returns open or closed accurately', () => {
      expect(resolvePrState({ state: 'OPEN', isDraft: false, merged: false })).toBe('open');
      expect(resolvePrState({ state: 'CLOSED', isDraft: false, merged: false })).toBe('closed');
    });

    it('resolves closed or merged precedence even when GitHub still keeps isDraft true', () => {
      expect(resolvePrState({ state: 'CLOSED', isDraft: true, merged: false })).toBe('closed');
      expect(
        resolvePrState({
          state: 'CLOSED',
          isDraft: true,
          merged: false,
          mergedAt: null,
        }),
      ).toBe('closed');
      expect(resolvePrState({ state: 'MERGED', isDraft: true, merged: true })).toBe('merged');
      expect(resolvePrState({ state: 'MERGED', isDraft: true, merged: false })).toBe('merged');
    });
  });

  describe('resolveOwnerType & matchesWorkspacePreferences', () => {
    it('classifies Organization vs User repositories', () => {
      expect(resolveOwnerType('Organization', 'nanocohub', 'thanhba')).toBe('organization');
      expect(resolveOwnerType('User', 'thanhba', 'thanhba')).toBe('personal');
      expect(resolveOwnerType(undefined, 'thanhba', 'thanhba')).toBe('personal');
    });

    it('filters personal and organization scopes according to preferences', () => {
      const orgOnlyPrefs = {
        ...DEFAULT_FETCH_PREFERENCES,
        includePersonal: false,
        includedOrgs: ['nanocohub'],
      };

      expect(matchesWorkspacePreferences('personal', 'thanhba', orgOnlyPrefs)).toBe(false);
      expect(matchesWorkspacePreferences('organization', 'nanocohub', orgOnlyPrefs)).toBe(true);
      expect(matchesWorkspacePreferences('organization', 'other-org', orgOnlyPrefs)).toBe(false);
    });
  });

  describe('normalizePrNode', () => {
    it('keeps a Draft PR without commits in window when includePrWithoutCommitsInRange is enabled', () => {
      const seenShas = new Set<string>();
      const since = new Date('2026-11-18T00:00:00Z');
      const result = normalizePrNode(
        {
          number: 12,
          title: 'feat: draft task tracking',
          url: 'https://github.com/thanhba/git-pulse/pull/12',
          state: 'OPEN',
          isDraft: true,
          merged: false,
          createdAt: '2026-11-18T09:00:00Z',
          updatedAt: '2026-11-18T10:00:00Z',
          headRefName: 'feat/task-tracking',
          baseRefName: 'develop',
          repository: {
            nameWithOwner: 'thanhba/git-pulse',
            isPrivate: true,
            owner: {
              login: 'thanhba',
              __typename: 'User',
              avatarUrl: 'https://avatar.test/u.png',
            },
          },
          commits: {
            nodes: [
              {
                commit: {
                  oid: 'abcdef1234567',
                  messageHeadline: 'wip: scaffold task schema',
                  committedDate: '2026-11-17T18:00:00Z',
                },
              },
            ],
          },
        },
        since,
        'thanhba',
        DEFAULT_FETCH_PREFERENCES,
        seenShas,
      );

      expect(result).not.toBeNull();
      expect(result?.state).toBe('draft');
      expect(result?.ownerType).toBe('personal');
      expect(result?.headBranch).toBe('feat/task-tracking');
      expect(result?.commits).toEqual(['wip: scaffold task schema']);
      expect(seenShas.has('abcdef1234567')).toBe(true);
    });

    it('drops PR states excluded by user settings', () => {
      const seenShas = new Set<string>();
      const result = normalizePrNode(
        {
          number: 15,
          title: 'feat: wip',
          url: 'https://github.com/nanocohub/api/pull/15',
          state: 'OPEN',
          isDraft: true,
          merged: false,
          updatedAt: '2026-11-18T10:00:00Z',
          repository: {
            nameWithOwner: 'nanocohub/api',
            isPrivate: true,
            owner: { login: 'nanocohub', __typename: 'Organization' },
          },
          commits: { nodes: [] },
        },
        new Date('2026-11-18T00:00:00Z'),
        'thanhba',
        { ...DEFAULT_FETCH_PREFERENCES, prStates: ['open', 'merged'] },
        seenShas,
      );

      expect(result).toBeNull();
    });
  });

  describe('buildPrSearchQueryString & normalizeFetchPreferences', () => {
    it('uses involves qualifier when configured', () => {
      expect(
        buildPrSearchQueryString('thanhba', '2026-11-17', {
          ...DEFAULT_FETCH_PREFERENCES,
          fetchRole: 'involves',
        }),
      ).toContain('involves:thanhba');
    });

    it('safely normalizes arbitrary or invalid persisted JSON', () => {
      const normalized = normalizeFetchPreferences({
        defaultGroupBy: 'invalid',
        includePersonal: false,
        includedOrgs: [' nanocohub ', 123, 'nanocohub'],
        prStates: ['draft', 'bogus'],
      });

      expect(normalized.defaultGroupBy).toBe('owner');
      expect(normalized.includePersonal).toBe(false);
      expect(normalized.includedOrgs).toEqual(['nanocohub']);
      expect(normalized.prStates).toEqual(['draft']);
    });
  });
});
