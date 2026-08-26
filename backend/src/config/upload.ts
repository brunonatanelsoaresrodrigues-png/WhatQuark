import path from "path";
import multer from "multer";

const publicFolder = path.resolve(__dirname, "..", "..", "public");
export default {
  directory: publicFolder,

  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_FILE_SIZE_MB || 20) * 1024 * 1024,
    files: Number(process.env.UPLOAD_MAX_FILES || 10),
    fields: 20,
    parts: 30
  },

  storage: multer.diskStorage({
    destination: publicFolder,
    filename(req, file, cb) {
      const fileName = new Date().getTime() + path.extname(file.originalname);

      return cb(null, fileName);
    }
  })
};
