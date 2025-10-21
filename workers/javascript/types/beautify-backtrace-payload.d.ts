import { JavaScriptEventWorkerTask } from "./javascript-event-worker-task";

/**
 * Type that represents the payload of the beautify backtrace method
 * It requires id of the project, release and backtrace to beautify
 */
export type BeautifyBacktracePayload = Pick<JavaScriptEventWorkerTask, 'projectId'> 
  & Pick<JavaScriptEventWorkerTask['payload'], 'release' | 'backtrace'>
