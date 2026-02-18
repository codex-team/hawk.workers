import { Notification, TemplateEventData } from 'hawk-worker-sender/types/template-variables';
import {
  ProjectDBScheme,
  WorkspaceDBScheme,
  UserDBScheme,
  DecodedGroupedEvent,
  PlanDBScheme,
} from '@hawk.so/types';
import { WebhookDelivery } from '../../types/template';

/**
 * Projects safe public fields from a project document
 *
 * @param p - project DB record
 */
function projectDTO(p: ProjectDBScheme): Record<string, unknown> {
  return {
    id: String(p._id),
    name: p.name,
    workspaceId: String(p.workspaceId),
    image: p.image ?? null,
  };
}

/**
 * Projects safe public fields from a workspace document
 *
 * @param w - workspace DB record
 */
function workspaceDTO(w: WorkspaceDBScheme): Record<string, unknown> {
  return {
    id: String(w._id),
    name: w.name,
    image: w.image ?? null,
  };
}

/**
 * Projects safe public fields from a user document (no password, no bank cards)
 *
 * @param u - user DB record
 */
function userDTO(u: UserDBScheme): Record<string, unknown> {
  return {
    id: String(u._id),
    name: u.name ?? null,
    email: u.email ?? null,
    image: u.image ?? null,
  };
}

/**
 * Projects safe public fields from a grouped event (no sourceCode, no breadcrumbs, no addons)
 *
 * @param e - decoded grouped event
 */
function eventDTO(e: DecodedGroupedEvent): Record<string, unknown> {
  return {
    id: e._id ? String(e._id) : null,
    groupHash: e.groupHash,
    totalCount: e.totalCount,
    catcherType: e.catcherType,
    timestamp: e.timestamp,
    usersAffected: e.usersAffected,
    title: e.payload.title,
    type: e.payload.type ?? null,
    backtrace: (e.payload.backtrace ?? []).map((f) => ({
      file: f.file,
      line: f.line,
      column: f.column ?? null,
      function: f.function ?? null,
    })),
  };
}

/**
 * Projects event list item with its metadata (newCount, daysRepeated, etc.)
 *
 * @param item - template event data from sender worker
 */
function templateEventDataDTO(item: TemplateEventData): Record<string, unknown> {
  return {
    event: eventDTO(item.event),
    newCount: item.newCount,
    daysRepeated: item.daysRepeated,
    usersAffected: item.usersAffected ?? null,
    repetitionId: item.repetitionId ? String(item.repetitionId) : null,
  };
}

/**
 * Projects safe public fields from a plan document
 *
 * @param p - plan DB record
 */
function planDTO(p: PlanDBScheme): Record<string, unknown> {
  return {
    id: String(p._id),
    name: p.name,
    eventsLimit: p.eventsLimit,
    monthlyCharge: p.monthlyCharge,
  };
}

type PayloadProjector = (payload: Record<string, unknown>) => Record<string, unknown>;

const projectors: Record<string, PayloadProjector> = {
  'event': (p) => ({
    project: p.project ? projectDTO(p.project as ProjectDBScheme) : null,
    events: ((p.events ?? []) as TemplateEventData[]).map(templateEventDataDTO),
    period: p.period ?? null,
  }),

  'several-events': (p) => ({
    project: p.project ? projectDTO(p.project as ProjectDBScheme) : null,
    events: ((p.events ?? []) as TemplateEventData[]).map(templateEventDataDTO),
    period: p.period ?? null,
  }),

  'assignee': (p) => ({
    project: p.project ? projectDTO(p.project as ProjectDBScheme) : null,
    event: p.event ? eventDTO(p.event as DecodedGroupedEvent) : null,
    assignedBy: p.whoAssigned ? userDTO(p.whoAssigned as UserDBScheme) : null,
    assignee: p.assignee ? userDTO(p.assignee as UserDBScheme) : null,
    daysRepeated: p.daysRepeated ?? null,
  }),

  'block-workspace': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
  }),

  'blocked-workspace-reminder': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
    daysAfterBlock: p.daysAfterBlock ?? null,
  }),

  'days-limit-almost-reached': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
    daysLeft: p.daysLeft ?? null,
  }),

  'events-limit-almost-reached': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
    eventsCount: p.eventsCount ?? null,
    eventsLimit: p.eventsLimit ?? null,
  }),

  'payment-failed': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
    reason: p.reason ?? null,
  }),

  'payment-success': (p) => ({
    workspace: p.workspace ? workspaceDTO(p.workspace as WorkspaceDBScheme) : null,
    plan: p.plan ? planDTO(p.plan as PlanDBScheme) : null,
  }),

  'sign-up': (p) => ({
    email: p.email ?? null,
  }),

  'password-reset': () => ({}),

  'workspace-invite': (p) => ({
    workspaceName: p.workspaceName ?? null,
    inviteLink: p.inviteLink ?? null,
  }),
};

/**
 * Whitelist-based webhook template — each notification type has an explicit
 * DTO projector that picks only safe, relevant fields.
 * Unknown types produce an empty payload (fail-closed).
 *
 * @param notification - notification with type and payload
 */
export default function render(notification: Notification): WebhookDelivery {
  const projector = projectors[notification.type];
  const payload = projector
    ? projector(notification.payload as unknown as Record<string, unknown>)
    : {};

  return {
    type: notification.type,
    payload,
  };
}
