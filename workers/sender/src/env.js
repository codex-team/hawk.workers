"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
/**
 * Load local environment configuration
 */
const localEnv = dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') }).parsed;
Object.assign(process.env, localEnv);
