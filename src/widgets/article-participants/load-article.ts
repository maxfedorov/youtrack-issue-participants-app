import {AUTHOR_FIELDS, USER_FIELDS, VALUE_FIELDS, fetchActivities} from '../shared/activities';
import {ParticipantsCollector, sortParticipants} from '../shared/participants';
import type {Host, Participant, User} from '../shared/types';

interface Article {
  reporter?: User | null;
  updatedBy?: User | null;
  created?: number;
  updated?: number;
}

const ARTICLE_FIELDS = `reporter(${USER_FIELDS}),updatedBy(${USER_FIELDS}),created,updated`;

// Article activities use their own `Article*` categories; the issue ones never match an article.
// Creation is covered by the `author` role, so ArticleCreatedCategory is not requested.
const ROLE_BY_CATEGORY: Readonly<Record<string, string>> = {
  ArticleCommentsCategory: 'commenter',
  ArticleCommentTextCategory: 'commenter',
  ArticleCommentAttachmentsCategory: 'commenter',
  ArticleCommentVisibilityCategory: 'commenter',
  ArticleInlineCommentsCategory: 'inline commenter',
  ArticleInlineCommentTextCategory: 'inline commenter',
  ArticleCommentReactionCategory: 'reacted',
  ArticleAttachmentsCategory: 'attachment manager',
  ArticleAttachmentRenameCategory: 'attachment manager',
  ArticleAttachmentVisibilityCategory: 'attachment manager',
  ArticleAttachmentRecognizedTextCategory: 'attachment manager',
  ArticleDescriptionCategory: 'content editor',
  ArticleSummaryCategory: 'title editor',
  ArticleTagsCategory: 'editor',
  ArticleProjectCategory: 'editor',
  ArticleVisibilityCategory: 'editor',
  ArticleDeletedCategory: 'editor',
  ArticleRestoredCategory: 'editor',
};

// Mentions are the only article activities whose values (`added`) are users.
const MENTION_CATEGORIES = new Set(['ArticleMentionCategory', 'ArticleCommentMentionCategory']);

export async function loadArticleParticipants(host: Host, articleId: string): Promise<Participant[]> {
  const path = `articles/${encodeURIComponent(articleId)}`;
  const [article, activities, mentions] = await Promise.all([
    host.fetchYouTrack(path, {query: {fields: ARTICLE_FIELDS}}) as Promise<Article>,
    fetchActivities(host, path, Object.keys(ROLE_BY_CATEGORY), AUTHOR_FIELDS),
    fetchActivities(host, path, [...MENTION_CATEGORIES], VALUE_FIELDS),
  ]);

  const collector = new ParticipantsCollector();
  collector.add(article.reporter, 'author', article.created);
  collector.add(article.updatedBy, 'last updater', article.updated);
  collector.addActivityAuthors(activities, ROLE_BY_CATEGORY);
  collector.addActivityTargets(mentions, MENTION_CATEGORIES, 'mentioned');

  return sortParticipants(collector.toArray(), [article.reporter?.login]);
}
