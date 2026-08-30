const allowedEvents = new Set(["sample_loaded", "analysis_completed", "tailoring_completed", "latex_copied", "tex_downloaded", "feedback_submitted"]);

export function track(event: string, properties: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined" || !allowedEvents.has(event)) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!key) return;
  const storageKey = "proofread-anonymous-id";
  const distinctId = window.localStorage.getItem(storageKey) || crypto.randomUUID();
  window.localStorage.setItem(storageKey, distinctId);
  void fetch(`${host}/capture/`, {
    method: "POST",
    mode: "cors",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, event, properties: { distinct_id: distinctId, ...properties } }),
  }).catch(() => undefined);
}
