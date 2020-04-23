export abstract class Block {
  protected type: string;
  protected data: any;

  public getType(): string {
    return this.type;
  }

  abstract getTemplate();
}
