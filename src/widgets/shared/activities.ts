import type {ActivityItem, ActivityPage, Host} from './types';

// activitiesPage returns 100 items by default; walk the cursor instead of trusting one page.
const PAGE_SIZE = 200;
// Safety cap for entities with an extreme history: 25 pages x 200 = 5000 activities.
// Pages go newest first, so hitting the cap drops the oldest history, not recent participants.
const MAX_PAGES = 25;

export const USER_FIELDS = 'login,fullName,avatarUrl,$type';
export const AUTHOR_FIELDS = `author(${USER_FIELDS}),timestamp,category(id)`;
// `added`/`removed` hold user objects for user fields and mentions. Text categories (description,
// summary) put the whole text there, so request values only for the categories that need them.
export const VALUE_FIELDS = `${AUTHOR_FIELDS},added(${USER_FIELDS}),removed(${USER_FIELDS})`;

/**
 * Loads the activities of an issue or article for the given categories, newest first.
 * `entityPath` is `issues/<id>` or `articles/<id>`.
 */
export async function fetchActivities(
  host: Host,
  entityPath: string,
  categories: readonly string[],
  fields: string,
): Promise<ActivityItem[]> {
  const result: ActivityItem[] = [];
  const query: Record<string, string | number | boolean> = {
    categories: categories.join(','),
    reverse: true,
    $top: PAGE_SIZE,
    fields: `hasBefore,beforeCursor,activities(${fields})`,
  };

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await host.fetchYouTrack(`${entityPath}/activitiesPage`, {query}) as ActivityPage | null;
    result.push(...(data?.activities ?? []));
    // In reverse mode older pages are "before"; a repeated cursor would loop forever.
    if (!data?.hasBefore || !data.beforeCursor || data.beforeCursor === query.cursor) {
      return result;
    }
    query.cursor = data.beforeCursor;
  }
  console.warn(`Participants: stopped after ${MAX_PAGES * PAGE_SIZE} activities of ${entityPath}`);
  return result;
}
