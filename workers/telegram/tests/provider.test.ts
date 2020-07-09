import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';
import { Project } from 'hawk-worker-sender/types/project';
import TelegramProvider from 'hawk-worker-telegram/src/provider';
import templates from '../src/templates';

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
      const vars: EventsTemplateVariables = {
        events: [ {
          event: {
            totalCount: 10,
            payload: {
              title: 'New event',
              timestamp: Date.now(),
              backtrace: [ {
                file: 'file',
                line: 1,
                sourceCode: [ {
                  line: 1,
                  content: 'code',
                } ],
              } ],
            },
          } as GroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        } ],
        period: 60,
        host: process.env.GARAGE_URL,
        hostOfStatic: process.env.API_STATIC_URL,
        project: {
          _id: 'projectId',
          name: 'Project',
          notifications: [],
        } as Project,
      };

      const provider = new TelegramProvider();

      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      const render = (): string => provider.render(templates.NewEventTpl, vars);

      expect(render).not.toThrowError();

      const message = await render();

      expect(message).toBeDefined();
    });
    /**
     * Check that rendering of a several events message works without errors
     */
    it('should successfully render a several-events template', async () => {
      const vars: EventsTemplateVariables = {
        events: [ {
          event: {
            totalCount: 10,
            payload: {
              title: 'New event',
              timestamp: Date.now(),
              backtrace: [ {
                file: 'file',
                line: 1,
                sourceCode: [ {
                  line: 1,
                  content: 'code',
                } ],
              } ],
            },
          } as GroupedEvent,
          daysRepeated: 1,
          newCount: 1,
        } ],
        host: process.env.GARAGE_URL,
        hostOfStatic: process.env.API_STATIC_URL,
        project: {
          _id: 'projectId',
          name: 'Project',
          notifications: [],
        } as Project,
        period: 60,
      };

      const provider = new TelegramProvider();

      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      const render = (): string => provider.render(templates.SeveralEventsTpl, vars);

      expect(render).not.toThrowError();

      const message = await render();

      expect(message).toBeDefined();
    });
  });
});
