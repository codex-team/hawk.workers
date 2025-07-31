import { EventNotification, SeveralEventsNotification } from 'hawk-worker-sender/types/template-variables';
import { DecodedGroupedEvent, ProjectDBScheme } from '@hawk.so/types';
import TelegramProvider from 'hawk-worker-telegram/src/provider';
import templates from '../src/templates';
import { ObjectId } from 'mongodb';

/**
 * @todo We need to test only public methods, so these tests should be rewrited similar with SlackProvider tests
 */
describe('TelegramProvider', () => {
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

      const provider = new TelegramProvider();

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

      const provider = new TelegramProvider();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const render = (): string => provider.render(templates.SeveralEventsTpl, vars.payload);

      expect(render).not.toThrowError();

      const message = await render();

      expect(message).toBeDefined();
    });
  });
});
