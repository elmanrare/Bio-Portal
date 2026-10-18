const express = require("express");
const { create, readOne, update } = require("./db");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

async function handleViewCount(req, res) {
  res.set("Cache-Control", "no-store");
  const payload = req.method === "GET" ? req.query : req.body;
  const { namespace, key } = payload || {};
  const isNewVisit = req.method === "GET"
    ? payload?.isNewVisit === "true"
    : payload?.isNewVisit;
  if (typeof namespace !== "string" || typeof key !== "string" || typeof isNewVisit !== "boolean") {
    return res.status(400).json({ error: "Invalid counter request" });
  }

  try {
    const query = { namespace, key };
    let current;
    if (isNewVisit) {
      current = await update(query, { $inc: { value: 1 } }, { upsert: true });
      if (!current) current = await readOne(query);
    } else {
      current = await readOne(query);
      if (!current) current = await create({ ...query, value: 0 });
    }
    res.json({ value: current.value });
  } catch (error) {
    console.error("View counter database error:", error);
    res.status(500).json({ error: "Could not update view counter" });
  }
}

app.get("/api/views", handleViewCount);
app.post("/api/views", handleViewCount);
app.options("/api/views", (_req, res) => res.sendStatus(204));

app.listen(PORT, () => {
  console.log(`Local site and database running at http://localhost:${PORT}`);
});
