const express = require("express");
const Datastore = require("nedb-promises");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = Datastore.create({
  filename: path.join(dataDir, "views.db"),
  autoload: true
});

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

app.post("/api/views", async (req, res) => {
  const { namespace, key, isNewVisit } = req.body || {};
  if (typeof namespace !== "string" || typeof key !== "string" || typeof isNewVisit !== "boolean") {
    return res.status(400).json({ error: "Invalid counter request" });
  }

  try {
    const query = { namespace, key };
    let current;
    if (isNewVisit) {
      current = await db.update(query, { $inc: { value: 1 } }, { upsert: true, returnUpdatedDocs: true });
      if (!current) current = await db.findOne(query);
    } else {
      current = await db.findOne(query);
      if (!current) current = await db.insert({ ...query, value: 0 });
    }
    res.json({ value: current.value });
  } catch (error) {
    console.error("View counter database error:", error);
    res.status(500).json({ error: "Could not update view counter" });
  }
});

app.listen(PORT, () => {
  console.log(`Local site and database running at http://localhost:${PORT}`);
});
