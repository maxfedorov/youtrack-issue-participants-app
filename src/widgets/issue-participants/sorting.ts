import type {Participant} from './types';

export function getSortedParticipants(participants: Participant[], reporterLogin?: string): Participant[] {
  return [...participants].sort((a, b) => {
    // Reporter always first
    if (a.login === reporterLogin) {
      return -1;
    }
    if (b.login === reporterLogin) {
      return 1;
    }

    // Current assignee second
    const aIsAssignee = a.roles.has('assignee');
    const bIsAssignee = b.roles.has('assignee');
    if (aIsAssignee && !bIsAssignee) {
      return -1;
    }
    if (!aIsAssignee && bIsAssignee) {
      return 1;
    }

    // Others by most recent activity (newest first)
    return b.lastActivityTimestamp - a.lastActivityTimestamp;
  });
}

