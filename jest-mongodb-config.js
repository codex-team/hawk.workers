module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55010,
      dbName: 'hawk',
      replSet: 'rs0',
      storageEngine: 'wiredTiger',
    },
    binary: {
      version: '6.0.2',
      skipMD5: true,
    },
    autoStart: false,
  },
};
