# Compatibility Notes

`singleflight-modern` is an independent migration package for projects leaving `inflight`; it is not affiliated with the original package maintainers or project.

| Area | Notes |
| --- | --- |
| Preserved migration surface | Keyed request coalescing and the callback-style `inflight(key, callback)` migration adapter. |
| Improvements | Promise-first API, deterministic cleanup, abort signals, timeouts, explicit forget semantics, and TypeScript types. |
| Intentional difference | The recommended API is an isolated coordinator instead of global mutable state. |
