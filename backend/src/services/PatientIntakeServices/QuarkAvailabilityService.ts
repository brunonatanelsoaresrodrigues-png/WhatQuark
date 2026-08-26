import {
  getQuarkConfig,
  isQuarkIntegrationEnabled
} from "../QuarkClinicServices/config";
import {
  listQuarkAgendas,
  listQuarkFreeSlots,
  listQuarkProfessionals
} from "../QuarkClinicServices/QuarkClinicClient";
import {
  QuarkAgendaDto,
  QuarkProfessionalDto
} from "../QuarkClinicServices/types";
import {
  IntakeDateOption,
  IntakeProfessionalOption,
  IntakeSlotOption,
  IntakeSpecialty
} from "./PatientIntakeContextService";

interface Catalog {
  professionals: QuarkProfessionalDto[];
  agendas: QuarkAgendaDto[];
}

interface CachedValue<T> {
  expiresAt: number;
  value: Promise<T>;
}

let catalogCache: CachedValue<Catalog> | undefined;
const slotCache = new Map<string, CachedValue<IntakeSlotOption[]>>();

const normalize = (value: unknown): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

export const isPatientIntakeAvailabilityEnabled = (): boolean =>
  isQuarkIntegrationEnabled() &&
  process.env.PATIENT_INTAKE_QUARK_AVAILABILITY_ENABLED !== "false";

export const isPatientIntakeBookingEnabled = (): boolean =>
  isPatientIntakeAvailabilityEnabled() &&
  process.env.PATIENT_INTAKE_QUARK_BOOKING_ENABLED === "true";

const getCatalog = async (): Promise<Catalog> => {
  const now = Date.now();
  if (catalogCache && catalogCache.expiresAt > now) return catalogCache.value;
  const config = getQuarkConfig();
  const value = Promise.all([
    listQuarkProfessionals(config),
    listQuarkAgendas(config)
  ]).then(([professionals, agendas]) => ({ professionals, agendas }));
  catalogCache = { value, expiresAt: now + 5 * 60 * 1000 };
  try {
    return await value;
  } catch (error) {
    catalogCache = undefined;
    throw error;
  }
};

const specialtiesFor = (
  professional: QuarkProfessionalDto
): Array<{ id?: number | string; nome?: string } | string> => {
  if (Array.isArray(professional.especialidadesList)) {
    return professional.especialidadesList;
  }
  if (Array.isArray(professional.especialidades)) {
    return professional.especialidades;
  }
  if (typeof professional.especialidades === "string") {
    return [professional.especialidades];
  }
  return [];
};

const specialtyMatches = (
  professional: QuarkProfessionalDto,
  specialty: IntakeSpecialty,
  agendas: QuarkAgendaDto[]
): boolean => {
  const rawSpecialties = specialtiesFor(professional);
  const specialtyNames = rawSpecialties.map(item =>
    normalize(typeof item === "string" ? item : item.nome)
  );
  if (specialty === "PSYCHIATRY") {
    return specialtyNames.some(value => value.includes("PSIQUIATR"));
  }
  if (specialty === "PSYCHOLOGY") {
    return specialtyNames.some(value => value.includes("PSICOLOG"));
  }
  return agendas.some(agenda =>
    (agenda.procedimentos || []).some(procedure =>
      normalize(procedure.nome || procedure.descricao).includes("LAUDO")
    )
  );
};

const professionalName = (professional: QuarkProfessionalDto): string =>
  String(
    professional.nome || professional.profissional || "Profissional"
  ).trim();

const professionalSpecialtyId = (
  professional: QuarkProfessionalDto,
  specialty: IntakeSpecialty
): string | undefined => {
  const rawSpecialties = specialtiesFor(professional);
  let token = "PSIQUIATR";
  if (specialty === "PSYCHOLOGY") token = "PSICOLOG";
  if (specialty === "REPORT") token = "LAUDO";
  const match = rawSpecialties.find(item =>
    normalize(typeof item === "string" ? item : item.nome).includes(token)
  );
  return typeof match === "string" || match?.id === undefined
    ? undefined
    : String(match.id);
};

export const listIntakeProfessionals = async (
  specialty: IntakeSpecialty
): Promise<IntakeProfessionalOption[]> => {
  const { professionals, agendas } = await getCatalog();
  return professionals
    .filter(professional => professional.ativo !== false)
    .map(professional => {
      const professionalAgendas = agendas.filter(
        agenda =>
          agenda.ativo !== false &&
          String(agenda.profissionalId || "") === String(professional.id)
      );
      return { professional, professionalAgendas };
    })
    .filter(
      ({ professional, professionalAgendas }) =>
        professionalAgendas.length > 0 &&
        specialtyMatches(professional, specialty, professionalAgendas)
    )
    .map(({ professional, professionalAgendas }) => ({
      professionalId: String(professional.id),
      name: professionalName(professional),
      agendaIds: professionalAgendas.map(agenda => String(agenda.id)),
      specialtyId: professionalSpecialtyId(professional, specialty)
    }))
    .sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
};

