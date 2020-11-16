import { DecodedGroupedEvent, GroupedEventDBScheme, ProjectDBScheme } from 'hawk.types';

/**
 * Common interface for template variables
 */
export interface TemplateVariables {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TemplateEventData {
  event: DecodedGroupedEvent;
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

/**
 * Variables for events template
 */
export interface PersonalTemplateVariables extends TemplateVariables {
  host: string;
  hostOfStatic: string;
  project: ProjectDBScheme;
  event: GroupedEventDBScheme;
  whoAssignedId: string;
  repeating: number;
}

/**
 * All templates
 */
export type AllTemplateVariables = EventsTemplateVariables | PersonalTemplateVariables;