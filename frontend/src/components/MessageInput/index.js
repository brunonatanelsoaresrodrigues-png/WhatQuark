import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  lazy,
  Suspense
} from "react";
import "emoji-mart/css/emoji-mart.css";
import { useParams } from "react-router-dom";
const Picker = lazy(() =>
  import("emoji-mart").then(module => ({ default: module.Picker }))
);
import { toast } from "react-toastify";
import {
  readDraft,
  writeDraft,
  messageAttempt,
  finishMessageAttempt
} from "../../services/messageDrafts";
import clsx from "clsx";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import CircularProgress from "@material-ui/core/CircularProgress";
import { green } from "@material-ui/core/colors";
import AttachFileIcon from "@material-ui/icons/AttachFile";
import IconButton from "@material-ui/core/IconButton";
import MoreVert from "@material-ui/icons/MoreVert";
import MoodIcon from "@material-ui/icons/Mood";
import SendIcon from "@material-ui/icons/Send";
import ClearIcon from "@material-ui/icons/Clear";
import MicIcon from "@material-ui/icons/Mic";
import StopIcon from "@material-ui/icons/Stop";
import CollectionsBookmarkIcon from "@material-ui/icons/CollectionsBookmark";
import CheckCircleOutlineIcon from "@material-ui/icons/CheckCircleOutline";
import HighlightOffIcon from "@material-ui/icons/HighlightOff";
import {
  FormControlLabel,
  Hidden,
  Menu,
  MenuItem,
  Switch,
  Tooltip
} from "@material-ui/core";
import ClickAwayListener from "@material-ui/core/ClickAwayListener";

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

let Mp3Recorder = null;
const mediaSignature = files =>
  JSON.stringify(files.map(file => [file.name, file.size, file.lastModified]));

const initRecorder = async () => {
  if (!Mp3Recorder) {
    try {
      const MicRecorder = (await import("mic-recorder-to-mp3")).default;
      Mp3Recorder = new MicRecorder({ bitRate: 128 });
    } catch (error) {
      console.error("Failed to initialize recorder:", error);
      return null;
    }
  }
  return Mp3Recorder;
};

