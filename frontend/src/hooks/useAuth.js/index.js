import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api, {
  clearSession,
  getAccessToken,
  refreshSession,
  saveSession
} from "../../services/api";
import toastError from "../../errors/toastError";

const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  useEffect(() => {
    let active = true;
    const onSession = event => {
      setUser(event.detail || {});
      setIsAuth(Boolean(event.detail));
    };
    window.addEventListener("auth:session", onSession);
    const initialize = async () => {
      try {
        if (getAccessToken()) await refreshSession();
      } catch (error) {
        if (active) toastError(error);
      } finally {
        if (active) setLoading(false);
      }
    };
    initialize();
    return () => {
      active = false;
      window.removeEventListener("auth:session", onSession);
    };
  }, []);

  const handleLogin = async userData => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", userData);
      saveSession(data);
      toast.success(i18n.t("auth.toasts.success"));
      history.push("/tickets");
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.delete("/auth/logout", { skipAuthRefresh: true });
    } catch (error) {
      toastError(error);
    } finally {
      clearSession();
      setLoading(false);
      history.push("/login");
    }
  };

  return { isAuth, user, loading, handleLogin, handleLogout };
};
export default useAuth;
