import QuarkAppointment from "../../../models/QuarkAppointment";
import {
  findConfirmedQuarkCandidate,
  findQuarkCandidates
} from "../../../services/IdentityServices/identityEvidence";
import { getQuarkPatient } from "../../../services/QuarkClinicServices/QuarkClinicClient";

jest.mock("../../../models/QuarkAppointment", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));
jest.mock("../../../services/QuarkClinicServices/config", () => ({
  getQuarkConfig: jest.fn(() => ({ timezone: "America/Sao_Paulo" }))
}));
jest.mock("../../../services/QuarkClinicServices/QuarkClinicClient", () => ({
  getQuarkPatient: jest.fn()
}));

const row = (overrides: Record<string, unknown> = {}) => ({
  patientId: "7",
  patientName: "Maria da Silva",
  appointmentId: "42",
  scheduledAt: new Date("2026-08-30T12:00:00Z"),
  snapshot: "{}",
  ...overrides
});

beforeEach(() => jest.clearAllMocks());

it("aggregates CPF from an older appointment of the same patient", async () => {
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
    row({ patientName: "Contato WhatsApp", appointmentId: "43" }),
    row({ snapshot: JSON.stringify({ cpf: "529.982.247-25" }) })
  ]);

  await expect(findQuarkCandidates({ number: "5585999999999" })).resolves.toEqual([
    expect.objectContaining({
      patientId: "7",
      patientName: "Maria da Silva",
      cpf: "52998224725",
      appointmentId: "43"
    })
  ]);
});

it("uses the confirmed patient endpoint only when local snapshots have no CPF", async () => {
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([row()]);
  (getQuarkPatient as jest.Mock).mockResolvedValue({
    id: 7,
    nome: "Maria da Silva",
    cpf: "529.982.247-25"
  });

  await expect(findConfirmedQuarkCandidate("7", true)).resolves.toEqual(
    expect.objectContaining({ patientId: "7", cpf: "52998224725" })
  );
  expect(getQuarkPatient).toHaveBeenCalledTimes(1);
});

it("does not call the patient endpoint when an older local snapshot has CPF", async () => {
  (QuarkAppointment.findAll as jest.Mock).mockResolvedValue([
    row({ appointmentId: "43" }),
    row({ snapshot: JSON.stringify({ cpf: "52998224725" }) })
  ]);

  await expect(findConfirmedQuarkCandidate("7", true)).resolves.toEqual(
    expect.objectContaining({ cpf: "52998224725", appointmentId: "43" })
  );
  expect(getQuarkPatient).not.toHaveBeenCalled();
});
