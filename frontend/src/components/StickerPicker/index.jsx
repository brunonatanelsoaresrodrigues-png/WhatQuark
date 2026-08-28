import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  CircularProgress,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
  makeStyles
} from "@material-ui/core";
import CloseIcon from "@material-ui/icons/Close";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import SearchIcon from "@material-ui/icons/Search";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import useProtectedMedia from "../../hooks/useProtectedMedia";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles(theme => ({
  panel: {
    position: "absolute",
    bottom: 66,
    left: 8,
    zIndex: 8,
    width: 350,
    maxWidth: "calc(100% - 16px)",
    padding: theme.spacing(1.5),
    borderRadius: 12,
    boxShadow: theme.shadows[8]
  },
  header: { display: "flex", alignItems: "center", gap: theme.spacing(1) },
  search: { display: "flex", flex: 1, alignItems: "center", padding: "2px 8px", background: theme.palette.background.default, borderRadius: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, maxHeight: 280, overflowY: "auto", marginTop: 12 },
  tileWrapper: { position: "relative", minHeight: 78 },
  tile: { width: "100%", minHeight: 78, border: 0, borderRadius: 9, cursor: "pointer", background: "transparent", padding: 5, "&:hover": { background: theme.palette.action.hover } },
  image: { width: "100%", height: 68, objectFit: "contain" },
  remove: { position: "absolute", right: 0, top: 0, background: "rgba(255,255,255,.88)" },
  empty: { gridColumn: "1 / -1", padding: theme.spacing(3), textAlign: "center" }
}));

const StickerTile = ({ sticker, onSend, onDelete, canDelete, sending }) => {
  const classes = useStyles();
  const { blobUrl, error } = useProtectedMedia(sticker.mediaUrl);
  return (
    <div className={classes.tileWrapper}>
      <button type="button" className={classes.tile} onClick={() => onSend(sticker)} disabled={sending || !blobUrl} title={sticker.name || "Enviar figurinha"}>
        {!blobUrl && !error && <CircularProgress size={22} />}
        {error && <Typography variant="caption">Indisponível</Typography>}
        {blobUrl && <img className={classes.image} src={blobUrl} alt={sticker.name || "Figurinha salva"} />}
      </button>
      {canDelete && (
        <Tooltip title="Excluir da biblioteca">
          <IconButton className={classes.remove} size="small" onClick={event => { event.stopPropagation(); onDelete(sticker); }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  );
};

export default function StickerPicker({ open, onClose, ticketId }) {
  const classes = useStyles();
  const { user } = useContext(AuthContext);
  const [stickers, setStickers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    api.get("/stickers").then(({ data }) => { if (active) setStickers(data.stickers || []); }).catch(toastError).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);
  const visible = useMemo(() => stickers.filter(sticker => (sticker.name || "").toLowerCase().includes(search.trim().toLowerCase())), [stickers, search]);
  const send = async sticker => {
    setSending(true);
    try {
      const key = `sticker-${user?.id || 0}-${sticker.id}-${Date.now()}`;
      const response = await api.post(`/stickers/${sticker.id}/send/${ticketId}`, {}, { headers: { "Idempotency-Key": key } });
      if (response.status === 202) toast.info("Figurinha adicionada à fila de envio.");
      onClose();
    } catch (error) { toastError(error); }
    finally { setSending(false); }
  };
  const remove = async sticker => {
    try {
      await api.delete(`/stickers/${sticker.id}`);
      setStickers(current => current.filter(item => item.id !== sticker.id));
      toast.success("Figurinha removida da biblioteca.");
    } catch (error) { toastError(error); }
  };
  if (!open) return null;
  return (
    <Paper className={classes.panel} role="dialog" aria-label="Biblioteca de figurinhas">
      <div className={classes.header}>
        <div className={classes.search}><SearchIcon fontSize="small" /><InputBase value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar figurinhas" fullWidth /></div>
        <IconButton size="small" onClick={onClose} aria-label="Fechar figurinhas"><CloseIcon /></IconButton>
      </div>
      <div className={classes.grid}>
        {loading && <div className={classes.empty}><CircularProgress size={24} /></div>}
        {!loading && visible.length === 0 && <Typography className={classes.empty} variant="body2" color="textSecondary">Salve uma figurinha recebida para ela aparecer aqui.</Typography>}
        {!loading && visible.map(sticker => <StickerTile key={sticker.id} sticker={sticker} sending={sending} onSend={send} onDelete={remove} canDelete={user?.profile === "admin" || sticker.createdByUserId === Number(user?.id)} />)}
      </div>
    </Paper>
  );
}
