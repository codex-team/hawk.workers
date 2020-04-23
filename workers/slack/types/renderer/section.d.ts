export interface SectionText {
  type: string;
  emoji: boolean;
  text: string;
}

export interface SectionAccessory {
  type: string;
  text: SectionText;
  value: string;
}

export interface SectionTemplate {
  text: SectionText;
  accessory: SectionAccessory;
}
