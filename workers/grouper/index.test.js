const { GrouperWorker } = require('./index');
const mongodb = require('mongodb');

const eventContent = {
  // eslint-disable-next-line camelcase
  projectId: '5d206f7f9aaf7c0071d64596',
  catcherType: 'grouper',
  payload: {
    title: 'Hawk client catcher test',
    timestamp: '2019-08-19T19:58:12.579Z',
    backtrace: []
  }
};

describe('GrouperWorker', () => {
  const worker = new GrouperWorker();

  test('should return correct worker type', () => {
    expect(worker.type).toEqual('grouper');
  });

  test('should start correctly', async () => {
    await worker.start();
  });

  test('should handle right messages', async () => {
    await worker.handle(eventContent);
  });

  test('show save event and return id', async () => {
    const result = await worker.saveEvent('5d206f7f9aaf7c0071d64596', {
      catcherType: 'grouper',
      payload: {
        title: 'testing',
        timestamp: new Date()
      }
    });

    const insertedId = mongodb.ObjectID.isValid(result);

    expect(insertedId).toBe(true);
  });

  test('throw error on saveEvent if project id not mongodb id', async () => {
    expect(
      worker.saveEvent('10', {})
    ).rejects.toThrowError();
  });

  test('throw error on saveEvent if event data not mongodb id', async () => {
    expect(
      worker.saveEvent('5d206f7f9aaf7c0071d64596', {})
    ).rejects.toThrowError();
  });

  test('save repetition should return mongodb id', async () => {
    const result = await worker.saveRepetition('5d206f7f9aaf7c0071d64596', {
      catcherType: 'grouper',
      payload: {
        title: 'testing',
        timestamp: new Date()
      }
    });

    const insertedId = mongodb.ObjectID.isValid(result);

    expect(insertedId).toBe(true);
  });

  test('throw error on saveRepetition if project id not mongodb id', async () => {
    expect(
      worker.saveRepetition('10', {})
    ).rejects.toThrowError();
  });

  test('throw error on incrementEventCounter if project id not mongodb id', async () => {
    expect(
      worker.incrementEventCounter('10', {})
    ).rejects.toThrowError();
  });

  test('should increment event', async () => {
    const result = await worker.incrementEventCounter('5d206f7f9aaf7c0071d64596', {});

    expect(result).not.toBe(null);
  });

  test('should finish correctly', async () => {
    await worker.finish();
  });
});
