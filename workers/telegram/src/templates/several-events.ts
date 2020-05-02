import {EventsTemplateVariables} from 'hawk-worker-sender/types/template-variables';

/**
 * Return tpl with data substitutions
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): string {
  const projectUrl = tplData.host + '/project/' + tplData.project._id;
  let message = tplData.events.length + ' new events\n\n';

  tplData.events.forEach(({event, newCount, daysRepeated, usersAffected}) => {
    message += `(${newCount}) ${event.payload.title} \n`;
  })

  message += `\n[View all events](${projectUrl}) | *${tplData.project.name}*`;

  return message;
};
