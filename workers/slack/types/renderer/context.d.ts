import {ImageElement, MrkdwnElement, PlainTextElement} from "@slack/types";

export declare type ContextTemplateElement = (ImageElement | PlainTextElement | MrkdwnElement);

/**
 * Renderer Context component interface
 */
export interface ContextTemplate {
  elements: ContextTemplateElement[];
}
