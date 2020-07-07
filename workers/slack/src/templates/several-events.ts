import { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { IncomingWebhookSendArguments } from '@slack/webhook';
import { block, element, object, TEXT_FORMAT_MRKDWN, TEXT_FORMAT_PLAIN } from 'slack-block-kit';
import { getEventLocation } from './utils';

const { text } = object;
const { button } = element;
const { section, actions, divider, context } = block;

/**
 * Returns JSON with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): IncomingWebhookSendArguments {
  const blocks = [];
  const eventsToShow = 5;
  const projectUrl = tplData.host + '/project/' + tplData.project._id;

  blocks.push(
    context([
      text(`You have ${tplData.events.length} new events for the last ${tplData.period} seconds`, TEXT_FORMAT_MRKDWN),
    ]),
    divider()
  );

  tplData.events.forEach((eventData, index) => {
    if (index === eventsToShow) {
      return;
    }

    blocks.push(
      section(
        text(eventData.event.payload.title, TEXT_FORMAT_PLAIN),
        {
          accessory: button('view-details', 'Details', {
            url: tplData.host + '/project/' + tplData.project._id + '/event/' + eventData.event._id + '/',
          }),
        }
      ),
      context([
        text(`> ${getEventLocation(eventData.event)}  |  ${eventData.newCount} new  |  ${eventData.event.totalCount} total`, TEXT_FORMAT_MRKDWN),
      ]),
      divider()
    );
  });

  const hiddenEventsCount = tplData.events.length - eventsToShow;
  const ctaButtonText = hiddenEventsCount > 0 ? `and ${hiddenEventsCount} more…` : 'View events';

  blocks.push(
    actions([
      button('action', ctaButtonText, {
        style: 'danger',
        url: projectUrl,
      }),
    ])
  );

  return {
    blocks,
  };
}
