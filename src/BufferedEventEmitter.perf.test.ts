import { describe, expect, it } from "vitest";
import { BufferedEventEmitter } from "./BufferedEventEmitter.js";

const bigArr = new Array(100).fill("sbee");

function runScenario(iterations: number): void {
  const instance = new BufferedEventEmitter({ ttl: 1, maintenanceChance: 100 });
  instance.subscribe("evt", () => {});

  for (let i = 0; i < iterations; i++) {
    const id = `b-${i}`;
    instance.createBuffer(id);
    instance.emitBuffered(id, "evt", i, {
      payload: `value-${i}`,
      data: bigArr,
    });
    instance.flush(id);
  }
}

describe("BufferedEventEmitter perf health", () => {
  it("keeps heap stable under repeated create/emit/flush cycles", () => {
    if (typeof global.gc !== "function") {
      throw new Error(
        "This test requires --expose-gc. Run: NODE_OPTIONS=--expose-gc vitest ..."
      );
    }

    const samples: number[] = [];
    const batches = 12;
    const iterationsPerBatch = 2000;

    // Warm up JIT and hidden classes to reduce startup noise.
    runScenario(iterationsPerBatch);
    global.gc();

    for (let i = 0; i < batches; i++) {
      runScenario(iterationsPerBatch);
      global.gc();
      samples.push(process.memoryUsage().heapUsed);
    }

    const initial = samples[0];
    const tailAverage =
      samples.slice(-4).reduce((acc, value) => acc + value, 0) / 4;

    const growthBytes = tailAverage - initial;
    const growthMb = growthBytes / 1024 / 1024;
    const samplesMb = samples.map(value =>
      Number((value / 1024 / 1024).toFixed(2))
    );

    console.info("Perf(memory): heap samples (MB)", samplesMb);
    console.info(
      "Perf(memory): initial/tailAvg/growth (MB)",
      Number((initial / 1024 / 1024).toFixed(2)),
      Number((tailAverage / 1024 / 1024).toFixed(2)),
      Number(growthMb.toFixed(2))
    );

    // Allows normal runtime variance while still detecting sustained growth.
    expect(growthMb).toBeLessThan(6);
  });

  it("has sane throughput for buffered emit + flush", () => {
    const iterations = 50_000;
    const start = performance.now();
    runScenario(iterations);
    const durationMs = performance.now() - start;

    const opsPerSecond = iterations / (durationMs / 1000);
    console.info(
      "Perf(throughput): iterations/durationMs/opsPerSec",
      iterations,
      Number(durationMs.toFixed(2)),
      Number(opsPerSecond.toFixed(0))
    );

    // Very conservative threshold to catch major regressions only.
    expect(opsPerSecond).toBeGreaterThan(2_000);
  });
});
