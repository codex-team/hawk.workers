import {GroupedEvent} from 'hawk-worker-grouper/types/grouped-event';
import {Project} from './project';

/**
 * Common interface for template variables
 */
export interface TemplateVariables {
  [key: string]: any;
}

/**
 * Variables for new-event template
 */
export interface NewEventTemplateVariables extends  TemplateVariables {
  event: GroupedEvent;
  daysRepeated: number;
  host: string;
  project: Project;
  usersAffected: number;
}
