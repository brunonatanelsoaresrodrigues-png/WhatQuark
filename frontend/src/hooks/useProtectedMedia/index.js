import { useEffect, useState } from "react";
import api from "../../services/api";

export default function useProtectedMedia(url) {
  const [state, setState] = useState({
    source: url,
    blobUrl: "",
    error: false
  });
  useEffect(() => {
    let active = true;
    let objectUrl;
    setState({ source: url, blobUrl: "", error: false });
    if (url) {
      api
        .get(url, { responseType: "blob" })
        .then(({ data }) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(data);
          setState({ source: url, blobUrl: objectUrl, error: false });
        })
        .catch(() => {
          if (active) setState({ source: url, blobUrl: "", error: true });
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return state.source === url ? state : { blobUrl: "", error: false };
}
