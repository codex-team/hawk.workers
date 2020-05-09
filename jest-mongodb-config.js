module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 55010,
      dbName: 'hawk',
    },
    binary: {
      version: '4.0.3',
      skipMD5: true,
    },
    autoStart: false,
  },
};
