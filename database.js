const COUNTER_NAMESPACE = "elman.me";
const COUNTER_KEY = "views";

export async function updateViewCount() {
  const counterEl = document.getElementById("view-count");
  if (!counterEl) return;

  try {
    const storageKey = `visited_${COUNTER_NAMESPACE}`;
    const isNewVisit = localStorage.getItem(storageKey) !== "true";
    const params = new URLSearchParams({
      namespace: COUNTER_NAMESPACE,
      key: COUNTER_KEY,
      isNewVisit: String(isNewVisit)
    });
    const payload = JSON.stringify({
      namespace: COUNTER_NAMESPACE,
      key: COUNTER_KEY,
      isNewVisit
    });
    let response;

    for (const endpoint of ["/api/views", "/.netlify/functions/views"]) {
      response = await fetch(`${endpoint}?${params}`, { cache: "no-store" });
      if (response.status === 405) {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          cache: "no-store"
        });
      }
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response.ok) {
      let detail = "";
      try {
        const errorData = await response.json();
        detail = errorData.code || errorData.error || "";
      } catch {
        // The host may return an HTML error page instead of a JSON API response.
      }
      throw new Error(`Counter request failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    const data = await response.json();
    if (!Number.isFinite(data.value)) throw new Error("Counter response was invalid");

    if (isNewVisit) localStorage.setItem(storageKey, "true");
    counterEl.textContent = data.value.toLocaleString();
  } catch (error) {
    console.error("View counter could not be loaded:", error);
    counterEl.textContent = "—";
  }
}
