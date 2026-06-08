import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TourRect = { x: number; y: number; width: number; height: number };

export type TourStep = {
  /** Matches the `id` of a <TourTarget> mounted somewhere in the tree. */
  id: string;
  title: string;
  body: string;
  /** Where the tooltip card sits relative to the highlight. 'auto' picks the side with more room. */
  placement?: 'top' | 'bottom' | 'auto';
  /** Extra space (px) around the target inside the spotlight hole. */
  padding?: number;
  /** Corner radius of the hole — a number, or 'full' for a circle/pill. */
  radius?: number | 'full';
  /**
   * Side-effect to run before the step shows — e.g. open the add-entry sheet or
   * make sure it's closed. Awaited; pair with `beforeDelay` to let layout settle.
   */
  before?: () => void | Promise<void>;
  /** ms to wait after `before()` before measuring the target (default 350). */
  beforeDelay?: number;
};

type MeasureFn = () => Promise<TourRect | null>;

type TourContextValue = {
  /** Called by <TourTarget> on mount. Returns an unregister fn. */
  register: (id: string, measure: MeasureFn) => () => void;
  /** Kick off a walkthrough. `onDone` fires when finished or skipped. */
  start: (steps: TourStep[], onDone?: () => void) => void;
  active: boolean;
  step: TourStep | null;
  rect: TourRect | null;
  index: number;
  total: number;
  next: () => void;
  back: () => void;
  skip: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a <TourProvider>');
  return ctx;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Provider ───────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const registry = useRef<Map<string, MeasureFn>>(new Map());
  const stepsRef = useRef<TourStep[]>([]);
  const onDoneRef = useRef<(() => void) | undefined>(undefined);
  const runningRef = useRef(false);

  const [active, setActive] = useState(false);
  const [step, setStep] = useState<TourStep | null>(null);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);

  const register = useCallback((id: string, measure: MeasureFn) => {
    registry.current.set(id, measure);
    return () => {
      // Only delete if still pointing at this exact fn (avoids a remount race
      // where the new instance registered before the old one cleaned up).
      if (registry.current.get(id) === measure) registry.current.delete(id);
    };
  }, []);

  // Targets may still be mounting/animating in right after `before()` — retry a
  // few times, and treat a never-found target as a step to silently skip (this
  // is how conditional targets like LOG DOSE drop out for off-treatment users).
  const measureWithRetry = useCallback(async (id: string, tries = 10): Promise<TourRect | null> => {
    for (let i = 0; i < tries; i++) {
      const fn = registry.current.get(id);
      if (fn) {
        const r = await fn();
        if (r && r.width > 0 && r.height > 0) return r;
      }
      await wait(110);
    }
    return null;
  }, []);

  const finish = useCallback(() => {
    runningRef.current = false;
    setActive(false);
    setStep(null);
    setRect(null);
    const cb = onDoneRef.current;
    onDoneRef.current = undefined;
    cb?.();
  }, []);

  const showStep = useCallback(async (i: number, dir: 1 | -1 = 1) => {
    const list = stepsRef.current;
    if (i < 0) return; // already at the first step
    if (i >= list.length) { finish(); return; }
    const st = list[i];
    if (st.before) { try { await st.before(); } catch { /* keep going */ } }
    await wait(st.beforeDelay ?? 350);
    if (!runningRef.current) return; // skipped mid-transition
    const r = await measureWithRetry(st.id);
    if (!r) { showStep(i + dir, dir); return; } // target absent → keep moving the same way
    if (!runningRef.current) return;
    setRect(r);
    setStep(st);
    setIndex(i);
  }, [finish, measureWithRetry]);

  const start = useCallback((steps: TourStep[], onDone?: () => void) => {
    if (runningRef.current || steps.length === 0) return;
    runningRef.current = true;
    stepsRef.current = steps;
    onDoneRef.current = onDone;
    setTotal(steps.length);
    setIndex(0);
    setRect(null);
    setStep(null);
    setActive(true);
    showStep(0);
  }, [showStep]);

  const next = useCallback(() => {
    if (!runningRef.current) return;
    showStep(index + 1);
  }, [index, showStep]);

  const back = useCallback(() => {
    if (!runningRef.current) return;
    showStep(index - 1, -1);
  }, [index, showStep]);

  const skip = useCallback(() => { finish(); }, [finish]);

  return (
    <TourContext.Provider
      value={{ register, start, active, step, rect, index, total, next, back, skip }}
    >
      {children}
    </TourContext.Provider>
  );
}
