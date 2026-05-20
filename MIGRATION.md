# Migration Guide

`singleflight-modern` is an independent alternative or migration helper for projects moving away from `inflight`. It is not affiliated with the original package maintainers or project.

## First Command

```sh
npm install singleflight-modern
```

## Migration Target

- Source package: `inflight`
- Replacement package: `singleflight-modern`
- Source signal: npm deprecation notice flags unsupported code and memory leaks
- Migration direction: Typed single-flight async coalescing with cleanup, cancellation, timeout support, and legacy callbacks.

## Compatibility Posture

- Preserved: Keyed request coalescing and the callback-style `inflight(key, callback)` migration adapter.
- Improved: Promise-first API, deterministic cleanup, abort signals, timeouts, explicit forget semantics, and TypeScript types.
- Intentional difference: The recommended API is an isolated coordinator instead of global mutable state.

## Review Checklist

- Replace the old dependency at one migration boundary first.
- Run the package or application test suite after the swap.
- Keep attribution accurate: this package is independent and is not an official successor to `inflight`.
