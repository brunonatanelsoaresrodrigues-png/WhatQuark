import { useState, useEffect } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const useTickets = ({
  searchParam,
  pageNumber,
  status,
  date,
  showAll,
  assignee,
  queueIds,
  withUnreadMessages,
  refreshKey,
  notifyOnError = true
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          const { data } = await api.get("/tickets", {
            params: {
              searchParam,
              pageNumber,
              status,
              date,
              showAll,
              assignee,
              queueIds,
              withUnreadMessages
            }
          });
          if (!active) return;
          setTickets(data.tickets);

          setHasMore(data.hasMore);
          setCount(data.count);
          setLoading(false);
        } catch (err) {
          if (!active) return;
          setError(err);
          setLoading(false);
          if (notifyOnError) toastError(err);
        }
      };

      fetchTickets();
    }, 500);
    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [
    searchParam,
    pageNumber,
    status,
    date,
    showAll,
    assignee,
    queueIds,
    withUnreadMessages,
    refreshKey,
    notifyOnError
  ]);

  return { tickets, loading, hasMore, count, error };
};

export default useTickets;
