import React, { useState, useContext } from "react";

import MenuItem from "@material-ui/core/MenuItem";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ConfirmationModal from "../ConfirmationModal";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  TextField
} from "@material-ui/core";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import toastError from "../../errors/toastError";
import { toast } from "react-toastify";
import { isStickerMessage } from "../../services/mediaComposer";
import {
  canEditMessage,
  MESSAGE_EDIT_MAX_LENGTH
} from "../../services/messageEditing";

const MessageOptionsMenu = ({ message, menuOpen, handleClose, anchorEl }) => {
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState("");
  const [editing, setEditing] = useState(false);

  const handleDeleteMessage = async () => {
    try {
      await api.delete(`/messages/${message.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  const hanldeReplyMessage = () => {
    setReplyingMessage(message);
    handleClose();
  };

  const handleOpenConfirmationModal = () => {
    setConfirmationOpen(true);
    handleClose();
  };

  const handleOpenEditModal = () => {
    setEditBody(message.body || "");
    setEditOpen(true);
    handleClose();
  };

  const handleCloseEditModal = () => {
    if (!editing) setEditOpen(false);
  };

  const handleEditMessage = async () => {
    const body = editBody.trim();
    if (!body || body.length > MESSAGE_EDIT_MAX_LENGTH) return;

    setEditing(true);
    try {
      await api.patch(`/messages/${message.id}`, { body });
      toast.success(i18n.t("messageOptionsMenu.editSuccess"));
      setEditOpen(false);
    } catch (err) {
      toastError(err);
    } finally {
      setEditing(false);
    }
  };

  const handleSaveSticker = async () => {
    try {
      const { status } = await api.post("/stickers", { messageId: message.id });
      if (status === 201) toast.success("Figurinha salva na biblioteca.");
    } catch (err) {
      toastError(err);
    } finally {
      handleClose();
    }
  };

  return (
    <>
      <ConfirmationModal
        title={i18n.t("messageOptionsMenu.confirmationModal.title")}
        open={confirmationOpen}
        onClose={setConfirmationOpen}
        onConfirm={handleDeleteMessage}
      >
        {i18n.t("messageOptionsMenu.confirmationModal.message")}
      </ConfirmationModal>
      <Dialog
        open={editOpen}
        onClose={handleCloseEditModal}
        fullWidth
        maxWidth="sm"
        aria-labelledby="edit-message-dialog-title"
      >
        <DialogTitle id="edit-message-dialog-title">
          {i18n.t("messageOptionsMenu.editTitle")}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={editBody}
            disabled={editing}
            onChange={event => setEditBody(event.target.value)}
            inputProps={{ maxLength: MESSAGE_EDIT_MAX_LENGTH }}
            helperText={i18n.t("messageOptionsMenu.editHelp", {
              count: editBody.length,
              limit: MESSAGE_EDIT_MAX_LENGTH
            })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditModal} disabled={editing}>
            {i18n.t("messageOptionsMenu.editCancel")}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={handleEditMessage}
            disabled={
              editing ||
              !editBody.trim() ||
              editBody.trim() === (message.body || "").trim()
            }
          >
            {editing ? (
              <CircularProgress size={20} />
            ) : (
              i18n.t("messageOptionsMenu.editSave")
            )}
          </Button>
        </DialogActions>
      </Dialog>
      <Menu
        anchorEl={anchorEl}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right"
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right"
        }}
        open={menuOpen}
        onClose={handleClose}
      >
        {canEditMessage(message) && (
          <MenuItem onClick={handleOpenEditModal}>
            {i18n.t("messageOptionsMenu.edit")}
          </MenuItem>
        )}
        {message.fromMe && (
          <MenuItem onClick={handleOpenConfirmationModal}>
            {i18n.t("messageOptionsMenu.delete")}
          </MenuItem>
        )}
        <MenuItem onClick={hanldeReplyMessage}>
          {i18n.t("messageOptionsMenu.reply")}
        </MenuItem>
        {isStickerMessage(message) && (
          <MenuItem onClick={handleSaveSticker}>Salvar figurinha</MenuItem>
        )}
      </Menu>
    </>
  );
};

export default MessageOptionsMenu;
