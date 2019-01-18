/**
 * Error bomber for nodejs hawk catcher
 */

/* eslint-disable require-jsdoc*/
const Hawk = require('@codexteam/hawk.nodejs');

/**
 * Hawk catcher url
 */
const CATCHER_URL = process.env.CATCHER_URL || 'http://localhost:3000/catcher';

/**
 * Hawk token
 */
const CATCHER_TOKEN = process.env.CATCHER_TOKEN || 'randomtoken';

const hawkCatcher = Hawk({
  url: CATCHER_URL,
  accessToken: CATCHER_TOKEN
});

const main = async () => {
  function namedFunc() {
    try {
      console.log('Named func');
      /* eslint-disable-next-line */
      kek();
      return true;
    } catch (e) {
      hawkCatcher.catchException(e, {comment: 'Exception in namedFunc'}, (error, response, body) => {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body); // Print the HTML for the Google homepage.
      });
    }
  }

  setInterval(namedFunc, parseInt(Math.random() * 1000, 10));
  setInterval(() => {
    try {
      console.log('Anon func');
      throw Error('WHOOPS');
      /* eslint-disable-next-line */
      return true;
    } catch (e) {
      hawkCatcher.catchException(e, {comment: 'Exception in anonFunc'}, (error, response, body) => {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        console.log('body:', body);
      });
    }
  }, parseInt(Math.random() * 1000, 10));
};

main();