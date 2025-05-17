import axios from 'axios';

const limiterBotUrl = process.env.TELEGRAM_LIMITER_CHAT_URL;

/**
 * Telegram bot URLs
 */
export enum TelegramBotURLs {
  /**
   * Hawk chat
   */
  Limiter = 'limiter',
}

/**
 * Send a message to telegram via notify-codex-bot
 *
 * @param message - message to send
 * @param chat - chat to send the message
 */
export async function sendMessage(message: string, chat = TelegramBotURLs.Limiter): Promise<void> {
  let botUrl = '';

  switch (chat) {
    case TelegramBotURLs.Limiter: botUrl = limiterBotUrl; break;
    default: botUrl = limiterBotUrl; break;
  }

  if (!botUrl) {
    return;
  }

  try {
    await axios.post(botUrl, `message=${encodeURIComponent(message)}&parse_mode=HTML`);
  } catch (err) {
    console.log('Couldn\'t send a message to Telegram', err);
  }
}
