import { HttpException, Injectable, Logger } from '@nestjs/common';
import { extractTokenExpiration } from '../common/token-expiration.util';
import {
  classifyParabolError,
  ParabolGraphqlErrorEntry,
  resolveParabolGraphqlUrl,
} from './parabol.helpers';

export interface ParabolViewerTeam {
  id: string;
  name: string;
}

export interface ParabolViewerProfile {
  id: string;
  preferredName: string;
  email: string | null;
  teams: ParabolViewerTeam[];
  expiresAt?: Date | null;
}

export interface ParabolPromptSummary {
  id: string;
  question: string;
  description: string;
  sortOrder: string;
}

export interface ParabolExistingResponseSummary {
  id: string;
  promptId: string;
  sharedAt: string | null;
}

export interface ParabolStandupMeeting {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  createdAt: string;
  prompts: ParabolPromptSummary[];
  viewerResponses: ParabolExistingResponseSummary[];
}

export interface UpsertStandupResponseResult {
  responseId: string;
  promptId: string;
  sharedAt: string | null;
  meetingId: string;
  meetingName: string;
}

export interface ShareStandupResponsesResult {
  meetingId: string;
  sharedCount: number;
  sharedAt: string | null;
}

export class ParabolClientError extends HttpException {
  readonly code: string;
  readonly revokeToken: boolean;

  constructor(params: { statusCode: number; code: string; message: string; revokeToken: boolean }) {
    super({ message: params.message, code: params.code }, params.statusCode);
    this.code = params.code;
    this.revokeToken = params.revokeToken;
  }
}

interface ViewerProfileQueryData {
  viewer: {
    id: string;
    preferredName: string;
    email: string | null;
    teams: Array<{ id: string; name: string }>;
  };
}

interface RawMeetingNode {
  __typename: string;
  id: string;
  name?: string | null;
  createdAt: string;
  endedAt: string | null;
  team?: { id: string; name: string } | null;
  prompts?: Array<{
    id: string;
    question: string;
    description: string;
    sortOrder: string;
  }>;
  responses?: Array<{
    id: string;
    userId: string;
    promptId: string;
    sharedAt: string | null;
  }>;
}

interface ActiveStandupsByTeamsQueryData {
  viewer: {
    id: string;
    teams: Array<{
      id: string;
      name: string;
      activeMeetings: RawMeetingNode[];
    }>;
  };
}

interface SingleMeetingQueryData {
  viewer: {
    id: string;
    meeting: RawMeetingNode | null;
  };
}

interface UpsertResponseMutationData {
  upsertTeamPromptResponse: {
    teamPromptResponse: {
      id: string;
      promptId: string;
      sharedAt: string | null;
    };
    meeting: {
      id: string;
      name: string | null;
    };
  };
}

interface ShareResponsesMutationData {
  shareTeamPromptResponses: {
    meeting: {
      id: string;
    };
    responses: Array<{
      id: string;
      sharedAt: string | null;
    }>;
  };
}

const VIEWER_PROFILE_QUERY = `query ViewerProfile {
  viewer {
    id
    preferredName
    email
    teams {
      id
      name
    }
  }
}`;

const ACTIVE_STANDUPS_BY_TEAMS_QUERY = `query ActiveStandupsByTeams {
  viewer {
    id
    teams {
      id
      name
      activeMeetings {
        __typename
        id
        createdAt
        endedAt
        ... on TeamPromptMeeting {
          name
          prompts {
            id
            question
            description
            sortOrder
          }
          responses {
            id
            userId
            promptId
            sharedAt
          }
        }
      }
    }
  }
}`;

const STANDUP_BY_ID_QUERY = `query StandupById($meetingId: ID!) {
  viewer {
    id
    meeting(meetingId: $meetingId) {
      __typename
      id
      createdAt
      endedAt
      team {
        id
        name
      }
      ... on TeamPromptMeeting {
        name
        prompts {
          id
          question
          description
          sortOrder
        }
        responses {
          id
          userId
          promptId
          sharedAt
        }
      }
    }
  }
}`;

