import path from "path";
import multer from "multer";
import { safeMediaFilename } from "../helpers/SafeMediaFilename";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
export default {
  directory: publicFolder,
  limits: { fileSize: 20 * 1024 * 1024, files: 10 },

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      const fileName = safeMediaFilename(file.originalname);

      return cb(null, fileName);
    }
  })
};
