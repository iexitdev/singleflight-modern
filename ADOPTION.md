# Adoption Plan

Post-publish discovery plan for `singleflight-modern`.

This package is an independent alternative or migration helper for `inflight`; do not imply affiliation with the original project.

## First Search

[Search GitHub package.json dependencies for inflight](https://github.com/search?q=%22inflight%22%20path%3Apackage.json&type=code)

## Useful Proof Point

Typed single-flight async coalescing with cleanup, cancellation, timeout support, and legacy callbacks.

## Pull Request Copy

```md
This removes `inflight`, which is deprecated, unsupported, or on a stale release line, and replaces the affected call site with `singleflight-modern`.

`singleflight-modern` is an independent TypeScript migration package with zero runtime dependencies. It is not affiliated with the original project.

Validation:
- [ ] npm install
- [ ] npm test
```
