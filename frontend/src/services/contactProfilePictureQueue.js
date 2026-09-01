export const createContactProfilePictureQueue = (
  request,
  schedule = callback => setTimeout(callback, 80)
) => {
  const attempted = new Set();
  const pending = new Map();
  let scheduled = false;
  let running = false;

  const scheduleFlush = () => {
    if (scheduled || running || pending.size === 0) return;
    scheduled = true;
    schedule(flush);
  };

  async function flush() {
    scheduled = false;
    if (running || pending.size === 0) return;
    running = true;
    const batch = Array.from(pending.values()).slice(0, 20);
    try {
      const response = await request(
        batch.map(entry => ({ id: entry.id, force: entry.force }))
      );
      const refreshed = new Map(
        (response?.contacts || []).map(contact => [contact.id, contact])
      );
      batch.forEach(entry => {
        const contact = refreshed.get(entry.id);
        entry.listeners.forEach(listener =>
          listener(contact?.profilePicUrl || "")
        );
      });
    } catch {
      batch.forEach(entry =>
        entry.listeners.forEach(listener => listener(""))
      );
    } finally {
      batch.forEach(entry => pending.delete(entry.id));
      running = false;
      scheduleFlush();
    }
  }

  const enqueue = ({ id, profilePicUrl = "", force = false }, listener) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) return () => {};
    const attemptKey = force
      ? `${numericId}:broken:${profilePicUrl}`
      : `${numericId}:missing`;
    const existing = pending.get(numericId);
    if (existing) {
      existing.force = existing.force || force;
      if (typeof listener === "function") existing.listeners.add(listener);
      return () => existing.listeners.delete(listener);
    }
    if (attempted.has(attemptKey)) return () => {};
    attempted.add(attemptKey);

    const entry = {
      id: numericId,
      force: false,
      listeners: new Set()
    };
    entry.force = entry.force || force;
    if (typeof listener === "function") entry.listeners.add(listener);
    pending.set(numericId, entry);
    scheduleFlush();

    return () => entry.listeners.delete(listener);
  };

  return { enqueue };
};
