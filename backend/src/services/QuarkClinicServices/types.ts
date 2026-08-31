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

export interface QuarkSpecialtyDto extends QuarkNamedEntity {
  ativo?: boolean;
}

export interface QuarkProfessionalDto {
  id: number | string;
  nome?: string;
  profissional?: string;
  ativo?: boolean;
  especialidades?: QuarkSpecialtyDto[] | string;
  especialidadesList?: Array<QuarkSpecialtyDto | string>;
  [key: string]: unknown;
}

export interface QuarkCatalogItemDto extends QuarkNamedEntity {
  descricao?: string;
}

export interface QuarkAgendaDto {
  id: number | string;
  nome?: string;
  ativo?: boolean;
  profissionalId?: number | string;
  clinicaId?: number | string;
  convenios?: QuarkCatalogItemDto[];
  procedimentos?: QuarkCatalogItemDto[];
  diasSemana?: string[];
  dataInicio?: string;
  dataValidade?: string;
  horaAbertura?: string;
  horaFechamento?: string;
  telemedicina?: boolean;
  [key: string]: unknown;
}

export interface QuarkFreeSlotDto {
  intervalo?: string;
  status?: string;
}

export interface QuarkFreeSlotDayDto {
  data?: string;
  horarios?: QuarkFreeSlotDto[];
}

export interface QuarkPatientDto {
  id: number | string;
  nome?: string;
  cpf?: string;
  dataNascimento?: string;
  [key: string]: unknown;
}

export interface CreateQuarkPatientRequest {
  cpf: string;
  dataNascimento: string;
  nome: string;
  telefone: string;
  unidadeId?: number;
  filterPorCPF?: boolean;
}

export interface CreateQuarkAppointmentRequest {
  agendaId: number;
  convenioId?: number;
  data: string;
  especialidadeId?: number;
  hora: string;
  nomePaciente: string;
  pacienteId: number;
  procedimentosIds?: number[];
  telefonePaciente: string;
  telemedicina?: boolean;
  unidadeId?: number;
}
