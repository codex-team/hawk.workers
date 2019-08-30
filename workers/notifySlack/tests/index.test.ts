import NotifySlackWorker from "../src";

describe("NotifySlackWorker", () => {
  const worker = new NotifySlackWorker();

  test("should have correct catcher type", () => {
    expect(worker.type).toEqual("notify/slack");
  });

  test("should start correctly", async () => {
    await worker.start();
  });

  test("should finish correctly", async () => {
    await worker.finish();
  });
});
