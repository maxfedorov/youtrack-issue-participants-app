/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {memo, useEffect, useState, useMemo} from 'react';
import {Issue, ActivityItem, ActivityPage} from './types';
import {collectParticipants, extractResult} from './utils';
import {getSortedParticipants, formatRoles} from './sorting';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Avatar, {Size as AvatarSize} from '@jetbrains/ring-ui-built/components/avatar/avatar';
import Link from '@jetbrains/ring-ui-built/components/link/link';

import './app.css';

// Register widget in YouTrack. To learn more, see https://www.jetbrains.com/help/youtrack/devportal-apps/apps-host-api.html
const host = await YTApp.register();

const AppComponent: React.FunctionComponent = () => {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const issueId = YTApp.entity?.id;
        if (!issueId) {
          setError('No issue context found');
          setLoading(false);
          return;
        }

        const issueFields = [
          'id', 'idReadable', 'summary', 'reporter(login,fullName,avatarUrl)',
          'updater(login,fullName,avatarUrl)', 'updated', 'created',
          'fields(value(login,fullName,avatarUrl,$type),projectCustomField(field(name,fieldType(valueType))))'
        ].join(',');

        const categories = [
          'AttachmentsCategory', 'AttachmentRenameCategory', 'AttachmentVisibilityCategory',
          'AttachmentRecognizedTextCategory', 'CommentsCategory', 'ArticleCommentsCategory',
          'CommentAttachmentsCategory', 'CommentTextCategory', 'CommentReactionCategory',
          'CommentTemporarilyDeletedCategory', 'CommentVisibilityCategory', 'CustomFieldCategory',
          'DefaultCategory', 'DescriptionCategory', 'IssueDeletedCategory', 'IssueRestoredCategory',
          'IssueResolvedCategory', 'LinksCategory', 'ProjectCategory', 'PullRequestChangeCategory',
          'SprintCategory', 'SummaryCategory', 'TagsCategory', 'TotalVotesCategory',
          'UpsourceReviewCategory', 'VcsChangeCategory', 'VcsChangeStateCategory',
          'IssueVisibilityCategory', 'VotersCategory', 'WorkItemCategory', 'WorkItemTypeCategory',
          'WorkItemDescriptionCategory', 'WorkItemDurationCategory', 'WorkItemDateCategory',
          'WorkItemAuthorCategory', 'StarCategory', 'TicketCCEventCategory', 'CommentMentionCategory',
          'IssueMentionCategory', 'IssueMentionedInIssueCategory', 'IssueMentionedInIssueCommentCategory',
          'IssueMentionedInWorkItemCategory', 'IssueMentionedInVcsChangesCategory',
          'IssueMentionedInArticlesCategory', 'IssueMentionedInArticleCommentsCategory',
          'IssueAllMentionedIssuesCategory', 'IssueAllMentionedArticlesCategory'
        ].join(',');

        const [issueData, activitiesData] = await Promise.all([
          host.fetchYouTrack(`issues/${issueId}?fields=${issueFields}`),
          host.fetchYouTrack(`issues/${issueId}/activitiesPage?categories=${categories}&fields=activities(author(login,fullName,avatarUrl,$type),timestamp,category(id),field(presentation,customField(fieldType(valueType))),added(login,fullName,avatarUrl,$type))`)
        ]);

        setIssue(extractResult(issueData));
        const activitiesPage = extractResult(activitiesData) as ActivityPage;
        setActivities(activitiesPage?.activities || []);
      } catch (e: unknown) {
        // eslint-disable-next-line no-console
        console.error('Failed to load issue participants', e);
        setError((e as any).message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const currentAssigneeLogin = useMemo(() => {
    const assigneeField = issue?.fields.find(f => f.projectCustomField.field.name === 'Assignee');
    return (assigneeField?.value as any)?.login;
  }, [issue]);

  const initialAssigneeLogin = useMemo(() => {
    const assigneeActivities = activities
      .filter(a => a.category.id === 'CustomFieldCategory' && a.field?.presentation === 'Assignee')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    if (assigneeActivities.length > 0) {
      const firstActivity = assigneeActivities[0];
      const added = Array.isArray(firstActivity.added) ? firstActivity.added : [firstActivity.added];
      const firstAddedUser = added.find((v: any) => v && v.$type === 'User');
      return (firstAddedUser as any)?.login;
    }
    return currentAssigneeLogin;
  }, [activities, currentAssigneeLogin]);

  const participants = useMemo(() => {
    if (!issue) {
      return [];
    }
    const collected = collectParticipants(issue, activities);
    return getSortedParticipants(collected, currentAssigneeLogin, issue.reporter?.login);
  }, [issue, activities, currentAssigneeLogin]);

  if (loading) {
    return <LoaderInline/>;
  }

  if (error) {
    return <Text>{`Error: ${error}`}</Text>;
  }

  return (
    <div className="widget">
      {participants.map(p => {
        const roles = formatRoles(p, currentAssigneeLogin, issue?.reporter?.login, initialAssigneeLogin);
        return (
          <div key={p.login} className="participant">
            <Avatar
              url={p.avatarUrl}
              username={p.login}
              size={AvatarSize.Size20}
            />
            <div className="participantInfo">
              <div className="participantNameRow">
                <Link
                  href={`/users/${p.login}`}
                  className="participantName"
                  title={p.fullName || p.login}
                >
                  {p.fullName || p.login}
                </Link>
              </div>
              <Text
                className="participantRoles"
                title={roles}
              >
                {roles}
              </Text>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const App = memo(AppComponent);
