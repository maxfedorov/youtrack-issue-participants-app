# YouTrack Issue Participants App

This app provides a compact list of all users involved in a YouTrack issue. It helps to quickly identify the reporter, the last updater, current and past assignees, and other contributors who have interacted with the issue.

## Features

- **Automated Participant Identification**: Automatically collects users from issue fields, activity stream, and comments.
- **Role Detection**: Identifies specific roles based on current state and history:
  - **Reporter**: The author of the issue.
  - **Last Updater**: The user who made the most recent change.
  - **Field-based Roles**: Users from custom fields (e.g., `assignee`, `reviewer`). Historical values are automatically marked as `(initial)` or `(past)`.
  - **Activity-based Roles**: 
    - `commenter`: users who left comments or reactions.
    - `attachment manager`: users who managed attachments.
    - `spent time author`: users who logged work.
    - `vcs committer`: users associated with VCS changes or pull requests.
    - `editor`: users who modified fields, tags, or issue state.
    - `description editor` / `summary editor`: users who specifically edited the description or title.
    - `voter`: users who voted for or starred the issue.
- **Smart Sorting**: The reporter is always at the top, followed by the current assignee, then other participants sorted by their most recent activity.
- **Collapsible Role Filters**: Filter participants by role with OR logic. Multiple filters can be selected and cleared with one click.
- **Ring UI Integration**: Uses standard JetBrains Ring UI components (`Avatar`, `Tag`, `Link`, `Collapse`) for a native look and feel.
- **Compact UI**: Optimized for the YouTrack sidebar (Issue Field Panel).

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
