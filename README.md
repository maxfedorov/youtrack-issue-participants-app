# Issue and Article Participants for YouTrack

Issue and Article Participants shows everyone involved in a YouTrack issue or knowledge base article and what each person did: who reported it, who is assigned now and who was assigned before, who commented, edited, attached files, logged time or was mentioned. It is for teams that want to know at a glance whom to ask about an issue or a page.

The app adds two widgets that share the same code and look:

| Widget | Where it appears | When it is hidden |
|---|---|---|
| **Issue Participants** | Issue sidebar, below the custom fields | Draft issues |
| **Article Participants** | Article page, above the activity stream | Article drafts and while the article is being edited |

## Features

- **Roles from current values and history.**
  - Issues: `reporter`, `last updater`, every user-type field (`assignee`, `reviewers`, …), and former field values marked `(initial)` or `(past)`.
  - Articles: `author`, `last updater`, `mentioned`.
  - Activity roles: `commenter`, `inline commenter` (articles), `reacted`, `attachment manager`, `description editor` / `summary editor` (issues), `content editor` / `title editor` (articles), `spent time author`, `vcs committer`, `voter`, `editor`.
- **Smart sorting.** The reporter or author comes first, then the current assignee, then everyone else by their most recent activity.
- **Role filters.** Pick one or more roles to narrow the list; clear them with one click.
- **The whole history.** The widgets page through the activity stream, so participants from long-running issues and articles are not lost.
- **Respects permissions.** Everything is read through the YouTrack REST API as the current user. A comment restricted to a group, a private article or a project the user cannot read never reaches the widget, so nobody learns about participants they could not see in YouTrack itself.
- **Native look.** Built with Ring UI; follows the light and dark YouTrack themes.

## Permissions

The app has no backend endpoints and stores nothing. Widget visibility:

- Issue Participants requires **Read Issue**.
- Article Participants requires **Read Article**.

## Development

```bash
npm install
npm run dev     # build, upload to YOUTRACK_HOST from .env, then watch with hot reload on :9000
npm test        # unit tests
npm run build   # lint, type check, tests, production build and manifest validation
```

`.env` needs `YOUTRACK_HOST` and `YOUTRACK_TOKEN`.

Shared code lives in `src/widgets/shared/`: activity loading with pagination, role collection, sorting and the list UI. Each widget only defines how to load its entity and which activity categories map to which roles (`load-issue.ts`, `load-article.ts`).

## Installation

### Manually

1. `npm install`
2. `npm run build`
3. Archive "dist" folder into a single ZIP file
4. Go to `/admin/apps` and import app from ZIP archive
5. Select desired projects on projects tab in the app sidebar

### With CLI

1. `npm install`
2. `npm run build && npm run upload -- --host %YOUTRACK_URL% --token %PERMANENT_USER_TOKEN%`
3. Select desired projects on the apps page
