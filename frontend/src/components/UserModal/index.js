import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  TextField,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Switch,
  Avatar,
  Typography,
} from "@material-ui/core";

import { PhotoCamera, Visibility, VisibilityOff } from "@material-ui/icons";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";
import UserAvatar from "../UserAvatar";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": {
      marginRight: theme.spacing(1),
    },
  },

  btnWrapper: {
    position: "relative",
  },

  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  avatarSection: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 12,
    background: theme.palette.background.default,
  },
  avatarPreview: {
    width: 72,
    height: 72,
    flexShrink: 0,
    color: theme.modeTokens.avatarText,
    background: theme.modeTokens.avatar,
    fontSize: "1rem",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  avatarActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  avatarHint: {
    color: theme.palette.text.secondary,
    fontSize: ".73rem",
  },
  hiddenInput: {
    display: "none",
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(50, "Too Long!")
    .required("Required"),
  password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email").required("Required"),
});

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();

  const initialState = {
    name: "",
    email: "",
    password: "",
    profile: "user",
    canAccessQuarkClinic: false,
    canViewOtherAgentsTickets: false,
  };

  const { user: loggedInUser } = useContext(AuthContext);

  const [user, setUser] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappId, setWhatsappId] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const { loading, whatsApps } = useWhatsApps();

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser((prevState) => {
          return { ...prevState, ...data };
        });
        const userQueueIds = data.queues?.map((queue) => queue.id);
        setSelectedQueueIds(userQueueIds);
        setWhatsappId(data.whatsappId ? data.whatsappId : "");
      } catch (err) {
        toastError(err);
      }
    };

    fetchUser();
  }, [userId, open]);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview]
  );

  useEffect(() => {
    if (!open) return;
    setAvatarFile(null);
    setAvatarPreview("");
    setAvatarRemoved(false);
  }, [open, userId]);

  const handleClose = () => {
    onClose();
    setUser(initialState);
    setAvatarFile(null);
    setAvatarPreview("");
    setAvatarRemoved(false);
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Escolha uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 5 MB.");
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarRemoved(false);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview("");
    setAvatarRemoved(true);
  };

  const handleSaveUser = async (values) => {
    const userData = { ...values, whatsappId, queueIds: selectedQueueIds };
    try {
      let savedUser = user;
      if (loggedInUser.profile === "admin") {
        const response = userId
          ? await api.put(`/users/${userId}`, userData)
          : await api.post("/users", userData);
        savedUser = response.data;
      }
      const targetId = userId || savedUser.id;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        savedUser = (await api.post(`/users/${targetId}/avatar`, formData))
          .data;
      } else if (avatarRemoved && targetId) {
        savedUser = (await api.delete(`/users/${targetId}/avatar`)).data;
      }
      if (Number(targetId) === Number(loggedInUser.id)) {
        window.dispatchEvent(
          new CustomEvent("auth:user-updated", { detail: savedUser })
        );
      }
      if (avatarFile || avatarRemoved) {
        window.dispatchEvent(
          new CustomEvent("user-avatar-updated", { detail: savedUser })
        );
      }
      toast.success(i18n.t("userModal.success"));
    } catch (err) {
      toastError(err);
      return false;
    }
    handleClose();
    return true;
  };

  return (
    <div className={classes.root}>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        scroll="paper"
      >
        <DialogTitle id="form-dialog-title">
          {userId
            ? `${i18n.t("userModal.title.edit")}`
            : `${i18n.t("userModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={async (values, actions) => {
            await handleSaveUser(values);
            actions.setSubmitting(false);
          }}
        >
          {({ touched, errors, isSubmitting, values, setFieldValue }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.avatarSection}>
                  {avatarPreview ? (
                    <Avatar className={classes.avatarPreview}>
                      <img
                        src={avatarPreview}
                        alt="Prévia da foto do atendente"
                        className={classes.avatarImage}
                      />
                    </Avatar>
                  ) : (
                    <UserAvatar
                      user={{
                        ...user,
                        hasAvatar: user.hasAvatar && !avatarRemoved,
                      }}
                      className={classes.avatarPreview}
                    />
                  )}
                  <div>
                    <Typography variant="subtitle2">
                      Foto do atendente
                    </Typography>
                    <div className={classes.avatarHint}>
                      JPEG, PNG ou WebP · máximo de 5 MB
                    </div>
                    <div className={classes.avatarActions}>
                      <input
                        id="user-avatar-input"
                        className={classes.hiddenInput}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleAvatarChange}
                      />
                      <label htmlFor="user-avatar-input">
                        <Button
                          component="span"
                          size="small"
                          variant="outlined"
                          startIcon={<PhotoCamera />}
                        >
                          Escolher foto
                        </Button>
                      </label>
                      {(avatarPreview ||
                        (user.hasAvatar && !avatarRemoved)) && (
                        <Button
                          size="small"
                          color="secondary"
                          onClick={handleRemoveAvatar}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.name")}
                    autoFocus
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={loggedInUser.profile !== "admin"}
                  />
                  <Field
                    as={TextField}
                    name="password"
                    variant="outlined"
                    margin="dense"
                    label={i18n.t("userModal.form.password")}
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    type={showPassword ? "text" : "password"}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword((e) => !e)}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                    disabled={loggedInUser.profile !== "admin"}
                  />
                </div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                    disabled={loggedInUser.profile !== "admin"}
                  />
                  <FormControl
                    variant="outlined"
                    className={classes.formControl}
                    margin="dense"
                  >
                    <Can
                      role={loggedInUser.profile}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <>
                          <InputLabel id="profile-selection-input-label">
                            {i18n.t("userModal.form.profile")}
                          </InputLabel>

                          <Field
                            as={Select}
                            label={i18n.t("userModal.form.profile")}
                            name="profile"
                            labelId="profile-selection-label"
                            id="profile-selection"
                            required
                          >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="user">User</MenuItem>
                          </Field>
                        </>
                      )}
                    />
                  </FormControl>
                </div>
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQueues"
                  yes={() => (
                    <QueueSelect
                      selectedQueueIds={selectedQueueIds}
                      onChange={(values) => setSelectedQueueIds(values)}
                    />
                  )}
                />
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQueues"
                  yes={() =>
                    !loading && (
                      <FormControl
                        variant="outlined"
                        margin="dense"
                        className={classes.maxWidth}
                        fullWidth
                      >
                        <InputLabel>
                          {i18n.t("userModal.form.whatsapp")}
                        </InputLabel>
                        <Field
                          as={Select}
                          value={whatsappId}
                          onChange={(e) => setWhatsappId(e.target.value)}
                          label={i18n.t("userModal.form.whatsapp")}
                        >
                          <MenuItem value={""}>&nbsp;</MenuItem>
                          {whatsApps.map((whatsapp) => (
                            <MenuItem key={whatsapp.id} value={whatsapp.id}>
                              {whatsapp.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    )
                  }
                />
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQuarkClinicAccess"
                  yes={() => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(values.canAccessQuarkClinic)}
                          onChange={(event) =>
                            setFieldValue(
                              "canAccessQuarkClinic",
                              event.target.checked
                            )
                          }
                          color="primary"
                        />
                      }
                      label="Permitir acesso ao Quark Clinic"
                    />
                  )}
                />
                {loggedInUser.profile === "admin" && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(values.canViewOtherAgentsTickets)}
                        onChange={(event) =>
                          setFieldValue(
                            "canViewOtherAgentsTickets",
                            event.target.checked
                          )
                        }
                        color="primary"
                      />
                    }
                    label="Permitir visualizar atendimentos de outros colaboradores nas filas autorizadas"
                  />
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("userModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {userId
                    ? `${i18n.t("userModal.buttons.okEdit")}`
                    : `${i18n.t("userModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default UserModal;
