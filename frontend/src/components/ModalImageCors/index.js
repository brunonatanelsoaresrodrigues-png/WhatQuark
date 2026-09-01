import React from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import useProtectedMedia from "../../hooks/useProtectedMedia";

const useStyles = makeStyles(() => ({
  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  }
}));

const ModalImageCors = ({ imageUrl }) => {
  const classes = useStyles();
  const { blobUrl, error } = useProtectedMedia(imageUrl);
  if (error) return <span>Anexo indisponível ou sem permissão.</span>;
  if (!blobUrl) return <span>Carregando imagem...</span>;
  return (
    <ModalImage
      className={classes.messageMedia}
      small={blobUrl}
      large={blobUrl}
      alt="image"
    />
  );
};

export default ModalImageCors;
