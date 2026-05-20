import { describe, expect, it } from "vitest";
import {
  createSingleFlight,
  inflight,
  legacyInflightCount,
  SingleFlightTimeoutError
} from "../src/index.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("createSingleFlight", () => {
  it("coalesces concurrent calls with the same key", async () => {
    const group = createSingleFlight<string, number>();
    const gate = deferred<number>();
    let calls = 0;

    const first = group.do("a", async () => {
      calls += 1;
      return gate.promise;
    });

    const second = group.do("a", async () => {
      calls += 1;
      return 13;
    });

    expect(group.has("a")).toBe(true);
    expect(group.snapshot()).toMatchObject([{ key: "a", waiters: 2 }]);

    gate.resolve(42);

    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    expect(calls).toBe(1);
    expect(group.has("a")).toBe(false);
  });

  it("runs different keys independently", async () => {
    const group = createSingleFlight<string, string>();
    const values = await Promise.all([
      group.do("a", () => "alpha"),
      group.do("b", () => "bravo")
    ]);

    expect(values).toEqual(["alpha", "bravo"]);
  });

  it("runs the key again after the previous promise settles", async () => {
    const group = createSingleFlight<string, number>();
    let calls = 0;

    await group.do("a", () => {
      calls += 1;
      return calls;
    });

    await group.do("a", () => {
      calls += 1;
      return calls;
    });

    expect(calls).toBe(2);
  });

  it("can forget an active key and abort the runner signal", async () => {
    const group = createSingleFlight<string, string>();
    const reason = new Error("stop");

    const pending = group.do("a", ({ signal }) => {
      return new Promise<string>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        setTimeout(() => resolve("late"), 25);
      });
    });

    expect(group.forget("a", reason)).toBe(true);

    await expect(pending).rejects.toThrow("stop");
    expect(group.has("a")).toBe(false);
  });

  it("supports caller timeouts", async () => {
    const group = createSingleFlight<string, string>();

    await expect(
      group.do("a", () => new Promise<string>(() => undefined), { timeoutMs: 1 })
    ).rejects.toBeInstanceOf(SingleFlightTimeoutError);
  });
});

describe("inflight compatibility adapter", () => {
  it("fans out completion to callbacks for the same key", () => {
    const seen: unknown[][] = [];
    const first = inflight("config", (...args: unknown[]) => seen.push(args));
    const second = inflight("config", (...args: unknown[]) => seen.push(args));

    expect(typeof first).toBe("function");
    expect(second).toBe(false);

    if (first) {
      first(null, "value");
      first(null, "ignored");
    }

    expect(seen).toEqual([
      [null, "value"],
      [null, "value"]
    ]);
    expect(legacyInflightCount()).toBe(0);
  });

  it("allows the same key to run again after completion", () => {
    const first = inflight("again", () => undefined);

    if (first) {
      first(null);
    }

    const second = inflight("again", () => undefined);
    expect(typeof second).toBe("function");

    if (second) {
      second(null);
    }
  });
});
