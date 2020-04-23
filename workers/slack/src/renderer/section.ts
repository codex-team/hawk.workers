import {Block} from "./block";
import {SectionAccessory, SectionTemplate, SectionText} from "../../types/renderer/section";

export class Section extends Block {
  protected type = "section";

  private text: SectionText;
  private accessory: SectionAccessory;

  public addText(text: SectionText) {
    this.text = text;
  }

  public addAccessory(accessory: SectionAccessory) {
    this.accessory = accessory;
  }

  getTemplate(): SectionTemplate {
    return {
      text: this.text,
      accessory: this.accessory
    }
  }
}
