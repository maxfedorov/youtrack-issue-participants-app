// @vitest-environment jsdom
import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, fireEvent, render, screen, within} from '@testing-library/react';

import {ParticipantsList} from './participants-list';
import type {Participant} from './types';

const participant = (login: string, roles: string[]): Participant => ({
  login,
  fullName: `${login} name`,
  roles: new Set(roles),
  lastActivityTimestamp: 0,
});

const PARTICIPANTS = [
  participant('ann', ['author', 'commenter']),
  participant('bob', ['assignee (past)', 'editor']),
  participant('cid', ['assignee']),
];

const names = () => screen.getAllByRole('listitem').map(li => within(li).getByRole('link').textContent);

// Ring's Collapse measures its content; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);

describe('ParticipantsList', () => {
  it('links each participant to their profile on the YouTrack host', () => {
    render(<ParticipantsList participants={PARTICIPANTS} layout="column" baseUrl="https://yt.example.com/yt"/>);
    const link = screen.getByRole('link', {name: 'ann name'});
    expect(link.getAttribute('href')).toBe('https://yt.example.com/yt/users/ann');
    expect(link.getAttribute('target')).toBe('_top');
  });

  it('filters by role, matching current and past values, and clears the filter', () => {
    const {container} = render(<ParticipantsList participants={PARTICIPANTS} layout="column" baseUrl=""/>);
    fireEvent.click(screen.getByText('Show filters'));

    const filters = container.querySelector('.filtersList') as HTMLElement;
    expect(within(filters).getAllByRole('button').map(b => b.textContent))
      .toEqual(['assignee', 'author', 'commenter', 'editor']);
    const assigneeFilter = within(filters).getByRole('button', {name: 'assignee'});
    expect(assigneeFilter.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(assigneeFilter);
    expect(names()).toEqual(['bob name', 'cid name']);
    expect(assigneeFilter.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', {name: 'Clear filters'}));
    expect(names()).toEqual(['ann name', 'bob name', 'cid name']);
  });

  it('toggles a filter from a role tag in a row', () => {
    render(<ParticipantsList participants={PARTICIPANTS} layout="grid" baseUrl=""/>);
    const annRow = screen.getAllByRole('listitem')[0];
    fireEvent.click(within(annRow).getByRole('button', {name: 'commenter'}));
    expect(names()).toEqual(['ann name']);
  });

  it('shows an empty state', () => {
    render(<ParticipantsList participants={[]} layout="column" baseUrl=""/>);
    expect(screen.getByText('No participants yet')).toBeTruthy();
  });
});
