# Sender worker / Abstract 🧰

This worker provides abstract classes for implementing notify-senders for different channels. For example, Email, Telegram, Slack notifiers.

## How to implement a new worker for a specific channel

1. Create a class that implements abstract sender.

```ts
import * as pkg from '../package.json';
import NewProvider from './provider';
import SenderWorker from 'hawk-worker-sender/src';
import { ChannelType } from 'hawk-worker-notifier/types/channel';

/**
 * Worker to send email notifications
 */
export default class NewSenderWorker extends SenderWorker {
  /**
   * Worker type
   */
  public readonly type: string = pkg.workerType;

  /**
   * Email channel type
   */
  protected channelType = ChannelType.NewType;

  /**
   * Email provider
   */
  protected provider = new NewProvider();
}
```

2. Implement a provider that will render and send messages

```ts
import { TemplateVariables } from 'hawk-worker-sender/types/template-variables/';
import templates, { Template } from './templates';
import Templates from './templates/names';

/**
 * Class to provide rendering and transport
 */
export default class NewProvider extends TemplateVariables {
  /**
   * Send email to recipient
   *
   * @param {string} to - recipient endpoint
   * @param {TemplateVariables} variables - variables for template
   */
  public async send(to: string, variables: Template): Promise<void> {
    // logic for rendering and sending
  }
}
```
