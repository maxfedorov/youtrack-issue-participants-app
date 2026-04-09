import React, {memo, useEffect, useState, useMemo} from 'react';
import LoaderInline from '@jetbrains/ring-ui-built/components/loader-inline/loader-inline';
import Text from '@jetbrains/ring-ui-built/components/text/text';
import Avatar, {Size as AvatarSize} from '@jetbrains/ring-ui-built/components/avatar/avatar';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Tag from '@jetbrains/ring-ui-built/components/tag/tag';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Collapse from '@jetbrains/ring-ui-built/components/collapse/collapse';
import Icon from '@jetbrains/ring-ui-built/components/icon/icon';
import CloseIcon from '@jetbrains/icons/close-12px';
import ChevronDownIcon from '@jetbrains/icons/chevron-down';
import ChevronUpIcon from '@jetbrains/icons/chevron-up';
import CollapseControl from '@jetbrains/ring-ui-built/components/collapse/collapse-control';
import CollapseContent from '@jetbrains/ring-ui-built/components/collapse/collapse-content';

import type {Issue, ActivityItem, ActivityPage} from './types';
import {collectParticipants} from './utils';
import {getSortedParticipants} from './sorting';

import './app.css';

const host = await YTApp.register();

const ISSUE_FIELDS = [
  'id', 'idReadable', 'summary', 'reporter(login,fullName,avatarUrl)',
  'updater(login,fullName,avatarUrl)', 'updated', 'created',
  'fields(value(login,fullName,avatarUrl,$type),projectCustomField(field(name,fieldType(valueType))))',
].join(',');

const ACTIVITY_CATEGORIES = [
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
  'WorkItemAuthorCategory', 'StarCategory', 'TicketCCEventCategory',
].join(',');

const ACTIVITY_FIELDS = [
  'activities(author(login,fullName,avatarUrl,$type),timestamp,category(id),',
  'field(presentation,customField(fieldType(valueType))),',
  'added(login,fullName,avatarUrl,$type),removed(login,fullName,avatarUrl,$type))',
].join('');

const normalizeRole = (role: string) => role.replace(/ \((initial|past)\)$/, '');

const AppComponent: React.FunctionComponent = () => {
  const [issue, setIssue] = useState<Issue | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  useEffect(() => {
    const issueId = YTApp.entity?.id;
    if (!issueId) {
      setError('No issue context found');
      setLoading(false);
      return;
    }

    Promise.all([
      host.fetchYouTrack<Issue>(`issues/${issueId}?fields=${ISSUE_FIELDS}`),
      host.fetchYouTrack<ActivityPage>(
        `issues/${issueId}/activitiesPage?categories=${ACTIVITY_CATEGORIES}&fields=${ACTIVITY_FIELDS}`
      ),
    ])
      .then(([issueData, activitiesData]) => {
        setIssue(issueData);
        setActivities(activitiesData?.activities ?? []);
      })
      .catch((e: Error) => {
        console.error('Failed to load issue participants', e);
        setError(e.message || 'Unknown error');
      })
      .finally(() => setLoading(false));
  }, []);

  const participants = useMemo(() => {
    if (!issue) {
      return [];
    }
    return getSortedParticipants(collectParticipants(issue, activities), issue.reporter?.login);
  }, [issue, activities]);

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const p of participants) {
      for (const role of p.roles) {
        roles.add(normalizeRole(role));
      }
    }
    return Array.from(roles).sort();
  }, [participants]);

  const filteredParticipants = useMemo(() => {
    if (selectedRoles.size === 0) {
      return participants;
    }
    return participants.filter(p =>
      Array.from(p.roles).some(role => selectedRoles.has(normalizeRole(role)))
    );
  }, [participants, selectedRoles]);

  const toggleRole = (role: string) => {
    const normalized = normalizeRole(role);
    setSelectedRoles(prev => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  };

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
              <div className="filtersHeader">
                <Icon
                  glyph={collapsed ? ChevronDownIcon : ChevronUpIcon}
                  className="filtersChevron"
                />
                <Link className="filtersToggle">
                  {collapsed ? 'Show filters' : 'Hide filters'}
                </Link>
                {selectedRoles.size > 0 && (
                  <Button
                    title="Clear filters"
                    icon={CloseIcon}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setSelectedRoles(new Set());
                    }}
                    className="clearFiltersButton"
                  />
                )}
              </div>
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

      {filteredParticipants.map(p => (
        <div key={p.login} className="participant">
          <Avatar url={p.avatarUrl} username={p.login} size={AvatarSize.Size20}/>
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
              {[...p.roles].map(role => (
                <Tag
                  key={role}
                  readOnly
                  onClick={() => toggleRole(role)}
                  tagType={selectedRoles.has(normalizeRole(role)) ? Tag.Type.MAIN : Tag.Type.DEFAULT}
                >
                  {role}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export const App = memo(AppComponent);
