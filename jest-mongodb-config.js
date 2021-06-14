module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55010,
      dbName: 'hawk',
    },
    binary: {
      version: '4.4.6',
      skipMD5: true,
    },
    autoStart: false,
  },
};
