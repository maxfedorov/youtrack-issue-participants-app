import type {ActivityItem, ActivityPage, Host, User} from './types';

export const user = (login: string): User => ({login, fullName: login.toUpperCase(), $type: 'User'});

export const activity = (category: string, author: string | null, timestamp: number,
  extra: Partial<ActivityItem> = {}): ActivityItem => ({
  category: {id: category},
  author: author ? user(author) : null,
  timestamp,
  ...extra,
});

interface Call {
  path: string;
  query: Record<string, string | number | boolean>;
}

/**
 * A fake host that answers `fetchYouTrack` from a handler and records every call.
 */
export function fakeHost(handler: (call: Call) => unknown): {host: Host; calls: Call[]} {
  const calls: Call[] = [];
  const host = {
    fetchYouTrack: async (path: string, params?: {query?: Record<string, string | number | boolean>}) => {
      const call = {path, query: {...(params?.query ?? {})}};
      calls.push(call);
      return handler(call);
    },
  } as unknown as Host;
  return {host, calls};
}

/** Serves activities in cursor pages the way activitiesPage does with `reverse=true`: newest first. */
export function paged(activities: ActivityItem[], pageSize: number, cursor: string | number | boolean | undefined): ActivityPage {
  const newestFirst = [...activities].reverse();
  const start = cursor === undefined ? 0 : Number(cursor);
  const end = start + pageSize;
  return {
    activities: newestFirst.slice(start, end),
    hasBefore: end < newestFirst.length,
    beforeCursor: String(end),
  };
}
