module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55010,
      dbName: 'hawk',
    },
    binary: {
      version: '6.0.2',
      skipMD5: true,
    },
    autoStart: false,
  },
};
