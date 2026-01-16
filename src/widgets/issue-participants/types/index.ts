export interface User {
  id: string;
  login: string;
  fullName?: string;
  avatarUrl?: string;
  ringId?: string;
  $type: 'User';
}

export interface FieldType {
  id: string;
  valueType: string;
  isMultiValue: boolean;
  presentation: string;
  $type: 'FieldType';
}

export interface CustomField {
  id: string;
  name: string;
  fieldType: FieldType;
  $type: 'CustomField';
}

export interface ProjectCustomField {
  id: string;
  field: CustomField;
  $type: string;
}

export interface IssueCustomField {
  id: string;
  projectCustomField: ProjectCustomField;
  value: unknown;
  $type: string;
}

export interface Issue {
  id: string;
  idReadable: string;
  summary: string;
  reporter?: User;
  fields: IssueCustomField[];
  $type: 'Issue';
}

export interface ActivityCategory {
  id: string;
  $type: 'ActivityCategory';
}

export interface ActivityItem {
  id: string;
  author: User;
  timestamp: number;
  category: ActivityCategory;
  field?: {
    presentation: string;
    customField?: {
      fieldType: {
        valueType: string;
      };
    };
  };
  added?: unknown;
  removed?: unknown;
  $type: string;
}

export interface ActivityPage {
  activities: ActivityItem[];
  cursor?: string;
}

export interface Participant {
  login: string;
  fullName?: string;
  avatarUrl?: string;
  roles: Set<string>;
  lastActivityTimestamp: number;
}
