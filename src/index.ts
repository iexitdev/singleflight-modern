export type SingleFlightKey = string | number | symbol;

export interface SingleFlightRunContext<K extends SingleFlightKey> {
  key: K;
  signal: AbortSignal;
}

export type SingleFlightRunner<K extends SingleFlightKey, V> = (
  context: SingleFlightRunContext<K>
) => V | Promise<V>;

export interface SingleFlightOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  cancelOnTimeout?: boolean;
}

export interface SingleFlightSnapshot<K extends SingleFlightKey> {
  key: K;
  startedAt: number;
  waiters: number;
}

interface Flight<K extends SingleFlightKey, V> {
  key: K;
  promise: Promise<V>;
  controller: AbortController;
  startedAt: number;
  waiters: number;
}

export class SingleFlightTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Single-flight call timed out after ${timeoutMs}ms`);
    this.name = "SingleFlightTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

export class SingleFlightAbortError extends Error {
  constructor(message = "Single-flight call was aborted") {
    super(message);
    this.name = "SingleFlightAbortError";
  }
}

export class SingleFlight<K extends SingleFlightKey = string, V = unknown> {
  private readonly flights = new Map<K, Flight<K, V>>();

  do<T extends V = V>(
    key: K,
    runner: SingleFlightRunner<K, T>,
    options: SingleFlightOptions = {}
  ): Promise<T> {
    const existing = this.flights.get(key) as Flight<K, T> | undefined;
    const flight = existing ?? this.start(key, runner);

    flight.waiters += 1;

    let result = flight.promise;

    if (options.signal) {
      result = rejectOnAbort(result, options.signal);
    }

    const timeoutMs = options.timeoutMs;

    if (timeoutMs !== undefined) {
      assertTimeout(timeoutMs);
      result = rejectOnTimeout(result, timeoutMs, () => {
        if (options.cancelOnTimeout) {
          this.forget(key, new SingleFlightTimeoutError(timeoutMs));
        }
      });
    }

    return result.finally(() => {
      flight.waiters = Math.max(0, flight.waiters - 1);
    });
  }

  has(key: K): boolean {
    return this.flights.has(key);
  }

  get size(): number {
    return this.flights.size;
  }

  clear(reason = new SingleFlightAbortError("Single-flight manager was cleared")): number {
    const count = this.flights.size;

    for (const key of this.flights.keys()) {
      this.forget(key, reason);
    }

    return count;
  }

  forget(key: K, reason = new SingleFlightAbortError()): boolean {
    const flight = this.flights.get(key);

    if (!flight) {
      return false;
    }

    this.flights.delete(key);
    flight.controller.abort(reason);
    return true;
  }

  snapshot(): Array<SingleFlightSnapshot<K>> {
    return Array.from(this.flights.values(), ({ key, startedAt, waiters }) => ({
      key,
      startedAt,
      waiters
    }));
  }

  private start<T extends V>(key: K, runner: SingleFlightRunner<K, T>): Flight<K, T> {
    const controller = new AbortController();

    const flight: Flight<K, T> = {
      key,
      controller,
      startedAt: Date.now(),
      waiters: 0,
      promise: rejectOnAbort(
        Promise.resolve().then(() => runner({ key, signal: controller.signal })),
        controller.signal
      )
        .finally(() => {
          if (this.flights.get(key) === flight) {
            this.flights.delete(key);
          }
        })
    };

    this.flights.set(key, flight as Flight<K, V>);
    return flight;
  }
}

export function createSingleFlight<K extends SingleFlightKey = string, V = unknown>(): SingleFlight<
  K,
  V
> {
  return new SingleFlight<K, V>();
}

const globalSingleFlight = createSingleFlight<SingleFlightKey, unknown>();

export function singleFlight<K extends SingleFlightKey, V>(
  key: K,
  runner: SingleFlightRunner<K, V>,
  options?: SingleFlightOptions
): Promise<V> {
  return globalSingleFlight.do(key, runner as SingleFlightRunner<SingleFlightKey, V>, options);
}

export type InflightCallback = (...args: unknown[]) => void;
export type InflightCompletion = (...args: unknown[]) => void;

export interface InflightOptions {
  timeoutMs?: number;
}

interface LegacyFlight {
  callbacks: InflightCallback[];
  timer?: ReturnType<typeof setTimeout>;
  completed: boolean;
}

const legacyFlights = new Map<string, LegacyFlight>();

export function inflight(
  key: string,
  callback: InflightCallback,
  options: InflightOptions = {}
): InflightCompletion | false {
  if (typeof callback !== "function") {
    throw new TypeError("inflight callback must be a function");
  }

  const existing = legacyFlights.get(key);

  if (existing) {
    existing.callbacks.push(callback);
    return false;
  }

  const flight: LegacyFlight = {
    callbacks: [callback],
    completed: false
  };

  const timeoutMs = options.timeoutMs;

  if (timeoutMs !== undefined) {
    assertTimeout(timeoutMs);
    flight.timer = setTimeout(() => {
      finishLegacyFlight(key, flight, [new SingleFlightTimeoutError(timeoutMs)]);
    }, timeoutMs);
  }

  legacyFlights.set(key, flight);

  return (...args: unknown[]) => {
    finishLegacyFlight(key, flight, args);
  };
}

export function legacyInflightCount(): number {
  return legacyFlights.size;
}

function finishLegacyFlight(key: string, flight: LegacyFlight, args: unknown[]): void {
  if (flight.completed) {
    return;
  }

  flight.completed = true;

  if (flight.timer) {
    clearTimeout(flight.timer);
  }

  if (legacyFlights.get(key) === flight) {
    legacyFlights.delete(key);
  }

  const callbacks = flight.callbacks.splice(0);

  for (const callback of callbacks) {
    callback(...args);
  }
}

function rejectOnAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(toAbortReason(signal.reason));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      signal.removeEventListener("abort", onAbort);
      handler();
    };

    const onAbort = () => {
      settle(() => reject(toAbortReason(signal.reason)));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => settle(() => resolve(value)),
      (error: unknown) => settle(() => reject(error))
    );
  });
}

function rejectOnTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new SingleFlightTimeoutError(timeoutMs);
      onTimeout();
      reject(error);
    }, timeoutMs);

    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
  });
}

function toAbortReason(reason: unknown): unknown {
  return reason ?? new SingleFlightAbortError();
}

function assertTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new RangeError("timeoutMs must be a non-negative finite number");
  }
}

export default inflight;