const useStyles = makeStyles(theme => ({
  mainWrapper: {
    position: "relative",
    background: theme.palette.background.paper,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    [theme.breakpoints.down("sm")]: {
      position: "relative",
      flexShrink: 0,
      width: "100%"
    }
  },

  newMessageBox: {
    background: theme.palette.background.paper,
    width: "100%",
    display: "flex",
    padding: "7px",
    alignItems: "center"
  },

  messageInputWrapper: {
    padding: 6,
    marginRight: 7,
    background: theme.palette.background.default,
    display: "flex",
    borderRadius: 20,
    flex: 1,
    minWidth: 0,
    position: "relative"
  },

  messageInput: {
    paddingLeft: 10,
    flex: 1,
    border: "none"
  },

  sendMessageIcons: {
    color: theme.palette.text.secondary
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
    borderTop: "1px solid rgba(0, 0, 0, 0.12)"
  },

  emojiBox: {
    position: "absolute",
    bottom: 63,
    left: 8,
    zIndex: 5,
    maxWidth: "calc(100% - 16px)",
    overflowX: "auto"
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
    alignContent: "middle",
    minWidth: 0
  },

  audioPreview: {
    width: 230,
    maxWidth: "42vw",
    height: 38
  },

  cancelAudioIcon: {
    color: "red"
  },

  sendAudioIcon: {
    color: "green"
  },

  replyginMsgWrapper: {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingLeft: 73,
    paddingRight: 7
  },

  replyginMsgContainer: {
    flex: 1,
    marginRight: 5,
    overflowY: "hidden",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: "7.5px",
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
    bottom: "50px",
    background: theme.palette.background.paper,
    padding: "2px",
    border: "1px solid #CCC",
    left: 0,
    width: "100%",
    "& li": {
      listStyle: "none",
      "& a": {
        display: "block",
        padding: "8px",
        textOverflow: "ellipsis",
        overflow: "hidden",
        maxHeight: "32px",
        "&:hover": {
          background: "#F1F1F1",
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
  const { ticketId } = useParams();

  const [medias, setMedias] = useState([]);
  const { user } = useContext(AuthContext);
  const draftKey = `${user?.id}:${ticketId}`;
  const [inputMessage, setInputRaw] = useState(() => readDraft(draftKey));
  const setInputMessage = value =>
    setInputRaw(previous => {
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
    if (response.status === 202)
      toast.info(
        "Mensagem na fila. Não é necessário reenviar; acompanhe a entrega no histórico."
      );
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
  const { setReplyingMessage, replyingMessage } =
    useContext(ReplyMessageContext);

  const [signMessage, setSignMessage] = useLocalStorage("signOption", true);

  useEffect(() => {
    inputRef.current?.focus();
  }, [replyingMessage]);
  useEffect(
    () => () => {
      try {
        if (Mp3Recorder) Mp3Recorder.stop();
      } catch (_) {
        // The recorder may already be stopped by the user.
      }
    },
    []
  );
  useEffect(
    () => () => {
      if (recordedAudio?.url) URL.revokeObjectURL(recordedAudio.url);
    },
    [recordedAudio]
  );

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
    let emoji = e.native;
    setInputMessage(prevState => prevState + emoji);
  };

  const addMedias = files => {
    if (!files?.length) return;
    setMedias(current => {
      const result = selectMediaFiles(current, files);
      if (result.rejected.length)
        toast.warn(
          `${result.rejected.length} arquivo${
            result.rejected.length === 1 ? " não foi aceito" : "s não foram aceitos"
          }: ${result.rejected[0].reason}`
        );
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
          if (event.total)
            setUploadProgress(Math.round((event.loaded * 100) / event.total));
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
    if (inputMessage.trim() === "" || loading || sendBlocked) return;
    setLoading(true);

    const message = {
      read: 1,
      fromMe: true,
      mediaUrl: "",
      body: signMessage
        ? `*${user?.name}:*\n${inputMessage.trim()}`
        : inputMessage.trim(),
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
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        audio: true
      });
      permissionStream.getTracks().forEach(track => track.stop());
      await recorder.start();
      setRecording(true);
      setLoading(false);
    } catch (err) {
      if (["NotAllowedError", "PermissionDeniedError"].includes(err?.name))
        toast.error(
          "Permita o acesso ao microfone no navegador para gravar áudio."
        );
      else toastError(err);
      setLoading(false);
    }
  };

  const handleLoadQuickAnswer = async value => {
    if (value && value.indexOf("/") === 0) {
      try {
        const { data } = await api.get("/quickAnswers/", {
          params: { searchParam: value.substring(1) }
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
    setLoading(true);
    try {
      const recorder = await initRecorder();
      if (!recorder) {
        throw new Error("Recorder not available");
      }
      const [, blob] = await recorder.stop().getMp3();
      if (blob.size < 10000) {
        toast.warn("O áudio ficou muito curto. Grave novamente.");
        setLoading(false);
        setRecording(false);
        return;
      }
      const filename = `${new Date().getTime()}.mp3`;
      const audioFile = new File([blob], filename, { type: "audio/mpeg" });
      setRecordedAudio({ blob, file: audioFile, url: URL.createObjectURL(blob) });
    } catch (err) {
      toastError(err);
    }
    setRecording(false);
    setLoading(false);
  };

  const handleUploadAudio = async () => {
    if (!recordedAudio || loading) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("medias", recordedAudio.blob, recordedAudio.file.name);
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
    try {
      if (recording) {
        const recorder = await initRecorder();
        if (recorder) await recorder.stop().getMp3();
      }
      if (recordedAudio?.url) {
        URL.revokeObjectURL(recordedAudio.url);
        setRecordedAudio(null);
      }
      setRecording(false);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenMenuClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuItemClick = () => {
    setAnchorEl(null);
  };

  const renderReplyingMessage = message => {
    return (
      <div className={classes.replyginMsgWrapper}>
        <div className={classes.replyginMsgContainer}>
          <span
            className={clsx(classes.replyginContactMsgSideColor, {
              [classes.replyginSelfMsgSideColor]: !message.fromMe
            })}
          ></span>
          <div className={classes.replyginMsgBody}>
            {!message.fromMe && (
              <span className={classes.messageContactName}>
                {message.contact?.name}
              </span>
            )}
            {message.body}
          </div>
        </div>
        <IconButton
          aria-label="Gravar áudio"
          component="button"
          disabled={loading || ticketStatus !== "open" || sendBlocked}
          onClick={() => setReplyingMessage(null)}
        >
          <ClearIcon className={classes.sendMessageIcons} />
        </IconButton>
      </div>
    );
  };

  if (medias.length > 0)
    return (
      <MediaPreviewQueue
        files={medias}
        loading={loading}
        progress={uploadProgress}
        onAdd={addMedias}
        onRemove={index =>
          setMedias(current => current.filter((_, itemIndex) => itemIndex !== index))
        }
        onClear={() => setMedias([])}
        onSend={handleUploadMedia}
      />
    );
  else {
    return (
      <Paper square elevation={0} className={classes.mainWrapper}>
        {replyingMessage && renderReplyingMessage(replyingMessage)}
        {showEmoji ? (
          <div className={classes.emojiBox}>
            <ClickAwayListener onClickAway={() => setShowEmoji(false)}>
              <Suspense fallback={<span>Carregando emojis…</span>}>
                <Picker
                  perLine={8}
                  showPreview={false}
                  showSkinTones={false}
                  onSelect={handleAddEmoji}
                />
              </Suspense>
            </ClickAwayListener>
          </div>
        ) : null}
        <StickerPicker
          open={showStickers}
          onClose={() => setShowStickers(false)}
          ticketId={ticketId}
        />
        <div className={classes.newMessageBox}>
          <Hidden only={["sm", "xs"]}>
            <IconButton
              aria-label="Inserir emoji"
              component="button"
              disabled={
                loading || recording || ticketStatus !== "open" || sendBlocked
              }
              onClick={() => setShowEmoji(prevState => !prevState)}
            >
              <MoodIcon className={classes.sendMessageIcons} />
            </IconButton>

            <input
              multiple
              type="file"
              id="upload-button"
              disabled={
                loading || recording || ticketStatus !== "open" || sendBlocked
              }
              className={classes.uploadInput}
              onChange={handleChangeMedias}
            />
            <label htmlFor="upload-button">
              <IconButton
                aria-label="Anexar arquivo"
                component="span"
                disabled={
                  loading || recording || ticketStatus !== "open" || sendBlocked
                }
              >
                <AttachFileIcon className={classes.sendMessageIcons} />
              </IconButton>
            </label>
            <FormControlLabel
              style={{ marginRight: 7, color: "gray" }}
              label={i18n.t("messagesInput.signMessage")}
              labelPlacement="start"
              control={
                <Switch
                  size="small"
                  checked={signMessage}
                  onChange={e => {
                    setSignMessage(e.target.checked);
                  }}
                  name="showAllTickets"
                  color="primary"
                />
              }
            />
          </Hidden>
          <Hidden only={["md", "lg", "xl"]}>
            <IconButton
              aria-label="Opções da mensagem"
              aria-controls="simple-menu"
              aria-haspopup="true"
              onClick={handleOpenMenuClick}
            >
              <MoreVert></MoreVert>
            </IconButton>
            <Menu
              id="simple-menu"
              keepMounted
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuItemClick}
            >
              <MenuItem onClick={handleMenuItemClick}>
                <IconButton
                  aria-label="Inserir emoji"
                  component="button"
                  disabled={
                    loading ||
                    recording ||
                    ticketStatus !== "open" ||
                    sendBlocked
                  }
                  onClick={() => setShowEmoji(prevState => !prevState)}
                >
                  <MoodIcon className={classes.sendMessageIcons} />
                </IconButton>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <input
                  multiple
                  type="file"
                  id="upload-button-mobile"
                  disabled={
                    loading ||
                    recording ||
                    ticketStatus !== "open" ||
                    sendBlocked
                  }
                  className={classes.uploadInput}
                  onChange={handleChangeMedias}
                />
                <label htmlFor="upload-button-mobile">
                  <IconButton
                    aria-label="Anexar arquivo"
                    component="span"
                    disabled={
                      loading ||
                      recording ||
                      ticketStatus !== "open" ||
                      sendBlocked
                    }
                  >
                    <AttachFileIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </label>
              </MenuItem>
              <MenuItem onClick={handleMenuItemClick}>
                <FormControlLabel
                  style={{ marginRight: 7, color: "gray" }}
                  label={i18n.t("messagesInput.signMessage")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={signMessage}
                      onChange={e => {
                        setSignMessage(e.target.checked);
                      }}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              </MenuItem>
            </Menu>
          </Hidden>
          <Tooltip title="Figurinhas salvas">
            <span>
              <IconButton
                aria-label="Abrir biblioteca de figurinhas"
                component="button"
                disabled={
                  loading || recording || ticketStatus !== "open" || sendBlocked
                }
                onClick={() => {
                  setShowEmoji(false);
                  setShowStickers(current => !current);
                }}
              >
                <CollectionsBookmarkIcon className={classes.sendMessageIcons} />
              </IconButton>
            </span>
          </Tooltip>
          <div className={classes.messageInputWrapper}>
            <InputBase
              inputRef={inputRef}
              inputProps={{ "aria-label": "Mensagem para o paciente" }}
              className={classes.messageInput}
              placeholder={
                sendBlocked
                  ? "Envio indisponível — consulte Contexto"
                  : ticketStatus === "open"
                  ? "Escreva uma mensagem…"
                  : i18n.t("messagesInput.placeholderClosed")
              }
              multiline
              maxRows={5}
              value={inputMessage}
              onChange={handleChangeInput}
              disabled={
                recording || loading || ticketStatus !== "open" || sendBlocked
              }
              onPaste={e => {
                ticketStatus === "open" && handleInputPaste(e);
              }}
              onKeyPress={e => {
                if (loading || e.shiftKey || e.nativeEvent.isComposing) return;
                else if (e.key === "Enter") {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            {typeBar ? (
              <ul className={classes.messageQuickAnswersWrapper}>
                {quickAnswers.map((value, index) => {
                  return (
                    <li
                      className={classes.messageQuickAnswersWrapperItem}
                      key={index}
                    >
                      <a onClick={() => handleQuickAnswersClick(value.message)}>
                        {`${value.shortcut} - ${value.message}`}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div></div>
            )}
          </div>
          {recording ? (
            <div className={classes.recorderWrapper}>
              <IconButton
                aria-label="Cancelar gravação"
                component="button"
                fontSize="large"
                disabled={loading}
                onClick={handleCancelAudio}
              >
                <HighlightOffIcon className={classes.cancelAudioIcon} />
              </IconButton>
              {loading ? (
                <div>
                  <CircularProgress className={classes.audioLoading} />
                </div>
              ) : (
                <RecordingTimer />
              )}

              <IconButton
                aria-label="Concluir gravação"
                component="button"
                onClick={handleStopRecording}
                disabled={loading}
              >
                <StopIcon className={classes.sendAudioIcon} />
              </IconButton>
            </div>
          ) : recordedAudio ? (
            <div className={classes.recorderWrapper}>
              <Tooltip title="Descartar áudio">
                <IconButton aria-label="Descartar áudio" disabled={loading} onClick={handleCancelAudio}>
                  <HighlightOffIcon className={classes.cancelAudioIcon} />
                </IconButton>
              </Tooltip>
              <audio className={classes.audioPreview} src={recordedAudio.url} controls preload="metadata" />
              <Tooltip title="Enviar áudio">
                <IconButton aria-label="Enviar áudio gravado" disabled={loading} onClick={handleUploadAudio}>
                  {loading ? <CircularProgress size={20} /> : <CheckCircleOutlineIcon className={classes.sendAudioIcon} />}
                </IconButton>
              </Tooltip>
            </div>
          ) : (
            <>
              <Tooltip title="Gravar e enviar áudio">
                <span>
                  <IconButton
                    aria-label="Gravar áudio"
                    component="button"
                    disabled={loading || ticketStatus !== "open" || sendBlocked}
                    onClick={handleStartRecording}
                  >
                    <MicIcon className={classes.sendMessageIcons} />
                  </IconButton>
                </span>
              </Tooltip>
              {inputMessage && (
                <Tooltip title="Enviar mensagem">
                  <span>
                    <IconButton
                      aria-label="Enviar mensagem"
                      component="button"
                      onClick={handleSendMessage}
                      disabled={loading || sendBlocked || ticketStatus !== "open"}
                    >
                      <SendIcon className={classes.sendMessageIcons} />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </Paper>
    );
  }
};

export default MessageInput;
