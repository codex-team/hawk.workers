import NotifyTelegramWorker from "../src";

describe("NotifyTelegramWorker", () => {
  const worker = new NotifyTelegramWorker();

  test("should have correct catcher type", () => {
    expect(worker.type).toEqual("notify/telegram");
  });

  test("should start correctly", async () => {
    await worker.start();
  });

  test("should finish correctly", async () => {
    await worker.finish();
  });
});