const UPSERT_TEAM_PROMPT_RESPONSE_MUTATION = `mutation UpsertTeamPromptResponse($meetingId: ID!, $promptId: ID!, $content: String!) {
  upsertTeamPromptResponse(meetingId: $meetingId, promptId: $promptId, content: $content) {
    teamPromptResponse {
      id
      promptId
      sharedAt
    }
    meeting {
      id
      name
    }
  }
}`;

const SHARE_TEAM_PROMPT_RESPONSES_MUTATION = `mutation ShareTeamPromptResponses($meetingId: ID!) {
  shareTeamPromptResponses(meetingId: $meetingId) {
    meeting {
      id
    }
    responses {
      id
      sharedAt
    }
  }
}`;

@Injectable()
export class ParabolClient {
  private readonly logger = new Logger(ParabolClient.name);
  private readonly timeoutMs = 10000;

  private async executeGraphqlWithHeaders<T>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<{ data: T; headers: Headers }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(resolveParabolGraphqlUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'GitPulse/1.0',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryAfter = response.headers.get('retry-after');
        if (response.status === 429) {
          this.logger.warn(
            `Parabol GraphQL rate limited (429). retry-after=${retryAfter ?? 'none'}, x-ratelimit-remaining=${response.headers.get('x-ratelimit-remaining') ?? 'none'}`,
          );
        }
        const classified = classifyParabolError(response.status, undefined, retryAfter);
        throw new ParabolClientError(classified);
      }

      const json = (await response.json()) as {
        data?: T;
        errors?: ReadonlyArray<ParabolGraphqlErrorEntry>;
      };

      if (json.errors && json.errors.length > 0) {
        const classified = classifyParabolError(undefined, json.errors);
        throw new ParabolClientError(classified);
      }

      if (!json.data) {
        throw new ParabolClientError({
          statusCode: 502,
          code: 'PARABOL_EMPTY_RESPONSE',
          message: 'Parabol API returned an empty response.',
          revokeToken: false,
        });
      }

