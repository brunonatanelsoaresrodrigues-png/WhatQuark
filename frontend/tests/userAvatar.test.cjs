const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const component = fs.readFileSync(
  path.join(__dirname, "../src/components/UserAvatar/index.jsx"),
  "utf8"
);
const modal = fs.readFileSync(
  path.join(__dirname, "../src/components/UserModal/index.js"),
  "utf8"
);

test("user avatars are fetched through the authenticated API and revoke blobs", () => {
  assert.match(component, /api\s*\.get\(`\/users\/\$\{user\.id\}\/avatar`/);
  assert.match(component, /responseType:\s*"blob"/);
  assert.match(component, /URL\.revokeObjectURL/);
});

test("profile photo picker limits formats and size before upload", () => {
  assert.match(modal, /image\/jpeg,image\/png,image\/webp/);
  assert.match(modal, /5 \* 1024 \* 1024/);
  assert.match(modal, /formData\.append\("avatar", avatarFile\)/);
});
