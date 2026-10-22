import { useCallback, useEffect, useRef, useState } from 'react'
import type { DependencyList } from 'react'

interface QueryState<T> {
  data?: T
  error?: Error
  loading: boolean
}

interface QueryOptions {
  /** Re-fetch every N ms while the tab is visible. */
  poll?: number
  enabled?: boolean
}

/**
 * Tiny data-fetching hook: ignores stale responses, never updates after unmount,
 * pauses polling in background tabs and refreshes the moment you come back.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: DependencyList, { poll, enabled = true }: QueryOptions = {}) {
  const [state, setState] = useState<QueryState<T>>({ loading: enabled })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const seq = useRef(0)

  const load = useCallback(async () => {
    const id = ++seq.current
    try {
      const data = await fnRef.current()
      if (id === seq.current) setState({ data, loading: false })
    } catch (e) {
      if (id === seq.current) setState((s) => ({ data: s.data, error: e as Error, loading: false }))
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) {
      setState({ loading: false })
      return
    }
    setState({ loading: true })
    void load()
    return () => {
      seq.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  useEffect(() => {
    if (!enabled || !poll) return
    const tick = () => {
      if (!document.hidden) void load()
    }
    const t = setInterval(tick, poll)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [enabled, poll, load])

  const mutate = useCallback((updater: (prev: T | undefined) => T | undefined) => {
    setState((s) => ({ ...s, data: updater(s.data) }))
  }, [])

  return { ...state, reload: load, mutate }
}

/** Re-renders every `ms` so countdowns stay live. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = title
    return () => {
      document.title = prev
    }
  }, [title])
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const set = useCallback(
    (v: T) => {
      setValue(v)
      try {
        localStorage.setItem(key, JSON.stringify(v))
      } catch {
        /* private mode etc. — still works in memory */
      }
    },
    [key],
  )
  return [value, set]
}
