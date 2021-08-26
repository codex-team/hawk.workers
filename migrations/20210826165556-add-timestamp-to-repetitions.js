/**
 * This migration updates date from format `dd-mm-YYYY` to midnight unixtime
 * so that each client with different timezone could convert it to local time
 */
module.exports = {
  async up(db) {
    const collections = await db.listCollections({}, {
      authorizedCollections: true,
      nameOnly: true,
    }).toArray();

    const projectIds = [];
    const REPETITIONS = 'repetitions';
    const EVENTS = 'events';

    collections.forEach((collection) => {
      if (/repetitions/.test(collection.name)) {
        projectIds.push(collection.name.split(':')[1]);
      }
    });

    for (const projectId of projectIds) {
      const originalEvents = await db.collection(`${EVENTS}:${projectId}`).find({}).toArray();
      const repetitions = await db.collection(`${REPETITIONS}:${projectId}`).find({
        'payload.timestamp': { $eq: null }
      }).toArray();

      for (const event of originalEvents) {
        const eventRepetitions = repetitions.filter(rep => rep.groupHash === event.groupHash);

        for (const repetition of eventRepetitions) {
          await db.collection(`${REPETITIONS}:${projectId}`).updateOne({
            _id: repetition._id,
          }, {
            $set: {
              'payload.timestamp': event.payload.timestamp,
            },
          });
        }
      }
    }
  },
};
