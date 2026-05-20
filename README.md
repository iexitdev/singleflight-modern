# singleflight-modern

Typed single-flight request coalescing for JavaScript and TypeScript.

Use it when many callers can ask for the same expensive async value at the same time and only one underlying operation should run. It is a modern replacement path for packages such as `inflight`, with deterministic cleanup, promise-first APIs, cancellation hooks, and a small legacy callback adapter.

## Install

```sh
npm install singleflight-modern
```

## Usage

### Promise API

```ts
import { createSingleFlight } from "singleflight-modern";

const users = createSingleFlight<string, User>();

const user = await users.do("user:42", async ({ signal }) => {
  const response = await fetch("https://api.example.com/users/42", { signal });
  return response.json() as Promise<User>;
});
```

Concurrent calls with the same key share the same promise. Once the promise settles, the key is removed and a future call can run again.

### Legacy callback adapter

```ts
import { inflight } from "singleflight-modern";

const done = inflight("config", (error, value) => {
  if (error) throw error;
  console.log(value);
});

if (done) {
  readConfig(done);
}
```

The first call returns a completion callback. Later calls with the same key attach their callback and return `false`, matching the old `inflight` control flow.

## API

### `createSingleFlight<K, V>()`

Creates an isolated coordinator.

### `manager.do(key, runner, options?)`

Runs `runner` once per active key and returns a promise for its result.

Options:

- `signal`: rejects this caller if aborted.
- `timeoutMs`: rejects this caller after the timeout.
- `cancelOnTimeout`: aborts and forgets the shared operation when this caller times out.

### `manager.forget(key, reason?)`

Removes an active key and aborts the runner signal.

### `inflight(key, callback, options?)`

Compatibility adapter for callback-style migrations.

## Why this exists

The original `inflight` package is deprecated and warns that it is unsupported and leaks memory. This package keeps the useful single-flight pattern, while making cleanup, cancellation, and TypeScript behavior explicit.

## Migration Position

`singleflight-modern` is an independent alternative or migration helper for projects moving away from `inflight`. It is not affiliated with the original package maintainers or project.

For release context, see the local [migration guide](./MIGRATION.md), [examples](./EXAMPLES.md), [compatibility notes](./COMPATIBILITY.md), [source metadata](./SOURCE_METADATA.md), and [adoption plan](./ADOPTION.md).

