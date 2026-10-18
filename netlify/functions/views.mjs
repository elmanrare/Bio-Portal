import { getStore } from "@netlify/blobs";

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  },
  body: JSON.stringify(payload)
});

export const handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  if (method === "OPTIONS") {
    return { statusCode: 204, headers: { "Cache-Control": "no-store" }, body: "" };
  }
  if (method !== "GET" && method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  let body;
  if (method === "GET") {
    body = event.queryStringParameters || {};
  } else {
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return jsonResponse(400, { error: "Invalid JSON body" });
    }
  }

  const { namespace, key } = body;
  const isNewVisit = typeof body.isNewVisit === "boolean"
    ? body.isNewVisit
    : body.isNewVisit === "true";
  if (
    typeof namespace !== "string" || !namespace.trim() || namespace.length > 100 ||
    typeof key !== "string" || !key.trim() || key.length > 100 ||
    typeof isNewVisit !== "boolean"
  ) {
    return jsonResponse(400, { error: "Invalid counter request" });
  }

  try {
    // Netlify normally injects Blobs context for Functions. The explicit
    // environment options also support manual deploys where that context is absent.
    const store = getStore({
      name: "visitor-counter",
      consistency: "strong",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN
    });
    const blobKey = `${encodeURIComponent(namespace)}:${encodeURIComponent(key)}`;

    // Conditional writes prevent concurrent visits from overwriting one another.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const entry = await store.getWithMetadata(blobKey, { consistency: "strong", type: "json" });

      if (!isNewVisit && entry) {
        return jsonResponse(200, { value: entry.data.value });
      }

      const nextValue = isNewVisit ? (entry?.data.value || 0) + 1 : 0;
      const writeOptions = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
      const result = await store.setJSON(blobKey, { value: nextValue }, writeOptions);

      if (result.modified) return jsonResponse(200, { value: nextValue });
    }

    return jsonResponse(503, { error: "Counter is busy; retry the request" });
  } catch (error) {
    console.error("Netlify visitor counter error:", error);
    return jsonResponse(500, {
      error: "Could not update view counter",
      code: error?.name || "UnknownError",
      siteIdPresent: Boolean(process.env.NETLIFY_SITE_ID),
      blobsTokenPresent: Boolean(process.env.NETLIFY_BLOBS_TOKEN)
    });
  }
};
