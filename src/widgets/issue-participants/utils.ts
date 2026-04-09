import type {Issue, ActivityItem, Participant, User} from './types';

const COMMENT_CATEGORIES = new Set([
  'CommentsCategory', 'ArticleCommentsCategory', 'CommentAttachmentsCategory',
  'CommentTextCategory', 'CommentReactionCategory', 'CommentTemporarilyDeletedCategory',
  'CommentVisibilityCategory',
]);

const ATTACHMENT_CATEGORIES = new Set([
  'AttachmentsCategory', 'AttachmentRenameCategory', 'AttachmentVisibilityCategory',
  'AttachmentRecognizedTextCategory',
]);

const WORK_ITEM_CATEGORIES = new Set([
  'WorkItemCategory', 'WorkItemTypeCategory', 'WorkItemDescriptionCategory',
  'WorkItemDurationCategory', 'WorkItemDateCategory', 'WorkItemAuthorCategory',
]);

const VCS_CATEGORIES = new Set([
  'VcsChangeCategory', 'VcsChangeStateCategory', 'PullRequestChangeCategory',
  'UpsourceReviewCategory',
]);

const EDITOR_CATEGORIES = new Set([
  'CustomFieldCategory', 'TagsCategory', 'LinksCategory', 'ProjectCategory',
  'SprintCategory', 'IssueVisibilityCategory', 'IssueResolvedCategory',
  'IssueRestoredCategory', 'IssueDeletedCategory',
]);

const VOTER_CATEGORIES = new Set([
  'VotersCategory', 'TotalVotesCategory', 'StarCategory',
]);

interface FieldHistory {
  earliestTimestamp: number;
  initialLogins: Set<string>;
  allHistoricalUsers: Map<string, { user: User; timestamp: number }>;
}

function isUser(value: unknown): value is User {
  return !!value && typeof value === 'object' && (value as User).$type === 'User';
}

function getUsers(values: unknown): User[] {
  if (!values) {
    return [];
  }
  const arr = Array.isArray(values) ? values : [values];
  return arr.filter(isUser);
}

function getRoleForCategory(categoryId: string): string {
  if (COMMENT_CATEGORIES.has(categoryId)) { return 'commenter'; }
  if (ATTACHMENT_CATEGORIES.has(categoryId)) { return 'attachment manager'; }
  if (categoryId === 'DescriptionCategory') { return 'description editor'; }
  if (categoryId === 'SummaryCategory') { return 'summary editor'; }
  if (VCS_CATEGORIES.has(categoryId)) { return 'vcs committer'; }
  if (WORK_ITEM_CATEGORIES.has(categoryId)) { return 'spent time author'; }
  if (EDITOR_CATEGORIES.has(categoryId)) { return 'editor'; }
  if (VOTER_CATEGORIES.has(categoryId)) { return 'voter'; }
  return 'contributor';
}

type ParticipantsMap = Map<string, Participant>;

function getOrCreate(map: ParticipantsMap, user: User, timestamp: number): Participant {
  let p = map.get(user.login);
  if (!p) {
    p = {
      login: user.login,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      roles: new Set<string>(),
      lastActivityTimestamp: timestamp,
    };
    map.set(user.login, p);
  }
  if (timestamp > p.lastActivityTimestamp) {
    p.lastActivityTimestamp = timestamp;
  }
  return p;
}

