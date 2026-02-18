import EventNotifyMock from './__mocks__/event-notify';
import SeveralEventsNotifyMock from './__mocks__/several-events-notify';
import AssigneeNotifyMock from './__mocks__/assignee-notify';
import WebhookProvider from '../src/provider';
import { Notification } from 'hawk-worker-sender/types/template-variables';
import { ObjectId } from 'mongodb';

/**
 * The sample of a webhook endpoint
 */
const webhookEndpointSample = 'https://example.com/hawk-webhook';

/**
 * Mock the 'deliver' method of WebhookDeliverer
 */
const deliver = jest.fn();

/**
 * Webhook Deliverer mock
 */
jest.mock('../src/deliverer', () => {
  return jest.fn().mockImplementation(() => {
    return {
      deliver: deliver,
    };
  });
});

/**
 * Clear all records of mock calls between tests
 */
afterEach(() => {
  jest.clearAllMocks();
});

/**
 * All notification types supported by the system
 */
const ALL_NOTIFICATION_TYPES = [
  'event',
  'several-events',
  'assignee',
  'block-workspace',
  'blocked-workspace-reminder',
  'payment-failed',
  'payment-success',
  'days-limit-almost-reached',
  'events-limit-almost-reached',
  'sign-up',
  'password-reset',
  'workspace-invite',
] as const;

/**
 * Helper to extract delivered payload
 */
function getDeliveredPayload(): Record<string, unknown> {
  return deliver.mock.calls[0][1].payload as Record<string, unknown>;
}

