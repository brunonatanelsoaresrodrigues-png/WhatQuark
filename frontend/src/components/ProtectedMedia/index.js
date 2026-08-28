import React, { useEffect, useRef, useState } from "react";
import { Button, CircularProgress, Typography } from "@material-ui/core";
import GetApp from "@material-ui/icons/GetApp";
import ModalImage from "react-modal-image";
import Audio from "../Audio";
import useProtectedMedia from "../../hooks/useProtectedMedia";
import api from "../../services/api";

export default function ProtectedMedia({ message, className }) {
  const preview = ["image", "audio", "video"].includes(message.mediaType);
  const { blobUrl, error } = useProtectedMedia(
    preview ? message.mediaUrl : null
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const download = async () => {
    setDownloading(true);
    setDownloadError(false);
    try {
      const { data } = await api.get(message.mediaUrl, {
        responseType: "blob"
      });
      if (!mounted.current) return;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = decodeURIComponent(message.mediaUrl.split("/").pop());
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (mounted.current) setDownloadError(true);
    } finally {
      if (mounted.current) setDownloading(false);
    }
  };

  if (!preview)
    return (
      <>
        <Button
          startIcon={<GetApp />}
          onClick={download}
          disabled={downloading}
          variant="outlined"
        >
          {downloading ? "Baixando..." : "Download"}
        </Button>
        {downloadError && (
          <Typography variant="caption">
            Anexo indisponível ou sem permissão.
          </Typography>
        )}
      </>
    );
  if (error)
    return (
      <Typography variant="caption">
        Anexo indisponível ou sem permissão.
      </Typography>
    );
  if (!blobUrl)
    return <CircularProgress size={20} aria-label="Carregando anexo" />;
  if (message.mediaType === "image") {
    return (
      <ModalImage
        className={className}
        small={blobUrl}
        large={blobUrl}
        alt="Imagem da conversa"
      />
    );
  }
  if (message.mediaType === "audio") return <Audio url={blobUrl} />;
  return <video className={className} src={blobUrl} controls />;
}
