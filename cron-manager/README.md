# Cron Manager
Used to scheduled add new tasks for the specified workers according to the config.

## How to run
1. Install dependencies: `yarn`
2. Write config file according to config.sample.yml in `cron-manager` folder: `cp config.sample.yml config.yml`
3. Fill env vars in `.env` 
4. Run it: `yarn run-cron-manager` (in `workers` folder) or `yarn start` (in `cron-manager` folder)
