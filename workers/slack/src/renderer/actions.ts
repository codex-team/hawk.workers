import {Block} from "./block";
import {ActionsElement, ActionsTemplate} from "../../types/renderer/actions";

export class Actions extends Block {
  protected type = "actions";

  private elements: ActionsElement[] = [];

  public addElement(element: ActionsElement) {
    this.elements.push(element);
  }

  getTemplate(): ActionsTemplate {
    return {
      elements: this.elements
    };
  }
}
