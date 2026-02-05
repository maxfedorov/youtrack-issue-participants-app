import {Participant} from './types';

export const getSortedParticipants = (participants: Participant[], reporterLogin?: string): Participant[] => {
  return [...participants].sort((a, b) => {
    // 1. Reporter first
    if (a.login === reporterLogin) {
      return -1;
    }
    if (b.login === reporterLogin) {
      return 1;
    }

    // 2. Assignee (current) second
    const isAAssignee = a.roles.has('assignee');
    const isBAssignee = b.roles.has('assignee');

    if (isAAssignee && !isBAssignee) {
      return -1;
    }
    if (!isAAssignee && isBAssignee) {
      return 1;
    }

    // 3. Others by last activity timestamp (newest first)
    return b.lastActivityTimestamp - a.lastActivityTimestamp;
  });
};

export const formatRoles = (participant: Participant): string[] => {
  return Array.from(participant.roles);
};
