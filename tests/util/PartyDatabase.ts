/** In-memory Firebase event semantics for deterministic multi-client protocol tests.
 * This is not a security-rules emulator. */
export const partyDB = {
  data: {} as Record<string, unknown>,
  listeners: new Set<{
    path: string;
    child: boolean;
    seen: Set<string>;
    last?: string;
    callback: (value: unknown) => void;
  }>(),
  disconnects: new Map<string, unknown>(),
  sequence: 0,
  writes: [] as Record<string, unknown>[],
  reset() {
    this.data = {};
    this.listeners.clear();
    this.disconnects.clear();
    this.sequence = 0;
    this.writes = [];
  },
  read(path: string): unknown {
    let value: unknown = this.data;
    for (const key of path.split("/").filter(Boolean))
      value = (value as Record<string, unknown>)?.[key];
    return value ?? null;
  },
  put(path: string, value: unknown) {
    const keys = path.split("/").filter(Boolean);
    let at = this.data;
    for (const key of keys.slice(0, -1))
      at = (at[key] ??= {}) as Record<string, unknown>;
    if (value === null) delete at[keys[keys.length - 1]];
    else at[keys[keys.length - 1]] = value;
  },
  snapshot(value: unknown, key?: string) {
    return {
      val: () => value ?? null,
      exists: () => value !== null && value !== undefined,
      key: key ?? null,
    };
  },
  flush() {
    for (const listener of [...this.listeners]) {
      const value = this.read(listener.path);
      if (listener.child) {
        for (const [key, child] of Object.entries(value ?? {}))
          if (!listener.seen.has(key)) {
            listener.seen.add(key);
            listener.callback(this.snapshot(child, key));
          }
      } else {
        const current = JSON.stringify(value);
        if (listener.last !== current) {
          listener.last = current;
          listener.callback(this.snapshot(value));
        }
      }
    }
  },
  update(paths: Record<string, unknown>) {
    this.writes.push(paths);
    for (const [path, value] of Object.entries(paths)) this.put(path, value);
    this.flush();
  },
  subscribe(path: string, child: boolean, callback: (value: unknown) => void) {
    const listener: {
      path: string;
      child: boolean;
      callback: (value: unknown) => void;
      seen: Set<string>;
      last?: string;
    } = { path, child, callback, seen: new Set<string>() };
    this.listeners.add(listener);
    queueMicrotask(() => {
      if (this.listeners.has(listener)) {
        if (child)
          for (const [key, value] of Object.entries(this.read(path) ?? {})) {
            listener.seen.add(key);
            callback(this.snapshot(value, key));
          }
        else {
          listener.last = JSON.stringify(this.read(path));
          callback(this.snapshot(this.read(path)));
        }
      }
    });
    return () => this.listeners.delete(listener);
  },
};
export const firebasePartyMock = {
  ref: (_db: unknown, path = "") => path,
  get: async (path: string) => partyDB.snapshot(partyDB.read(path)),
  set: async (path: string, value: unknown) =>
    partyDB.update({ [path]: value }),
  update: async (_root: unknown, paths: Record<string, unknown>) =>
    partyDB.update(paths),
  remove: async (path: string) => partyDB.update({ [path]: null }),
  runTransaction: async (
    path: string,
    update: (current: unknown) => unknown,
  ) => {
    const value = update(partyDB.read(path));
    if (value === undefined) return { committed: false };
    partyDB.update({ [path]: value });
    return { committed: true };
  },
  push: (path: string, value?: unknown) => {
    const key = String(++partyDB.sequence).padStart(10, "0");
    if (value !== undefined) partyDB.update({ [`${path}/${key}`]: value });
    return Object.assign(Promise.resolve(), { key });
  },
  onValue: (path: string, callback: (value: unknown) => void) =>
    partyDB.subscribe(path, false, callback),
  onChildAdded: (path: string, callback: (value: unknown) => void) =>
    partyDB.subscribe(path, true, callback),
  onDisconnect: (path: string) => ({
    set: async (value: unknown) => {
      partyDB.disconnects.set(path, value);
    },
    remove: async () => {
      partyDB.disconnects.set(path, null);
    },
    cancel: async () => {
      partyDB.disconnects.delete(path);
    },
  }),
  query: (path: string) => path,
  limitToLast: () => 100,
};
