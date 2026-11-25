import {
  buildParabolMeetingUrl,
  buildParabolTipTapContent,
  classifyParabolError,
  maskParabolToken,
  normalizeParabolToken,
  parseParabolMeetingId,
} from './parabol.helpers';

describe('parabol.helpers', () => {
  describe('parseParabolMeetingId', () => {
    it('extracts meeting ID from Parabol meeting URLs and raw IDs', () => {
      expect(parseParabolMeetingId('https://action.parabol.co/meet/m-12345')).toBe('m-12345');
      expect(parseParabolMeetingId('https://action.parabol.co/meet/DEMO_MEET_01/responses')).toBe(
        'DEMO_MEET_01',
      );
      expect(parseParabolMeetingId('https://action.parabol.co/meet/abc_XYZ-99?tab=reflect')).toBe(
        'abc_XYZ-99',
      );
      expect(parseParabolMeetingId('m-54321')).toBe('m-54321');
    });

    it('rejects empty or invalid meeting references', () => {
      expect(parseParabolMeetingId('')).toBeNull();
      expect(parseParabolMeetingId('https://action.parabol.co/meetings')).toBeNull();
      expect(parseParabolMeetingId('not a valid id with spaces')).toBeNull();
    });
  });

  describe('maskParabolToken & buildParabolMeetingUrl', () => {
    it('masks secrets while preserving short prefix/suffix', () => {
      expect(maskParabolToken('pbl_1234567890abcdef')).toBe('pbl_••••cdef');
      expect(maskParabolToken('short')).toBe('••••');
    });

    it('builds direct Parabol meeting URLs', () => {
      expect(buildParabolMeetingUrl('m-123')).toBe('https://action.parabol.co/meet/m-123');
    });
  });

  describe('buildParabolTipTapContent', () => {
    it('preserves Today: header and serializes bullets into TipTap doc paragraphs with inline marks', () => {
      const json = buildParabolTipTapContent([
        'Today:',
        '• Fixed **auth** bug in `api.ts` ([PR #12](https://github.com/org/repo/pull/12))',
      ]);

      const doc = JSON.parse(json) as {
        type: string;
        content: Array<{
          type: string;
          content: Array<{ type: string; text: string; marks?: Array<{ type: string }> }>;
        }>;
      };

      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(2);
      expect(doc.content[0]?.content[0]?.text).toBe('Today:');
      expect(doc.content[0]?.content[0]?.marks?.[0]?.type).toBe('bold');
      expect(doc.content[1]?.content.map((n) => n.text).join('')).toBe(
        '• Fixed auth bug in api.ts (PR #12)',
      );
      expect(doc.content[1]?.content.some((n) => n.marks?.[0]?.type === 'link')).toBe(true);
    });
  });

  describe('classifyParabolError', () => {
    it('marks 401/403 HTTP failures as revocable auth errors and preserves 429 retry hints', () => {
      const err = classifyParabolError(401);
      expect(err.statusCode).toBe(401);
      expect(err.revokeToken).toBe(true);

      const rateErr = classifyParabolError(429, undefined, '15');
      expect(rateErr.statusCode).toBe(429);
      expect(rateErr.revokeToken).toBe(false);
      expect(rateErr.message).toContain('15s');
    });

    it('classifies GraphQL scope, invalid token format, and not-found errors accurately', () => {
      expect(
        classifyParabolError(undefined, [{ message: 'Missing scope MEETINGS_WRITE' }]).statusCode,
      ).toBe(403);
      expect(classifyParabolError(undefined, [{ message: 'Meeting not found' }]).statusCode).toBe(
        404,
      );
      const pqErr = classifyParabolError(undefined, [
        { message: 'PersistedQueryOnly', extensions: { code: 'CANNOT_SEND_PQ_ID_AND_BODY' } },
      ]);
      expect(pqErr.statusCode).toBe(400);
      expect(pqErr.code).toBe('PARABOL_INVALID_TOKEN_FORMAT');

      const unauthErr = classifyParabolError(undefined, [
        {
          message: 'Invalid or revoked personal access token',
          extensions: { code: 'UNAUTHENTICATED' },
        },
      ]);
      expect(unauthErr.statusCode).toBe(401);
      expect(unauthErr.revokeToken).toBe(true);

      expect(normalizeParabolToken('  "Bearer pat_abc123"  ')).toBe('pat_abc123');
    });
  });
});
