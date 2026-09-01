import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";

const messages = {
  ERR_MESSAGING_PAUSED: "Os envios estão pausados ou em simulação.",
  ERR_CONSENT_REQUIRED: "Registre a autorização do titular para enviar avisos.",
  ERR_RECIPIENT_OPTED_OUT: "Este número desativou os avisos automáticos.",
  ERR_APPROVED_TEMPLATE_REQUIRED:
    "Fora da janela de atendimento: é necessário um modelo aprovado.",
  ERR_SEND_OUTCOME_UNKNOWN:
    "O resultado do envio é incerto. Não reenvie; confira o histórico e as pendências.",
  ERR_APPOINTMENT_CHANGED:
    "A consulta mudou. Atualize os dados antes de continuar.",
  ERR_QUARK_REVIEW_REQUIRED:
    "Confira o resultado no Quark antes de fazer uma nova alteração.",
  ERR_QUARK_SIMULATION: "A integração Quark está desativada ou em simulação.",
  ERR_BOT_PAUSED: "O atendimento está sob responsabilidade da equipe.",
  ERR_OPERATION_BUSY: "Esta operação já está em andamento. Aguarde e atualize.",
  ERR_QUIET_HOURS: "Avisos automáticos não são enviados neste horário.",
  ERR_TEST_RECIPIENT_NOT_ALLOWED:
    "O número não está autorizado no ambiente de teste.",
  ERR_CHANNEL_DISCONNECTED: "O canal está desconectado.",
  ERR_QUARK_CHANNEL_REQUIRED:
    "Configure o canal específico do Quark no servidor.",
  ERR_CLOUD_FEATURE_UNSUPPORTED:
    "Esta ação não está disponível na API oficial.",
  ERR_IDEMPOTENCY_KEY_REQUIRED:
    "Atualize a aplicação antes de enviar mensagens.",
  ERR_INVALID_MEDIA: "Arquivo inválido ou lote acima do limite permitido.",
  ERR_MEDIA_TOO_LARGE: "Cada arquivo deve ter no máximo 20 MB.",
  ERR_INVALID_MEDIA_CONTENT:
    "O conteúdo do arquivo não corresponde ao tipo informado.",
  ERR_MEDIA_TYPE_NOT_ALLOWED: "Este tipo de arquivo não é permitido.",
  ERR_NO_STICKER_FOUND: "A figurinha não está mais disponível.",
  ERR_MESSAGE_IS_NOT_STICKER: "Esta mensagem não contém uma figurinha válida.",
  ERR_STICKER_PROVIDER_UNSUPPORTED:
    "O provedor configurado não permite enviar figurinhas."
};
const toastError = err => {
  const errorMsg = err.response?.data?.message || err.response?.data?.error;
  if (errorMsg) {
    if (messages[errorMsg]) {
      toast.error(messages[errorMsg], { toastId: errorMsg });
    } else if (i18n.exists(`backendErrors.${errorMsg}`)) {
      toast.error(i18n.t(`backendErrors.${errorMsg}`), {
        toastId: errorMsg
      });
    } else {
      toast.error(errorMsg, {
        toastId: errorMsg
      });
    }
  } else {
    toast.error(
      "Não foi possível concluir. Verifique sua conexão e tente novamente."
    );
  }
};

export default toastError;
