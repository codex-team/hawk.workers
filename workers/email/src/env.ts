import * as dotenv from 'dotenv';
import * as path from 'path';

/**
 * Load local environment configuration
 */
const localEnv = dotenv.config({path: path.resolve(__dirname, '../.env')}).parsed;

Object.assign(process.env, localEnv);
