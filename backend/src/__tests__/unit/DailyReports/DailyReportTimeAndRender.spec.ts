import RenderDailyReportService from "../../../services/DailyReportServices/RenderDailyReportService";
import { DailyReportSnapshot } from "../../../services/DailyReportServices/DailyReportMetricsService";
import { reportWindowFor } from "../../../services/DailyReportServices/time";

const snapshot: DailyReportSnapshot = {
  periodStart: "2026-08-19T20:00:00.000Z",
  periodEnd: "2026-08-20T20:00:00.000Z",
  generatedAt: "2026-08-20T20:00:00.000Z",
  attendance: {
    newContacts: 2,
    newConversations: 3,
    moved: 4,
    reopened: 1,
    resolved: 3,
    closedByInactivity: 1,
    transferred: 1,
    openNow: 1,
    pendingNow: 2,
    unassignedNow: 1,
    waitingPatientNow: 1,
    resolutionRate: 75,
    busiestHour: "14:00"
  },
  messages: {
    received: 10,
    sent: 9,
    human: 5,
    bot: 1,
    quark: 2,
    inactivity: 1,
    system: 0,
    unknownOutgoing: 0,
    audiosReceived: 1,
    mediaReceived: 1,
    failed: 0,
    averagePerConversation: 4.8
  },
  appointments: {
    created: 3,
    confirmed: 2,
    cancelled: 1,
    rescheduled: 1,
    updated: 0,
    awaitingConfirmation: 1,
    tomorrow: 4,
    tomorrowUnconfirmed: 1,
    notificationsSent: 3,
    notificationsDelivered: 2,
    notificationsRead: 1,
    notificationFailures: 0,
    confirmedViaWhatsapp: 2,
    cancelledViaWhatsapp: 0,
    applyFailures: 0,
    averageResponseSeconds: 120
  },
  agents: [
    {
      id: 7,
      name: "Atendente Teste",
      messages: 5,
      tickets: 3,
      accepted: 3,
      resolved: 2,
      transferred: 1,
      medianFirstResponseSeconds: 90,
      averageFirstResponseSeconds: 100
    }
  ],
  alerts: {
    connectedWhatsapps: 1,
    queuedNotifications: 0,
    processingNotifications: 0,
    deadLetters: 0,
    invalidPhones: 0,
    unassignedTickets: 1,
    tomorrowUnconfirmed: 1,
    quarkLastSuccessfulSyncAt: "2026-08-20T19:57:00.000Z"
  },
  dataQuality: { complete: true, warnings: [] }
};

describe("daily report time window and rendering", () => {
  it("uses the continuous 17:00 São Paulo window and tomorrow's civil day", () => {
    const window = reportWindowFor(
      new Date("2026-08-20T20:02:00.000Z"),
      "America/Sao_Paulo",
      "17:00"
    );

    expect(window.reportDate).toBe("2026-08-20");
    expect(window.periodStart.toISOString()).toBe("2026-08-19T20:00:00.000Z");
    expect(window.periodEnd.toISOString()).toBe("2026-08-20T20:00:00.000Z");
    expect(window.tomorrowStart.toISOString()).toBe("2026-08-21T03:00:00.000Z");
    expect(window.tomorrowEnd.toISOString()).toBe("2026-08-22T03:00:00.000Z");
    expect(window.due).toBe(true);
  });

  it("does not consider the report due before 17:00", () => {
    const window = reportWindowFor(
      new Date("2026-08-20T19:59:00.000Z"),
      "America/Sao_Paulo",
      "17:00"
    );
    expect(window.due).toBe(false);
  });

  it("renders only aggregate operational data", () => {
    const body = RenderDailyReportService(snapshot, "America/Sao_Paulo");
    expect(body).toContain("ESSENCIAL SAÚDE — FECHAMENTO DIÁRIO");
    expect(body).toContain("Atendente Teste");
    expect(body).toContain("Agenda prevista para amanhã: 4");
    expect(body).toContain("Dados agregados, sem identificação de pacientes");
    expect(body).not.toMatch(/\+55\d{10,11}/);
  });
});
