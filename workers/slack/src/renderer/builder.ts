import {Block} from "./block";
import {IncomingWebhookSendArguments} from "@slack/webhook";

export class Builder {
  private blocks: Block[] = [];

  public addBlock(block: Block) {
    this.blocks.push(block);
  }

  public buildMessage(): IncomingWebhookSendArguments
  {
    const message = [];
    for (const block of this.blocks) {
      const chunk = {
        type: block.getType(),
        ...block.getTemplate()
      };

      message.push(chunk);
    }
    return message as IncomingWebhookSendArguments;
  }
}
