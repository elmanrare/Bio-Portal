const GOATCOUNTER_SCRIPT_URL = "https://gc.zgo.at/count.js";

function getGoatCounterCode() {
  const code = globalThis.config?.goatCounterCode?.trim();
  if (!code || !/^[a-z0-9-]+$/i.test(code)) {
    throw new Error("Set a valid GoatCounter site code in config.js");
  }
  return code;
}

function loadGoatCounterTracker(code) {
  if (document.querySelector("script[data-goatcounter]")) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const tracker = document.createElement("script");
    tracker.dataset.goatcounter = `https://${code}.goatcounter.com/count`;
    tracker.async = true;
    tracker.src = GOATCOUNTER_SCRIPT_URL;
    tracker.onload = resolve;
    tracker.onerror = () => reject(new Error("Could not load GoatCounter tracking script"));
    document.head.append(tracker);
  });
}

export async function updateViewCount() {
  const counterEl = document.getElementById("view-count");
  if (!counterEl) return;

  // GoatCounter intentionally ignores localhost. Avoid making cross-origin
  // tracker/count requests from local previews, which otherwise produce
  // expected CORS/403 console errors and pollute the owner's analytics if enabled.
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
  if (localHosts.has(window.location.hostname)) {
    counterEl.textContent = "—";
    counterEl.title = "View counts are available on the published site.";
    return;
  }

  try {
    const code = getGoatCounterCode();
    // This creates the same tracking tag as the documented GoatCounter snippet,
    // using the per-site code from config.js so each fork can use its own account.
    loadGoatCounterTracker(code).catch((error) => {
      console.warn("GoatCounter pageview tracking is unavailable:", error);
    });

    const response = await fetch(
      `https://${code}.goatcounter.com/counter/TOTAL.json`,
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error(`GoatCounter count request failed (${response.status})`);

    const data = await response.json();
    if (typeof data.count !== "string" && !Number.isFinite(data.count)) {
      throw new Error("GoatCounter returned an invalid count");
    }

    counterEl.textContent = String(data.count);
  } catch (error) {
    console.warn("View count could not be loaded:", error);
    counterEl.textContent = "—";
  }
}
