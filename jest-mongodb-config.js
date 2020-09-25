module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55010,
      dbName: 'hawk',
    },
    binary: {
      version: '4.2.0',
      skipMD5: true,
    },
    autoStart: false,
  },
};
