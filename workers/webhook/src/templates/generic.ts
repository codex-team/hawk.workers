import { Notification } from 'hawk-worker-sender/types/template-variables';
import { WebhookDelivery } from '../../types/template';

/**
 * Converts ObjectId (or any BSON value) to string, passes primitives through
 *
 * @param value - value to stringify
 */
function str(value: unknown): string {
  return String(value);
}

/**
 * Safe property accessor — returns undefined for missing nested paths
 *
 * @param obj - source object
 * @param key - property name
 */
function get(obj: Record<string, unknown>, key: string): unknown {
  return obj?.[key];
}

/* ---------- Shared DTO projectors ---------- */

function projectDTO(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: str(get(p, '_id')),
    name: get(p, 'name') ?? null,
    workspaceId: get(p, 'workspaceId') ? str(get(p, 'workspaceId')) : null,
    image: get(p, 'image') ?? null,
  };
}

function workspaceDTO(w: Record<string, unknown>): Record<string, unknown> {
  return {
    id: str(get(w, '_id')),
    name: get(w, 'name') ?? null,
    image: get(w, 'image') ?? null,
  };
}

function userDTO(u: Record<string, unknown>): Record<string, unknown> {
  return {
    id: str(get(u, '_id')),
    name: get(u, 'name') ?? null,
    email: get(u, 'email') ?? null,
    image: get(u, 'image') ?? null,
  };
}

function eventDTO(e: Record<string, unknown>): Record<string, unknown> {
  const payload = (e.payload ?? {}) as Record<string, unknown>;
  const backtrace = (payload.backtrace ?? []) as Array<Record<string, unknown>>;

  return {
    id: e._id ? str(e._id) : null,
    groupHash: e.groupHash ?? null,
    totalCount: e.totalCount ?? null,
    catcherType: e.catcherType ?? null,
    timestamp: e.timestamp ?? null,
    usersAffected: e.usersAffected ?? null,
    title: payload.title ?? null,
    type: payload.type ?? null,
    backtrace: backtrace.map((f) => ({
      file: f.file ?? null,
      line: f.line ?? null,
      column: f.column ?? null,
      function: f.function ?? null,
    })),
  };
}

function templateEventDataDTO(item: Record<string, unknown>): Record<string, unknown> {
  const event = (item.event ?? {}) as Record<string, unknown>;

  return {
    event: eventDTO(event),
    newCount: item.newCount ?? null,
    daysRepeated: item.daysRepeated ?? null,
    usersAffected: item.usersAffected ?? null,
    repetitionId: item.repetitionId ? str(item.repetitionId) : null,
  };
}

function planDTO(p: Record<string, unknown>): Record<string, unknown> {
  return {
    id: str(get(p, '_id')),
    name: get(p, 'name') ?? null,
    eventsLimit: get(p, 'eventsLimit') ?? null,
    monthlyCharge: get(p, 'monthlyCharge') ?? null,
  };
}

type PayloadProjector = (payload: Record<string, unknown>) => Record<string, unknown>;

const projectors: Record<string, PayloadProjector> = {
  'event': (p) => ({
    project: projectDTO((p.project ?? {}) as Record<string, unknown>),
    events: ((p.events ?? []) as Array<Record<string, unknown>>).map(templateEventDataDTO),
    period: p.period ?? null,
  }),

  'several-events': (p) => ({
    project: projectDTO((p.project ?? {}) as Record<string, unknown>),
    events: ((p.events ?? []) as Array<Record<string, unknown>>).map(templateEventDataDTO),
    period: p.period ?? null,
  }),

  'assignee': (p) => ({
    project: projectDTO((p.project ?? {}) as Record<string, unknown>),
    event: eventDTO((p.event ?? {}) as Record<string, unknown>),
    whoAssigned: userDTO((p.whoAssigned ?? {}) as Record<string, unknown>),
    daysRepeated: p.daysRepeated ?? null,
  }),

  'block-workspace': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
  }),

  'blocked-workspace-reminder': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
    daysAfterBlock: p.daysAfterBlock ?? null,
  }),

  'days-limit-almost-reached': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
    daysLeft: p.daysLeft ?? null,
  }),

  'events-limit-almost-reached': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
    eventsCount: p.eventsCount ?? null,
    eventsLimit: p.eventsLimit ?? null,
  }),

  'payment-failed': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
    reason: p.reason ?? null,
  }),

  'payment-success': (p) => ({
    workspace: workspaceDTO((p.workspace ?? {}) as Record<string, unknown>),
    plan: planDTO((p.plan ?? {}) as Record<string, unknown>),
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
  const project = projectors[notification.type];
  const payload = project
    ? project(notification.payload as unknown as Record<string, unknown>)
    : {};

  return {
    type: notification.type,
    payload,
  };
}
