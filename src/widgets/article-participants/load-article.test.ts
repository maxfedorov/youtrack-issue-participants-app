import {describe, expect, it} from 'vitest';

import {activity, fakeHost, user} from '../shared/test-utils';

import {loadArticleParticipants} from './load-article';

describe('loadArticleParticipants', () => {
  it('collects the author, editors, commenters and mentioned users', async () => {
    const {host, calls} = fakeHost(({path, query}) => {
      if (path === 'articles/197-2') {
        return {reporter: user('alice'), updatedBy: user('carol'), created: 1, updated: 90};
      }
      if (String(query.categories).includes('Mention')) {
        return {activities: [activity('ArticleMentionCategory', 'bob', 20, {added: [user('dave')]})]};
      }
      return {
        activities: [
          activity('ArticleDescriptionCategory', 'bob', 20),
          activity('ArticleSummaryCategory', 'carol', 30),
          activity('ArticleCommentsCategory', 'dave', 40),
          activity('ArticleInlineCommentsCategory', 'bob', 50),
          activity('ArticleCommentReactionCategory', 'alice', 60),
          activity('ArticleAttachmentsCategory', 'frank', 70),
        ],
      };
    });

    const participants = await loadArticleParticipants(host, '197-2');
    const roles = Object.fromEntries(participants.map(p => [p.login, [...p.roles].sort()]));

    expect(participants[0].login).toBe('alice');
    expect(roles).toEqual({
      alice: ['author', 'reacted'],
      bob: ['content editor', 'inline commenter'],
      carol: ['last updater', 'title editor'],
      dave: ['commenter', 'mentioned'],
      frank: ['attachment manager'],
    });
    // Only Article* categories are requested; issue categories never match an article.
    const categories = calls.flatMap(c => String(c.query.categories ?? '').split(',')).filter(Boolean);
    expect(categories.every(c => c.startsWith('Article'))).toBe(true);
  });
});
