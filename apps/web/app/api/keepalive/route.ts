/**
 * Keep-alive endpoint, called twice a day by Vercel Cron (see vercel.json).
 *
 * Both free tiers this project runs on switch themselves off when idle: Render
 * sleeps the API after 15 minutes, and Supabase pauses the whole database
 * after about a week without queries (which took the site down for months in
 * 2026). The API's /health route runs a real `SELECT 1`, so calling it wakes
 * Render and counts as database activity.
 *
 * Render can take about a minute to wake, which is close to this function's
 * time limit, so a timeout here is expected now and then: the request has
 * still started the wake-up, and the next run finds the API warm.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function ping(timeoutMs: number) {
  const res = await fetch(`${API}/health`, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  return (await res.json()) as { status?: string; database?: boolean };
}

export async function GET() {
  const started = Date.now();
  let lastError = "unknown";
  // Two attempts inside the time limit: the first one usually just wakes Render.
  for (const timeoutMs of [25_000, 30_000]) {
    try {
      const health = await ping(timeoutMs);
      return Response.json(
        { ok: health.database === true, api: health.status ?? "unknown", database: health.database ?? false, ms: Date.now() - started },
        { status: health.database === true ? 200 : 503 },
      );
    } catch (err) {
      lastError = err instanceof Error ? err.name : "error";
    }
  }
  return Response.json({ ok: false, api: "no response (probably still waking)", error: lastError, ms: Date.now() - started }, { status: 504 });
}
