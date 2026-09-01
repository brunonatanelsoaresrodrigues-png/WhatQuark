import TableEmptyState from "../../components/TableEmptyState";
import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  makeStyles,
  Paper,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  InputAdornment,
  TextField
} from "@material-ui/core";
import { Edit, DeleteOutline } from "@material-ui/icons";
import SearchIcon from "@material-ui/icons/Search";

import MainContainer from "../../components/MainContainer";
import PageHeading from "../../components/PageHeading";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import QuickAnswersModal from "../../components/QuickAnswersModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import ResponsiveTable from "../../components/ResponsiveTable";
import { AuthContext } from "../../context/Auth/AuthContext";

const reducer = (state, action) => {
  if (action.type === "LOAD_QUICK_ANSWERS") {
    const quickAnswers = action.payload;
    const newQuickAnswers = [];

    quickAnswers.forEach(quickAnswer => {
      const quickAnswerIndex = state.findIndex(q => q.id === quickAnswer.id);
      if (quickAnswerIndex !== -1) {
        state[quickAnswerIndex] = quickAnswer;
      } else {
        newQuickAnswers.push(quickAnswer);
      }
    });

    return [...state, ...newQuickAnswers];
  }

  if (action.type === "UPDATE_QUICK_ANSWERS") {
    const quickAnswer = action.payload;
    const quickAnswerIndex = state.findIndex(q => q.id === quickAnswer.id);

    if (quickAnswerIndex !== -1) {
      state[quickAnswerIndex] = quickAnswer;
      return [...state];
    } else {
      return [quickAnswer, ...state];
    }
  }

  if (action.type === "DELETE_QUICK_ANSWERS") {
    const quickAnswerId = action.payload;

    const quickAnswerIndex = state.findIndex(q => q.id === quickAnswerId);
    if (quickAnswerIndex !== -1) {
      state.splice(quickAnswerIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles(theme => ({
  mainPaper: theme.panelStyles
}));

const QuickAnswers = () => {
  const classes = useStyles();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [quickAnswers, dispatch] = useReducer(reducer, []);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState(null);
  const [quickAnswersModalOpen, setQuickAnswersModalOpen] = useState(false);
  const [deletingQuickAnswers, setDeletingQuickAnswers] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchQuickAnswers = async () => {
        try {
          const { data } = await api.get("/quickAnswers/", {
            params: { searchParam, pageNumber }
          });
          if (!active) return;
          dispatch({ type: "LOAD_QUICK_ANSWERS", payload: data.quickAnswers });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          if (!active) return;
          setLoading(false);
          toastError(err);
        }
      };
      fetchQuickAnswers();
    }, 500);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("quickAnswer", data => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICK_ANSWERS", payload: data.quickAnswer });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_QUICK_ANSWERS",
          payload: +data.quickAnswerId
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = event => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(true);
  };

  const handleCloseQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(false);
  };

  const handleEditQuickAnswers = quickAnswer => {
    setSelectedQuickAnswers(quickAnswer);
    setQuickAnswersModalOpen(true);
  };

  const handleDeleteQuickAnswers = async quickAnswerId => {
    try {
      await api.delete(`/quickAnswers/${quickAnswerId}`);
      toast.success(i18n.t("quickAnswers.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickAnswers(null);
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
          deletingQuickAnswers &&
          `${i18n.t("quickAnswers.confirmationModal.deleteTitle")} ${
            deletingQuickAnswers.shortcut
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteQuickAnswers(deletingQuickAnswers.id)}
      >
        {i18n.t("quickAnswers.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QuickAnswersModal
        open={quickAnswersModalOpen}
        onClose={handleCloseQuickAnswersModal}
        aria-labelledby="form-dialog-title"
        quickAnswerId={selectedQuickAnswers && selectedQuickAnswers.id}
      ></QuickAnswersModal>
      <PageHeading
        title={i18n.t("quickAnswers.title")}
        description="Organize respostas para tornar o atendimento mais consistente."
        actions={
          <>
            <TextField
              placeholder={i18n.t("quickAnswers.searchPlaceholder")}
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
              onClick={handleOpenQuickAnswersModal}
            >
              {i18n.t("quickAnswers.buttons.add")}
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
              <TableCell align="center">
                {i18n.t("quickAnswers.table.shortcut")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("quickAnswers.table.message")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("quickAnswers.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {quickAnswers.map(quickAnswer => (
                <TableRow key={quickAnswer.id}>
                  <TableCell data-mobile-primary align="center">{quickAnswer.shortcut}</TableCell>
                  <TableCell data-label="Mensagem" align="center">{quickAnswer.message}</TableCell>
                  <TableCell data-label="Ações" data-mobile-actions align="center">
                    {(user.profile === "admin" || quickAnswer.userId === user.id) && <IconButton
                      size="small"
                      aria-label={`Editar ${quickAnswer.shortcut}`}
                      onClick={() => handleEditQuickAnswers(quickAnswer)}
                    >
                      <Edit />
                    </IconButton>}

                    {(user.profile === "admin" || quickAnswer.userId === user.id) && <IconButton
                      size="small"
                      aria-label="Excluir registro"
                      onClick={() => {
                        setConfirmModalOpen(true);
                        setDeletingQuickAnswers(quickAnswer);
                      }}
                    >
                      <DeleteOutline />
                    </IconButton>}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && quickAnswers.length === 0 && (
                <TableEmptyState columns={3} />
              )}
              {loading && <TableRowSkeleton columns={3} />}
            </>
          </TableBody>
        </ResponsiveTable>
      </Paper>
    </MainContainer>
  );
};

export default QuickAnswers;
