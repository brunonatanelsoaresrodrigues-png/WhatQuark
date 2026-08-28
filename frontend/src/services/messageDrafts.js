// Drafts stay in memory for this signed-in session; no patient text in localStorage.
const drafts = new Map();
const attempts = new Map();
export const readDraft = key => drafts.get(key) || "";
export const writeDraft = (key, value) => {
  if (value) drafts.set(key, value);
  else drafts.delete(key);
};
export const messageAttempt = (key, signature) => {
  const previous = attempts.get(key);
  if (previous?.signature === signature) return previous.id;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, value =>
    value.toString(16).padStart(2, "0")
  ).join("");
  attempts.set(key, { signature, id });
  return id;
};
export const finishMessageAttempt = key => attempts.delete(key);
window.addEventListener("auth:session", event => {
  if (!event.detail) {
    drafts.clear();
    attempts.clear();
  }
});
