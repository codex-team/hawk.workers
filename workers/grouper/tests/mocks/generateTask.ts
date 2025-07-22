import type {  ErrorsCatcherType, EventData, JavaScriptAddons } from '@hawk.so/types';
import type { GroupWorkerTask } from '../../types/group-worker-task';
import { projectIdMock } from './projectId';
import { generateEvent } from './generateEvent';

/**
 * Generates task for testing
 *
 * @param event - allows to override some event properties in generated task
 */
export function generateTask(
  event: Partial<EventData<JavaScriptAddons>> = undefined
): GroupWorkerTask<ErrorsCatcherType> {
  return {
    projectId: projectIdMock,
    catcherType: 'errors/javascript',
    payload: generateEvent(event),
    timestamp: new Date().getTime(),
  };
}
