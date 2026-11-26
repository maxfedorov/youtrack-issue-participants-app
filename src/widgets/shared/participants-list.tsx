import {memo, useMemo, useState} from 'react';
import Avatar, {Size as AvatarSize} from '@jetbrains/ring-ui-built/components/avatar/avatar';
import Link from '@jetbrains/ring-ui-built/components/link/link';
import Tag from '@jetbrains/ring-ui-built/components/tag/tag';
import Button from '@jetbrains/ring-ui-built/components/button/button';
import Collapse from '@jetbrains/ring-ui-built/components/collapse/collapse';
import CollapseControl from '@jetbrains/ring-ui-built/components/collapse/collapse-control';
import CollapseContent from '@jetbrains/ring-ui-built/components/collapse/collapse-content';
import Icon from '@jetbrains/ring-ui-built/components/icon/icon';
import CloseIcon from '@jetbrains/icons/close-12px';
import ChevronDownIcon from '@jetbrains/icons/chevron-down';
import ChevronUpIcon from '@jetbrains/icons/chevron-up';

import {normalizeRole} from './participants';
import type {Participant} from './types';

export type ListLayout = 'column' | 'grid';

interface Props {
  participants: Participant[];
  layout: ListLayout;
  /** YouTrack base URL used for profile links; `''` keeps them relative. */
  baseUrl: string;
}

function useRoleFilter(participants: Participant[]) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    participants.forEach(p => p.roles.forEach(role => roles.add(normalizeRole(role))));
    return Array.from(roles).sort();
  }, [participants]);

  const visible = useMemo(() => (selected.size === 0
    ? participants
    : participants.filter(p => [...p.roles].some(role => selected.has(normalizeRole(role))))
  ), [participants, selected]);

  const toggle = (role: string) => setSelected(prev => {
    const next = new Set(prev);
    const normalized = normalizeRole(role);
    if (!next.delete(normalized)) {
      next.add(normalized);
    }
    return next;
  });

  return {allRoles, selected, visible, toggle, clear: () => setSelected(new Set())};
}

// The selected state is shown by color only, so expose it to assistive technology as a toggle button.
const renderToggle = (active: boolean) => function ToggleTag(props: React.HTMLAttributes<HTMLElement>) {
  return <button type="button" aria-pressed={active} {...props}/>;
};

const RoleTag = ({role, active, onClick}: {role: string; active: boolean; onClick: () => void}) => (
  <Tag readOnly onClick={onClick} tagType={active ? Tag.Type.MAIN : Tag.Type.DEFAULT} render={renderToggle(active)}>
    {role}
  </Tag>
);

const ParticipantsListComponent = ({participants, layout, baseUrl}: Props) => {
  const {allRoles, selected, visible, toggle, clear} = useRoleFilter(participants);

  if (participants.length === 0) {
    return <div className="emptyState">No participants yet</div>;
  }

  return (
    <div className="widget">
      <Collapse className="filtersCollapse" defaultCollapsed>
        <CollapseControl>
          {(collapsed: boolean) => (
            <div className="filtersHeader">
              <Icon glyph={collapsed ? ChevronDownIcon : ChevronUpIcon} className="filtersChevron"/>
              <Link pseudo className="filtersToggle">
                {collapsed ? 'Show filters' : 'Hide filters'}
              </Link>
              {selected.size > 0 && (
                <Button
                  title="Clear filters"
                  aria-label="Clear filters"
                  icon={CloseIcon}
                  className="clearFiltersButton"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    clear();
                  }}
                />
              )}
            </div>
          )}
        </CollapseControl>
        <CollapseContent>
          <div className="filtersList">
            {allRoles.map(role => (
              <RoleTag key={role} role={role} active={selected.has(role)} onClick={() => toggle(role)}/>
            ))}
          </div>
        </CollapseContent>
      </Collapse>

      <ul className={layout === 'grid' ? 'participants participantsGrid' : 'participants'}>
        {visible.map(p => (
          <li key={p.login} className="participant">
            <Avatar url={p.avatarUrl} username={p.fullName || p.login} size={AvatarSize.Size20}/>
            <div className="participantInfo">
              <Link
                href={`${baseUrl}/users/${encodeURIComponent(p.login)}`}
                target="_top"
                className="participantName"
                title={p.fullName || p.login}
              >
                {p.fullName || p.login}
              </Link>
              <div className="participantRoles">
                {[...p.roles].map(role => (
                  <RoleTag
                    key={role}
                    role={role}
                    active={selected.has(normalizeRole(role))}
                    onClick={() => toggle(role)}
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ParticipantsList = memo(ParticipantsListComponent);
