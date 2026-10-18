const fs = require("node:fs");
const path = require("node:path");
const Datastore = require("nedb-promises");

const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

// NeDB creates the file automatically when the first operation runs.
const collection = Datastore.create({
  filename: path.join(dataDirectory, "views.db"),
  autoload: true
});

async function create(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new TypeError("create() expects a document object");
  }
  return collection.insert(document);
}

async function read(query = {}) {
  return collection.find(query);
}

async function readOne(query = {}) {
  return collection.findOne(query);
}

async function update(query, changes, options = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("update() expects a query object");
  }
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("update() expects an update object");
  }

  const hasOperators = Object.keys(changes).some((key) => key.startsWith("$"));
  const updateDocument = hasOperators ? changes : { $set: changes };
  return collection.update(query, updateDocument, {
    returnUpdatedDocs: true,
    ...options
  });
}

async function deleteDocuments(query, options = {}) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("delete() expects a query object");
  }
  return collection.remove(query, options);
}

module.exports = { create, read, readOne, update, delete: deleteDocuments };
