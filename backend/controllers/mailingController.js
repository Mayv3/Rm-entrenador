import { supabase } from "../lib/supabase.js"
import * as brevo from "@getbrevo/brevo"

const ENVIAR_EMAILS = true
const EMAIL_PRUEBA = "nicopereyra855@gmail.com"

// Emails excluidos del envío de recordatorios
const EMAILS_EXCLUIDOS = []

// Configurar API de Brevo (usa HTTPS, no bloqueado por Render)
const apiInstance = new brevo.TransactionalEmailsApi()
apiInstance.authentications["apiKey"].apiKey = process.env.BREVO_API_KEY

console.log("✅ Brevo API configurada (HTTPS)")

async function sendEmailVencidoAPI({ to, nombre, estado, fechaVencimiento, modalidad }) {
  const sendSmtpEmail = new brevo.SendSmtpEmail()

  sendSmtpEmail.subject = "⚠️ Tu plan venció – Regularizá para seguir entrenando"
  sendSmtpEmail.sender = {
    name: "RM ENTRENADOR",
    email: process.env.BREVO_SENDER_EMAIL
  }
  sendSmtpEmail.to = [{ email: to, name: nombre }]
  sendSmtpEmail.htmlContent = `
      <div style="margin:0; padding:0; background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">

        <!-- CONTENEDOR -->
        <table width="520" cellpadding="0" cellspacing="0" style="
          background-color:#ffffff;
          font-family: Arial, Helvetica, sans-serif;
          color:#111827;
        ">

          <!-- BANNER -->
          <tr>
            <td style="
              background-color:#22b567;
              padding:16px;
              text-align:center;
            ">
              <h1 style="
                margin:0;
                font-size:20px;
                font-weight:600;
                color:#ffffff;
              ">
                Aviso de vencimiento de plan
              </h1>
            </td>
          </tr>

          <!-- CONTENIDO -->
          <tr>
            <td style="padding:26px 24px;">

              <!-- LOGO -->
              <div style="text-align:center; margin-bottom:20px;">
                <img
                  src="https://rm-entrenador.vercel.app/_next/static/media/LOGO-RODRIGO-VERDE.ec2cf1d3.png"
                  alt="Rodrigo Montenegro"
                  style="max-width:150px; height:auto;"
                />
              </div>

              <!-- SALUDO -->
              <p style="font-size:15px; margin:0 0 14px 0;">
                Hola <strong>${nombre}</strong>,
              </p>

              <!-- TEXTO -->
              <p style="font-size:15px; margin:0 0 14px 0;">
                Te informamos que tu plan de entrenamiento actualmente se encuentra en estado
                <strong style="color:#dc2626;">${estado}</strong>.
              </p>

              <!-- CARD -->
              <div style="
                background-color:#f6fffa;
                border:1px solid #22b567;
                border-radius:10px;
                padding:14px 16px;
                margin:18px 0;
                font-size:14px;
              ">
                <p style="margin:0 0 6px 0;">
                  <strong>Plan contratado:</strong>
                  <span style="color:#22b567; font-weight:600;">
                    ${modalidad}
                  </span>
                </p>
                <p style="margin:0;">
                  <strong>Fecha de vencimiento:</strong>
                  <span style="color:#22b567; font-weight:600;">
                    ${fechaVencimiento}
                  </span>
                </p>
              </div>

              <!-- CTA -->
              <p style="font-size:15px; margin:16px 0;">
                Para continuar accediendo a tus
                <strong style="color:#22b567;">planificaciones personalizadas</strong>
                y al
                <strong style="color:#22b567;">seguimiento profesional</strong>,
                es necesario <strong>regularizar el pago</strong>.
              </p>

              <p style="font-size:15px; margin:16px 0;">
                Si necesitás ayuda o querés coordinar la renovación,
                podés comunicarte directamente al
                <strong style="color:#22b567;">
                  +54 9 3516 67-1026
                </strong>.
              </p>

              <!-- DIVISOR -->
              <hr style="
                border:none;
                border-top:1px solid #e5e7eb;
                margin:26px 0;
              " />

              <!-- FIRMA -->
              <p style="
                font-size:13px;
                text-align:center;
                margin:0;
                color:#6b7280;
              ">
                <strong style="color:#22b567;">
                  Rodrigo Montenegro
                </strong><br />
                Entrenador Personal
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</div>
  `

  await apiInstance.sendTransacEmail(sendSmtpEmail)
  console.log(`📧 Email enviado vía API → ${to} | ${nombre} | ${estado}`)
}

// ─── Lógica compartida ────────────────────────────────────────────────────────

