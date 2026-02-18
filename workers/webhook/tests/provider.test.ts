import EventNotifyMock from './__mocks__/event-notify';
import SeveralEventsNotifyMock from './__mocks__/several-events-notify';
import AssigneeNotifyMock from './__mocks__/assignee-notify';
import WebhookProvider from '../src/provider';
import { Notification } from 'hawk-worker-sender/types/template-variables';

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
jest.mock('./../src/deliverer.ts', () => {
  const original = jest.requireActual('./../src/deliverer.ts');

  const MockDeliverer = jest.fn().mockImplementation(() => {
    return {
      deliver: deliver,
    };
  });

  return {
    __esModule: true,
    default: MockDeliverer,
    isPrivateIP: original.isPrivateIP,
  };
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

  it('should strip all internal/sensitive fields from payload', async () => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, {
      type: 'event',
      payload: {
        host: 'https://garage.hawk.so',
        hostOfStatic: 'https://api.hawk.so',
        notificationRuleId: '123',
        project: {
          name: 'My Project',
          token: 'secret-token',
          integrationId: 'uuid',
          uidAdded: 'user-id',
          notifications: [{ rule: 'data' }],
        },
        events: [{
          event: {
            groupHash: 'abc',
            visitedBy: ['user1'],
          },
        }],
      },
    } as unknown as Notification);

    const delivery = deliver.mock.calls[0][1];
    const payload = delivery.payload as Record<string, unknown>;
    const project = payload.project as Record<string, unknown>;
    const events = payload.events as Array<Record<string, Record<string, unknown>>>;

    expect(payload).not.toHaveProperty('host');
    expect(payload).not.toHaveProperty('hostOfStatic');
    expect(payload).not.toHaveProperty('notificationRuleId');
    expect(project).not.toHaveProperty('token');
    expect(project).not.toHaveProperty('integrationId');
    expect(project).not.toHaveProperty('uidAdded');
    expect(project).not.toHaveProperty('notifications');
    expect(project).toHaveProperty('name', 'My Project');
    expect(events[0].event).not.toHaveProperty('visitedBy');
    expect(events[0].event).toHaveProperty('groupHash', 'abc');
  });

  it('should strip internal fields from all notification types', async () => {
    const provider = new WebhookProvider();
    const sensitivePayload = {
      host: 'h',
      hostOfStatic: 's',
      token: 'secret',
      notifications: [],
      integrationId: 'id',
      notificationRuleId: 'rid',
      visitedBy: ['u1'],
      uidAdded: 'uid',
      safeField: 'keep-me',
    };

    for (const type of ALL_NOTIFICATION_TYPES) {
      deliver.mockClear();

      await provider.send(webhookEndpointSample, {
        type,
        payload: { ...sensitivePayload },
      } as unknown as Notification);

      const payload = deliver.mock.calls[0][1].payload as Record<string, unknown>;

      expect(payload).not.toHaveProperty('host');
      expect(payload).not.toHaveProperty('hostOfStatic');
      expect(payload).not.toHaveProperty('token');
      expect(payload).not.toHaveProperty('notifications');
      expect(payload).not.toHaveProperty('integrationId');
      expect(payload).not.toHaveProperty('notificationRuleId');
      expect(payload).not.toHaveProperty('visitedBy');
      expect(payload).not.toHaveProperty('uidAdded');
      expect(payload).toHaveProperty('safeField', 'keep-me');
    }
  });
});
