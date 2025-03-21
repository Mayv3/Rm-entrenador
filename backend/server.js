import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: "rmentrenador-0c0bdd931abd.json",
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

app.get("/files", async (req, res) => {
  try {
    const folderId = process.env.FOLDER_ID; // ID de la carpeta en Google Drive
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: "files(id, name, webViewLink)",
    });

    const files = response.data.files.map((file) => ({
      nameFile: file.name,
      url: file.webViewLink,
    }));

    res.json(files);
  } catch (error) {
    console.error("Error obteniendo archivos:", error);
    res.status(500).json({ message: "Error obteniendo archivos" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
