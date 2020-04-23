export interface ActionsText {
  type: string;
  text: string;
}

export interface ActionsElement {
  type: string;
  style: string;
  text: ActionsText;
  value: string;
  action_id: string;
}

export interface ActionsTemplate {
  elements: ActionsElement[];
}
