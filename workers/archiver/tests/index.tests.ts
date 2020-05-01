import { MongoClient } from 'mongodb';

describe('Archiver worker', () => {
  let connection;
  let db;

  beforeAll(async () => {
    connection = await MongoClient.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = await connection.db();
  });

  test('Should correctly remove old events', () => {

  });
  afterAll(async () => {
    await connection.close();
  });
});
