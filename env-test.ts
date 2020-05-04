/**
 * @file import this file to test-files to provide env-vars for testing
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env.test') });
