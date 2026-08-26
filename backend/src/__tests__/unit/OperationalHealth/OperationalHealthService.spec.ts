import {
  deriveOperationalAlerts,
  OperationalHealthSnapshot
} from "../../../services/OperationalHealthServices/OperationalHealthService";

const snapshot = (): Omit<
  OperationalHealthSnapshot,
  "overallStatus" | "activeAlerts"
> => ({
  generatedAt: new Date().toISOString(),
  uptimeSeconds: 60,
  database: { status: "UP", latencyMs: 1 },
  redis: { status: "UP", latencyMs: 1 },
  whatsapp: {
    configuredId: 1,
    targetStatus: "CONNECTED",
    targetUpdatedAt: new Date(),
    connections: [
      {
        id: 1,
        name: "Principal",
        status: "CONNECTED",
        isDefault: true,
        updatedAt: new Date()
      }
    ],
    lastInboundAt: new Date(),
    lastOutboundAt: new Date()
  },
  quark: {
    enabled: true,
    syncStatus: "ACTIVE",
    lastSuccessfulSyncAt: new Date(),
    syncAgeSeconds: 30,
    syncLockUntil: null,
    queue: {
      pending: 0,
      processing: 0,
      retrying: 0,
      deadLetter: 0,
      suppressed: 0,
      sentLastHour: 0,
      stuckProcessing: 0,
      oldestPendingAt: null,
      lastSentAt: null
    },
    coverage: {
      upcomingScheduled: 10,
      uncoveredUpcoming: 0,
      cancelledWithoutNotification: 0
    },
    responses: {
      processing: 0,
      stuckProcessing: 0,
      failedLast24Hours: 0,
      lastAppliedAt: null
    }
  }
});

describe("OperationalHealthService", () => {
  it("does not raise alerts for a healthy operation", () => {
    expect(deriveOperationalAlerts(snapshot())).toEqual([]);
  });

  it("raises a critical alert without changing the WhatsApp provider", () => {
    const current = snapshot();
    current.whatsapp.targetStatus = "DISCONNECTED";

    expect(deriveOperationalAlerts(current)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alertKey: "whatsapp:1:offline",
          severity: "CRITICAL",
          category: "WHATSAPP"
        })
      ])
    );
  });

  it("detects uncovered appointments and stuck confirmations", () => {
    const current = snapshot();
    current.quark.coverage.uncoveredUpcoming = 2;
    current.quark.responses.stuckProcessing = 1;
    current.quark.queue.deadLetter = 4;

    const keys = deriveOperationalAlerts(current).map(item => item.alertKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        "quark:appointments-uncovered",
        "quark:responses-stuck",
        "quark:dead-letter"
      ])
    );
  });
});
