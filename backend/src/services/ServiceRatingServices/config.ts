import Setting from "../../models/Setting";

export interface ServiceRatingConfig {
  enabled: boolean;
  expiryHours: number;
  cooldownHours: number;
  message: string;
  thankYouMessage: string;
}

export const DEFAULT_RATING_MESSAGE =
  "Como você avalia este atendimento? ⭐\n\nResponda somente com uma nota de 0 a 5, onde 0 é muito ruim e 5 é excelente.";
export const DEFAULT_RATING_THANK_YOU =
  "Obrigado pela sua avaliação! Sua opinião nos ajuda a melhorar. 💚";

const positive = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getServiceRatingConfig = async (): Promise<ServiceRatingConfig> => {
  const rows = await Setting.findAll({
    where: {
      key: [
        "serviceRatingEnabled",
        "serviceRatingExpiryHours",
        "serviceRatingCooldownHours",
        "serviceRatingMessage",
        "serviceRatingThankYouMessage"
      ]
    }
  });
  const values = new Map(rows.map(row => [row.key, row.value]));
  return {
    enabled: values.get("serviceRatingEnabled") !== "disabled",
    expiryHours: positive(values.get("serviceRatingExpiryHours"), 48),
    cooldownHours: positive(values.get("serviceRatingCooldownHours"), 12),
    message: values.get("serviceRatingMessage")?.trim() || DEFAULT_RATING_MESSAGE,
    thankYouMessage:
      values.get("serviceRatingThankYouMessage")?.trim() ||
      DEFAULT_RATING_THANK_YOU
  };
};
