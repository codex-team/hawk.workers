import templates from '../src/templates';
import EventNotifyMock from './__mocks__/event-notify';
import SeveralEventsNotifyMock from './__mocks__/several-events-notify';
import SlackProvider from '../src/provider';

/**
 * The sample of the Slack Incoming Webhook endpoint
 */
const slackEndpointSample = 'https://hooks.slack.com/services/XXXXXXXXX/XXXXXXXXXX/XXXXXXXXXXX';

/**
 * Mock the 'deliver' method of SlackDeliverer
 */
const deliver = jest.fn();

/**
 * Slack Deliverer mock
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

describe('SlackProvider', () => {
  /**
   * Check that the 'send' method works without errors
   */
  it('The "send" method should render and deliver message', async () => {
    const provider = new SlackProvider();

    await provider.send(slackEndpointSample, EventNotifyMock);

    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith(slackEndpointSample, expect.anything());
  });

  /**
   * Logic for select the template depended on events count
   */
  describe('Select correct template', () => {
    /**
     * If there is a single event in payload, use the 'new-event' template
     */
    it('Select the new-event template if there is a single event in notify payload', async () => {
      const provider = new SlackProvider();
      const EventTpl = jest.spyOn(templates, 'EventTpl');
      const SeveralEventsTpl = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(slackEndpointSample, EventNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(1);
      expect(SeveralEventsTpl).toHaveBeenCalledTimes(0);
    });

    /**
     * If there are several events in payload, use the 'several-events' template
     */
    it('Select the several-events template if there are several events in notify payload', async () => {
      const provider = new SlackProvider();
      const EventTpl = jest.spyOn(templates, 'EventTpl');
      const SeveralEventsTpl = jest.spyOn(templates, 'SeveralEventsTpl');

      await provider.send(slackEndpointSample, SeveralEventsNotifyMock);

      expect(EventTpl).toHaveBeenCalledTimes(0);
      expect(SeveralEventsTpl).toHaveBeenCalledTimes(1);
    });
  });
});
