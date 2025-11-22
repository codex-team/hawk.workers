import { EventNotification, SeveralEventsNotification, EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { DecodedGroupedEvent, ProjectDBScheme } from '@hawk.so/types';
import LoopProvider from '../src/provider';
import templates from '../src/templates';
import SeveralEventsTpl from '../src/templates/several-events';
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
      const SeveralEventsTplSpy = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(loopEndpointSample, EventNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(1);
      expect(SeveralEventsTplSpy).toHaveBeenCalledTimes(0);
    });

    /**
     * If there are several events in payload, use the 'several-events' template
     */
    it('Select the several-events template if there are several events in notify payload', async () => {
      const provider = new LoopProvider();
      const EventTpl = jest.spyOn(templates, 'EventTpl');
      const SeveralEventsTplSpy = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(loopEndpointSample, SeveralEventsNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(0);
      expect(SeveralEventsTplSpy).toHaveBeenCalledTimes(1);
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
          events: [ {
            event: {
              totalCount: 10,
              timestamp: Date.now(),
              payload: {
                title: 'New event',
                backtrace: [ {
                  file: 'file',
                  line: 1,
                  sourceCode: [ {
                    line: 1,
                    content: 'code',
                  } ],
                } ],
              },
            } as DecodedGroupedEvent,
            daysRepeated: 1,
            newCount: 1,
          } ],
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

      const render = (): string => templates.EventTpl(vars.payload);

      expect(render).not.toThrowError();

      const message = render();

      expect(message).toBeDefined();
    });

    /**
     * Check that rendering of a several events message works without errors
     */
    it('should successfully render a several-events template', () => {
      const vars: SeveralEventsNotification = SeveralEventsNotifyMock;

      const render = (): string => templates.SeveralEventsTpl(vars.payload);

      expect(render).not.toThrowError();

      const message = render();

      expect(message).toBeDefined();

      // Header contains number of events and declension
      expect(message).toContain(`${vars.payload.events.length} `);

      // Each event should be listed with "(newCount) title"
      vars.payload.events.forEach(({ event, newCount }) => {
        expect(message).toContain(`(${newCount}) ${event.payload.title}`);
      });

      // Footer should contain link to the project and project name
      const projectUrl = vars.payload.host + '/project/' + vars.payload.project._id;

      expect(message).toContain(`[Посмотреть все события](${projectUrl})`);
      expect(message).toContain(`*${vars.payload.project.name}*`);
    });

    /**
     * Check declensions in several-events template header
     */
    describe('several-events declensions', () => {
      const baseEvent = {
        event: {
          totalCount: 10,
          timestamp: Date.now(),
          payload: {
            title: 'New event',
            backtrace: [ {
              file: 'file',
              line: 1,
              sourceCode: [ {
                line: 1,
                content: 'code',
              } ],
            } ],
          },
        } as DecodedGroupedEvent,
        daysRepeated: 1,
        newCount: 1,
      };

      const baseProject: ProjectDBScheme = {
        _id: new ObjectId('5d206f7f9aaf7c0071d64596'),
        token: 'project-token',
        name: 'Project',
        workspaceId: new ObjectId('5d206f7f9aaf7c0071d64596'),
        uidAdded: new ObjectId('5d206f7f9aaf7c0071d64596'),
        notifications: [],
      } as ProjectDBScheme;

      const makePayload = (count: number): EventsTemplateVariables => ({
        events: Array.from({ length: count }, () => baseEvent),
        host: process.env.GARAGE_URL,
        hostOfStatic: process.env.API_STATIC_URL,
        project: baseProject,
        period: 60,
      });

      it('uses correct declension for 1 event', () => {
        const payload = makePayload(1);
        const message = SeveralEventsTpl(payload);

        expect(message).toContain('1 новое событие');
      });

      it('uses correct declension for 2 events', () => {
        const payload = makePayload(2);
        const message = SeveralEventsTpl(payload);

        expect(message).toContain('2 новых события');
      });

      it('uses correct declension for 5 events', () => {
        const payload = makePayload(5);
        const message = SeveralEventsTpl(payload);

        expect(message).toContain('5 новых событий');
      });

      it('uses correct declension for 10 events', () => {
        const payload = makePayload(10);
        const message = SeveralEventsTpl(payload);

        expect(message).toContain('10 новых событий');
      });

      it('uses correct declension for 21 events', () => {
        const payload = makePayload(21);
        const message = SeveralEventsTpl(payload);

        expect(message).toContain('21 новое событие');
      });
    });
  });
});
