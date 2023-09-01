import express from "express";
import cors from "cors";
import queryHandler from "./pdfQuery.js";
import uploadHandler from "./pdfUpload.js";
import dotenv from "dotenv";
import azureUpload from "./azureUpload.js";
import multer from "multer";
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());
const port = 5000;

// multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // console.log(req);
    cb(null, "upload/"); // Specify the directory where files will be stored
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now(); // Add a timestamp to make filenames unique
    cb(null, `${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

// Define a route
app.post("/ask", queryHandler);
app.post("/upload/:email", upload.single("pdfFile"), uploadHandler);
app.get("/azure-upload", azureUpload);

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