async function getAlumnosVencidos() {
  const hoy = new Date()

  const { data: alumnos, error } = await supabase
    .from("alumnos")
    .select(`
      id,
      nombre,
      email,
      modalidad,
      pagos (
        fecha_de_vencimiento
      )
    `)

  if (error) throw error

  const alumnosVencidos = []
  const alumnosExcluidos = { sinEmail: [], sinPagos: [], enListaNegra: [] }

  for (const alumno of alumnos) {
    if (!alumno.email) {
      alumnosExcluidos.sinEmail.push(alumno.nombre)
      continue
    }
    if (!alumno.pagos?.length) {
      alumnosExcluidos.sinPagos.push(alumno.nombre)
      continue
    }
    if (EMAILS_EXCLUIDOS.includes(alumno.email.toLowerCase())) {
      alumnosExcluidos.enListaNegra.push(alumno.nombre)
      continue
    }

    const ultimoVencimiento = alumno.pagos
      .map(p => new Date(p.fecha_de_vencimiento + "T00:00:00"))
      .sort((a, b) => b - a)[0]

    if (ultimoVencimiento <= hoy) {
      alumnosVencidos.push({
        id: alumno.id,
        nombre: alumno.nombre,
        email: alumno.email,
        modalidad: alumno.modalidad,
        fecha_vencimiento: ultimoVencimiento.toLocaleDateString("es-AR"),
        dias_vencido: Math.floor((hoy - ultimoVencimiento) / (1000 * 60 * 60 * 24)),
        estado: "VENCIDO",
      })
    }
  }

  return { alumnosVencidos, alumnosExcluidos }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const enviarRecordatoriosVencidos = async (req, res) => {
  try {
    const { alumnosVencidos, alumnosExcluidos } = await getAlumnosVencidos()

    console.log("==============================================")
    console.log("⚠️  ALUMNOS EXCLUIDOS DEL ENVÍO")
    console.log("==============================================")
    if (alumnosExcluidos.sinEmail.length)
      console.log(`❌ Sin email (${alumnosExcluidos.sinEmail.length}): ${alumnosExcluidos.sinEmail.join(", ")}`)
    if (alumnosExcluidos.sinPagos.length)
      console.log(`❌ Sin pagos (${alumnosExcluidos.sinPagos.length}): ${alumnosExcluidos.sinPagos.join(", ")}`)
    if (alumnosExcluidos.enListaNegra.length)
      console.log(`🚫 Lista negra (${alumnosExcluidos.enListaNegra.length}): ${alumnosExcluidos.enListaNegra.join(", ")}`)
    if (!alumnosExcluidos.sinEmail.length && !alumnosExcluidos.sinPagos.length && !alumnosExcluidos.enListaNegra.length)
      console.log("✅ No hay alumnos excluidos")

    console.log("==============================================")
    console.log(`📛 ALUMNOS VENCIDOS: ${alumnosVencidos.length}`)
    if (alumnosVencidos.length) console.table(alumnosVencidos)
    else console.log("✅ No hay alumnos vencidos")
    console.log("==============================================")

    // Responder inmediatamente para no bloquear cronjobs
    res.json({
      message: "Proceso de envío iniciado en segundo plano",
      vencidos: alumnosVencidos.length,
    })

    // Envío en background
    console.log("📤 INICIO ENVÍO DE EMAILS")
    let enviados = 0

    for (const alumno of alumnosVencidos) {
      try {
        const destinatario = ENVIAR_EMAILS ? alumno.email : EMAIL_PRUEBA
        console.log(ENVIAR_EMAILS ? "📤 ENVÍO REAL" : "🧪 ENVÍO DE PRUEBA → email personal", alumno.nombre)

        await sendEmailVencidoAPI({
          to: destinatario,
          nombre: alumno.nombre,
          estado: alumno.estado,
          fechaVencimiento: alumno.fecha_vencimiento,
          modalidad: alumno.modalidad,
        })
        enviados++
      } catch (emailError) {
        console.error(`❌ Error enviando a ${alumno.email}:`, emailError.message)
      }
    }

    console.log("==============================================")
    console.log(ENVIAR_EMAILS
      ? `✅ EMAILS ENVIADOS: ${enviados}`
      : `🧪 MODO PRUEBA: ${enviados} emails enviados a ${EMAIL_PRUEBA}`
    )
    console.log("==============================================")
  } catch (err) {
    console.error("❌ Error enviando recordatorios:", err)
    if (!res.headersSent) {
      res.status(500).json({ error: "Error enviando recordatorios" })
    }
  }
}

export const previewRecordatoriosVencidos = async (req, res) => {
  try {
    const { alumnosVencidos, alumnosExcluidos } = await getAlumnosVencidos()

    return res.json({
      message: "Preview - No se enviaron emails",
      total: alumnosVencidos.length,
      alumnos: alumnosVencidos,
      excluidos: {
        total: alumnosExcluidos.sinEmail.length + alumnosExcluidos.sinPagos.length + alumnosExcluidos.enListaNegra.length,
        sin_email: alumnosExcluidos.sinEmail,
        sin_pagos: alumnosExcluidos.sinPagos,
        en_lista_negra: alumnosExcluidos.enListaNegra,
      }
    })
  } catch (err) {
    console.error("❌ Error en preview de recordatorios:", err)
    return res.status(500).json({ error: "Error obteniendo preview" })
  }
}

export async function sendTestAPIMail() {
  const sendSmtpEmail = new brevo.SendSmtpEmail()

  sendSmtpEmail.subject = "✅ Test Brevo API"
  sendSmtpEmail.sender = {
    name: "RM ENTRENADOR",
    email: process.env.BREVO_SENDER_EMAIL
  }
  sendSmtpEmail.to = [{ email: "nicopereyra855@gmail.com" }]
  sendSmtpEmail.htmlContent = `
    <h2>Brevo API funcionando</h2>
    <p>Este mail fue enviado usando <strong>Brevo API (HTTPS)</strong> en lugar de SMTP.</p>
  `

  await apiInstance.sendTransacEmail(sendSmtpEmail)
  console.log("📧 Test enviado correctamente vía API")
}
