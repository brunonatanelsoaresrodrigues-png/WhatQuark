import path from "path";
import { v4 as uuid } from "uuid";

export const safeMediaFilename = (originalName: string): string => {
  const extension = path.extname(originalName).toLowerCase();
  return `${uuid()}${/^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ""}`;
};
