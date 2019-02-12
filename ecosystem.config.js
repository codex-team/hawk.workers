module.exports = {
  apps: [
    {
      name: 'nodejs',
      script: 'workers/nodejs/runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
        DEBUG: 'db-controller'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'php',
      script: 'workers/php/runner.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
        DEBUG: 'db-controller'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
