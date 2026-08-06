# Sender worker 📮

Multi-channel worker that delivers notifications to users. One process serves
all notification channels: `email`, `telegram`, `slack`, `webhook`, `loop`.

Each enabled channel runs its own consumer on the `sender/<channel>` queue, so
per-channel backpressure and retries are preserved, while MongoDB connections
are shared between channels.

## Configuration

Besides common worker variables (see the root `.env`), the sender uses:

| Variable | Description |
| -- | -- |
| `SENDER_CHANNELS` | Comma-separated list of channels to serve (e.g. `email,telegram`). All channels are enabled when not set. |
| `GARAGE_URL` | Garage URL used in notification links |
| `API_STATIC_URL` | API static files URL (icons etc.) |
| `SMTP_*` | SMTP settings for the email channel (see `.env.sample`) |

## Run

```bash
yarn run-sender
```

## Structure

- `src/index.ts` — multi-channel worker: reads `SENDER_CHANNELS`, owns db connections, starts channel workers.
- `src/channel-sender.ts` — worker of a single channel: consumes `sender/<channel>` queue, handles tasks, calls the provider.
- `src/channels.ts` — registry of channels and their providers.
- `src/providers/<channel>/` — provider (rendering + delivery) and templates of each channel.
- `types/sender-task/` — task payload types (used by producers: notifier, paymaster, api).
- `types/template-variables/` — notification template variables types.

## How to add a new channel

1. Add the channel to `ChannelType` (`workers/notifier/types/channel.ts`).
2. Create `src/providers/<channel>/provider.ts` extending `NotificationsProvider` — it renders and sends messages:

```ts
import NotificationsProvider from '../../provider';
import { Notification } from '../../../types/template-variables';

export default class NewProvider extends NotificationsProvider {
  public async send(to: string, notification: Notification): Promise<void> {
    // rendering and delivery logic
  }
}
```

3. Register it in `src/channels.ts`.
4. Declare the `sender/<channel>` queue in hawk.registry definitions.

## How to implement a new notification type

1. Create a new type for task and payload in `types/sender-task`.
2. Create a new type for notification in `types/template-variables`.
3. Create a new case for switch in `ChannelSenderWorker.handle()` method.
4. Create a new handler method in `ChannelSenderWorker` class.
5. Add templates to the channels that should support it (e.g. for email:
   create a directory in `src/providers/email/templates/emails` and run
   `yarn generate-tpl-names`, then add a case to `EmailProvider.send`).

## Email templates preview

```bash
yarn email-overview
# open http://localhost:4444/
```
