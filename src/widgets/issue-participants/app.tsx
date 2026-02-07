/* eslint-disable @typescript-eslint/no-explicit-any */
import React, {memo, useEffect, useState, useMemo} from 'react';
import {Issue, ActivityItem, ActivityPage} from './types';
import {collectParticipants, extractResult} from './utils';
import {getSortedParticipants, formatRoles} from './sorting';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Avatar, {Size as AvatarSize} from '@jetbrains/ring-ui-built/components/avatar/avatar';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Tag from '@jetbrains/ring-ui-built/components/tag/tag';
import Collapse from '@jetbrains/ring-ui-built/components/collapse/collapse';
import CollapseControl from '@jetbrains/ring-ui-built/components/collapse/collapse-control';
import CollapseContent from '@jetbrains/ring-ui-built/components/collapse/collapse-content';

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
          'WorkItemAuthorCategory', 'StarCategory', 'TicketCCEventCategory'
        ].join(',');

        const [issueData, activitiesData] = await Promise.all([
          host.fetchYouTrack(`issues/${issueId}?fields=${issueFields}`),
          host.fetchYouTrack(`issues/${issueId}/activitiesPage?categories=${categories}&fields=activities(author(login,fullName,avatarUrl,$type),timestamp,category(id),field(presentation,customField(fieldType(valueType))),added(login,fullName,avatarUrl,$type),removed(login,fullName,avatarUrl,$type))`)
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


  const participants = useMemo(() => {
    if (!issue) {
      return [];
    }
    const collected = collectParticipants(issue, activities);
    return getSortedParticipants(collected, issue.reporter?.login);
  }, [issue, activities]);

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    participants.forEach(p => {
      p.roles.forEach(role => roles.add(role));
    });
    return Array.from(roles).sort();
  }, [participants]);

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  const toggleRole = (role: string) => {
    const newSelected = new Set(selectedRoles);
    if (newSelected.has(role)) {
      newSelected.delete(role);
    } else {
      newSelected.add(role);
    }
    setSelectedRoles(newSelected);
  };

  const filteredParticipants = useMemo(() => {
    if (selectedRoles.size === 0) {
      return participants;
    }
    return participants.filter(p =>
      Array.from(p.roles).some(role => selectedRoles.has(role))
    );
  }, [participants, selectedRoles]);

  if (loading) {
    return <LoaderInline/>;
  }

  if (error) {
    return <Text>{`Error: ${error}`}</Text>;
  }

  return (
    <div className="widget">
      {allRoles.length > 0 && (
        <Collapse className="filtersCollapse" defaultCollapsed>
          <CollapseControl>
            {(collapsed: boolean) => (
              <Link className="filtersToggle">
                {collapsed ? 'Show filters' : 'Hide filters'}
              </Link>
            )}
          </CollapseControl>
          <CollapseContent>
            <div className="filtersList">
              {allRoles.map(role => (
                <Tag
                  key={role}
                  onClick={() => toggleRole(role)}
                  tagType={selectedRoles.has(role) ? Tag.Type.MAIN : Tag.Type.DEFAULT}
                >
                  {role}
                </Tag>
              ))}
            </div>
          </CollapseContent>
        </Collapse>
      )}
      {filteredParticipants.map(p => {
        const roles = formatRoles(p);
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
              <div className="participantRoles">
                {roles.map(role => (
                  <Tag key={role} readOnly>{role}</Tag>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const App = memo(AppComponent);
