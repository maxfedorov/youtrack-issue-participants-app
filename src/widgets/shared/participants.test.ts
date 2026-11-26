import {describe, expect, it} from 'vitest';

import {fetchActivities} from './activities';
import {ParticipantsCollector, normalizeRole, sortParticipants} from './participants';
import {activity, fakeHost, paged, user} from './test-utils';

describe('ParticipantsCollector', () => {
  it('merges roles per login and keeps the latest activity time', () => {
    const collector = new ParticipantsCollector();
    collector.add(user('ann'), 'author', 10);
    collector.add(user('ann'), 'commenter', 30);
    collector.add(user('ann'), 'editor', 20);

    const [ann] = collector.toArray();
    expect([...ann.roles]).toEqual(['author', 'commenter', 'editor']);
    expect(ann.lastActivityTimestamp).toBe(30);
  });

  it('ignores values that are not users', () => {
    const collector = new ParticipantsCollector();
    collector.add(null, 'author');
    collector.add({login: 'x', $type: 'UserGroup'}, 'author');
    collector.add({$type: 'User'} as never, 'author');
    expect(collector.toArray()).toEqual([]);
  });

  it('maps activity categories to roles and skips unmapped ones', () => {
    const collector = new ParticipantsCollector();
    collector.addActivityAuthors([
      activity('CommentsCategory', 'ann', 1),
      activity('UnknownCategory', 'bob', 2),
      activity('CommentsCategory', null, 3),
    ], {CommentsCategory: 'commenter'});

    expect(collector.toArray().map(p => [p.login, [...p.roles]])).toEqual([['ann', ['commenter']]]);
  });

  it('adds mentioned users from `added`', () => {
    const collector = new ParticipantsCollector();
    collector.addActivityTargets([
      activity('ArticleMentionCategory', 'ann', 1, {added: [user('bob'), {name: 'group', $type: 'UserGroup'}]}),
      activity('ArticleSummaryCategory', 'ann', 2, {added: 'not a user'}),
    ], new Set(['ArticleMentionCategory']), 'mentioned');

    expect(collector.toArray().map(p => p.login)).toEqual(['bob']);
    expect(collector.toArray()[0].lastActivityTimestamp).toBe(0);
  });
});

describe('sortParticipants', () => {
  it('puts pinned logins first in order, then the most recently active', () => {
    const collector = new ParticipantsCollector();
    collector.add(user('old'), 'x', 1);
    collector.add(user('new'), 'x', 5);
    collector.add(user('reporter'), 'x', 0);
    collector.add(user('assignee'), 'x', 2);

    const sorted = sortParticipants(collector.toArray(), ['reporter', undefined, 'assignee']);
    expect(sorted.map(p => p.login)).toEqual(['reporter', 'assignee', 'new', 'old']);
  });
});

describe('normalizeRole', () => {
  it('strips historical suffixes only', () => {
    expect(normalizeRole('assignee (initial)')).toBe('assignee');
    expect(normalizeRole('assignee (past)')).toBe('assignee');
    expect(normalizeRole('inline commenter')).toBe('inline commenter');
  });
});

describe('fetchActivities', () => {
  it('pages newest first until hasBefore is false', async () => {
    const all = Array.from({length: 450}, (_, i) => activity('CommentsCategory', `u${i}`, i));
    const {host, calls} = fakeHost(call => paged(all, Number(call.query.$top), call.query.cursor));

    const result = await fetchActivities(host, 'issues/DEMO-1', ['CommentsCategory'], 'author(login)');

    expect(result).toHaveLength(450);
    expect(result[0].timestamp).toBe(449);
    expect(calls.map(c => c.query.cursor)).toEqual([undefined, '200', '400']);
    expect(calls[0]).toMatchObject({
      path: 'issues/DEMO-1/activitiesPage',
      query: {categories: 'CommentsCategory', reverse: true, fields: 'hasBefore,beforeCursor,activities(author(login))'},
    });
  });

  it('stops when the server repeats a cursor', async () => {
    const {host, calls} = fakeHost(() => ({activities: [], hasBefore: true, beforeCursor: 'same'}));
    await fetchActivities(host, 'issues/DEMO-1', ['CommentsCategory'], 'author(login)');
    expect(calls).toHaveLength(2);
  });

  it('stops at the safety cap', async () => {
    let page = 0;
    const {host, calls} = fakeHost(() => ({activities: [], hasBefore: true, beforeCursor: String(page++)}));
    await fetchActivities(host, 'issues/DEMO-1', ['CommentsCategory'], 'author(login)');
    expect(calls).toHaveLength(25);
  });
});
