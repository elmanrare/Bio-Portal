const COUNTER_NAMESPACE = "elman.me"; // Change this to your own namespace to avoid conflicts with other users
const COUNTER_KEY = "views";

export async function updateViewCount() {
  const counterEl = document.getElementById("view-count");
  if (!counterEl) return;

  try {
    const hasVisited = localStorage.getItem("visited_" + COUNTER_NAMESPACE);
    const endpoint = hasVisited
      ? `https://api.countapi.xyz/get/${COUNTER_NAMESPACE}/${COUNTER_KEY}`
      : `https://api.countapi.xyz/hit/${COUNTER_NAMESPACE}/${COUNTER_KEY}`;
    const response = await fetch(endpoint);

    if (!hasVisited) {
      localStorage.setItem("visited_" + COUNTER_NAMESPACE, "true");
    }

    const data = await response.json();
    if (data && data.value !== undefined) {
      counterEl.textContent = data.value.toLocaleString();
    }
  } catch (error) {
    console.error("View counter could not be loaded:", error);
    counterEl.textContent = "1";
  }
}
