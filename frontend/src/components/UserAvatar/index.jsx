import React, { useEffect, useState } from "react";
import { Avatar } from "@material-ui/core";
import api from "../../services/api";

const initials = (name) =>
  (name || "Usuário")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toLocaleUpperCase();

export default function UserAvatar({ user, className = "", variant }) {
  const [imageUrl, setImageUrl] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const handleUpdate = (event) => {
      if (Number(event.detail?.id) === Number(user?.id))
        setRevision((value) => value + 1);
    };
    window.addEventListener("user-avatar-updated", handleUpdate);
    return () =>
      window.removeEventListener("user-avatar-updated", handleUpdate);
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setImageUrl("");
    if (!user?.id || !user?.hasAvatar) return undefined;
    api
      .get(`/users/${user.id}/avatar`, { responseType: "blob" })
      .then(({ data }) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(data);
        setImageUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.id, user?.hasAvatar, user?.avatarUpdatedAt, revision]);

  return (
    <Avatar
      alt={user?.name || "Usuário"}
      className={className}
      src={imageUrl || undefined}
      variant={variant}
    >
      {initials(user?.name)}
    </Avatar>
  );
}
