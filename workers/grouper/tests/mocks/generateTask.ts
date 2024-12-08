import { EventAddons, EventDataAccepted } from "@hawk.so/types";
import { GroupWorkerTask } from "../../types/group-worker-task";
import { projectIdMock } from "./projectId";
import { generateEvent } from "./generateEvent";

/**
 * Generates task for testing
 *
 * @param event - allows to override some event properties in generated task
 */
export function generateTask(
  event: Partial<EventDataAccepted<EventAddons>> = undefined,
): GroupWorkerTask {
  return {
    projectId: projectIdMock,
    catcherType: 'grouper',
    event: generateEvent(event),
  };
}
