import TableEmptyState from "../../components/TableEmptyState";
import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import PageHeading from "../../components/PageHeading";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import UserModal from "../../components/UserModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import UserAvatar from "../../components/UserAvatar";
import ResponsiveTable from "../../components/ResponsiveTable";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach(user => {
      const userIndex = state.findIndex(u => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex(u => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles(theme => ({
  mainPaper: theme.panelStyles,
  userCell: {
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing(1.25),
    minWidth: 180,
    textAlign: "left"
  },
  userAvatar: {
    width: 34,
    height: 34,
    fontSize: ".75rem",
    color: theme.modeTokens.avatarText,
    background: theme.modeTokens.avatar
  }
}));

const Users = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);
  const [ratingsByUser, setRatingsByUser] = useState({});

  const loadRatings = async () => {
    try {
      const { data } = await api.get("/service-ratings/summary", {
        params: { days: 30 }
      });
      setRatingsByUser(
        (data.users || []).reduce((map, item) => {
          map[item.userId] = item;
          return map;
        }, {})
      );
    } catch (error) {
      toastError(error);
    }
  };

  useEffect(() => {
    loadRatings();
  }, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber }
          });
          if (!active) return;
          dispatch({ type: "LOAD_USERS", payload: data.users });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          if (!active) return;
          setLoading(false);
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("user", data => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    });
    socket.on("serviceRating", loadRatings);

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = event => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = user => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async userId => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber(prevState => prevState + 1);
  };

  const handleScroll = e => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${
            deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
      />
      <PageHeading
        title={i18n.t("users.title")}
        description="Organize sua equipe, os acessos e as responsabilidades."
        actions={
          <>
            <TextField
              placeholder={i18n.t("contacts.searchPlaceholder")}
              type="search"
              size="small"
              inputProps={{ "aria-label": "Buscar registros" }}
              value={searchParam}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="disabled" />
                  </InputAdornment>
                )
              }}
            />
            <Button
              variant="contained"
              color="primary"
              onClick={handleOpenUserModal}
            >
              {i18n.t("users.buttons.add")}
            </Button>
          </>
        }
      />
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <ResponsiveTable size="medium" aria-label="Registros">
          <TableHead>
            <TableRow>
              <TableCell align="center">{i18n.t("users.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("users.table.email")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.profile")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("users.table.whatsapp")}
              </TableCell>
              <TableCell align="center">Quark Clinic</TableCell>
              <TableCell align="center">Avaliação (30 dias)</TableCell>
              <TableCell align="center">
                {i18n.t("users.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell data-mobile-primary align="center">
                    <span className={classes.userCell}>
                      <UserAvatar user={user} className={classes.userAvatar} />
                      <span>{user.name}</span>
                    </span>
                  </TableCell>
                  <TableCell data-label="E-mail" align="center">{user.email}</TableCell>
                  <TableCell data-label="Perfil" align="center">{user.profile}</TableCell>
                  <TableCell data-label="Canal" align="center">{user.whatsapp?.name || "Não atribuído"}</TableCell>
                  <TableCell data-label="Quark Clinic" align="center">
                    {user.canAccessQuarkClinic ? "Liberado" : "Bloqueado"}
                  </TableCell>
                  <TableCell data-label="Avaliação" align="center">
                    {ratingsByUser[user.id]?.average === null || !ratingsByUser[user.id]
                      ? "Sem avaliações"
                      : `★ ${ratingsByUser[user.id].average} / 5 · ${ratingsByUser[user.id].answered} respostas`}
                  </TableCell>
                  <TableCell data-label="Ações" data-mobile-actions align="center">
                    <IconButton
                      size="small"
                      aria-label={`Editar ${user.name}`}
                      onClick={() => handleEditUser(user)}
                    >
                      <EditIcon />
                    </IconButton>

                    <IconButton
                      size="small"
                      aria-label="Excluir registro"
                      onClick={() => {
                        setConfirmModalOpen(true);
                        setDeletingUser(user);
                      }}
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableEmptyState columns={7} />
              )}
              {loading && <TableRowSkeleton columns={7} />}
            </>
          </TableBody>
        </ResponsiveTable>
      </Paper>
    </MainContainer>
  );
};

export default Users;
