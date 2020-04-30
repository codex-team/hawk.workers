import { GroupedEvent } from 'hawk-worker-grouper/types/grouped-event';
import { Project } from './project';

/**
 * Common interface for template variables
 */
export interface TemplateVariables {
  [key: string]: any;
}

export interface TemplateEventData {
  event: GroupedEvent;
  daysRepeated: number;
  newCount: number;
  usersAffected?: number;
}

/**
 * Variables for events template
 */
export interface EventsTemplateVariables extends TemplateVariables {
  events: TemplateEventData[];
  host: string;
  project: Project;
  period: number;
}
