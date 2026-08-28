import {
  listQuarkAgendas,
  listQuarkFreeSlots,
  listQuarkProfessionals
} from "../../../services/QuarkClinicServices/QuarkClinicClient";
import {
  clearQuarkAvailabilityCaches,
  listIntakeAvailabilityDates,
  listIntakeProfessionals,
  revalidateIntakeSlot
} from "../../../services/PatientIntakeServices/QuarkAvailabilityService";

jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn(() => ({})),
  isQuarkIntegrationEnabled: jest.fn(() => true)
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  listQuarkAgendas: jest.fn(),
  listQuarkFreeSlots: jest.fn(),
  listQuarkProfessionals: jest.fn()
}));

describe("QuarkAvailabilityService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-08-24T00:00:00-03:00").getTime());
    clearQuarkAvailabilityCaches();
    (listQuarkProfessionals as jest.Mock).mockResolvedValue([
      {
        id: 10,
        nome: "Dra. Maria",
        ativo: true,
        especialidadesList: [{ id: 30, nome: "PSIQUIATRIA" }]
      },
      {
        id: 11,
        nome: "Profissional inativo",
        ativo: false,
        especialidadesList: [{ id: 30, nome: "PSIQUIATRIA" }]
      }
    ]);
    (listQuarkAgendas as jest.Mock).mockResolvedValue([
      { id: 20, profissionalId: 10, ativo: true, diasSemana: [] },
      { id: 21, profissionalId: 10, ativo: true, diasSemana: [] },
      { id: 22, profissionalId: 11, ativo: true, diasSemana: [] }
    ]);
    (listQuarkFreeSlots as jest.Mock).mockResolvedValue([
      {
        data: "26/08/2026",
        horarios: [
          { intervalo: "09:00 - 09:30", status: "LIVRE" },
          { intervalo: "10:00 - 10:30", status: "OCUPADO" }
        ]
      }
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("deduplicates active agendas under the active professional", async () => {
    await expect(listIntakeProfessionals("PSYCHIATRY")).resolves.toEqual([
      {
        professionalId: "10",
        name: "Dra. Maria",
        agendaIds: ["20", "21"],
        specialtyId: "30"
      }
    ]);
  });

  it("accepts the string specialty format returned by the live Quark API", async () => {
    (listQuarkProfessionals as jest.Mock).mockResolvedValue([
      {
        id: 10,
        nome: "Dra. Maria",
        ativo: true,
        especialidadesList: ["PSIQUIATRIA"]
      }
    ]);

    await expect(listIntakeProfessionals("PSYCHIATRY")).resolves.toEqual([
      expect.objectContaining({
        professionalId: "10",
        name: "Dra. Maria",
        agendaIds: ["20", "21"]
      })
    ]);
  });

  it("returns only free times and deduplicates equal times", async () => {
    const [professional] = await listIntakeProfessionals("PSYCHIATRY");
    const dates = await listIntakeAvailabilityDates(professional, 2, 1);

    expect(dates).toHaveLength(1);
    expect(dates[0].slots).toHaveLength(1);
    expect(dates[0].slots[0].time).toBe("09:00");
    expect(listQuarkFreeSlots).toHaveBeenCalledTimes(2);
  });

  it("bypasses the short cache when revalidating a selected slot", async () => {
    const slot = {
      agendaId: "20",
      date: "26/08/2026",
      time: "09:00",
      interval: "09:00 - 09:30"
    };

    await expect(revalidateIntakeSlot(slot)).resolves.toBe(true);
    await expect(revalidateIntakeSlot(slot)).resolves.toBe(true);
    expect(listQuarkFreeSlots).toHaveBeenCalledTimes(2);
  });
});
