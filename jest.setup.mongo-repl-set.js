const { MongoClient } = require('mongodb');

let admin;
let connection;

beforeAll(async () => {
  connection = await MongoClient.connect('mongodb://127.0.0.1:55010/hawk?', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  admin = connection.db().admin();

  try {
    let status = await admin.command({ replSetGetStatus: 1 }).catch(() => null);

    if (status && status.ok) {
      // console.log('✅ Replica set already initialized');
    } else {
      await admin.command({ replSetInitiate: {} });
      // console.log('✅ Replica set initiated');
    }

    const startTime = Date.now();
    const timeout = 15000;

    /**
     * Wait for the replica set to initialize all nodes
     */
    do {
      status = await admin.command({ replSetGetStatus: 1 });

      const primary = status.members.find(member => member.stateStr === 'PRIMARY');

      if (primary) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } while (Date.now() - startTime < timeout);

    // console.log('✅ Replica set is stable');
  } catch (err) {
    console.error('❌ Failed to initiate replica set:', err);
  }
}, 30000);

afterAll(async () => {
  await connection.close();
});
