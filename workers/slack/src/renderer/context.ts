import {Block} from "./block";
import {ContextElement, ContextTemplate} from "../../types/renderer/context";

export class Context extends Block {
  protected type = "context";

  private elements: ContextElement[] = [];

  public addElement(element: ContextElement) {
    this.elements.push(element);
  }

  getTemplate(): ContextTemplate {
    return {
      elements: this.elements
    }
  }
}
