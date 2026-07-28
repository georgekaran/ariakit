# @ariakit/solid-store

**Important:** This package is an internal dependency of Ariakit and does not follow semantic versioning, meaning breaking changes may occur in patch and minor versions.

Solid-facing entrypoint for Ariakit store primitives. This package currently re-exports the framework-agnostic store helpers from `@ariakit/store`.

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [API reference](#api-reference)

## Installation

```sh
npm i @ariakit/solid-store
```

## Usage

Import store helpers from the package root:

```ts
import { createStore } from "@ariakit/solid-store";
```

This package is ESM-only and exposes a single public entrypoint.

<!-- ariakit-docs:start -->

## API reference

- [`createStore`](#createstore)
- [`setup`](#setup)
- [`init`](#init)
- [`subscribe`](#subscribe)
- [`sync`](#sync)
- [`StateController`](#statecontroller)
- [`controlState`](#controlstate)
- [`observeRequests`](#observerequests)
- [`getRequestedState`](#getrequestedstate)
- [`batch`](#batch)
- [`omit`](#omit)
- [`pick`](#pick)
- [`mergeStore`](#mergestore)
- [`throwOnConflictingProps`](#throwonconflictingprops)
- [`State`](#state)
- [`StoreOptions`](#storeoptions)
- [`StoreProps`](#storeprops)
- [`StoreState`](#storestate)
- [`Store`](#store)

### `createStore`

```ts
function createStore<S extends State>(
  initialState: S,
  ...stores: Array<Store<Partial<S>> | undefined>
): Store<S>;
```

Creates a store.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `setup`

```ts
type StoreSetup = (callback: () => void | (() => void)) => () => void;

function setup<T extends Store>(
  store?: T | null,
  ...args: Parameters<StoreSetup>
): T extends Store ? ReturnType<StoreSetup> : void;
```

Register a callback function that's called when the store is initialized.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `init`

```ts
type StoreInit = () => () => void;

function init<T extends Store>(
  store?: T | null,
  ...args: Parameters<StoreInit>
): T extends Store ? ReturnType<StoreInit> : void;
```

Function that should be called when the store is initialized.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `subscribe`

```ts
type Listener<S> = (state: S, prevState: S) => void | (() => void);

type Sync<S, K extends keyof S> = (
  keys: K[] | null,
  listener: Listener<Pick<S, K>>,
) => () => void;

type StoreSubscribe<S = State, K extends keyof S = keyof S> = Sync<S, K>;

function subscribe<T extends Store, K extends keyof StoreState<T>>(
  store?: T | null,
  ...args: Parameters<StoreSubscribe<StoreState<T>, K>>
): T extends Store ? ReturnType<StoreSubscribe<StoreState<T>, K>> : void;
```

Registers a listener function that's called after state changes in the store.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `sync`

```ts
type Listener<S> = (state: S, prevState: S) => void | (() => void);

type Sync<S, K extends keyof S> = (
  keys: K[] | null,
  listener: Listener<Pick<S, K>>,
) => () => void;

type StoreSync<S = State, K extends keyof S = keyof S> = Sync<S, K>;

function sync<T extends Store, K extends keyof StoreState<T>>(
  store?: T | null,
  ...args: Parameters<StoreSync<StoreState<T>, K>>
): T extends Store ? ReturnType<StoreSync<StoreState<T>, K>> : void;
```

Registers a listener function that's called immediately and synchronously whenever the store state changes.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `StateController`

```ts
interface StateController<T> {
  /**
   * Commits a controlled prop value to the store. This is the only path that
   * updates the public state of a controlled key: it notifies subscribers
   * once and propagates through composed stores. Committing the current value
   * only clears the pending request.
   */
  commit: (value: T) => void;
  /**
   * Releases control of the key. The store keeps the last committed value and
   * becomes writable again.
   */
  release: () => void;
}
```

The object returned by `controlState`, used to commit controlled prop values and to release control of the key.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `controlState`

```ts
function controlState<T extends Store, K extends keyof StoreState<T>>(
  store: T,
  key: K,
  onRequest: (value: StoreState<T>[K]) => void,
): StateController<StoreState<T>[K]>;
function controlState<T extends Store, K extends keyof StoreState<T>>(
  store: T | null | undefined,
  key: K,
  onRequest: (value: StoreState<T>[K]) => void,
): T extends Store ? StateController<StoreState<T>[K]> : void;
```

Controls a state key: writes to the key anywhere in the composed store graph stop committing and instead call `onRequest` with the requested value, keeping the public state untouched. The returned controller's `commit` is the only way to update the key, mirroring how controlled React components treat props as the source of truth. Sequential and functional writes derive from the last requested value, so `toggle()` twice requests the original value again before anything commits.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `observeRequests`

```ts
function observeRequests<T extends Store, K extends keyof StoreState<T>>(
  store: T | null | undefined,
  key: K,
  listener: (value: StoreState<T>[K]) => void,
): () => void;
```

Registers a listener that's called when a write to a controlled key is requested, without controlling the key: on its own it leaves writes committing as usual. Unlike `subscribe`, it reports updates that the controller refused, which is what a setter prop passed without its value prop needs to observe.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `getRequestedState`

```ts
function getRequestedState<T extends Store, K extends keyof StoreState<T>>(
  store: T,
  key: K,
): StoreState<T>[K];
function getRequestedState<T extends Store, K extends keyof StoreState<T>>(
  store: T | null | undefined,
  key: K,
): StoreState<T>[K] | undefined;
```

Returns the last requested value for a controlled key, falling back to the committed state. Listeners that derive state from a write in the same dispatch (for example, selecting the tab a `move` targeted) can use this to read the value the write asked for before the controlled prop commits it. For uncontrolled keys this is the same as reading the state directly.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `batch`

```ts
type Listener<S> = (state: S, prevState: S) => void | (() => void);

type Sync<S, K extends keyof S> = (
  keys: K[] | null,
  listener: Listener<Pick<S, K>>,
) => () => void;

type StoreBatch<S = State, K extends keyof S = keyof S> = Sync<S, K>;

function batch<T extends Store, K extends keyof StoreState<T>>(
  store?: T | null,
  ...args: Parameters<StoreBatch<StoreState<T>, K>>
): T extends Store ? ReturnType<StoreBatch<StoreState<T>, K>> : void;
```

Registers a listener function that's called immediately and after a batch of state changes in the store.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `omit`

```ts
type StoreOmit<
  S = State,
  K extends ReadonlyArray<keyof S> = ReadonlyArray<keyof S>,
> = (keys: K) => Store<Omit<S, K[number]>>;

function omit<T extends Store, K extends ReadonlyArray<keyof StoreState<T>>>(
  store?: T | null,
  ...args: Parameters<StoreOmit<StoreState<T>, K>>
): T extends Store ? ReturnType<StoreOmit<StoreState<T>, K>> : void;
```

Creates a new store with a subset of the current store state and keeps them in sync.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `pick`

```ts
type StorePick<
  S = State,
  K extends ReadonlyArray<keyof S> = ReadonlyArray<keyof S>,
> = (keys: K) => Store<Pick<S, K[number]>>;

function pick<T extends Store, K extends ReadonlyArray<keyof StoreState<T>>>(
  store?: T | null,
  ...args: Parameters<StorePick<StoreState<T>, K>>
): T extends Store ? ReturnType<StorePick<StoreState<T>, K>> : void;
```

Creates a new store with a subset of the current store state and keeps them in sync.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `mergeStore`

```ts
function mergeStore<S extends State>(
  ...stores: Array<Store<S> | undefined>
): Store<S>;
```

Merges multiple stores into a single store.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `throwOnConflictingProps`

```ts
function throwOnConflictingProps(props: AnyObject, store?: Store): void;
```

Throws when a store prop is passed in conjunction with a default state.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `State`

```ts
type State = AnyObject;
```

Store state type.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `StoreOptions`

```ts
type StoreOptions<S extends State, K extends keyof S> = Partial<Pick<S, K>>;
```

Initial state that can be passed to a store creator function.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `StoreProps`

```ts
interface StoreProps<S extends State = State> {
  /**
   * Another store object that will be kept in sync with the original store.
   *
   * Live examples:
   * - [Navigation Menubar](https://ariakit.com/examples/menubar-navigation)
   */
  store?: Store<Partial<S>>;
}
```

Props that can be passed to a store creator function.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `StoreState`

```ts
type StoreState<T> = T extends Store<infer S> ? S : never;
```

Extracts the state type from a store type.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

### `Store`

```ts
interface Store<S = State> {
  /**
   * Returns the current store state.
   */
  getState(): S;
  /**
   * Sets a state value.
   */
  setState<K extends keyof S>(key: K, value: SetStateAction<S[K]>): void;
}
```

Store.

<div align="right">
  <a href="#api-reference">&uarr; back to top</a>
</div>

<!-- ariakit-docs:end -->
