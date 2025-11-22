import type { EventsTemplateVariables } from 'hawk-worker-sender/types/template-variables';
import { declOfNum } from '../../../../lib/utils/decl';

/**
 * Return tpl with data substitutions
 *
 * @param tplData - event template data
 */
export default function render(tplData: EventsTemplateVariables): string {
  const projectUrl = tplData.host + '/project/' + tplData.project._id;
  let message = tplData.events.length + ' ' + declOfNum(
    tplData.events.length,
    ['новое событие', 'новых события', 'новых событий']
  ) + '\n\n';

  tplData.events.forEach(({ event, newCount }) => {
    message += `(${newCount}) ${event.payload.title} \n`;
  });

  message += `\n[Посмотреть все события](${projectUrl}) | *${tplData.project.name}*`;

  return message;
}
