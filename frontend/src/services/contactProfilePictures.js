import api from "./api";
import { createContactProfilePictureQueue } from "./contactProfilePictureQueue";

const queue = createContactProfilePictureQueue(async contacts => {
  const { data } = await api.post("/contacts/profile-pictures/refresh", {
    contacts
  });
  return data;
});

export const queueContactProfilePictureRefresh = queue.enqueue;
