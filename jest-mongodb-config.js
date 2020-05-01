module.exports = {
  mongodbMemoryServerOptions: {
    instance: {
      port: 27019,
      dbName: 'hawk',
    },
    binary: {
      version: '4.0.3',
      skipMD5: true,
    },
    autoStart: false,
  },
};
