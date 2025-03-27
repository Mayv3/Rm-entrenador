import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { addClient, deleteClient, editClient, getClients } from "./controllers/clientController.js";
import { addPayment, deletePayment, getPayments } from "./controllers/paymentsController.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  credentials: {
    type: "service_account",
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  },
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

app.get("/files", async (req, res) => {
  try {
    const folderId = "17NomItssDyRCHiyVMtWckFq4r2AeqRr2";
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

// Estudiantes

app.post("/add-student", addClient);
app.get("/getAllStudents", getClients);
app.delete("/clients/:id", deleteClient);
app.put("/clients/:id", editClient)

// Pagos

app.get("/getAllPayments", getPayments)
app.post("/addPayment", addPayment)
app.delete("/payment/:id", deletePayment)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
