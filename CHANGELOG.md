# Changelog

## v4.0.0

### Breaking Changes

1. **Node.js >= 20 required** (was >= 16)
2. **ESM-only package** — `"type": "module"` added to `package.json`. CommonJS `require()` will no longer work.
3. **New entry point** — Main export changed from `lib/BufferedEventEmitter.js` to `lib/index.js`. Types from `lib/index.d.ts`. All public symbols (class + types) are re-exported from the barrel `index.ts`.
4. **`createBuffer()` returns a `CreatedBuffer` object** (was `this`). The returned object has convenience methods:
   - `bufferId` — the id (auto-generated UUID if none provided)
   - `emit(eventName, ...args)` — shortcut to `emitBuffered(bufferId, ...)`
   - `flush()` — shortcut to `flush(bufferId)`
   - `clean()` — shortcut to `cleanBuffer(bufferId)`
5. **`createBuffer()` id is now optional** — defaults to `crypto.randomUUID()`.
6. **Buffer timestamps are now `number` (epoch ms)** — `created` and `lastActivity` changed from `Date` to `number` (`Date.now()`).
7. **`emitBuffered()` uses rest params** — signature changed from `(bufferId, eventName, message)` to `(bufferId, eventName, ...args)`, supporting multiple arguments per buffered event.
8. **`emit()` freezes cloned args** — event data passed to handlers is now `Object.freeze(structuredClone(args))` instead of `JSON.parse(JSON.stringify(args))`. Handlers that mutate the received arguments will now throw in strict mode.
9. **Validation errors use `TypeError`** — `setTTL` and `setMaintenanceChance` now throw `TypeError` for type-mismatch inputs (was plain `Error`).

### New Features

- **Auto-generated buffer IDs** — `createBuffer()` with no arguments creates a buffer with a UUID id.
- **`CreatedBuffer` convenience API** — The object returned from `createBuffer()` lets you interact with the buffer without passing the id around.
- **`EventHandler` generic type** — `EventHandler<T extends any[]>` enables typed listener signatures.
- **Performance tests** — New `BufferedEventEmitter.perf.test.ts` with heap stability and throughput benchmarks.
- **Source maps & declaration maps** — `sourceMap: true` and `declarationMap: true` now enabled in tsconfig.

### Internal / Quality Improvements

- **`Map` instead of plain objects** — `eventListenersMap` and `bufferedMessages` now use `Map` for better performance and cleaner key management (no `delete` / `in` operator).
- **`structuredClone` replaces `JSON.parse(JSON.stringify())`** — Proper deep cloning that handles more types and avoids the serialization round-trip.
- **`for...of` loops** replace `.forEach()` and `Object.keys()` iteration in several methods.
- **Strict TypeScript** — `"strict": true` in tsconfig (was only `strictNullChecks`). Target bumped to `es2022`, module to `node16`.
- **Biome replaces ts-standard** — Linting/formatting switched from `ts-standard` (ESLint-based) to Biome. New `biome.json` config added; `tsconfig.eslint.json` removed.
- **Dependency upgrades** — TypeScript 6.0, Vitest 4.1, typedoc 0.28, `@types/node` 25.x. Dropped `ts-standard`.
- **Vitest runs with `--expose-gc`** and `sequence.concurrent: true`.
- **Test suite significantly expanded** (~225 to ~709 lines) — includes GC/memory-leak tests via `WeakRef` + `tryCollect`, more thorough coverage of edge cases.
- **typedoc config** migrated from `typedoc.js` to `typedoc.json`.

### Migration Guide (v3 to v4)

```diff
- const { BufferedEventEmitter } = require('sbee')
+ import { BufferedEventEmitter } from 'sbee'

- const emitter = new BufferedEventEmitter()
- emitter.createBuffer('my-buffer', { some: 'context' })
- emitter.emitBuffered('my-buffer', 'event', data)
- emitter.flush('my-buffer')
+ const emitter = new BufferedEventEmitter()
+ const buffer = emitter.createBuffer('my-buffer', { some: 'context' })
+ buffer.emit('event', data)
+ buffer.flush()

// Or with auto-generated id:
+ const buffer = emitter.createBuffer()
+ buffer.emit('event', data)
+ buffer.flush()

// Buffer timestamps
- buffer.created instanceof Date  // true in v3
+ typeof buffer.created === 'number'  // true in v4 (Date.now())
```
