const https = require('https');

/**
 * Stop execution for a given number of milliseconds
 *
 * @param {number} ms - number of milliseconds to stop execution
 * @returns {Promise<void>}
 */
module.exports.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends alert to the Slack/Telegram
 *
 * @param {string} text - message to send
 * @returns {Promise<void>}
 */
module.exports.sendReport = async function sendReport(text) {
  const message = `🦩 Hawk workers (${process.env.ENVIRONMENT_NAME || 'unknown'}) | ${text}`;
  const postData = 'parse_mode=Markdown&message=' + encodeURIComponent(message);
  const endpoint = process.env.CODEX_BOT_WEBHOOK;

  if (!endpoint) {
    return;
  }

  return new Promise((resolve) => {
    const request = https.request(endpoint, {
      method: 'POST',
      timeout: 3000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        console.log('📤 Reporting:', chunk);

        resolve();
      });
    });

    request.on('error', (e) => {
      console.log('📤 Reporting failed:', e);

      /**
       * Does not throw error, so we don't need to catch it higher
       * and the application will not exit
       */
      resolve();
    });

    request.write(postData);
    request.end();
  });
};
