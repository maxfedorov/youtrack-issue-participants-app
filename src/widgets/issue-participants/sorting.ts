import {Participant} from './types';

export const getSortedParticipants = (participants: Participant[], currentAssigneeLogin?: string, reporterLogin?: string): Participant[] => {
  return [...participants].sort((a, b) => {
    // 1. Reporter first
    if (a.login === reporterLogin) {
      return -1;
    }
    if (b.login === reporterLogin) {
      return 1;
    }

    // 2. Current assignee second
    if (a.login === currentAssigneeLogin) {
      return -1;
    }
    if (b.login === currentAssigneeLogin) {
      return 1;
    }

    // 3. Others by last activity timestamp (newest first)
    return b.lastActivityTimestamp - a.lastActivityTimestamp;
  });
};

export const formatRoles = (participant: Participant, currentAssigneeLogin?: string, reporterLogin?: string, initialAssigneeLogin?: string): string => {
  const roles = Array.from(participant.roles);
  
  return roles.map(role => {
    let label = role;
    if (role === 'assignee') {
      if (participant.login === currentAssigneeLogin) {
        label = 'assignee (current)';
      } else if (participant.login === initialAssigneeLogin) {
        label = 'assignee (initial)';
      } else {
        label = 'assignee (past)';
      }
    }
    return label;
  }).join(', ');
};
