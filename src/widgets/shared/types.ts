export interface User {
  login: string;
  fullName?: string;
  avatarUrl?: string;
  $type: string;
}

export interface ActivityItem {
  author?: User | null;
  timestamp: number;
  category: {id: string};
  field?: {
    presentation: string;
    customField?: {
      fieldType?: {valueType: string};
    };
  };
  added?: unknown;
  removed?: unknown;
}

export interface ActivityPage {
  activities?: ActivityItem[];
  hasBefore?: boolean;
  beforeCursor?: string;
}

export interface Participant {
  login: string;
  fullName?: string;
  avatarUrl?: string;
  roles: Set<string>;
  lastActivityTimestamp: number;
}

export type Host = Awaited<ReturnType<typeof YTApp.register>>;

/** Loads everything a widget needs and turns it into a participant list. */
export type ParticipantsLoader = (host: Host, entityId: string) => Promise<Participant[]>;
