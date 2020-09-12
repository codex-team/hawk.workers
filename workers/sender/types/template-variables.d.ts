import { GroupedEventDBScheme, ProjectDBScheme } from 'hawk.types';

/**
 * Common interface for template variables
 */
export interface TemplateVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TemplateEventData {
  event: GroupedEventDBScheme;
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
  hostOfStatic: string;
  project: ProjectDBScheme;
  period: number;
}