      return { data: json.data, headers: response.headers };
    } catch (error) {
      if (error instanceof ParabolClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ParabolClientError({
          statusCode: 504,
          code: 'PARABOL_TIMEOUT',
          message: 'Request to Parabol API timed out. Please try again.',
          revokeToken: false,
        });
      }
      throw new ParabolClientError({
        statusCode: 502,
        code: 'PARABOL_NETWORK_ERROR',
        message: 'Could not reach Parabol API. Please try again later.',
        revokeToken: false,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async executeGraphql<T>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const { data } = await this.executeGraphqlWithHeaders<T>(token, query, variables);
    return data;
  }

  private normalizeStandupNode(
    node: RawMeetingNode,
    viewerUserId: string,
  ): ParabolStandupMeeting | null {
    if (node.__typename !== 'TeamPromptMeeting' || node.endedAt !== null) {
      return null;
    }

    const prompts = [...(node.prompts ?? [])].sort((a, b) =>
      a.sortOrder.localeCompare(b.sortOrder),
    );
    const viewerResponses = (node.responses ?? [])
      .filter((r) => r.userId === viewerUserId)
      .map((r) => ({
        id: r.id,
        promptId: r.promptId,
        sharedAt: r.sharedAt,
      }));

    return {
      id: node.id,
      name: node.name?.trim() || 'Standup',
      teamId: node.team?.id ?? '',
      teamName: node.team?.name?.trim() || 'Team',
      createdAt: node.createdAt,
      prompts,
      viewerResponses,
    };
  }

  async fetchViewerProfile(token: string): Promise<ParabolViewerProfile> {
    const { data, headers } = await this.executeGraphqlWithHeaders<ViewerProfileQueryData>(
      token,
      VIEWER_PROFILE_QUERY,
      {},
    );
    return {
      ...data.viewer,
      expiresAt: extractTokenExpiration(token, headers),
    };
  }

  async fetchActiveStandupMeetings(token: string): Promise<ParabolStandupMeeting[]> {
    const data = await this.executeGraphql<ActiveStandupsByTeamsQueryData>(
      token,
      ACTIVE_STANDUPS_BY_TEAMS_QUERY,
      {},
    );

    const viewerId = data.viewer.id;
    const seenIds = new Set<string>();
    const result: ParabolStandupMeeting[] = [];

    for (const team of data.viewer.teams) {
      for (const meeting of team.activeMeetings) {
        if (seenIds.has(meeting.id)) continue;
        const normalized = this.normalizeStandupNode(
          {
            ...meeting,
            team: meeting.team ?? { id: team.id, name: team.name },
          },
          viewerId,
        );
        if (normalized && normalized.prompts.length > 0) {
          seenIds.add(meeting.id);
          result.push(normalized);
        }
      }
    }

    return result;
  }

  async fetchStandupMeetingById(token: string, meetingId: string): Promise<ParabolStandupMeeting> {
    const data = await this.executeGraphql<SingleMeetingQueryData>(token, STANDUP_BY_ID_QUERY, {
      meetingId,
    });

    const meeting = data.viewer.meeting;
    if (!meeting) {
      throw new ParabolClientError({
        statusCode: 404,
        code: 'PARABOL_MEETING_NOT_FOUND',
        message: 'Parabol Standup meeting not found or your token lacks access.',
        revokeToken: false,
      });
    }

    if (meeting.__typename !== 'TeamPromptMeeting') {
      throw new ParabolClientError({
        statusCode: 400,
        code: 'PARABOL_INVALID_MEETING_TYPE',
        message: `Selected Parabol meeting is ${meeting.__typename}, not a Standup (TeamPromptMeeting).`,
        revokeToken: false,
      });
    }

    if (meeting.endedAt !== null) {
      throw new ParabolClientError({
        statusCode: 400,
        code: 'PARABOL_MEETING_ENDED',
        message: 'This Parabol Standup meeting has already ended.',
        revokeToken: false,
      });
    }

    const normalized = this.normalizeStandupNode(meeting, data.viewer.id);
    if (!normalized || normalized.prompts.length === 0) {
      throw new ParabolClientError({
        statusCode: 400,
        code: 'PARABOL_NO_PROMPTS',
        message: 'This Parabol Standup meeting has no prompts available to answer.',
        revokeToken: false,
      });
    }

    return normalized;
  }

  async upsertTeamPromptResponse(
    token: string,
    input: { meetingId: string; promptId: string; content: string },
  ): Promise<UpsertStandupResponseResult> {
    const data = await this.executeGraphql<UpsertResponseMutationData>(
      token,
      UPSERT_TEAM_PROMPT_RESPONSE_MUTATION,
      input,
    );

    const { teamPromptResponse, meeting } = data.upsertTeamPromptResponse;
    return {
      responseId: teamPromptResponse.id,
      promptId: teamPromptResponse.promptId,
      sharedAt: teamPromptResponse.sharedAt,
      meetingId: meeting.id,
      meetingName: meeting.name?.trim() || 'Standup',
    };
  }

  async shareTeamPromptResponses(
    token: string,
    meetingId: string,
  ): Promise<ShareStandupResponsesResult> {
    const data = await this.executeGraphql<ShareResponsesMutationData>(
      token,
      SHARE_TEAM_PROMPT_RESPONSES_MUTATION,
      { meetingId },
    );

    const responses = data.shareTeamPromptResponses.responses;
    const latestSharedAt = responses.find((r) => Boolean(r.sharedAt))?.sharedAt ?? null;
    return {
      meetingId: data.shareTeamPromptResponses.meeting.id,
      sharedCount: responses.length,
      sharedAt: latestSharedAt,
    };
  }
}
