import type {ActivityItem, Participant, User} from './types';

export function isUser(value: unknown): value is User {
  return !!value && typeof value === 'object' && (value as User).$type === 'User' &&
    typeof (value as User).login === 'string';
}

export function getUsers(values: unknown): User[] {
  if (!values) {
    return [];
  }
  return (Array.isArray(values) ? values : [values]).filter(isUser);
}

/** Collects users and their roles; one entry per login. */
export class ParticipantsCollector {
  private readonly map = new Map<string, Participant>();

  add(user: User | null | undefined, role: string, timestamp = 0): void {
    if (!isUser(user)) {
      return;
    }
    let p = this.map.get(user.login);
    if (!p) {
      p = {
        login: user.login,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        roles: new Set<string>(),
        lastActivityTimestamp: timestamp,
      };
      this.map.set(user.login, p);
    }
    p.roles.add(role);
    p.lastActivityTimestamp = Math.max(p.lastActivityTimestamp, timestamp);
  }

  /** Gives every activity author the role its category maps to; categories without a role are skipped. */
  addActivityAuthors(activities: ActivityItem[], roleByCategory: Readonly<Record<string, string>>): void {
    for (const activity of activities) {
      const role = roleByCategory[activity.category.id];
      if (role) {
        this.add(activity.author, role, activity.timestamp);
      }
    }
  }

  /**
   * Adds the users listed in `added` of the given categories, e.g. mentioned users. Being mentioned is not
   * the user's own activity, so it does not move them up the list.
   */
  addActivityTargets(activities: ActivityItem[], categories: ReadonlySet<string>, role: string): void {
    for (const activity of activities) {
      if (categories.has(activity.category.id)) {
        for (const user of getUsers(activity.added)) {
          this.add(user, role);
        }
      }
    }
  }

  toArray(): Participant[] {
    return Array.from(this.map.values());
  }
}

/**
 * Pinned logins come first in the given order; everyone else follows by most recent activity.
 */
export function sortParticipants(participants: Participant[], pinnedLogins: Array<string | undefined>): Participant[] {
  const pinned = pinnedLogins.filter((login): login is string => !!login);
  const rank = (p: Participant) => {
    const index = pinned.indexOf(p.login);
    return index === -1 ? pinned.length : index;
  };
  return [...participants].sort((a, b) =>
    rank(a) - rank(b) || b.lastActivityTimestamp - a.lastActivityTimestamp
  );
}

/** Strips the `(initial)` / `(past)` suffix so a filter matches current and historical roles. */
export const normalizeRole = (role: string) => role.replace(/ \((initial|past)\)$/, '');
