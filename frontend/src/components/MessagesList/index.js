import React, { useState, useEffect, useReducer, useRef } from "react";
import { isSameDay, parseISO, format } from "date-fns";
import openSocket from "../../services/socket-io";
import clsx from "clsx";
import { green } from "@material-ui/core/colors";
import { CircularProgress, IconButton, makeStyles } from "@material-ui/core";
import { AccessTime, Block, Done, DoneAll, ExpandMore } from "@material-ui/icons";
import MarkdownWrapper from "../MarkdownWrapper";
import VcardPreview from "../VcardPreview";
import LocationPreview from "../LocationPreview";
import ProtectedMedia from "../ProtectedMedia";
import {
  isStickerMessage,
  shouldRenderMessageBody
} from "../../services/mediaComposer";
import MessageOptionsMenu from "../MessageOptionsMenu";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import PageSkeleton from "../PageSkeleton";
const useStyles = makeStyles(theme => ({
  "@keyframes arrive": {
    from: {
      opacity: 0,
      transform: "translateY(3px)"
    },
    to: {
      opacity: 1,
      transform: "translateY(0)"
    }
  },
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    background: theme.modeTokens.conversation
  },
  messagesList: {
    backgroundColor: theme.modeTokens.conversation,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "12px clamp(12px, 1.4vw, 22px)",
    overflowY: "scroll",
    [theme.breakpoints.down("sm")]: {
      padding: "16px 10px"
    },
    ...theme.scrollbarStyles
  },
  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12
  },
  messageLeft: {
    animation: "$arrive 160ms ease-out",
    marginRight: 20,
    marginTop: 3,
    minWidth: 100,
    maxWidth: "min(82%, 680px)",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover $messageActionsButton, &:focus-within $messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.modeTokens.messageIncoming,
    color: theme.palette.text.primary,
    alignSelf: "flex-start",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    fontSize: 13,
    lineHeight: 1.6,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 7,
    paddingBottom: 0,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none",
    [theme.breakpoints.down("xs")]: {
      maxWidth: "88%"
    }
  },
  quotedContainerLeft: {
    margin: "0 0 6px",
    overflow: "hidden",
    backgroundColor: theme.palette.action.hover,
    borderRadius: "7.5px",
    display: "flex",
    position: "relative"
  },
  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden"
  },
  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef"
  },
  messageRight: {
    animation: "$arrive 160ms ease-out",
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: "min(82%, 680px)",
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover $messageActionsButton, &:focus-within $messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0
    },
    whiteSpace: "pre-wrap",
    backgroundColor: theme.modeTokens.messageOutgoing,
    color: theme.palette.text.primary,
    alignSelf: "flex-end",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 10,
    fontSize: 13,
    lineHeight: 1.6,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 7,
    paddingBottom: 0,
    border: "1px solid rgba(12,124,114,.14)",
    boxShadow: "none",
    [theme.breakpoints.down("xs")]: {
      maxWidth: "88%"
    }
  },
  quotedContainerRight: {
    margin: "0 0 6px",
    overflowY: "hidden",
    backgroundColor: theme.palette.action.hover,
    borderRadius: "7.5px",
    display: "flex",
    position: "relative"
  },
  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap"
  },
  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96"
  },
  messageActionsButton: {
    display: "flex",
    position: "absolute",
    right: 0,
    top: 0,
    color: theme.palette.text.secondary,
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: 0.4,
    padding: 3,
    "& svg": {
      fontSize: 16
    },
    "&:hover, &.Mui-focusVisible": {
      backgroundColor: "inherit",
      opacity: 1
    },
    "@media (hover: none)": {
      opacity: 1
    }
  },
  messageContactName: {
    display: "flex",
    color: theme.palette.primary.main,
    fontWeight: 500
  },
  textContentItem: {
    overflowWrap: "break-word",
    padding: "2px 20px 4px 4px"
  },
  textContentItemDeleted: {
    fontStyle: "italic",
    color: theme.palette.text.secondary,
    overflowWrap: "break-word",
    padding: "2px 20px 4px 4px"
  },
  messageMedia: {
    objectFit: "cover",
    width: 250,
    maxWidth: "100%",
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8
  },
  stickerMedia: {
    display: "block",
    objectFit: "contain",
    width: 180,
    height: 180,
    maxWidth: "65vw",
    background: "transparent",
    padding: 6
  },
  stickerBubble: {
    background: "transparent",
    borderColor: "transparent",
    boxShadow: "none"
  },
  timestamp: {
    fontSize: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 2,
    marginRight: -12,
    color: theme.palette.text.secondary
  },
  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "auto",
    backgroundColor: theme.palette.background.paper,
    margin: "14px",
    borderRadius: 999,
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: "none"
  },
  dailyTimestampText: {
    color: theme.palette.text.secondary,
    padding: "5px 12px",
    fontSize: ".68rem",
    fontWeight: 500,
    alignSelf: "center",
    marginLeft: "0px"
  },
  ackIcons: {
    fontSize: 16,
    verticalAlign: "middle",
    marginLeft: 4
  },
  deletedIcon: {
    fontSize: 16,
    verticalAlign: "middle",
    marginRight: 4
  },
  ackDoneAllIcon: {
    color: green[500],
    fontSize: 16,
    verticalAlign: "middle",
    marginLeft: 4
  },
  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10
  }
}));
const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];
    messages.forEach(message => {
      const messageIndex = state.findIndex(m => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });
    return [...newMessages, ...state];
  }
  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex(m => m.id === newMessage.id);
    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }
    return [...state];
  }
  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex(m => m.id === messageToUpdate.id);
    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }
    return [...state];
  }
  if (action.type === "RESET") {
    return [];
  }
};
const MessagesList = ({
  ticketId,
  isGroup
}) => {
  const classes = useStyles();
  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();
  const historyCursor = useRef();
  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  useEffect(() => {
    dispatch({
      type: "RESET"
    });
    setPageNumber(1);
    historyCursor.current = undefined;
    currentTicketId.current = ticketId;
  }, [ticketId]);
  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        try {
          const {
            data
          } = await api.get("/messages/" + ticketId, {
            params: {
              pageNumber,
              beforeMessageId: pageNumber > 1 ? historyCursor.current : undefined
            }
          });
          if (currentTicketId.current === ticketId) {
            dispatch({
              type: "LOAD_MESSAGES",
              payload: data.messages
            });
            if (data.messages.length) historyCursor.current = data.messages[0].id;
            setHasMore(data.hasMore);
            setLoading(false);
          }
          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [pageNumber, ticketId]);
  useEffect(() => {
    const socket = openSocket();
    socket.on("connect", () => socket.emit("joinChatBox", ticketId));
    socket.on("appMessage", data => {
      if (Number(data.message?.ticketId) !== Number(ticketId)) return;
      if (data.action === "create") {
        dispatch({
          type: "ADD_MESSAGE",
          payload: data.message
        });
        scrollToBottom();
      }
      if (data.action === "update") {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: data.message
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [ticketId]);
  const loadMore = () => {
    setPageNumber(prevPageNumber => prevPageNumber + 1);
  };
  const scrollToBottom = () => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({});
    }
  };
  const handleScroll = e => {
    if (!hasMore) return;
    const {
      scrollTop
    } = e.currentTarget;
    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }
    if (loading) {
      return;
    }
    if (scrollTop < 50) {
      loadMore();
    }
  };
  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };
  const handleCloseMessageOptionsMenu = () => {
    setAnchorEl(null);
  };
  const checkMessageMedia = message => {
    if (message.mediaType === "location" && message.body.split("|").length >= 2) {
      let locationParts = message.body.split("|");
      let imageLocation = locationParts[0];
      let linkLocation = locationParts[1];
      let descriptionLocation = null;
      if (locationParts.length > 2) descriptionLocation = message.body.split("|")[2];
      return <LocationPreview image={imageLocation} link={linkLocation} description={descriptionLocation} />;
    } else if (message.mediaType === "vcard") {
      //console.log("vcard")
      //console.log(message)
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({
              number: values[ind]
            });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      return <VcardPreview contact={contact} numbers={obj[0]?.number} />;
    }
    /*else if (message.mediaType === "multi_vcard") {
      console.log("multi_vcard")
      console.log(message)
        if(message.body !== null && message.body !== "") {
        let newBody = JSON.parse(message.body)
        return (
          <>
            {
            newBody.map(v => (
              <VcardPreview contact={v.name} numbers={v.number} />
            ))
            }
          </>
        )
      } else return (<></>)
    }*/
    return <ProtectedMedia message={message} className={isStickerMessage(message) ? classes.stickerMedia : classes.messageMedia} />;
  };
  const renderMessageAck = message => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3 || message.ack === 4) {
      return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
    }
  };
  const renderDailyTimestamps = (message, index) => {
    if (index > 0 && isSameDay(parseISO(message.createdAt), parseISO(messagesList[index - 1].createdAt))) return null;
    return <span className={classes.dailyTimestamp} key={`timestamp-${message.id}`}>
        <span className={classes.dailyTimestampText}>
          {format(parseISO(message.createdAt), "dd/MM/yyyy")}
        </span>
      </span>;
  };
  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;
      if (messageUser !== previousMessageUser) {
        return <span style={{
          marginTop: 16
        }} key={`divider-${message.id}`}></span>;
      }
    }
  };
  const renderQuotedMessage = message => {
    return <div className={clsx(classes.quotedContainerLeft, {
      [classes.quotedContainerRight]: message.fromMe
    })}>
        <span className={clsx(classes.quotedSideColorLeft, {
        [classes.quotedSideColorRight]: message.quotedMsg?.fromMe
      })}></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>}
          {message.quotedMsg?.body}
        </div>
      </div>;
  };
  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (!message.fromMe) {
          return <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div className={clsx(classes.messageLeft, {
              [classes.stickerBubble]: isStickerMessage(message)
            })}>
                <IconButton variant="contained" size="small" aria-label="Opções da mensagem recebida" disabled={message.isDeleted} className={classes.messageActionsButton} onClick={e => handleOpenMessageOptionsMenu(e, message)}>
                  <ExpandMore />
                </IconButton>
                {isGroup && <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>}
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard") &&
              //|| message.mediaType === "multi_vcard"
              checkMessageMedia(message)}
                <div className={classes.textContentItem}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {shouldRenderMessageBody(message) && <MarkdownWrapper>{message.body}</MarkdownWrapper>}
                  <span className={classes.timestamp}>
                    {format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>;
        } else {
          return <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderMessageDivider(message, index)}
              <div className={clsx(classes.messageRight, {
              [classes.stickerBubble]: isStickerMessage(message)
            })}>
                <IconButton variant="contained" size="small" aria-label="Opções da mensagem enviada" disabled={message.isDeleted} className={classes.messageActionsButton} onClick={e => handleOpenMessageOptionsMenu(e, message)}>
                  <ExpandMore />
                </IconButton>
                {(message.mediaUrl || message.mediaType === "location" || message.mediaType === "vcard") &&
              //|| message.mediaType === "multi_vcard"
              checkMessageMedia(message)}
                <div className={clsx(classes.textContentItem, {
                [classes.textContentItemDeleted]: message.isDeleted
              })}>
                  {message.isDeleted && <Block color="disabled" fontSize="small" className={classes.deletedIcon} />}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {shouldRenderMessageBody(message) && <MarkdownWrapper>{message.body}</MarkdownWrapper>}
                  <span className={classes.timestamp}>
                    {format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>;
        }
      });
      return viewMessagesList;
    } else {
      return <div>Say hello to your new contact!</div>;
    }
  };
  return <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu message={selectedMessage} anchorEl={anchorEl} menuOpen={messageOptionsMenuOpen} handleClose={handleCloseMessageOptionsMenu} />
      <div id="messagesList" className={classes.messagesList} onScroll={handleScroll}>
        {messagesList.length > 0 ? renderMessages() : loading ? <PageSkeleton messages /> : <div style={{
        margin: "auto",
        textAlign: "center"
      }}>
            Inicie a conversa com uma mensagem de acolhimento.
          </div>}
        <div ref={lastMessageRef} />
      </div>
      {loading && messagesList.length > 0 && <div>
          <CircularProgress className={classes.circleLoading} />
        </div>}
    </div>;
};
export default MessagesList;
