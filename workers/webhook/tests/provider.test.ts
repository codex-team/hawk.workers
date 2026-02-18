import EventNotifyMock from './__mocks__/event-notify';
import SeveralEventsNotifyMock from './__mocks__/several-events-notify';
import AssigneeNotifyMock from './__mocks__/assignee-notify';
import WebhookProvider from '../src/provider';

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

  it('should preserve notification type in delivery', async () => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, EventNotifyMock);
    expect(deliver.mock.calls[0][1].type).toBe('event');

    deliver.mockClear();

    await provider.send(webhookEndpointSample, SeveralEventsNotifyMock);
    expect(deliver.mock.calls[0][1].type).toBe('several-events');

    deliver.mockClear();

    await provider.send(webhookEndpointSample, AssigneeNotifyMock);
    expect(deliver.mock.calls[0][1].type).toBe('assignee');
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
    } as any);

    const delivery = deliver.mock.calls[0][1];

    expect(delivery.payload).not.toHaveProperty('host');
    expect(delivery.payload).not.toHaveProperty('hostOfStatic');
    expect(delivery.payload).not.toHaveProperty('notificationRuleId');
    expect(delivery.payload.project).not.toHaveProperty('token');
    expect(delivery.payload.project).not.toHaveProperty('integrationId');
    expect(delivery.payload.project).not.toHaveProperty('uidAdded');
    expect(delivery.payload.project).not.toHaveProperty('notifications');
    expect(delivery.payload.project).toHaveProperty('name', 'My Project');
    expect((delivery.payload.events as any[])[0].event).not.toHaveProperty('visitedBy');
    expect((delivery.payload.events as any[])[0].event).toHaveProperty('groupHash', 'abc');
  });

  it('should handle all known notification types without throwing', async () => {
    const provider = new WebhookProvider();

    const types = [
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
    ];

    for (const type of types) {
      await expect(
        provider.send(webhookEndpointSample, {
          type,
          payload: { host: 'h', hostOfStatic: 's' },
        } as any)
      ).resolves.toBeUndefined();
    }

    expect(deliver).toHaveBeenCalledTimes(types.length);
  });

  it('should only have { type, payload } keys at root level', async () => {
    const provider = new WebhookProvider();

    await provider.send(webhookEndpointSample, EventNotifyMock);

    const delivery = deliver.mock.calls[0][1];

    expect(Object.keys(delivery).sort()).toEqual(['payload', 'type']);
  });
});
