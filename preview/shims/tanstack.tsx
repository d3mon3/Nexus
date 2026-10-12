import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";

type Entry = { data?: unknown; error?: unknown; promise?: Promise<unknown>; updated: number };
const store = new Map<string, Entry>();
const subs = new Set<() => void>();
const notify = () => subs.forEach((s) => s());
export const keepPreviousData = Symbol("keep");

export class QueryClient {
  constructor(_o?: unknown) {}
}
export function QueryClientProvider({ children }: { children: ReactNode; client: QueryClient }) {
  return <>{children}</>;
}
const Ctx = createContext(null);
void Ctx;
export function useQueryClient() {
  return {
    invalidateQueries: async () => {
      store.clear();
      notify();
    },
  };
}

function load(key: string, fn: () => Promise<unknown>) {
  const e = store.get(key) ?? { updated: 0 };
  if (e.promise) return;
  e.promise = fn()
    .then((d) => {
      e.data = d;
      e.error = undefined;
    })
    .catch((err) => (e.error = err))
    .finally(() => {
      e.promise = undefined;
      e.updated = Date.now();
      notify();
    });
  store.set(key, e);
}

export function useQuery<T>(opts: { queryKey: readonly unknown[]; queryFn: () => Promise<T>; enabled?: boolean; placeholderData?: unknown }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const key = JSON.stringify(opts.queryKey);
  const enabled = opts.enabled ?? true;
  const prev = useRef<unknown>(undefined);
  useEffect(() => {
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const e = store.get(key);
    if (!e || (e.data === undefined && e.error === undefined && !e.promise)) load(key, opts.queryFn);
  }, [key, enabled]);
  const e = store.get(key);
  let data = e?.data as T | undefined;
  if (data !== undefined) prev.current = data;
  else if (opts.placeholderData === keepPreviousData) data = prev.current as T | undefined;
  const refetch = useCallback(() => {
    store.delete(key);
    load(key, opts.queryFn);
  }, [key]);
  return {
    data,
    error: e?.error ?? null,
    isLoading: enabled && data === undefined && !e?.error,
    isFetching: Boolean(e?.promise),
    isError: Boolean(e?.error),
    refetch,
  };
}
