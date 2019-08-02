require('../../env');
const db = require('./controller');

const PROJECT_ID_VALID = '5d206f7f9aaf7c0071d64596';

const PROJECT_ID_INVALID = '5d20011231';

const EVENT_VALID = {
  catcherType: 'errors/nodejs',
  payload: {
    title: 'ReferenceError: nonexistant_func is not defined',
    timestamp: new Date(),
    level: 10
  }
};

const EVENT_INVALID = {
  catcherType: 111
};

describe('DB contoroller', () => {
  describe('event', () => {
    beforeAll(async () => {
      await db.connect();
    });

    afterAll(async () => {
      await db.close();
    });

    it('should save event', async () => {
      const eventID = await db.saveEvent(PROJECT_ID_VALID, EVENT_VALID);
      const realEvent = await db.db
        .collection(`events:${PROJECT_ID_VALID}`)
        .findOne({ _id: eventID });

      expect({ _id: eventID, ...EVENT_VALID }).toEqual(realEvent);
    });

    it('should throw error on invalid event', async () => {
      expect(
        db.saveEvent(PROJECT_ID_VALID, EVENT_INVALID)
      ).rejects.toThrowError();
    });

    it('should throw error on invalid projectId', async () => {
      expect(
        db.saveEvent(PROJECT_ID_INVALID, EVENT_VALID)
      ).rejects.toThrowError();
    });
  });
});