function collectCurrentFieldValues(
  map: ParticipantsMap,
  issue: Issue,
): Map<string, Set<string>> {
  const currentFieldValues = new Map<string, Set<string>>();

  for (const field of issue.fields) {
    const valueType = field.projectCustomField?.field?.fieldType?.valueType;
    if (valueType !== 'user') {
      continue;
    }

    const fieldName = field.projectCustomField.field.name.toLowerCase();
    if (!currentFieldValues.has(fieldName)) {
      currentFieldValues.set(fieldName, new Set());
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guaranteed by the has-check above
    const logins = currentFieldValues.get(fieldName)!;
    const values = Array.isArray(field.value) ? field.value : [field.value];

    for (const v of values) {
      if (isUser(v)) {
        getOrCreate(map, v, 0).roles.add(fieldName);
        logins.add(v.login);
      }
    }
  }

  return currentFieldValues;
}

function updateFieldHistory(
  history: FieldHistory,
  activity: ActivityItem,
): void {
  const added = getUsers(activity.added);
  const removed = getUsers(activity.removed);

  if (added.length === 0 && removed.length === 0) {
    return;
  }

  if (activity.timestamp < history.earliestTimestamp) {
    history.earliestTimestamp = activity.timestamp;
    history.initialLogins.clear();
    const initial = removed.length > 0 ? removed : added;
    for (const u of initial) {
      history.initialLogins.add(u.login);
    }
  } else if (activity.timestamp === history.earliestTimestamp) {
    const initial = removed.length > 0 ? removed : added;
    for (const u of initial) {
      history.initialLogins.add(u.login);
    }
  }

  for (const user of [...added, ...removed]) {
    const existing = history.allHistoricalUsers.get(user.login);
    if (!existing) {
      history.allHistoricalUsers.set(user.login, {user, timestamp: activity.timestamp});
    } else if (activity.timestamp > existing.timestamp) {
      existing.timestamp = activity.timestamp;
    }
  }
}

function processActivities(
  map: ParticipantsMap,
  activities: ActivityItem[],
): Map<string, FieldHistory> {
  const fieldHistory = new Map<string, FieldHistory>();

  for (const activity of activities) {
    if (!activity.author || !isUser(activity.author)) {
      continue;
    }
    if (activity.category.id === 'IssueCreatedCategory') {
      continue;
    }

    const p = getOrCreate(map, activity.author, activity.timestamp);
    p.roles.add(getRoleForCategory(activity.category.id));

    // Track user-field changes for initial/past labels
    const isUserFieldChange =
      activity.category.id === 'CustomFieldCategory' &&
      activity.field?.customField?.fieldType.valueType === 'user';

    if (isUserFieldChange && activity.field) {
      const fieldName = activity.field.presentation.toLowerCase();
      let history = fieldHistory.get(fieldName);
      if (!history) {
        history = {
          earliestTimestamp: Infinity,
          initialLogins: new Set(),
          allHistoricalUsers: new Map(),
        };
        fieldHistory.set(fieldName, history);
      }
      updateFieldHistory(history, activity);
    }
  }

  return fieldHistory;
}

function applyHistoricalLabels(
  map: ParticipantsMap,
  fieldHistory: Map<string, FieldHistory>,
  currentFieldValues: Map<string, Set<string>>,
): void {
  for (const [fieldName, history] of fieldHistory) {
    const currentLogins = currentFieldValues.get(fieldName) ?? new Set();
    for (const [login, {user, timestamp}] of history.allHistoricalUsers) {
      if (!currentLogins.has(login)) {
        const suffix = history.initialLogins.has(login) ? '(initial)' : '(past)';
        getOrCreate(map, user, timestamp).roles.add(`${fieldName} ${suffix}`);
      }
    }
  }
}

export function collectParticipants(issue: Issue, activities: ActivityItem[]): Participant[] {
  const map: ParticipantsMap = new Map();

  // Reporter
  if (issue.reporter) {
    getOrCreate(map, issue.reporter, issue.created ?? 0).roles.add('reporter');
  }

  // Last updater
  if (issue.updater) {
    getOrCreate(map, issue.updater, issue.updated ?? 0).roles.add('last updater');
  }

  // Current user-type field values
  const currentFieldValues = collectCurrentFieldValues(map, issue);

  // Activities: assign roles and track field history
  const fieldHistory = processActivities(map, activities);

  // Apply initial/past labels for historical field assignments
  applyHistoricalLabels(map, fieldHistory, currentFieldValues);

  return Array.from(map.values());
}
