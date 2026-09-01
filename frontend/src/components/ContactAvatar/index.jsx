import React, { useEffect, useState } from "react";
import { Avatar, makeStyles } from "@material-ui/core";
import { queueContactProfilePictureRefresh } from "../../services/contactProfilePictures";
import { contactDisplayName } from "../../services/contactIdentity";
const useStyles = makeStyles(theme => ({
  root: {
    width: 38,
    height: 38,
    flexShrink: 0,
    color: theme.modeTokens.avatarText,
    background: theme.modeTokens.avatar,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: ".02em"
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    color: "transparent"
  }
}));
export default function ContactAvatar({
  contact,
  className = ""
}) {
  const classes = useStyles();
  const [imageUrl, setImageUrl] = useState(contact?.profilePicUrl || "");
  const initials = contactDisplayName(contact, "?").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toLocaleUpperCase();
  useEffect(() => {
    const current = contact?.profilePicUrl || "";
    setImageUrl(current);
    if (current || !contact?.id) return undefined;
    return queueContactProfilePictureRefresh({
      id: contact.id,
      profilePicUrl: ""
    }, refreshed => {
      if (refreshed) setImageUrl(refreshed);
    });
  }, [contact?.id, contact?.profilePicUrl]);
  const handleImageError = () => {
    const failedUrl = imageUrl;
    setImageUrl("");
    if (!contact?.id || !failedUrl) return;
    queueContactProfilePictureRefresh({
      id: contact.id,
      profilePicUrl: failedUrl,
      force: true
    }, refreshed => {
      if (refreshed && refreshed !== failedUrl) setImageUrl(refreshed);
    });
  };
  return <Avatar alt="" className={`${classes.root} ${className}`}>
      {imageUrl ? <img src={imageUrl} alt="" className={classes.image} onError={handleImageError} /> : initials}
    </Avatar>;
}
