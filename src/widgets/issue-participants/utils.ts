/* eslint-disable complexity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {Issue, ActivityItem, Participant, User} from './types';

export const extractResult = (response: unknown): any => {
  if (response && typeof response === 'object' && 'result' in (response as object)) {
    return (response as any).result;
  }
  return response;
};

export const collectParticipants = (issue: Issue, activities: ActivityItem[]): Participant[] => {
  const participantsMap = new Map<string, Participant>();

  const getOrCreateParticipant = (user: User, timestamp: number): Participant => {
    let participant = participantsMap.get(user.login);
    if (!participant) {
      participant = {
        login: user.login,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        roles: new Set<string>(),
        lastActivityTimestamp: timestamp
      };
      participantsMap.set(user.login, participant);
    }
    if (timestamp > participant.lastActivityTimestamp) {
      participant.lastActivityTimestamp = timestamp;
    }
    return participant;
  };

  // 1. Reporter
  if (issue.reporter) {
    const p = getOrCreateParticipant(issue.reporter, 0);
    p.roles.add('reporter');
  }

  // 2. Fields
  issue.fields.forEach(field => {
    const value = field.value;
    const fieldName = field.projectCustomField.field.name;
    const valueType = field.projectCustomField.field.fieldType.valueType;

    if (valueType === 'user') {
      if (Array.isArray(value)) {
        value.forEach((v: unknown) => {
          if (v && typeof v === 'object' && (v as any).$type === 'User') {
            const p = getOrCreateParticipant(v as User, 0);
            p.roles.add(fieldName.toLowerCase());
          }
        });
      } else if (value && typeof value === 'object' && (value as any).$type === 'User') {
        const p = getOrCreateParticipant(value as User, 0);
        p.roles.add(fieldName.toLowerCase());
      }
    }
  });

  // 3. Activities
  activities.forEach(activity => {
    const author = activity.author;
    if (!author || (author as any).$type !== 'User') {
      return;
    }

    const p = getOrCreateParticipant(author, activity.timestamp);
    const categoryId = activity.category.id;

    if (categoryId === 'CommentsCategory') {
      p.roles.add('commenter');
    } else if (categoryId === 'AttachmentsCategory') {
      p.roles.add('attachment uploader');
    } else if (categoryId === 'IssueCreatedCategory') {
      p.roles.add('creator');
    } else if (categoryId === 'VCSChangeCategory') {
      p.roles.add('vcs committer');
    } else if (categoryId === 'WorkItemCategory') {
      p.roles.add('spent time author');
    } else {
      p.roles.add('contributor');
    }

    // Special case: check for initial assignee
    if (categoryId === 'CustomFieldCategory' && activity.field?.presentation === 'Assignee') {
      if (activity.added) {
        const added = Array.isArray(activity.added) ? activity.added : [activity.added];
        added.forEach((v: unknown) => {
          if (v && typeof v === 'object' && (v as any).$type === 'User') {
            const ap = getOrCreateParticipant(v as User, activity.timestamp);
            ap.roles.add('assignee');
          }
        });
      }
    }
    
    // Check for other user field changes
    if (categoryId === 'CustomFieldCategory' && activity.field?.customField?.fieldType.valueType === 'user') {
      const fieldName = activity.field.presentation;
      if (activity.added) {
        const added = Array.isArray(activity.added) ? activity.added : [activity.added];
        added.forEach((v: unknown) => {
          if (v && typeof v === 'object' && (v as any).$type === 'User') {
            const ap = getOrCreateParticipant(v as User, activity.timestamp);
            ap.roles.add(fieldName.toLowerCase());
          }
        });
      }
    }
  });

  return Array.from(participantsMap.values());
};