const pad = (value: number): string => String(value).padStart(2, "0");
const apiDate = (date: Date): string =>
  `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
const displayDate = (date: Date): string =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
const dateFromDisplay = (value: string): Date | undefined => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const date = new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1])
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const weekdayToken = (date: Date): string =>
  ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"][date.getDay()];

const agendaAcceptsDate = (agenda: QuarkAgendaDto, date: Date): boolean =>
  !Array.isArray(agenda.diasSemana) ||
  agenda.diasSemana.length === 0 ||
  agenda.diasSemana.map(normalize).includes(weekdayToken(date));

const firstTime = (interval: string): string | undefined => {
  const match = interval.match(/(?:^|\s)([0-2]\d:[0-5]\d)(?:\s|$)/);
  return match?.[1];
};

const fetchSlots = async (
  agendaId: string,
  date: Date,
  bypassCache = false
): Promise<IntakeSlotOption[]> => {
  const dateValue = displayDate(date);
  const key = `${agendaId}:${dateValue}`;
  const now = Date.now();
  const cached = slotCache.get(key);
  if (!bypassCache && cached && cached.expiresAt > now) return cached.value;
  const value = listQuarkFreeSlots(
    getQuarkConfig(),
    agendaId,
    apiDate(date)
  ).then(days => {
    const slots: IntakeSlotOption[] = [];
    days.forEach(day => {
      const current = (day.horarios || [])
        .filter(slot => normalize(slot.status) === "LIVRE")
        .map(slot => {
          const interval = String(slot.intervalo || "").trim();
          const time = firstTime(interval);
          return time
            ? { agendaId, date: dateValue, time, interval }
            : undefined;
        })
        .filter((slot): slot is IntakeSlotOption => Boolean(slot));
      slots.push(...current);
    });
    return slots;
  });
  if (!bypassCache) {
    slotCache.set(key, { value, expiresAt: now + 45 * 1000 });
  }
  return value;
};

const labelForDate = (date: Date): string => {
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo"
  }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${pad(
    date.getDate()
  )}/${pad(date.getMonth() + 1)}`;
};

const uniqueSlots = (slots: IntakeSlotOption[]): IntakeSlotOption[] => {
  const byTime = new Map<string, IntakeSlotOption>();
  slots
    .sort((first, second) => first.time.localeCompare(second.time))
    .forEach(slot => {
      if (!byTime.has(slot.time)) byTime.set(slot.time, slot);
    });
  return Array.from(byTime.values());
};

export const listIntakeAvailabilityDates = async (
  professional: IntakeProfessionalOption,
  horizonDays = 30,
  limit = 5
): Promise<IntakeDateOption[]> => {
  const { agendas } = await getCatalog();
  const selectedAgendas = agendas.filter(
    agenda =>
      agenda.ativo !== false &&
      professional.agendaIds.includes(String(agenda.id))
  );
  const dates: IntakeDateOption[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (
    let offset = 0;
    offset < horizonDays && dates.length < limit;
    offset += 1
  ) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const eligible = selectedAgendas.filter(agenda =>
      agendaAcceptsDate(agenda, date)
    );
    // Scanning dates is intentionally sequential so the API is not flooded and
    // stops as soon as enough dates were found.
    // eslint-disable-next-line no-continue
    if (eligible.length === 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const slotGroups = await Promise.all(
      eligible.map(agenda => fetchSlots(String(agenda.id), date))
    );
    const slots = uniqueSlots(
      slotGroups.reduce<IntakeSlotOption[]>(
        (values, current) => values.concat(current),
        []
      )
    ).filter(slot => {
      if (offset > 0) return true;
      const [hour, minute] = slot.time.split(":").map(Number);
      const scheduled = new Date(date);
      scheduled.setHours(hour, minute, 0, 0);
      return scheduled.getTime() > Date.now() + 15 * 60 * 1000;
    });
    if (slots.length > 0) {
      dates.push({ date: displayDate(date), label: labelForDate(date), slots });
    }
  }
  return dates;
};

export const findFirstIntakeAvailability = async (
  professionals: IntakeProfessionalOption[],
  horizonDays = 30
): Promise<{
  professional: IntakeProfessionalOption;
  dates: IntakeDateOption[];
} | null> => {
  const options = await Promise.all(
    professionals.map(async professional => ({
      professional,
      dates: await listIntakeAvailabilityDates(professional, horizonDays, 1)
    }))
  );
  const available = options.filter(option => option.dates.length > 0);
  available.sort((first, second) => {
    const firstDate =
      dateFromDisplay(first.dates[0].date)?.getTime() || Infinity;
    const secondDate =
      dateFromDisplay(second.dates[0].date)?.getTime() || Infinity;
    if (firstDate !== secondDate) return firstDate - secondDate;
    return first.dates[0].slots[0].time.localeCompare(
      second.dates[0].slots[0].time
    );
  });
  if (!available[0]) return null;
  return {
    professional: available[0].professional,
    dates: await listIntakeAvailabilityDates(available[0].professional)
  };
};

export const revalidateIntakeSlot = async (
  slot: IntakeSlotOption
): Promise<boolean> => {
  const date = dateFromDisplay(slot.date);
  if (!date) return false;
  const current = await fetchSlots(slot.agendaId, date, true);
  return current.some(value => value.time === slot.time);
};

export const getIntakeAgenda = async (
  agendaId: string
): Promise<QuarkAgendaDto | undefined> => {
  const { agendas } = await getCatalog();
  return agendas.find(agenda => String(agenda.id) === agendaId);
};

export const clearQuarkAvailabilityCaches = (): void => {
  catalogCache = undefined;
  slotCache.clear();
};
