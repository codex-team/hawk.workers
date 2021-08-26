/**
 * This migration sets timestamp for event repetitions if it was omitted because it's the same as original event one
 */
module.exports = {
  async up(db, client) {
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

    const session = client.startSession();

    try {
      session.withTransaction(async () => {
        for (const projectId of projectIds) {
          const originalEvents = await db.collection(`${EVENTS}:${projectId}`).find({}).toArray();
          const repetitions = await db.collection(`${REPETITIONS}:${projectId}`).find({
            'payload.timestamp': {$eq: null}
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
      })
    } finally {
      session.endSession();
    }
  },
};
