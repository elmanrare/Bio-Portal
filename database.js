const COUNTER_NAMESPACE = "elman.me";
const COUNTER_KEY = "views";

export async function updateViewCount() {
  const counterEl = document.getElementById("view-count");
  if (!counterEl) return;

  try {
    const storageKey = `visited_${COUNTER_NAMESPACE}`;
    const isNewVisit = localStorage.getItem(storageKey) !== "true";
    const response = await fetch("/api/views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        namespace: COUNTER_NAMESPACE,
        key: COUNTER_KEY,
        isNewVisit
      })
    });

    if (!response.ok) throw new Error(`Counter request failed (${response.status})`);
    const data = await response.json();
    if (!Number.isFinite(data.value)) throw new Error("Counter response was invalid");

    if (isNewVisit) localStorage.setItem(storageKey, "true");
    counterEl.textContent = data.value.toLocaleString();
  } catch (error) {
    console.error("View counter could not be loaded:", error);
    counterEl.textContent = "—";
  }
}
