import { EventNotification, SeveralEventsNotification } from 'hawk-worker-sender/types/template-variables';
import { DecodedGroupedEvent, ProjectDBScheme } from '@hawk.so/types';
import LoopProvider from '../src/provider';
import templates from '../src/templates';
import EventNotifyMock from './__mocks__/event-notify';
import SeveralEventsNotifyMock from './__mocks__/several-events-notify';
import { ObjectId } from 'mongodb';

/**
 * The sample of the Loop Incoming Webhook endpoint
 */
const loopEndpointSample = 'https://hooks.loop.com/services/XXXXXXXXX/XXXXXXXXXX/XXXXXXXXXXX';

/**
 * Mock the 'deliver' method of LoopDeliverer
 */
const deliver = jest.fn();

/**
 * Loop Deliverer mock
 */
jest.mock('./../src/deliverer.ts', () => {
  return jest.fn().mockImplementation(() => {
    /**
     * Now we can track calls to 'deliver'
     */
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

describe('LoopProvider', () => {
  /**
   * Check that the 'send' method works without errors
   */
  it('The "send" method should render and deliver message', async () => {
    const provider = new LoopProvider();

    await provider.send(loopEndpointSample, EventNotifyMock);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(loopEndpointSample, expect.anything());
  });

  /**
   * Logic for select the template depended on events count
   */
  describe('Select correct template', () => {
    /**
     * If there is a single event in payload, use the 'new-event' template
     */
    it('Select the new-event template if there is a single event in notify payload', async () => {
      const provider = new LoopProvider();
      const EventTpl = jest.spyOn(templates, 'EventTpl');
      const SeveralEventsTpl = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(loopEndpointSample, EventNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(1);
      expect(SeveralEventsTpl).toHaveBeenCalledTimes(0);
    });

    /**
     * If there are several events in payload, use the 'several-events' template
     */
    it('Select the several-events template if there are several events in notify payload', async () => {
      const provider = new LoopProvider();
      const EventTpl = jest.spyOn(templates, 'EventTpl');
      const SeveralEventsTpl = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(loopEndpointSample, SeveralEventsNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(0);
      expect(SeveralEventsTpl).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Check templates rendering
   */
  describe('templates', () => {
    /**
     * Check that rendering of a single event message works without errors
     */
    it('should successfully render a new-event template', async () => {
      const vars: EventNotification = {
        type: 'event',
        payload: {
          events: [{
            event: {
              totalCount: 10,
              timestamp: Date.now(),
              payload: {
                title: 'New event',
                backtrace: [{
                  file: 'file',
                  line: 1,
                  sourceCode: [{
                    line: 1,
                    content: 'code',
                  }],
                }],
              },
            } as DecodedGroupedEvent,
            daysRepeated: 1,
            newCount: 1,
          }],
          period: 60,
          host: process.env.GARAGE_URL,
          hostOfStatic: process.env.API_STATIC_URL,
          project: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
            token: 'project-token',
            name: 'Project',
            workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
            uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
            notifications: [],
          } as ProjectDBScheme,
        },
      };

      const provider = new LoopProvider();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const render = (): string => provider.render(templates.EventTpl, vars.payload);

      expect(render).not.toThrowError();

      const message = await render();

      expect(message).toBeDefined();
    });

    /**
     * Check that rendering of a several events message works without errors
     */
    it('should successfully render a several-events template', async () => {
      const vars: SeveralEventsNotification = {
        type: 'several-events',
        payload: {
          events: [{
            event: {
              totalCount: 10,
              timestamp: Date.now(),
              payload: {
                title: 'New event',
                backtrace: [{
                  file: 'file',
                  line: 1,
                  sourceCode: [{
                    line: 1,
                    content: 'code',
                  }],
                }],
              },
            } as DecodedGroupedEvent,
            daysRepeated: 1,
            newCount: 1,
          }],
          host: process.env.GARAGE_URL,
          hostOfStatic: process.env.API_STATIC_URL,
          project: {
            _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
            token: 'project-token',
            name: 'Project',
            workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
            uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
            notifications: [],
          } as ProjectDBScheme,
          period: 60,
        },
      };

      const provider = new LoopProvider();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const render = (): string => provider.render(templates.SeveralEventsTpl, vars.payload);

      expect(render).not.toThrowError();

      const message = await render();

      expect(message).toBeDefined();
    });
  });
});
