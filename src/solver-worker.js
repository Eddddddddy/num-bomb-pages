import { recommendGuessWithProgress } from "./solver.js";

self.addEventListener("message", async (event) => {
  const { id, state } = event.data;

  try {
    const recommendation = await recommendGuessWithProgress(state, {
      chunkSize: 120,
      onProgress: (progress) => {
        self.postMessage({
          id,
          type: "progress",
          progress
        });
      }
    });

    self.postMessage({
      id,
      type: "result",
      recommendation
    });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