describe('WebhookProvider', () => {
  it('should deliver a message with { type, payload } structure', async () => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, EventNotifyMock);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(webhookEndpointSample, expect.objectContaining({
      type: 'event',
      payload: expect.any(Object),
    }));
  });

  it('should only have { type, payload } keys at root level', async () => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, EventNotifyMock);

    const delivery = deliver.mock.calls[0][1];

    expect(Object.keys(delivery).sort()).toEqual(['payload', 'type']);
  });

  it.each([
    ['event', EventNotifyMock],
    ['several-events', SeveralEventsNotifyMock],
    ['assignee', AssigneeNotifyMock],
  ] as const)('should preserve type "%s" from mock notification', async (expectedType, mock) => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, mock);

    expect(deliver.mock.calls[0][1].type).toBe(expectedType);
  });

  it.each(
    ALL_NOTIFICATION_TYPES.map((type) => [type])
  )('should handle "%s" notification without throwing', async (type) => {
    const provider = new WebhookProvider();

    await expect(
      provider.send(webhookEndpointSample, {
        type,
        payload: { projectName: 'Test' },
      } as unknown as Notification)
    ).resolves.toBeUndefined();

    const delivery = deliver.mock.calls[0][1];

    expect(delivery.type).toBe(type);
    expect(delivery.payload).toBeDefined();
  });

  describe('whitelist DTO behavior', () => {
    it('should only include whitelisted project fields for "event" type', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'event',
        payload: {
          project: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
            name: 'My Project',
            workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
            image: 'img.png',
            token: 'secret-token',
            notifications: [{ rule: 'data' }],
            integrationId: 'uuid',
            uidAdded: 'user-id',
          },
          events: [],
          period: 60,
          host: 'https://garage.hawk.so',
          hostOfStatic: 'https://api.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();
      const project = payload.project as Record<string, unknown>;

      expect(Object.keys(project).sort()).toEqual(['id', 'image', 'name', 'workspaceId']);
      expect(project.name).toBe('My Project');
      expect(project.id).toBe('5d206f7f9aaf7c0071d64596');
      expect(project.image).toBe('img.png');
    });

    it('should strip sourceCode from event backtrace', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, EventNotifyMock);

      const payload = getDeliveredPayload();
      const events = payload.events as Array<Record<string, unknown>>;
      const firstEvent = events[0].event as Record<string, unknown>;
      const backtrace = firstEvent.backtrace as Array<Record<string, unknown>>;

      expect(backtrace[0]).not.toHaveProperty('sourceCode');
      expect(backtrace[0]).toHaveProperty('file', 'file');
      expect(backtrace[0]).toHaveProperty('line', 1);
    });

    it('should never leak host/hostOfStatic from event payload', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, EventNotifyMock);

      const payload = getDeliveredPayload();

      expect(payload).not.toHaveProperty('host');
      expect(payload).not.toHaveProperty('hostOfStatic');
    });

    it('should return only email for "sign-up" (no password)', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'sign-up',
        payload: {
          email: 'john@example.com',
          password: 'super-secret-password',
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toEqual({ email: 'john@example.com' });
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('host');
    });

    it('should return empty payload for "password-reset"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'password-reset',
        payload: {
          password: 'new-secret',
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toEqual({});
    });

    it('should return empty payload for unknown notification type', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'totally-unknown-type',
        payload: {
          secret: 'should-not-leak',
          token: 'also-secret',
        },
      } as unknown as Notification);

      const delivery = deliver.mock.calls[0][1];

      expect(delivery.type).toBe('totally-unknown-type');
      expect(delivery.payload).toEqual({});
    });

    it('should include workspace DTO for "block-workspace"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'block-workspace',
        payload: {
          workspace: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
            name: 'My Workspace',
            image: 'ws.png',
            balance: 1000,
            accountId: 'acc-123',
          },
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();
      const workspace = payload.workspace as Record<string, unknown>;

      expect(Object.keys(workspace).sort()).toEqual(['id', 'image', 'name']);
      expect(workspace.name).toBe('My Workspace');
      expect(workspace).not.toHaveProperty('balance');
      expect(workspace).not.toHaveProperty('accountId');
    });

    it('should include workspace and plan DTOs for "payment-success"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'payment-success',
        payload: {
          workspace: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
            name: 'Ws',
          },
          plan: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64597'),
            name: 'Pro',
            eventsLimit: 50000,
            monthlyCharge: 999,
          },
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toHaveProperty('workspace');
      expect(payload).toHaveProperty('plan');

      const plan = payload.plan as Record<string, unknown>;

      expect(plan).toEqual({
        id: '5d206f7f9aaf7c0071d64597',
        name: 'Pro',
        eventsLimit: 50000,
        monthlyCharge: 999,
      });
    });

    it('should include assignedBy, assignee and event DTOs for "assignee"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, AssigneeNotifyMock);

      const payload = getDeliveredPayload();
      const assignedBy = payload.assignedBy as Record<string, unknown>;
      const assignee = payload.assignee as Record<string, unknown>;

      expect(assignedBy).toHaveProperty('name', 'John Doe');
      expect(assignedBy).toHaveProperty('email', 'john@example.com');
      expect(assignee).toHaveProperty('name', 'Jane Smith');
      expect(assignee).toHaveProperty('email', 'jane@example.com');
      expect(payload).toHaveProperty('event');
      expect(payload).toHaveProperty('daysRepeated', 3);
    });

    it('should include inviteLink and workspaceName for "workspace-invite"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'workspace-invite',
        payload: {
          workspaceName: 'My Team',
          inviteLink: 'https://hawk.so/invite/abc',
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toEqual({
        workspaceName: 'My Team',
        inviteLink: 'https://hawk.so/invite/abc',
      });
    });

    it('should include daysAfterBlock for "blocked-workspace-reminder"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'blocked-workspace-reminder',
        payload: {
          workspace: { _id: new ObjectId(), name: 'Ws' },
          daysAfterBlock: 7,
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toHaveProperty('daysAfterBlock', 7);
      expect(payload).toHaveProperty('workspace');
    });

    it('should include eventsCount and eventsLimit for "events-limit-almost-reached"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'events-limit-almost-reached',
        payload: {
          workspace: { _id: new ObjectId(), name: 'Ws' },
          eventsCount: 9500,
          eventsLimit: 10000,
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toHaveProperty('eventsCount', 9500);
      expect(payload).toHaveProperty('eventsLimit', 10000);
    });

    it('should include reason for "payment-failed"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'payment-failed',
        payload: {
          workspace: { _id: new ObjectId(), name: 'Ws' },
          reason: 'Insufficient funds',
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toHaveProperty('reason', 'Insufficient funds');
    });

    it('should include daysLeft for "days-limit-almost-reached"', async () => {
      const provider = new WebhookProvider();

      await provider.send(webhookEndpointSample, {
        type: 'days-limit-almost-reached',
        payload: {
          workspace: { _id: new ObjectId(), name: 'Ws' },
          daysLeft: 3,
          host: 'https://garage.hawk.so',
        },
      } as unknown as Notification);

      const payload = getDeliveredPayload();

      expect(payload).toHaveProperty('daysLeft', 3);
    });

    it('should never include sensitive fields regardless of notification type', async () => {
      const provider = new WebhookProvider();
      const toxicFields = {
        host: 'h',
        hostOfStatic: 's',
        token: 'secret',
        notifications: [],
        integrationId: 'id',
        notificationRuleId: 'rid',
        visitedBy: ['u1'],
        uidAdded: 'uid',
        password: 'pass',
      };

      for (const type of ALL_NOTIFICATION_TYPES) {
        deliver.mockClear();

        await provider.send(webhookEndpointSample, {
          type,
          payload: { ...toxicFields },
        } as unknown as Notification);

        const payload = getDeliveredPayload();

        expect(payload).not.toHaveProperty('host');
        expect(payload).not.toHaveProperty('hostOfStatic');
        expect(payload).not.toHaveProperty('token');
        expect(payload).not.toHaveProperty('notifications');
        expect(payload).not.toHaveProperty('integrationId');
        expect(payload).not.toHaveProperty('notificationRuleId');
        expect(payload).not.toHaveProperty('visitedBy');
        expect(payload).not.toHaveProperty('uidAdded');
        expect(payload).not.toHaveProperty('password');
      }
    });
  });
});
