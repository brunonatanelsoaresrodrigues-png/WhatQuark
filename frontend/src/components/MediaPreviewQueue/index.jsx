import React, { useEffect, useState } from "react";
import {
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import CloseIcon from "@material-ui/icons/Close";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import InsertDriveFileOutlinedIcon from "@material-ui/icons/InsertDriveFileOutlined";
import SendIcon from "@material-ui/icons/Send";
import { mediaFileKey } from "../../services/mediaComposer";

const useStyles = makeStyles(theme => ({
  root: {
    width: "100%",
    padding: theme.spacing(1.25),
    borderTop: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing(1)
  },
  list: {
    display: "flex",
    gap: theme.spacing(1),
    overflowX: "auto",
    paddingBottom: theme.spacing(1)
  },
  item: {
    position: "relative",
    width: 150,
    minWidth: 150,
    height: 112,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    overflow: "hidden",
    background: theme.palette.background.default,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing(1)
  },
  image: { width: "100%", height: 70, objectFit: "contain" },
  fileIcon: { fontSize: 42, color: theme.palette.text.secondary },
  remove: {
    position: "absolute",
    right: 2,
    top: 2,
    background: theme.palette.background.paper
  },
  filename: {
    width: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },
  actions: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  input: { display: "none" },
  progress: { marginTop: theme.spacing(1) }
}));

const FilePreview = ({ file, onRemove, disabled }) => {
  const classes = useStyles();
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <Paper variant="outlined" className={classes.item}>
      <Tooltip title="Remover arquivo">
        <IconButton
          aria-label={`Remover ${file.name}`}
          className={classes.remove}
          size="small"
          onClick={onRemove}
          disabled={disabled}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      {preview ? (
        <img className={classes.image} src={preview} alt="Prévia do anexo" />
      ) : (
        <InsertDriveFileOutlinedIcon className={classes.fileIcon} />
      )}
      <Typography
        className={classes.filename}
        variant="caption"
        title={file.name}
      >
        {file.name}
      </Typography>
      <Typography variant="caption" color="textSecondary">
        {(file.size / 1024 / 1024).toFixed(1)} MB
      </Typography>
    </Paper>
  );
};

export default function MediaPreviewQueue({
  files,
  loading,
  progress,
  sendDisabled = false,
  onAdd,
  onRemove,
  onClear,
  onSend
}) {
  const classes = useStyles();
  return (
    <Paper elevation={0} square className={classes.root}>
      <div className={classes.header}>
        <Typography variant="subtitle2">
          {files.length} arquivo{files.length === 1 ? "" : "s"} pronto
          {files.length === 1 ? "" : "s"} para enviar
        </Typography>
        <Tooltip title="Cancelar todos os anexos">
          <IconButton
            aria-label="Cancelar todos os anexos"
            size="small"
            onClick={onClear}
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </div>
      <div className={classes.list}>
        {files.map((file, index) => (
          <FilePreview
            key={`${mediaFileKey(file)}:${index}`}
            file={file}
            disabled={loading}
            onRemove={() => onRemove(index)}
          />
        ))}
      </div>
      <div className={classes.actions}>
        <div>
          <input
            multiple
            type="file"
            id="media-queue-add"
            className={classes.input}
            disabled={loading}
            onChange={event => {
              onAdd(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
          <label htmlFor="media-queue-add">
            <Button component="span" startIcon={<AddIcon />} disabled={loading}>
              Adicionar
            </Button>
          </label>
        </div>
        <Tooltip title={sendDisabled ? "Envio indisponível — consulte Contexto" : "Enviar arquivos"}>
          <span>
            <Button
              color="primary"
              variant="contained"
              startIcon={loading ? <CircularProgress size={18} /> : <SendIcon />}
              onClick={onSend}
              disabled={loading || sendDisabled}
            >
              {loading ? "Enviando" : "Enviar arquivos"}
            </Button>
          </span>
        </Tooltip>
      </div>
      {loading && (
        <LinearProgress
          className={classes.progress}
          variant={progress > 0 ? "determinate" : "indeterminate"}
          value={progress}
        />
      )}
    </Paper>
  );
}
