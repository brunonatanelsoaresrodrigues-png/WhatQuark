export interface QuarkNamedEntity {
  id?: number | string;
  nome?: string;
}

export interface QuarkAppointmentDto {
  id: number | string;
  pacienteId?: number | string;
  nomePaciente?: string;
  dataAgendamento?: string;
  horaAgendamento?: string;
  statusMarcacao?: string;
  telefone?: string;
  telefoneComDDI?: string;
  telefoneOutro?: string;
  telefoneOutroComDDI?: string;
  agendaId?: number | string;
  clinicaId?: number | string;
  clinicaNome?: string;
  profissionalId?: number | string;
  profissional?: QuarkNamedEntity;
  procedimentoId?: number | string;
  procedimento?: QuarkNamedEntity & { orientacoes?: string };
  especialidadeId?: number | string;
  especialidade?: QuarkNamedEntity;
  [key: string]: unknown;
}

export interface QuarkPagedResponse<T> {
  errorDetail?: string;
  organizacao?: number | string;
  page?: number;
  response?: T[];
  status?: string;
}
