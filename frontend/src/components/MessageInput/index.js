import React, { useState, useEffect, useContext, useRef, lazy, Suspense } from "react";
import "emoji-mart/css/emoji-mart.css";
import { useParams } from "react-router-dom";
const Picker = lazy(() => import("emoji-mart").then(module => ({
  default: module.Picker
})));
import { toast } from "react-toastify";
import { readDraft, writeDraft, messageAttempt, finishMessageAttempt } from "../../services/messageDrafts";
import clsx from "clsx";
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoreHorizIcon from "@material-ui/icons/MoreHoriz";
import QuickReplyIcon from "@material-ui/icons/ReplyAll";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import StopIcon from "@material-ui/icons/Stop";
import CollectionsBookmarkIcon from "@material-ui/icons/CollectionsBookmark";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import { FormControlLabel, Menu, MenuItem, Popover, Switch, Tooltip } from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import RecordingTimer from "./RecordingTimer";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import toastError from "../../errors/toastError";
import MediaPreviewQueue from "../MediaPreviewQueue";
import StickerPicker from "../StickerPicker";
import { selectMediaFiles } from "../../services/mediaComposer";
import { createAudioRecorder, audioErrorMessage } from "../../services/audioRecorder";
const mediaSignature = files => JSON.stringify(files.map(file => [file.name, file.size, file.lastModified]));
const useStyles = makeStyles(theme => ({
  mainWrapper: {
    position: "relative",
    background: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    padding: "0 12px 12px",
    borderTop: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    [theme.breakpoints.down("sm")]: {
      position: "relative",
      flexShrink: 0,
      width: "100%"
    }
  },
  composerLabel: {
    alignSelf: "flex-start",
    padding: "10px 2px 8px",
    fontSize: 11,
    fontWeight: 550
  },
  newMessageBox: {
    background: theme.modeTokens.surfaceMuted,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "8px 8px 6px",
    borderRadius: 10,
    border: `1px solid ${theme.palette.divider}`,
    "&:focus-within": {
      borderColor: theme.modeTokens.focus
    }
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 1,
    width: "100%",
    "& .MuiIconButton-root": {
      padding: 8
    }
  },
  toolbarSpacer: {
    flex: 1
  },
  sendButton: {
    color: theme.palette.primary.contrastText,
    background: theme.palette.primary.main,
    "&:hover": {
      background: theme.palette.primary.dark
    },
    "&.Mui-disabled": {
      background: theme.modeTokens.surfaceRaised
    }
  },
  messageInputWrapper: {
    display: "flex",
    minWidth: 0,
    position: "relative"
  },
  messageInput: {
    padding: "3px 6px 10px",
    flex: 1,
    fontSize: 13,
    lineHeight: 1.65
  },
  sendMessageIcons: {
    color: theme.palette.text.secondary,
    "&:hover": {
      color: theme.palette.primary.main,
      background: theme.modeTokens.surfaceTint
    }
  },
  uploadInput: {
    display: "none"
  },
  viewMediaInputWrapper: {
    display: "flex",
    padding: "10px 13px",
    position: "relative",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`
  },
  emojiBox: {
    borderRadius: 12,
    border: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    "& .emoji-mart": {
      border: 0,
      background: "transparent",
      maxWidth: "100%",
      color: theme.palette.text.primary
    },
    "& .emoji-mart-category-label span": {
      background: theme.palette.background.paper,
      color: theme.palette.text.secondary
    },
    "& .emoji-mart-search input": {
      background: theme.modeTokens.surfaceMuted,
      color: theme.palette.text.primary,
      borderColor: theme.palette.divider
    }
  },
  circleLoading: {
    color: green[500],
    opacity: "70%",
    position: "absolute",
    top: "20%",
    left: "50%",
    marginLeft: -12
  },
  audioLoading: {
    color: green[500],
    opacity: "70%"
  },
  recorderWrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 80,
    minWidth: 0
  },
  audioPreview: {
    width: "100%",
    minWidth: 0,
    height: 38
  },
  cancelAudioIcon: {
    color: theme.palette.error.main
  },
  sendAudioIcon: {
    color: theme.palette.primary.main
  },
  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 0,
    paddingRight: 7
  },
  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: theme.modeTokens.surfaceMuted,
    borderRadius: 10,
    display: "flex",
    position: "relative"
  },
  replyginMsgBody: {
    padding: 10,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden"
  },
  replyginContactMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96"
  },
  replyginSelfMsgSideColor: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef"
  },
  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500
  },
  messageQuickAnswersWrapper: {
    margin: 0,
    position: "absolute",
    bottom: "100%",
    zIndex: 10,
    maxHeight: 240,
    overflowY: "auto",
    background: theme.palette.background.paper,
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    boxShadow: theme.productTokens.shadows.raised,
    left: 0,
    width: "100%",
    "& li": {
      listStyle: "none",
      "& button": {
        border: 0,
        width: "100%",
        textAlign: "left",
        background: "transparent",
        color: "inherit",
        font: "inherit",
        display: "block",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "32px",
        "&:hover": {
          background: theme.modeTokens.surfaceMuted,
          cursor: "pointer"
        }
      }
    }
  }
}));
const MessageInput = ({
  ticketStatus,
  sendBlocked,
  droppedFiles = [],
  onDroppedFilesHandled
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const emojiButtonRef = useRef(null);
  const fileInputRef = useRef(null);
  const recorderRef = useRef(null);
  if (!recorderRef.current) recorderRef.current = createAudioRecorder();
  const mounted = useRef(true);
  const {
    ticketId
  } = useParams();
  const [medias, setMedias] = useState([]);
  const {
    user
  } = useContext(AuthContext);
  const draftKey = `${user?.id}:${ticketId}`;
  const [inputMessage, setInputRaw] = useState(() => readDraft(draftKey));
  const setInputMessage = value => setInputRaw(previous => {
    const next = typeof value === "function" ? value(previous) : value;
    writeDraft(draftKey, next);
    return next;
  });
  const submit = async (payload, signature, requestConfig = {}) => {
    const response = await api.post(`/messages/${ticketId}`, payload, {
      ...requestConfig,
      headers: {
        ...requestConfig.headers,
        "Idempotency-Key": messageAttempt(draftKey, signature)
      }
    });
    if (response.status === 202) toast.info("Mensagem na fila. Não é necessário reenviar; acompanhe a entrega no histórico.");
    finishMessageAttempt(draftKey);
    return response;
  };
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [quickAnswers, setQuickAnswer] = useState([]);
  const [typeBar, setTypeBar] = useState(false);
  const inputRef = useRef();
  const [anchorEl, setAnchorEl] = useState(null);
  const {
    setReplyingMessage,
    replyingMessage
  } = useContext(ReplyMessageContext);
  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);
  useEffect(() => {
    inputRef.current?.focus();
  }, [replyingMessage]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      recorderRef.current.cancel();
    };
  }, []);
  useEffect(() => () => {
    if (recordedAudio?.url) URL.revokeObjectURL(recordedAudio.url);
  }, [recordedAudio]);
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      setShowEmoji(false);
      setShowStickers(false);
      setMedias([]);
      setRecordedAudio(null);
      setReplyingMessage(null);
    };
  }, [ticketId, setReplyingMessage]);
  const handleChangeInput = e => {
    setInputMessage(e.target.value);
    handleLoadQuickAnswer(e.target.value);
  };
  const handleQuickAnswersClick = value => {
    setInputMessage(value);
    setTypeBar(false);
  };
  const handleAddEmoji = e => {
    const emoji = e.native;
    const start = inputRef.current?.selectionStart ?? inputMessage.length;
    const end = inputRef.current?.selectionEnd ?? start;
    setInputMessage(value => value.slice(0, start) + emoji + value.slice(end));
    setShowEmoji(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };
  const addMedias = files => {
    if (!files?.length) return;
    setMedias(current => {
      const result = selectMediaFiles(current, files);
      if (result.rejected.length) toast.warn(`${result.rejected.length} arquivo${result.rejected.length === 1 ? " não foi aceito" : "s não foram aceitos"}: ${result.rejected[0].reason}`);
      return result.accepted;
    });
  };
  const handleChangeMedias = e => {
    addMedias(Array.from(e.target.files || []));
    e.target.value = "";
  };
  const handleInputPaste = e => {
    if (e.clipboardData.files[0]) {
      addMedias(Array.from(e.clipboardData.files));
    }
  };
  useEffect(() => {
    if (!droppedFiles.length) return;
    addMedias(droppedFiles);
    if (onDroppedFilesHandled) onDroppedFilesHandled();
    // The parent replaces this array for each drop operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFiles]);
  const handleUploadMedia = async e => {
    if (loading || sendBlocked || ticketStatus !== "open") return;
    setLoading(true);
    setUploadProgress(0);
    e.preventDefault();
    const formData = new FormData();
    formData.append("fromMe", true);
    medias.forEach(media => {
      formData.append("medias", media);
      formData.append("body", media.name);
    });
    try {
      await submit(formData, mediaSignature(medias), {
        onUploadProgress: event => {
          if (event.total) setUploadProgress(Math.round(event.loaded * 100 / event.total));
        }
      });
      setMedias([]);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
    setUploadProgress(0);
  };
  const handleSendMessage = async () => {
    if (inputMessage.trim() === "" || loading || sendBlocked || ticketStatus !== "open") return;
    setLoading(true);
    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage ? `*${user?.name}:*\n${inputMessage.trim()}` : inputMessage.trim(),
      quotedMsg: replyingMessage
    };
    try {
      await submit(message, JSON.stringify(message));
    } catch (err) {
      toastError(err);
      setLoading(false);
      return;
    }
    setInputMessage("");
    setShowEmoji(false);
    setLoading(false);
    setReplyingMessage(null);
  };
  const handleStartRecording = async () => {
    if (loading || recording || recordedAudio || sendBlocked || ticketStatus !== "open") return;
    setLoading(true);
    setShowEmoji(false);
    setShowStickers(false);
    try {
      await recorderRef.current.start();
      if (mounted.current) setRecording(true);
    } catch (err) {
      if (mounted.current && err.code !== "AUDIO_CANCELLED") {
        console.warn("[audio] Could not start recording", err.stack || err.message);
        toast.error(audioErrorMessage(err));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  const handleLoadQuickAnswer = async value => {
    if (value && value.indexOf("/") === 0) {
      try {
        const {
          data
        } = await api.get("/quickAnswers/", {
          params: {
            searchParam: value.substring(1)
          }
        });
        setQuickAnswer(data.quickAnswers);
        if (data.quickAnswers.length > 0) {
          setTypeBar(true);
        } else {
          setTypeBar(false);
        }
      } catch (err) {
        setTypeBar(false);
      }
    } else {
      setTypeBar(false);
    }
  };
  const handleStopRecording = async () => {
    if (loading || !recording) return;
    setLoading(true);
    try {
      const file = await recorderRef.current.finish();
      if (mounted.current) setRecordedAudio({
        file,
        url: URL.createObjectURL(file)
      });
    } catch (err) {
      if (mounted.current) toast.error(audioErrorMessage(err));
    } finally {
      if (mounted.current) {
        setRecording(false);
        setLoading(false);
      }
    }
  };
  const handleUploadAudio = async () => {
    if (!recordedAudio || loading || sendBlocked || ticketStatus !== "open") return;
    setLoading(true);
    const formData = new FormData();
    formData.append("medias", recordedAudio.file);
    formData.append("body", recordedAudio.file.name);
    formData.append("fromMe", true);
    try {
      await submit(formData, mediaSignature([recordedAudio.file]));
      setRecordedAudio(null);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };
  const handleCancelAudio = async () => {
    recorderRef.current.cancel();
    setRecordedAudio(null);
    setRecording(false);
  };
  const handleOpenMenuClick = event => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuItemClick = () => {
    setAnchorEl(null);
  };
  const renderReplyingMessage = message => {
    return <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span className={clsx(classes.replyginContactMsgSideColor, {
          [classes.replyginSelfMsgSideColor]: !message.fromMe
        })}></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>}
            {message.body}
          </div>
        </div>
        <IconButton aria-label="Cancelar resposta à mensagem" component="button" disabled={loading || ticketStatus !== "open" || sendBlocked} onClick={() => setReplyingMessage(null)}>
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>;
  };
  const composerDisabled = loading || recording || !!recordedAudio || ticketStatus !== "open" || sendBlocked;
  const openQuickAnswers = () => {
    setInputMessage("/");
    handleLoadQuickAnswer("/");
    inputRef.current?.focus();
  };
  if (medias.length > 0) return <MediaPreviewQueue files={medias} loading={loading} progress={uploadProgress} onAdd={addMedias} onRemove={index => setMedias(current => current.filter((_, itemIndex) => itemIndex !== index))} onClear={() => setMedias([])} onSend={handleUploadMedia} />;
  return <Paper square elevation={0} className={classes.mainWrapper}>
      {replyingMessage && renderReplyingMessage(replyingMessage)}
      <span className={classes.composerLabel}>{recording ? "Gravando áudio" : recordedAudio ? "Ouça antes de enviar" : "Responder"}</span>
      <Popover id="composer-emojis" open={showEmoji} anchorEl={emojiButtonRef.current} onClose={() => {
      setShowEmoji(false);
      emojiButtonRef.current?.focus();
    }} anchorOrigin={{
      vertical: "top",
      horizontal: "left"
    }} transformOrigin={{
      vertical: "bottom",
      horizontal: "left"
    }} classes={{
      paper: classes.emojiBox
    }} PaperProps={{
      role: "dialog",
      "aria-label": "Escolher emoji"
    }} disableRestoreFocus>
        <Suspense fallback={<div style={{
        width: 340,
        height: 320,
        padding: 16
      }}>Carregando emojis…</div>}>
          <Picker native autoFocus perLine={8} showPreview={false} showSkinTones={false} theme={theme.palette.type} onSelect={handleAddEmoji} style={{
          width: 340,
          height: 320,
          maxWidth: "calc(100vw - 24px)"
        }} i18n={{
          search: "Pesquisar emojis",
          notfound: "Nenhum emoji encontrado",
          categories: {
            search: "Resultados",
            recent: "Recentes",
            people: "Rostos e pessoas",
            nature: "Animais e natureza",
            foods: "Comidas e bebidas",
            activity: "Atividades",
            places: "Viagens e lugares",
            objects: "Objetos",
            symbols: "Símbolos",
            flags: "Bandeiras",
            custom: "Personalizados"
          }
        }} />
        </Suspense>
      </Popover>
      <StickerPicker open={showStickers} onClose={() => setShowStickers(false)} ticketId={ticketId} />
      <div className={classes.newMessageBox}>
        <input multiple type="file" ref={fileInputRef} className={classes.uploadInput} disabled={composerDisabled} onChange={handleChangeMedias} />
        {recording ? <div className={classes.recorderWrapper}>
            <IconButton aria-label="Cancelar gravação" disabled={loading} onClick={handleCancelAudio}><HighlightOffIcon className={classes.cancelAudioIcon} /></IconButton>
            {loading ? <CircularProgress size={24} /> : <RecordingTimer />}
            <Tooltip title="Concluir gravação"><span><IconButton aria-label="Concluir gravação" onClick={handleStopRecording} disabled={loading}><StopIcon className={classes.sendAudioIcon} /></IconButton></span></Tooltip>
          </div> : recordedAudio ? <div className={classes.recorderWrapper}>
            <Tooltip title="Descartar áudio"><span><IconButton aria-label="Descartar áudio" disabled={loading} onClick={handleCancelAudio}><HighlightOffIcon className={classes.cancelAudioIcon} /></IconButton></span></Tooltip>
            <audio className={classes.audioPreview} src={recordedAudio.url} controls preload="metadata" aria-label="Prévia do áudio gravado" />
            <Tooltip title="Enviar áudio"><span><IconButton aria-label="Enviar áudio gravado" disabled={loading || sendBlocked || ticketStatus !== "open"} onClick={handleUploadAudio}>
              {loading ? <CircularProgress size={20} /> : <CheckCircleOutlineIcon className={classes.sendAudioIcon} />}
            </IconButton></span></Tooltip>
          </div> : <>
            <div className={classes.messageInputWrapper}>
              <InputBase inputRef={inputRef} inputProps={{
            "aria-label": "Mensagem para o paciente"
          }} className={classes.messageInput} placeholder={sendBlocked ? "Envio indisponível — consulte Contexto" : ticketStatus === "open" ? "Digite sua mensagem…" : i18n.t("messagesInput.placeholderClosed")} multiline minRows={2} maxRows={5} value={inputMessage} onChange={handleChangeInput} disabled={composerDisabled} onPaste={e => {
            if (!composerDisabled) handleInputPaste(e);
          }} onKeyPress={e => {
            if (loading || e.shiftKey || e.nativeEvent.isComposing) return;
            if (e.key === "Enter") {
              e.preventDefault();
              handleSendMessage();
            }
          }} />
              {typeBar && <ul className={classes.messageQuickAnswersWrapper} aria-label="Respostas rápidas">
                {quickAnswers.map(value => <li className={classes.messageQuickAnswersWrapperItem} key={value.id || value.shortcut}>
                  <button type="button" onClick={() => handleQuickAnswersClick(value.message)}>{value.shortcut} - {value.message}</button>
                </li>)}
              </ul>}
            </div>
            <div className={classes.toolbar}>
              <Tooltip title="Emojis"><span><IconButton ref={emojiButtonRef} aria-label="Adicionar emoji" aria-haspopup="dialog" aria-expanded={showEmoji} aria-controls={showEmoji ? "composer-emojis" : undefined} disabled={composerDisabled} onClick={() => {
                setShowStickers(false);
                setShowEmoji(true);
              }}><MoodIcon /></IconButton></span></Tooltip>
              <Tooltip title="Anexar arquivo · ou arraste para a conversa"><span><IconButton aria-label="Anexar arquivo" disabled={composerDisabled} onClick={() => fileInputRef.current?.click()}><AttachFileIcon /></IconButton></span></Tooltip>
              <Tooltip title="Figurinhas salvas"><span><IconButton aria-label="Abrir biblioteca de figurinhas" disabled={composerDisabled} onClick={() => {
                setShowEmoji(false);
                setShowStickers(current => !current);
              }}><CollectionsBookmarkIcon /></IconButton></span></Tooltip>
              <Tooltip title="Resposta rápida"><span><IconButton aria-label="Inserir resposta rápida" disabled={composerDisabled} onClick={openQuickAnswers}><QuickReplyIcon /></IconButton></span></Tooltip>
              <Tooltip title="Opções da mensagem"><span><IconButton aria-label="Opções da mensagem" aria-controls="composer-menu" aria-haspopup="true" aria-expanded={Boolean(anchorEl)} onClick={handleOpenMenuClick} disabled={composerDisabled}><MoreHorizIcon /></IconButton></span></Tooltip>
              <Menu id="composer-menu" anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuItemClick}>
                <MenuItem><FormControlLabel label={i18n.t("messagesInput.signMessage")} control={<Switch size="small" checked={signMessage} onChange={event => setSignMessage(event.target.checked)} color="primary" />} /></MenuItem>
              </Menu>
              <div className={classes.toolbarSpacer} />
              <Tooltip title="Gravar áudio"><span><IconButton aria-label="Gravar áudio" disabled={composerDisabled} onClick={handleStartRecording}>{loading && !inputMessage ? <CircularProgress size={20} /> : <MicIcon />}</IconButton></span></Tooltip>
              <Tooltip title="Enviar mensagem · Enter"><span><IconButton className={classes.sendButton} aria-label="Enviar mensagem" onClick={handleSendMessage} disabled={composerDisabled || !inputMessage.trim()}><SendIcon /></IconButton></span></Tooltip>
            </div>
          </>}
      </div>
    </Paper>;
};
export default MessageInput;
