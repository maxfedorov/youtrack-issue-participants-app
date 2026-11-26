import {describe, expect, it} from 'vitest';

import {activity, fakeHost, user} from '../shared/test-utils';
import type {ActivityItem} from '../shared/types';

import {loadIssueParticipants} from './load-issue';

const userField = (name: string) => ({presentation: name, customField: {fieldType: {valueType: 'user'}}});

/** Activities are given in chronological order; the fake server returns them newest first, like reverse=true. */
function issueHost(valueActivities: ActivityItem[], authorActivities: ActivityItem[] = []) {
  return fakeHost(({path, query}) => {
    if (path === 'issues/DEMO-1') {
      return {
        reporter: user('rep'),
        updater: user('upd'),
        created: 1,
        updated: 100,
        fields: [
          {value: user('dave'), projectCustomField: {field: {name: 'Assignee', fieldType: {valueType: 'user'}}}},
          {value: [user('alice')], projectCustomField: {field: {name: 'Reviewers', fieldType: {valueType: 'user'}}}},
          {value: {name: 'Major', $type: 'EnumBundleElement'},
            projectCustomField: {field: {name: 'Priority', fieldType: {valueType: 'enum'}}}},
        ],
      };
    }
    const isValueRequest = String(query.categories) === 'CustomFieldCategory';
    return {activities: [...(isValueRequest ? valueActivities : authorActivities)].reverse(), hasBefore: false};
  });
}

const rolesOf = (participants: Array<{login: string; roles: Set<string>}>) =>
  Object.fromEntries(participants.map(p => [p.login, [...p.roles].sort()]));

describe('loadIssueParticipants', () => {
  it('labels former field values as initial or past', async () => {
    const {host} = issueHost([
      activity('CustomFieldCategory', 'rep', 10, {field: userField('Assignee'), added: [user('carol')], removed: []}),
      activity('CustomFieldCategory', 'alice', 20,
        {field: userField('Assignee'), added: [user('dave')], removed: [user('carol')]}),
      activity('CustomFieldCategory', 'alice', 30,
        {field: userField('Reviewers'), added: [user('alice'), user('carol')], removed: []}),
      activity('CustomFieldCategory', 'dave', 40, {field: userField('Reviewers'), added: [], removed: [user('carol')]}),
    ]);

    const roles = rolesOf(await loadIssueParticipants(host, 'DEMO-1'));

    expect(roles.carol).toEqual(['assignee (initial)', 'reviewers (initial)']);
    expect(roles.dave).toEqual(['assignee', 'editor']);
    expect(roles.alice).toEqual(['editor', 'reviewers']);
  });

  it('marks a later, already replaced value as past', async () => {
    const {host} = issueHost([
      activity('CustomFieldCategory', 'rep', 10, {field: userField('Assignee'), added: [user('carol')], removed: []}),
      activity('CustomFieldCategory', 'rep', 20,
        {field: userField('Assignee'), added: [user('bob')], removed: [user('carol')]}),
      activity('CustomFieldCategory', 'rep', 30,
        {field: userField('Assignee'), added: [user('dave')], removed: [user('bob')]}),
    ]);

    const roles = rolesOf(await loadIssueParticipants(host, 'DEMO-1'));
    expect(roles.carol).toEqual(['assignee (initial)']);
    expect(roles.bob).toEqual(['assignee (past)']);
  });

  it('keeps a value the issue was created with as initial when someone is added later', async () => {
    // Reviewers was [alice] from the start (no activity), bob was added and removed afterwards.
    const {host} = issueHost([
      activity('CustomFieldCategory', 'rep', 10, {field: userField('Reviewers'), added: [user('bob')], removed: []}),
      activity('CustomFieldCategory', 'rep', 20, {field: userField('Reviewers'), added: [], removed: [user('bob')]}),
    ]);

    const roles = rolesOf(await loadIssueParticipants(host, 'DEMO-1'));
    expect(roles.bob).toEqual(['reviewers (past)']);
    expect(roles.alice).toEqual(['reviewers']);
  });

  it('ignores authors and values that are not users', async () => {
    const {host} = issueHost([
      activity('CustomFieldCategory', 'rep', 10, {
        field: userField('Assignee'),
        added: [user('dave')],
        removed: [{login: 'ghost', $type: 'VcsUnresolvedUser'}, {name: 'Team', $type: 'UserGroup'}],
      }),
    ], [
      {category: {id: 'VcsChangeCategory'}, timestamp: 5, author: {login: 'git-bot', $type: 'VcsUnresolvedUser'}},
    ]);

    const logins = (await loadIssueParticipants(host, 'DEMO-1')).map(p => p.login);
    expect(logins).not.toContain('ghost');
    expect(logins).not.toContain('git-bot');
  });

  it('puts the reporter first and the assignee second, even without activity of their own', async () => {
    const {host} = issueHost([], [
      activity('CommentsCategory', 'zed', 500),
    ]);

    const participants = await loadIssueParticipants(host, 'DEMO-1');
    expect(participants.map(p => p.login).slice(0, 3)).toEqual(['rep', 'dave', 'zed']);
  });

  it('requests values only for custom field changes', async () => {
    const {host, calls} = issueHost([]);
    await loadIssueParticipants(host, 'DEMO-1');

    const activityCalls = calls.filter(c => c.path.endsWith('/activitiesPage'));
    const authorOnly = activityCalls.find(c => c.query.categories !== 'CustomFieldCategory');
    expect(authorOnly?.query.categories).toContain('DescriptionCategory');
    expect(authorOnly?.query.fields).not.toContain('added');
  });
});
