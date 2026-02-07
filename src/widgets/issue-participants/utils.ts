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
    const p = getOrCreateParticipant(issue.reporter, issue.created || 0);
    p.roles.add('reporter');
  }

  // 1.1 Updater
  if (issue.updater) {
    const p = getOrCreateParticipant(issue.updater, issue.updated || 0);
    p.roles.add('last updater');
  }

  // 2. Fields
  const currentFieldValues = new Map<string, Set<string>>(); // fieldName -> Set of logins

  issue.fields.forEach(field => {
    const value = field.value;
    const fieldName = field.projectCustomField.field.name.toLowerCase();
    const valueType = field.projectCustomField.field.fieldType.valueType;

    if (valueType === 'user') {
      if (!currentFieldValues.has(fieldName)) {
        currentFieldValues.set(fieldName, new Set());
      }
      const logins = currentFieldValues.get(fieldName)!;

      if (Array.isArray(value)) {
        value.forEach((v: unknown) => {
          if (v && typeof v === 'object' && (v as any).$type === 'User') {
            const user = v as User;
            const p = getOrCreateParticipant(user, 0);
            p.roles.add(fieldName);
            logins.add(user.login);
          }
        });
      } else if (value && typeof value === 'object' && (value as any).$type === 'User') {
        const user = value as User;
        const p = getOrCreateParticipant(user, 0);
        p.roles.add(fieldName);
        logins.add(user.login);
      }
    }
  });

  const fieldHistory = new Map<string, {
    earliestTimestamp: number;
    initialLogins: Set<string>;
    allHistoricalUsers: Map<string, {user: User, timestamp: number}>;
  }>();

  const getUsers = (values: unknown): User[] => {
    if (!values) {
      return [];
    }
    const vals = Array.isArray(values) ? values : [values];
    return vals.filter(v => v && typeof v === 'object' && (v as any).$type === 'User') as User[];
  };

  const COMMENT_CATEGORIES = [
    'CommentsCategory', 'ArticleCommentsCategory', 'CommentAttachmentsCategory',
    'CommentTextCategory', 'CommentReactionCategory', 'CommentTemporarilyDeletedCategory',
    'CommentVisibilityCategory', 'CommentMentionCategory'
  ];

  const ATTACHMENT_CATEGORIES = [
    'AttachmentsCategory', 'AttachmentRenameCategory', 'AttachmentVisibilityCategory',
    'AttachmentRecognizedTextCategory'
  ];

  const WORK_ITEM_CATEGORIES = [
    'WorkItemCategory', 'WorkItemTypeCategory', 'WorkItemDescriptionCategory',
    'WorkItemDurationCategory', 'WorkItemDateCategory', 'WorkItemAuthorCategory'
  ];

  const VCS_CATEGORIES = [
    'VcsChangeCategory', 'VcsChangeStateCategory', 'PullRequestChangeCategory', 'UpsourceReviewCategory'
  ];

  const EDITOR_CATEGORIES = [
    'CustomFieldCategory', 'TagsCategory',
    'LinksCategory', 'ProjectCategory', 'SprintCategory', 'IssueVisibilityCategory',
    'IssueResolvedCategory', 'IssueRestoredCategory', 'IssueDeletedCategory',
    'VisibilityCategory'
  ];

  const VOTER_CATEGORIES = [
    'VotersCategory', 'TotalVotesCategory', 'StarCategory'
  ];

  // 3. Activities
  activities.forEach(activity => {
    const author = activity.author;
    if (!author || (author as any).$type !== 'User') {
      return;
    }

    const categoryId = activity.category.id;

    // Skip IssueCreatedCategory as requested
    if (categoryId === 'IssueCreatedCategory') {
      return;
    }

    const p = getOrCreateParticipant(author, activity.timestamp);

    if (COMMENT_CATEGORIES.includes(categoryId)) {
      p.roles.add('commenter');
    } else if (ATTACHMENT_CATEGORIES.includes(categoryId)) {
      p.roles.add('attachment manager');
    } else if (categoryId === 'DescriptionCategory') {
      p.roles.add('description editor');
    } else if (categoryId === 'SummaryCategory') {
      p.roles.add('summary editor');
    } else if (VCS_CATEGORIES.includes(categoryId)) {
      p.roles.add('vcs committer');
    } else if (WORK_ITEM_CATEGORIES.includes(categoryId)) {
      p.roles.add('spent time author');
    } else if (EDITOR_CATEGORIES.includes(categoryId)) {
      p.roles.add('editor');
    } else if (VOTER_CATEGORIES.includes(categoryId)) {
      p.roles.add('voter');
    } else {
      p.roles.add('contributor');
    }

    // Check for user field changes (including Assignee)
    if (categoryId === 'CustomFieldCategory' && activity.field?.customField?.fieldType.valueType === 'user') {
      const fieldName = activity.field.presentation.toLowerCase();
      if (!fieldHistory.has(fieldName)) {
        fieldHistory.set(fieldName, {
          earliestTimestamp: Infinity,
          initialLogins: new Set(),
          allHistoricalUsers: new Map()
        });
      }
      const history = fieldHistory.get(fieldName)!;
      const added = getUsers(activity.added);
      const removed = getUsers(activity.removed);

      if (added.length > 0 || removed.length > 0) {
        if (activity.timestamp < history.earliestTimestamp) {
          history.earliestTimestamp = activity.timestamp;
          history.initialLogins.clear();
          if (removed.length > 0) {
            removed.forEach(u => history.initialLogins.add(u.login));
          } else {
            added.forEach(u => history.initialLogins.add(u.login));
          }
        } else if (activity.timestamp === history.earliestTimestamp) {
          if (removed.length > 0) {
            removed.forEach(u => history.initialLogins.add(u.login));
          } else {
            added.forEach(u => history.initialLogins.add(u.login));
          }
        }

        [...added, ...removed].forEach(user => {
          if (!history.allHistoricalUsers.has(user.login)) {
            history.allHistoricalUsers.set(user.login, {user, timestamp: activity.timestamp});
          } else {
            const existing = history.allHistoricalUsers.get(user.login)!;
            if (activity.timestamp > existing.timestamp) {
              existing.timestamp = activity.timestamp;
            }
          }
        });
      }
    }
  });

  fieldHistory.forEach((history, fieldName) => {
    const currentLogins = currentFieldValues.get(fieldName) || new Set();
    history.allHistoricalUsers.forEach(({user, timestamp}, login) => {
      if (!currentLogins.has(login)) {
        const p = getOrCreateParticipant(user, timestamp);
        if (history.initialLogins.has(login)) {
          p.roles.add(`${fieldName} (initial)`);
        } else {
          p.roles.add(`${fieldName} (past)`);
        }
      }
    });
  });

  return Array.from(participantsMap.values());
};
