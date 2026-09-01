export const queues = [{
  id: 1,
  name: "Recepção",
  color: "#0c7c72"
}, {
  id: 2,
  name: "Agendamento",
  color: "#3978e6"
}];
export const user = {
  id: 1,
  name: "Marina · Demonstração",
  profile: "admin",
  queues,
  canAccessQuarkClinic: true
};
export const assignees = [user, {
  id: 2,
  name: "Carlos Alberto",
  profile: "user",
  queues,
  canAccessQuarkClinic: false
}, {
  id: 3,
  name: "Letícia Gomes",
  profile: "user",
  queues,
  canAccessQuarkClinic: true
}, {
  id: 4,
  name: "Rafael Pereira",
  profile: "user",
  queues,
  canAccessQuarkClinic: false
}];
export const channels = [{
  id: 1,
  name: "Essencial Saúde",
  status: "CONNECTED",
  isDefault: true,
  updatedAt: new Date().toISOString()
}];
const names = ["Ana Ribeiro", "Carlos Lima", "Beatriz Oliveira", "Lucas Ferreira", "Helena Costa", "Pedro Almeida", "Sofia Martins"];
const avatarDataUri = id => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="${id % 2 ? "#BCE8DF" : "#C9DDF6"}"/><circle cx="48" cy="38" r="18" fill="#466A75"/><path d="M18 92c3-23 16-34 30-34s27 11 30 34" fill="#466A75"/></svg>`)}`;
export const tickets = names.map((name, index) => ({
  id: index + 1,
  contactId: index + 1,
  status: index < 4 ? "open" : index < 6 ? "pending" : "closed",
  userId: index < 4 ? 1 : null,
  user: index < 4 ? user : null,
  queue: queues[index % 2],
  queueId: index % 2 + 1,
  whatsapp: channels[0],
  whatsappId: 1,
  contact: {
    id: index + 1,
    name,
    number: "5500000000000",
    email: "exemplo@example.invalid",
    cpf: index === 0 ? "52998224725" : null,
    profilePicUrl: index === 2 ? "https://expired.example.invalid/avatar.jpg" : "",
    extraInfo: []
  },
  lastMessage: ["Obrigada pelo retorno!", "Posso confirmar o horário?", "Bom dia, gostaria de agendar uma consulta.", "Vou enviar os documentos."][index % 4],
  unreadMessages: index < 2 ? index + 1 : 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date(Date.now() - index * 600000).toISOString()
}));
const textMessages = [{
  fromMe: false,
  body: "Olá! Gostaria de confirmar o horário da minha consulta."
}, {
  fromMe: true,
  body: "Olá, Ana! Sou a Marina, da Essencial Saúde. Vou conferir sua agenda. 😊"
}, {
  fromMe: true,
  body: "Sua consulta está confirmada para amanhã às 10h. Podemos ajudar com mais alguma coisa?"
}, {
  fromMe: false,
  body: "Perfeito! Preciso levar algum documento?"
}, {
  fromMe: true,
  body: "Sim, por favor leve um documento com foto e a carteirinha do convênio."
}];
const messages = textMessages.map((message, i) => ({
  ...message,
  id: `message-${i}`,
  ticketId: 1,
  ack: 3,
  mediaType: "chat",
  createdAt: new Date(Date.now() - (textMessages.length - i) * 60000).toISOString()
}));
messages.push({
  id: "demo-sticker",
  ticketId: 1,
  fromMe: false,
  body: "Figurinha",
  mediaType: "sticker",
  mediaUrl: "/qa/sticker",
  createdAt: new Date().toISOString()
});
const stickerImage = '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><rect x="12" y="12" width="156" height="156" rx="48" fill="#36BFAE"/><path d="M47 89L77 116L133 61" fill="none" stroke="white" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export function getAccessToken() {
  return null;
}
export function saveSession() {}
export function clearSession() {}
export async function refreshSession() {
  return {
    user
  };
}
const requests = [];
function exposeRequests() {
  const node = document.getElementById("qa-requests");
  if (node) node.textContent = JSON.stringify(requests.slice(-50));
}
export default {
  async get(url, options = {}) {
    await new Promise(resolve => setTimeout(resolve, 120));
    const path = "/" + url.replace(/^\//, "");
    requests.push({
      method: "GET",
      path,
      params: options.params
    });
    exposeRequests();
    const p = options.params || {};
    let data;
    if (path === "/tickets") {
      if (p.searchParam === "erro-demo") throw new Error("Falha simulada na consulta");
      let rows = tickets.filter(t => !p.status || t.status === p.status);
      if (p.searchParam) rows = rows.filter(t => (t.contact.name + t.lastMessage).toLowerCase().includes(p.searchParam.toLowerCase()));
      if (p.withUnreadMessages === "true") rows = rows.filter(t => t.unreadMessages > 0);
      if (p.date) rows = rows.filter(t => t.createdAt.startsWith(p.date));
      data = {
        tickets: rows,
        count: rows.length,
        hasMore: false
      };
    } else if (/^\/tickets\/\d+\/context$/.test(path)) data = {
      mode: new URLSearchParams(window.location.search).get("context") === "blocked" ? "off" : "production",
      paused: false,
      official: false,
      appointmentNoticesRequireOptIn: false,
      botPaused: true,
      serviceWindowOpen: true,
      preference: {
        consent: "UNKNOWN"
      },
      clinicTimezone: "America/Sao_Paulo",
      serverNow: new Date("2026-08-28T15:00:00.000Z").toISOString(),
      lastAppointment: {
        appointmentId: "previous-1",
        reference: "ANTERIOR1",
        status: "CONFIRMADO",
        scheduledAt: new Date("2026-08-20T12:30:00.000Z").toISOString()
      },
      appointments: [{
        appointmentId: 1,
        reference: "PROXIMA1",
        status: "CONFIRMADO",
        scheduledAt: new Date("2026-09-02T12:30:00.000Z").toISOString()
      }, {
        appointmentId: 2,
        reference: "PROXIMA2",
        status: "AGENDADO",
        scheduledAt: new Date("2026-09-09T14:00:00.000Z").toISOString()
      }]
    };else if (/^\/tickets\/\d+$/.test(path)) data = tickets.find(t => t.id === Number(path.split("/")[2])) || tickets[0];else if (/^\/quark\/clinic\/contacts\/\d+$/.test(path)) {
      const quarkMode = new URLSearchParams(window.location.search).get("quark");
      if (quarkMode === "not-found" || quarkMode === "unavailable") {
        const error = new Error(
          quarkMode === "not-found"
            ? "ERR_QUARK_PATIENT_NOT_FOUND"
            : "ERR_QUARK_UNAVAILABLE"
        );
        error.response = {
          status: quarkMode === "not-found" ? 404 : 503,
          data: { error: error.message }
        };
        throw error;
      }
      data = {
      contactId: Number(path.split("/").pop()),
      patientId: "7001",
      patientName: "Ana Ribeiro",
      cpf: "52998224725",
      birthDate: "01/01/1990",
      appointmentId: "1",
      refreshedAt: new Date().toISOString()
      };
    }else if (/^\/quark\/clinic\/patients\/[^/]+$/.test(path)) data = {
      patientId: decodeURIComponent(path.split("/").pop()),
      patientName: "Ana Ribeiro",
      cpf: "52998224725",
      birthDate: "01/01/1990",
      appointmentId: "1",
      refreshedAt: new Date().toISOString()
    };else if (/^\/quark\/clinic\/appointments\/[^/]+$/.test(path)) data = {
      appointmentId: decodeURIComponent(path.split("/").pop()),
      patientName: "Ana Ribeiro",
      scheduledAt: "2026-09-02T12:30:00.000Z",
      status: "CONFIRMADO",
      clinicName: "Essencial Saúde",
      professionalName: "Dra. Mariana Silva",
      procedureName: "Consulta clínica",
      specialtyName: "Clínica geral",
      clinicTimezone: "America/Sao_Paulo",
      refreshedAt: new Date().toISOString()
    };else if (path.startsWith("/messages/")) data = {
      messages,
      hasMore: false
    };else if (path === "/contacts" || path === "/contacts/") data = {
      contacts: tickets.map(t => t.contact),
      count: 7,
      hasMore: false
    };else if (path.startsWith("/contacts/")) data = tickets[0].contact;else if (path === "/users/assignees") data = assignees;else if (path === "/users/") data = {
      users: [user],
      count: 1,
      hasMore: false
    };else if (path.startsWith("/users/")) data = user;else if (path === "/whatsapp/" || path === "/whatsapp") data = channels;else if (path === "/queue") data = queues;else if (path.startsWith("/quickAnswers")) data = {
      quickAnswers: [{
        id: 1,
        shortcut: "boas-vindas",
        message: "Olá! Como podemos ajudar?"
      }],
      hasMore: false
    };else if (path === "/settings") data = [{
      key: "userCreation",
      value: "disabled"
    }, {
      key: "userApiToken",
      value: "DEMO-SEM-CREDENCIAIS"
    }];else if (path === "/ticket-metrics/operations") data = {
      generatedAt: new Date().toISOString(),
      timezone: "America/Sao_Paulo",
      period: {
        label: "Hoje"
      },
      slaMinutes: 5,
      now: {
        waiting: 10,
        active: 9,
        unread: 0,
        unassigned: 2,
        maximumWaitSeconds: 522,
        averageWaitSeconds: 222,
        aboveSla: 2
      },
      today: {
        entries: 97,
        resolved: 88,
        averageWaitSeconds: 198,
        averageServiceSeconds: 780,
        resolutionRate: 90.7
      },
      comparison: {
        entriesPercent: 12,
        resolvedPercent: 8,
        averageWaitSeconds: -42,
        averageServiceSeconds: -30,
        resolutionPoints: 1.4
      },
      flow: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        time: `${String(hour).padStart(2, "0")}:00`,
        entries: [4, 2, 2, 1, 2, 4, 11, 18, 25, 31, 42, 46, 41, 38, 34, 30, 23, 18, 15, 11, 7, 4, 2, 1][hour],
        resolved: [2, 1, 1, 1, 1, 3, 7, 14, 20, 24, 33, 36, 35, 36, 31, 27, 20, 15, 12, 8, 5, 3, 2, 1][hour]
      })),
      attention: {
        highestDemandQueue: {
          id: 1,
          name: "Recepção",
          total: 12
        },
        peakHour: "11:00",
        peakEntries: 46
      },
      agents: [{
        id: 1,
        name: "Marina Silva",
        active: 4,
        resolved: 23,
        averageWaitSeconds: 182,
        averageServiceSeconds: 720,
        status: "WITHIN_SLA"
      }, {
        id: 2,
        name: "Carlos Alberto",
        active: 3,
        resolved: 18,
        averageWaitSeconds: 225,
        averageServiceSeconds: 810,
        status: "WITHIN_SLA"
      }, {
        id: 3,
        name: "Letícia Gomes",
        active: 5,
        resolved: 19,
        averageWaitSeconds: 261,
        averageServiceSeconds: 930,
        status: "ATTENTION"
      }, {
        id: 4,
        name: "Rafael Pereira",
        active: 2,
        resolved: 15,
        averageWaitSeconds: 178,
        averageServiceSeconds: 690,
        status: "WITHIN_SLA"
      }]
    };else if (path === "/ticket-metrics/daily") data = {
      total: 24,
      timezone: "America/Sao_Paulo",
      hours: Array.from({
        length: 12
      }, (_, i) => ({
        time: `${i + 7}:00`,
        amount: [1, 3, 4, 2, 5, 2, 0, 1, 2, 1, 2, 1][i]
      }))
    };else if (path === "/messaging/status") data = {
      mode: "production",
      paused: false,
      official: false
    };else if (path === "/messaging/outbox" || path.endsWith("/timeseries")) data = [];else if (path.endsWith("/calendar-days")) data = [{
      day: "2026-08-29",
      total: 4,
      scheduled: 1,
      awaitingResponse: 1,
      confirmed: 2,
      cancelled: 0
    }, {
      day: "2026-08-30",
      total: 2,
      scheduled: 1,
      awaitingResponse: 0,
      confirmed: 1,
      cancelled: 0
    }, {
      day: "2026-08-31",
      total: 5,
      scheduled: 1,
      awaitingResponse: 2,
      confirmed: 1,
      cancelled: 1
    }];else if (path === "/quark/dashboard/summary") data = {
      sync: {
        lastSuccessfulSyncAt: new Date().toISOString()
      },
      appointments: {
        monitored: 84,
        awaitingResponse: 7
      },
      notifications: {
        generated: 62,
        sent: 58,
        delivered: 55,
        read: 43,
        queued: 3,
        failed: 1
      },
      responses: {
        confirmed: 31,
        cancelled: 4,
        responseRate: 72.9,
        averageResponseSeconds: 486
      }
    };else if (path.endsWith("/appointments")) data = {
      rows: [{
        id: 101,
        appointmentId: "QK-101",
        patient: "Ana Ribeiro",
        phone: "5585998765432",
        phones: ["5585998765432"],
        scheduledAt: "2026-08-29T12:00:00.000Z",
        status: "CONFIRMADO",
        awaitingConfirmation: 0,
        professional: "Dra. Mariana Silva",
        lastEventType: "REMINDER",
        lastNotificationStatus: "SENT",
        lastSentAt: "2026-08-28T13:00:00.000Z",
        lastDeliveredAt: "2026-08-28T13:01:00.000Z",
        lastReadAt: "2026-08-28T13:04:00.000Z",
        ticketId: 1,
        manualReminderToday: 0,
        lastDecision: "CONFIRMED",
        lastDecisionStatus: "SUCCESS",
        lastDecisionSource: "WHATSAPP"
      }, {
        id: 102,
        appointmentId: "QK-102",
        patient: "Carlos Lima",
        phone: "5585998123456",
        phones: ["5585998123456"],
        scheduledAt: "2026-08-29T13:30:00.000Z",
        status: "AGENDADO",
        awaitingConfirmation: 1,
        professional: "Dr. Paulo Mendes",
        lastEventType: "REMINDER",
        lastNotificationStatus: "SENT",
        lastSentAt: "2026-08-28T14:00:00.000Z",
        lastDeliveredAt: "2026-08-28T14:01:00.000Z",
        lastReadAt: null,
        ticketId: 2,
        manualReminderToday: 0,
        lastDecision: null,
        lastDecisionStatus: null,
        lastDecisionSource: null
      }, {
        id: 103,
        appointmentId: "QK-103",
        patient: "Beatriz Oliveira",
        phone: "5585998234567",
        phones: ["5585998234567"],
        scheduledAt: "2026-08-29T15:00:00.000Z",
        status: "CONFIRMADO",
        awaitingConfirmation: 0,
        professional: "Dra. Mariana Silva",
        lastEventType: "UPDATED",
        lastNotificationStatus: "READ",
        lastSentAt: "2026-08-28T15:00:00.000Z",
        lastDeliveredAt: "2026-08-28T15:01:00.000Z",
        lastReadAt: "2026-08-28T15:05:00.000Z",
        ticketId: 3,
        manualReminderToday: 0,
        lastDecision: "CONFIRMED",
        lastDecisionStatus: "SUCCESS",
        lastDecisionSource: "DASHBOARD"
      }, {
        id: 104,
        appointmentId: "QK-104",
        patient: "Lucas Ferreira",
        phone: "5585998345678",
        phones: ["5585998345678"],
        scheduledAt: "2026-08-29T17:30:00.000Z",
        status: "AGENDADO",
        awaitingConfirmation: 0,
        professional: "Dr. Paulo Mendes",
        lastEventType: null,
        lastNotificationStatus: null,
        lastSentAt: null,
        lastDeliveredAt: null,
        lastReadAt: null,
        ticketId: 4,
        manualReminderToday: 0,
        lastDecision: null,
        lastDecisionStatus: null,
        lastDecisionSource: null
      }],
      total: 4,
      page: 1,
      pageSize: 25
    };else if (path.endsWith("/breakdown")) data = {
      eventTypes: [],
      professionals: []
    };else if (path === "/daily-reports") data = {
      config: {
        reportTime: "17:00",
        timezone: "America/Sao_Paulo",
        enabled: false
      },
      recipients: [],
      runs: []
    };else if (path === "/stickers") data = {
      stickers: [{
        id: 1,
        name: "Tudo certo · exemplo",
        mediaUrl: "/qa/sticker",
        createdByUserId: 1
      }]
    };else if (path === "/qa/sticker") data = new Blob([stickerImage], {
      type: "image/svg+xml"
    });else throw new Error(`No fixture for ${path}`);
    return {
      status: 200,
      data
    };
  },
  async post(path, body, options = {}) {
    const summary = body instanceof FormData ? Array.from(body.entries()).map(([key, value]) => [key, value instanceof File ? {
      name: value.name,
      type: value.type,
      size: value.size
    } : value]) : body;
    requests.push({
      method: "POST",
      path,
      body: summary,
      headers: options.headers
    });
    exposeRequests();
    if (new URLSearchParams(window.location.search).get("upload") === "fail-once" && path.startsWith("/messages/") && requests.filter(request => request.method === "POST" && request.path === path).length === 1) {
      throw new Error("QA: simulated upload interruption");
    }
    if (path === "/contacts/profile-pictures/refresh") {
      return {
        status: 200,
        data: {
          contacts: (body.contacts || []).map(contact => ({
            id: contact.id,
            profilePicUrl: contact.id <= 2 || contact.force ? avatarDataUri(contact.id) : "",
            refreshed: contact.id <= 2 || contact.force
          }))
        }
      };
    }
    return {
      status: 202,
      data: {}
    };
  },
  async put(path, body) {
    requests.push({
      method: "PUT",
      path,
      body
    });
    exposeRequests();
    return {
      status: 200,
      data: {}
    };
  },
  async delete(path) {
    requests.push({
      method: "DELETE",
      path
    });
    exposeRequests();
    return {
      status: 200,
      data: {}
    };
  }
};
