const jwt = require('jsonwebtoken');
const { ParsingError } = require('../worker');

module.exports = (Worker) =>
  class extends Worker {
    /**
     * Message handle function
     *
     * @override
     * @param {Object} event - Message object from consume method
     */
    async handle(event) {
      await super.handle(event);
      try {
        const decodedToken = await jwt.verify(event.token, process.env.JWT_SECRET);

        event.projectId = decodedToken.projectId;
      } catch (err) {
        throw new ParsingError('tokenVerifierMixin::handle: Can\'t decode token' + err);
      }
    }
  };
