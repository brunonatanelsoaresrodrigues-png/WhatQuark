import AutomationState from "../../../models/AutomationState";
import { withLease } from "../../../services/MessagingServices/state";
jest.mock("../../../models/AutomationState", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), update: jest.fn() }
}));
it("serializes competing workers and releases only its own lock", async () => {
  let owner: string | null = null;
  (AutomationState.findOrCreate as jest.Mock).mockResolvedValue([{}, false]);
  (AutomationState.update as jest.Mock).mockImplementation(
    async (values, options) => {
      if (values.lockOwner) {
        if (owner) return [0];
        owner = values.lockOwner;
        return [1];
      }
      if (options.where.lockOwner === owner) {
        owner = null;
        return [1];
      }
      return [0];
    }
  );
  let release: () => void = () => undefined;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  let started: () => void = () => undefined;
  const entered = new Promise<void>(resolve => {
    started = resolve;
  });
  const first = withLease("channel:1", async () => {
    started();
    await gate;
    return 1;
  });
  await entered;
  await expect(withLease("channel:1", async () => 2)).rejects.toThrow(
    "ERR_OPERATION_BUSY"
  );
  release();
  await expect(first).resolves.toBe(1);
  expect(owner).toBeNull();
  await expect(withLease("channel:1", async () => 3)).resolves.toBe(3);
});
it("cannot release a new holder after a lease expires", async () => {
  const updates: any[] = [];
  (AutomationState.findOrCreate as jest.Mock).mockResolvedValue([{}, false]);
  (AutomationState.update as jest.Mock).mockImplementation(
    async (values, options) => {
      updates.push({ values, options });
      return [1];
    }
  );
  await withLease("appointment:42", async () => undefined);
  expect(updates[1].options.where.lockOwner).toBe(updates[0].values.lockOwner);
  expect(updates[1].options.where.id).toBe("appointment:42");
});
