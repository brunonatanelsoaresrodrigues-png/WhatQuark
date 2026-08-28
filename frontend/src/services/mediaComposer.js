export const MAX_MEDIA_FILES = 10;
export const MAX_MEDIA_FILE_BYTES = 20 * 1024 * 1024;

const dangerousExtension =
  /\.(apk|bat|cmd|com|cpl|dll|exe|hta|jar|js|jse|msi|ps1|scr|vbs|vbe|wsf)$/i;

export const mediaFileKey = file =>
  `${file.name}:${file.size}:${file.lastModified}`;

export const selectMediaFiles = (current, incoming) => {
  const accepted = [...current];
  const existing = new Set(accepted.map(mediaFileKey));
  const rejected = [];
  for (const file of incoming) {
    if (accepted.length >= MAX_MEDIA_FILES) {
      rejected.push({ file, reason: "Limite de 10 arquivos por envio." });
      continue;
    }
    if (!file.size || file.size > MAX_MEDIA_FILE_BYTES) {
      rejected.push({ file, reason: "O arquivo deve ter no máximo 20 MB." });
      continue;
    }
    if (dangerousExtension.test(file.name)) {
      rejected.push({ file, reason: "Este tipo de arquivo não é permitido." });
      continue;
    }
    const key = mediaFileKey(file);
    if (existing.has(key)) continue;
    existing.add(key);
    accepted.push(file);
  }
  return { accepted, rejected };
};

export const isStickerMessage = message =>
  message?.mediaType === "sticker" || /\.webp(?:$|\?)/i.test(message?.mediaUrl || "");
