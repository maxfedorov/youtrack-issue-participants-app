import type { ExtendedIssue } from './extended-entities.js';

/**
 * Issue context with extended entity (includes extension properties)
 */
export type ExtendedIssueCtx<T extends import('@jetbrains/youtrack-enhanced-dx-tools').IssueCtx> =
  Omit<T, 'issue'> & { issue: ExtendedIssue };


