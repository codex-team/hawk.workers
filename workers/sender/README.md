# Sender worker / Abstract 🧰

This worker provides abstract classes for implementing notify-senders
for different channels. For example, Email, Telegram, Slack notifiers.

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
import { TemplateVariables } from 'hawk-worker-sender/types/template-variables';
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

## How to implement a new template

1. Create a new type for task and payload in `workers/sender/src/types/sender-task`.

2. Create a new type for notification in `workers/sender/src/types/template-variables`.

3. Create a new case for switch in `SenderWorker.handle()` method.

4. Create a new handler method in `SenderWorker` class.

Let's create a template for Email worker for example.

5. Go to `workers/email/src/emails` and create a new directory for templates.

6. Go to `workers/email` and update `names` file by the following command:

`yarn generate-tpl-names`

7. Then go provider's switch in `EmailProvider.send` method which resolves template and add a new one.

Now you can test it by adding new tasks with a new name type.

Good luck.
