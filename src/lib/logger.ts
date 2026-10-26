/**
 * Minimal structured logger. Writes one JSON line per event so Vercel's log drain can filter by
 * level/scope. Never pass secrets, passwords, tokens or full request bodies as context.
 */
type Level = "debug" | "info" | "warn" | "error";

function serializeError(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message };
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    return { message: String(e.message ?? "unknown error"), code: e.code, details: e.details, hint: e.hint };
  }
  return { message: String(err) };
}

function emit(level: Level, scope: string, message: string, context?: Record<string, unknown>) {
  const line = JSON.stringify({ level, scope, message, ...context, time: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") {
    if (process.env.NODE_ENV !== "production") console.debug(line);
  } else console.info(line);
}

export function createLogger(scope: string) {
  return {
    debug: (m: string, c?: Record<string, unknown>) => emit("debug", scope, m, c),
    info: (m: string, c?: Record<string, unknown>) => emit("info", scope, m, c),
    warn: (m: string, c?: Record<string, unknown>) => emit("warn", scope, m, c),
    error: (m: string, err?: unknown, c?: Record<string, unknown>) =>
      emit("error", scope, m, { ...c, error: err === undefined ? undefined : serializeError(err) }),
  };
}
