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
  withUnreadMessages
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
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
          setLoading(false);
          toastError(err);
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
    withUnreadMessages
  ]);

  return { tickets, loading, hasMore, count };
};

export default useTickets;
