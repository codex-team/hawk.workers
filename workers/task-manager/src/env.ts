import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load environment variables from .env file
 */
dotenv.config({ path: path.resolve(__dirname, '../.env') });
