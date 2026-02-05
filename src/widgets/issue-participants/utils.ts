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

  const MENTION_CATEGORIES = [
    'CommentMentionCategory', 'IssueMentionCategory', 'IssueMentionedInIssueCategory',
    'IssueMentionedInIssueCommentCategory', 'IssueMentionedInWorkItemCategory',
    'IssueMentionedInVcsChangesCategory', 'IssueMentionedInArticlesCategory',
    'IssueMentionedInArticleCommentsCategory', 'IssueAllMentionedIssuesCategory',
    'IssueAllMentionedArticlesCategory'
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
    } else if (MENTION_CATEGORIES.includes(categoryId)) {
      p.roles.add('mentioned user');
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
