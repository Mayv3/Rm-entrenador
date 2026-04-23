import express from "express";
import { google } from "googleapis";
import dotenv from "dotenv";
import cors from "cors";
import { addClientSupabase, deleteClientSupabase, getMembersSupabase, updateClientSupabase, getStudentByEmail, updateAntroPdf, updateHabitosLink } from "./controllers/clientController.js";
import { addPaymentSupabase, deletePaymentSupabase, getPaymentsSupabase, updatePaymentInSupabase, getPaymentHistory, getAllPaymentHistory, deleteHistoryEntry, updateHistoryEntry } from "./controllers/paymentsController.js";
import { enviarRecordatoriosVencidos, previewRecordatoriosVencidos, sendTestAPIMail, recordatorioAntropometrias, recordatorioCumpleanos } from "./controllers/mailingController.js";
import { getPlanes, addPlan, updatePlan, deletePlan } from "./controllers/planesController.js";
import {
  getEjercicios, createEjercicio, updateEjercicio, deleteEjercicio,
  getPlanificaciones, getPlanificacionesByAlumno, getPlanificacionById,
  createPlanificacion, updatePlanificacion, deletePlanificacion,
  createHoja, updateHoja, deleteHoja,
  createDia, updateDia, deleteDia,
  addEjercicioADia, addEjerciciosADiaBulk, updateEjercicioEnDia, removeEjercicioDeDia,
  updateDosis, updateDosisBulk, guardarPlanCompleto, bulkUpdateOrden, saveMovilidad, getEjerciciosMovilidad, saveAll,
} from "./controllers/planificacionesController.js";
import { getAntrosByAlumno, getAllAntrosCounts, createAntro, deleteAntro, updateAntroNombre, updateAntroFecha, getParsedAntro } from "./controllers/antropometriasController.js";
import { getNutricionByAlumno, getAllNutricionCounts, createNutricion, deleteNutricion, updateNutricionNombre, updateNutricionHabitos } from "./controllers/nutricionController.js";
import { getPortalPlanificacion, getPortalSesion, upsertPortalSesion } from "./controllers/portalPlanController.js";

import multer from "multer"
import { parseAntropometriaPdf } from "./controllers/pdfAntroParser.js"

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
    const folderId = "16MV5YKHB2KDJ7e3_iwyjwC7mX9KnLaVV";
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

app.post("/add-student", addClientSupabase);
app.get("/getAllStudents", getMembersSupabase);
app.get("/student/by-email", getStudentByEmail);
app.delete("/clients/:id", deleteClientSupabase);
app.put("/clients/:id", updateClientSupabase);
app.patch("/clients/:id/antro-pdf", updateAntroPdf);
app.patch("/clients/:id/habitos-link", updateHabitosLink);

// Antropometrias
app.get("/antropometrias/counts", getAllAntrosCounts);
app.get("/clients/:id/antropometrias", getAntrosByAlumno);
app.post("/clients/:id/antropometrias", createAntro);
app.delete("/antropometrias/:id", deleteAntro);
app.patch("/antropometrias/:id/nombre", updateAntroNombre);
app.patch("/antropometrias/:id/fecha", updateAntroFecha);
app.get("/antropometrias/:id/parsed", getParsedAntro);

// Nutricion
app.get("/nutricion/counts", getAllNutricionCounts);
app.get("/clients/:id/nutricion", getNutricionByAlumno);
app.post("/clients/:id/nutricion", createNutricion);
app.delete("/nutricion/:id", deleteNutricion);
app.patch("/nutricion/:id/nombre", updateNutricionNombre);
app.patch("/nutricion/:id/habitos", updateNutricionHabitos);

// Pagos

app.get("/getAllPayments", getPaymentsSupabase);
app.post("/addPayment", addPaymentSupabase);
app.delete("/payment/:id", deletePaymentSupabase);
app.put("/payment/:id", updatePaymentInSupabase);
app.get("/payment/:id/history", getPaymentHistory);
app.get("/payments/history", getAllPaymentHistory);
app.delete("/payment/history/:id", deleteHistoryEntry);
app.put("/payment/history/:id", updateHistoryEntry);

// Planes

app.get("/planes", getPlanes);
app.post("/planes", addPlan);
app.put("/planes/:id", updatePlan);
app.delete("/planes/:id", deletePlan);

// Ejercicios (librería)
app.get("/ejercicios", getEjercicios);
app.post("/ejercicios", createEjercicio);
app.put("/ejercicios/:id", updateEjercicio);
app.delete("/ejercicios/:id", deleteEjercicio);

// Planificaciones
app.get("/planificaciones", getPlanificaciones);
app.post("/planificaciones", createPlanificacion);
app.get("/planificaciones/:id", getPlanificacionById);
app.put("/planificaciones/:id", updatePlanificacion);
app.delete("/planificaciones/:id", deletePlanificacion);
app.get("/planificaciones/alumno/:alumnoId", getPlanificacionesByAlumno);

// Hojas
app.post("/planificaciones/:id/hojas", createHoja);
app.put("/planificaciones/hojas/:hojaId", updateHoja);
app.delete("/planificaciones/hojas/:hojaId", deleteHoja);

// Días
app.post("/planificaciones/hojas/:hojaId/dias", createDia);
app.put("/planificaciones/dias/:diaId", updateDia);
app.delete("/planificaciones/dias/:diaId", deleteDia);

// Ejercicios en un día
app.post("/planificaciones/dias/:diaId/ejercicios", addEjercicioADia);
app.post("/planificaciones/dias/:diaId/ejercicios/bulk", addEjerciciosADiaBulk);
app.put("/planificaciones/ejercicios/bulk-orden", bulkUpdateOrden);
app.put("/planificaciones/ejercicios/:planEjId", updateEjercicioEnDia);
app.delete("/planificaciones/ejercicios/:planEjId", removeEjercicioDeDia);

// Guardar plan completo (semanas + categorías de golpe)
app.put("/planificaciones/:id/guardar", guardarPlanCompleto);
app.post("/planificaciones/:id/save-all", saveAll);
app.put("/planificaciones/hojas/:hojaId/movilidad", saveMovilidad);
app.get("/ejercicios-movilidad", getEjerciciosMovilidad);

// Dosis por semana (legacy, por si se necesita)
app.put("/planificaciones/ejercicios/:planEjId/semanas/:semana", updateDosis);
app.put("/planificaciones/ejercicios/:planEjId/semanas", updateDosisBulk);

// Portal alumno: planificacion + carga de entrenamiento
app.get("/portal/alumnos/:alumnoId/planificacion", getPortalPlanificacion);
app.get("/portal/planificaciones/:planId/sesiones", getPortalSesion);
app.put("/portal/planificaciones/:planId/sesiones", upsertPortalSesion);

// Mailing

app.get("/send-reminders/preview", previewRecordatoriosVencidos);
app.post("/send-reminders", enviarRecordatoriosVencidos);
app.post("/recordatorio-antropometrias", recordatorioAntropometrias);
app.post("/recordatorio-cumpleanos", recordatorioCumpleanos);
app.post("/test-api", async (req, res) => {
  try {
    await sendTestAPIMail();
    res.json({ ok: true, message: "API funcionando" })
  } catch (err) {
    console.error("❌ Error API:", err)
    res.status(500).json({ error: "Falló API" })
  }
})

app.get("/ping", (req, res) => {
  return res.json({ ok: true, message: "Pong" })
})


const upload = multer()
app.post("/test-pdf", upload.single("file"), async (req, res) => {
  try {
    const data = await parseAntropometriaPdf(req.file.buffer)
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})


const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto: ${PORT}`);
});

