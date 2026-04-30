type PerfContextValue = string | number | boolean | null | undefined;
type PerfContext = Record<string, PerfContextValue>;

const nowMs = () => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const roundMs = (value: number) => Math.round(value * 100) / 100;

const sanitizeContext = (context: PerfContext) =>
  Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined));

const formatContext = (context: PerfContext) => JSON.stringify(sanitizeContext(context));

export function createPerfTracker(scope: string, baseContext: PerfContext = {}) {
  const startedAt = nowMs();
  let lastMarkedAt = startedAt;
  const segments: Record<string, number> = {};

  return {
    mark(segment: string, extraContext: PerfContext = {}) {
      const current = nowMs();
      const elapsedMs = roundMs(current - lastMarkedAt);
      const totalMs = roundMs(current - startedAt);

      segments[segment] = elapsedMs;
      lastMarkedAt = current;

      console.log(
        `[Perf] ${scope} ${segment} elapsedMs=${elapsedMs} totalMs=${totalMs} context=${formatContext({
          ...baseContext,
          ...extraContext,
        })}`
      );

      return { elapsedMs, totalMs };
    },

    fail(error: unknown, extraContext: PerfContext = {}) {
      const totalMs = roundMs(nowMs() - startedAt);
      const message = error instanceof Error ? error.message : String(error);

      console.error(
        `[Perf] ${scope} failed totalMs=${totalMs} context=${formatContext({
          ...baseContext,
          ...extraContext,
          error: message,
        })}`
      );

      return totalMs;
    },

    getSegments() {
      return {
        ...segments,
        totalMs: roundMs(nowMs() - startedAt),
      };
    },
  };
}

export function buildServerTimingHeader(segments: Record<string, number>) {
  return Object.entries(segments)
    .map(([name, duration]) => `${name};dur=${roundMs(duration)}`)
    .join(', ');
}
