import {AUTHOR_FIELDS, USER_FIELDS, VALUE_FIELDS, fetchActivities} from '../shared/activities';
import {ParticipantsCollector, getUsers, sortParticipants} from '../shared/participants';
import type {ActivityItem, Host, Participant, User} from '../shared/types';

interface IssueField {
  value: unknown;
  projectCustomField?: {field?: {name: string; fieldType?: {valueType: string}}};
}

interface Issue {
  reporter?: User | null;
  updater?: User | null;
  created?: number;
  updated?: number;
  fields?: IssueField[];
}

const ISSUE_FIELDS = `reporter(${USER_FIELDS}),updater(${USER_FIELDS}),created,updated,` +
  `fields(value(${USER_FIELDS}),projectCustomField(field(name,fieldType(valueType))))`;

const ROLE_BY_CATEGORY: Readonly<Record<string, string>> = {
  CommentsCategory: 'commenter',
  CommentTextCategory: 'commenter',
  CommentAttachmentsCategory: 'commenter',
  CommentVisibilityCategory: 'commenter',
  CommentTemporarilyDeletedCategory: 'commenter',
  CommentReactionCategory: 'reacted',
  AttachmentsCategory: 'attachment manager',
  AttachmentRenameCategory: 'attachment manager',
  AttachmentVisibilityCategory: 'attachment manager',
  AttachmentRecognizedTextCategory: 'attachment manager',
  DescriptionCategory: 'description editor',
  SummaryCategory: 'summary editor',
  VcsChangeCategory: 'vcs committer',
  VcsChangeStateCategory: 'vcs committer',
  PullRequestChangeCategory: 'vcs committer',
  UpsourceReviewCategory: 'vcs committer',
  WorkItemCategory: 'spent time author',
  WorkItemTypeCategory: 'spent time author',
  WorkItemDescriptionCategory: 'spent time author',
  WorkItemDurationCategory: 'spent time author',
  WorkItemDateCategory: 'spent time author',
  WorkItemAuthorCategory: 'spent time author',
  CustomFieldCategory: 'editor',
  TagsCategory: 'editor',
  LinksCategory: 'editor',
  ProjectCategory: 'editor',
  SprintCategory: 'editor',
  IssueVisibilityCategory: 'editor',
  IssueResolvedCategory: 'editor',
  IssueRestoredCategory: 'editor',
  IssueDeletedCategory: 'editor',
  TotalVotesCategory: 'voter',
  VotersCategory: 'voter',
  TicketCCEventCategory: 'contributor',
  DefaultCategory: 'contributor',
};

// Only custom field changes carry user values worth requesting; every other category needs just the author.
const VALUE_CATEGORIES = ['CustomFieldCategory'];
const AUTHOR_CATEGORIES = Object.keys(ROLE_BY_CATEGORY).filter(c => !VALUE_CATEGORIES.includes(c));

const isUserField = (valueType: string | undefined) => valueType === 'user';

/** Current values of user-type fields: field name (lower case) -> logins. */
function addCurrentFieldUsers(collector: ParticipantsCollector, issue: Issue): Map<string, Set<string>> {
  const current = new Map<string, Set<string>>();
  for (const field of issue.fields ?? []) {
    const definition = field.projectCustomField?.field;
    if (!definition || !isUserField(definition.fieldType?.valueType)) {
      continue;
    }
    const name = definition.name.toLowerCase();
    const logins = current.get(name) ?? new Set<string>();
    current.set(name, logins);
    for (const user of getUsers(field.value)) {
      collector.add(user, name);
      logins.add(user.login);
    }
  }
  return current;
}

interface FieldHistory {
  /** The field's value rewound change by change, ending as the value before the oldest recorded change. */
  value: Set<string>;
  /** Users added by the oldest recorded change(s); several changes made in one go share a timestamp. */
  firstAdded: Set<string>;
  firstTimestamp: number;
  /** Everyone who was ever added or removed. */
  users: Map<string, User>;
}

/** Undoes one change: `history.value` goes from the value after `activity` to the value before it. */
function rewindFieldChange(history: FieldHistory, activity: ActivityItem, added: User[], removed: User[]): void {
  added.forEach(u => history.value.delete(u.login));
  removed.forEach(u => history.value.add(u.login));
  if (activity.timestamp < history.firstTimestamp) {
    history.firstAdded.clear();
    history.firstTimestamp = activity.timestamp;
  }
  if (activity.timestamp === history.firstTimestamp) {
    added.forEach(u => history.firstAdded.add(u.login));
  }
  [...added, ...removed].forEach(u => history.users.set(u.login, u));
}

/** Activities arrive newest first, so each field is rewound from its current value back to the start. */
function collectFieldHistory(activities: ActivityItem[], current: Map<string, Set<string>>): Map<string, FieldHistory> {
  const histories = new Map<string, FieldHistory>();
  for (const activity of activities) {
    const added = getUsers(activity.added);
    const removed = getUsers(activity.removed);
    if (!activity.field || !isUserField(activity.field.customField?.fieldType?.valueType) ||
      (added.length === 0 && removed.length === 0)) {
      continue;
    }
    const name = activity.field.presentation.toLowerCase();
    const history = histories.get(name) ??
      {value: new Set(current.get(name)), firstAdded: new Set(), firstTimestamp: Infinity, users: new Map()};
    histories.set(name, history);
    rewindFieldChange(history, activity, added, removed);
  }
  return histories;
}

/**
 * Users who held a user field in the past get `<field> (initial)` when they were its first value and
 * `<field> (past)` otherwise. The first value is the value at creation, or the first one set when the
 * field started empty.
 */
function addPastFieldUsers(
  collector: ParticipantsCollector,
  activities: ActivityItem[],
  current: Map<string, Set<string>>,
): void {
  for (const [name, history] of collectFieldHistory(activities, current)) {
    const initial = history.value.size > 0 ? history.value : history.firstAdded;
    for (const [login, user] of history.users) {
      if (!current.get(name)?.has(login)) {
        // Being assigned is something done to a user, not their own activity: it must not lift them in the list.
        collector.add(user, `${name} (${initial.has(login) ? 'initial' : 'past'})`);
      }
    }
  }
}

export async function loadIssueParticipants(host: Host, issueId: string): Promise<Participant[]> {
  const path = `issues/${encodeURIComponent(issueId)}`;
  const [issue, authorActivities, valueActivities] = await Promise.all([
    host.fetchYouTrack(path, {query: {fields: ISSUE_FIELDS}}) as Promise<Issue>,
    fetchActivities(host, path, AUTHOR_CATEGORIES, AUTHOR_FIELDS),
    fetchActivities(host, path, VALUE_CATEGORIES, `${VALUE_FIELDS},field(presentation,customField(fieldType(valueType)))`),
  ]);

  const collector = new ParticipantsCollector();
  collector.add(issue.reporter, 'reporter', issue.created);
  collector.add(issue.updater, 'last updater', issue.updated);
  const current = addCurrentFieldUsers(collector, issue);
  collector.addActivityAuthors(authorActivities, ROLE_BY_CATEGORY);
  collector.addActivityAuthors(valueActivities, ROLE_BY_CATEGORY);
  addPastFieldUsers(collector, valueActivities, current);

  const participants = collector.toArray();
  const assignees = participants.filter(p => p.roles.has('assignee')).map(p => p.login);
  return sortParticipants(participants, [issue.reporter?.login, ...assignees]);
}
