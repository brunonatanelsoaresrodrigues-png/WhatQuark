const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [
    path.join(__dirname, "../src/services/contactProfilePictureQueue.js")
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const { createContactProfilePictureQueue } = loaded.exports;

test("batches missing contact pictures and returns refreshed URLs", async () => {
  const scheduled = [];
  const requests = [];
  const queue = createContactProfilePictureQueue(
    async contacts => {
      requests.push(contacts);
      return {
        contacts: contacts.map(contact => ({
          id: contact.id,
          profilePicUrl: `https://pictures.test/${contact.id}`
        }))
      };
    },
    callback => scheduled.push(callback)
  );
  const results = [];
  queue.enqueue({ id: 1 }, url => results.push(url));
  queue.enqueue({ id: 2 }, url => results.push(url));
  await scheduled.shift()();

  assert.deepEqual(requests, [[
    { id: 1, force: false },
    { id: 2, force: false }
  ]]);
  assert.deepEqual(results, [
    "https://pictures.test/1",
    "https://pictures.test/2"
  ]);
});

test("does not repeat the same failed URL in one browser session", async () => {
  const scheduled = [];
  let calls = 0;
  const queue = createContactProfilePictureQueue(
    async () => {
      calls += 1;
      return { contacts: [] };
    },
    callback => scheduled.push(callback)
  );
  queue.enqueue({ id: 4, profilePicUrl: "https://old.test/4", force: true });
  queue.enqueue({ id: 4, profilePicUrl: "https://old.test/4", force: true });
  await scheduled.shift()();
  assert.equal(calls, 1);
});

test("shares one request between two avatars for the same contact", async () => {
  const scheduled = [];
  let calls = 0;
  const queue = createContactProfilePictureQueue(
    async contacts => {
      calls += 1;
      return {
        contacts: [{
          id: contacts[0].id,
          profilePicUrl: "https://pictures.test/shared"
        }]
      };
    },
    callback => scheduled.push(callback)
  );
  const results = [];
  queue.enqueue({ id: 8 }, url => results.push(url));
  queue.enqueue({ id: 8 }, url => results.push(url));
  await scheduled.shift()();
  assert.equal(calls, 1);
  assert.deepEqual(results, [
    "https://pictures.test/shared",
    "https://pictures.test/shared"
  ]);
});
