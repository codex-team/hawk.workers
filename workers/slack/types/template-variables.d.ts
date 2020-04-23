import {GroupedEvent} from 'hawk-worker-grouper/types/grouped-event';

export interface TemplateVariables {
  [key: string]: any;
}

export interface TemplateEventData {
  event: GroupedEvent,
  daysRepeated: number,
  count: number;
}
