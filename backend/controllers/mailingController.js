import { supabase } from "../lib/supabase.js"
import nodemailer from "nodemailer"

export const smtpTransporter = nodemailer.createTransport({
    from: `"RM ENTRENADOR" <${process.env.BREVO_SENDER_EMAIL}>`,
    host: process.env.BREVO_SMTP_HOST,
    port: process.env.BREVO_SMTP_PORT,
    secure: false, // puerto 587
    auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_PASS,
    },
})

smtpTransporter.verify((err) => {
    if (err) {
        console.error("❌ SMTP NO OK:", err.message)
    } else {
        console.log("✅ SMTP listo para enviar mails")
    }
})

async function sendEmailVencidoSMTP({
    to,
    nombre,
    estado,
    fechaVencimiento,
    modalidad,
}) {
    await smtpTransporter.sendMail({
        from: `"RM ENTRENADOR" <${process.env.BREVO_SENDER_EMAIL}>`,
        to,
        subject: "⚠️ Tu plan venció – Regularizá para seguir entrenando",
        html: `
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

    `,
    })

    console.log(`📧 SMTP enviado → ${to} | ${nombre} | ${estado}`)
}


export const enviarRecordatoriosVencidos = async (req, res) => {
    try {
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

        for (const alumno of alumnos) {
            if (!alumno.email || !alumno.pagos?.length) continue

            const ultimoVencimiento = alumno.pagos
                .map(p => new Date(p.fecha_de_vencimiento))
                .sort((a, b) => b - a)[0]

            if (ultimoVencimiento <= hoy) {
                const diasVencido = Math.floor(
                    (hoy - ultimoVencimiento) / (1000 * 60 * 60 * 24)
                )

                alumnosVencidos.push({
                    nombre: alumno.nombre,
                    email: alumno.email,
                    modalidad: alumno.modalidad,
                    fecha_vencimiento: ultimoVencimiento.toLocaleDateString("es-AR"),
                    dias_vencido: diasVencido,
                    estado: "VENCIDO",
                })
            }
        }

        /* ========== LOGS ========== */
        console.log("==============================================")
        console.log("📛 ALUMNOS CON PLAN VENCIDO")
        console.log(`🔢 Cantidad total: ${alumnosVencidos.length}`)

        if (alumnosVencidos.length) {
            console.table(alumnosVencidos)
        } else {
            console.log("✅ No hay alumnos vencidos")
        }

        console.log("==============================================")

        console.log("==============================================")
        console.log("📤 INICIO ENVÍO DE EMAILS")
        console.log("==============================================")

        let enviados = 0


        for (const alumno of alumnosVencidos) {
            console.log(`Enviando email a: ${alumno}`)
            await sendEmailVencidoSMTP({
                to: alumno.email,
                nombre: alumno.nombre,
                estado: alumno.estado,
                fechaVencimiento: alumno.fecha_vencimiento,
                modalidad: alumno.modalidad,
            })
            enviados++
        }

        console.log("==============================================")
        console.log(`✅ EMAILS ENVIADOS: ${enviados}`)
        console.log("==============================================")

        return res.json({
            message: "Proceso finalizado",
            vencidos: alumnosVencidos.length,
        })
    } catch (err) {
        console.error("❌ Error enviando recordatorios:", err)
        return res.status(500).json({ error: "Error enviando recordatorios" })
    }
}

export async function sendTestSMTPMail() {
    await smtpTransporter.sendMail({
        from: `"${process.env.BREVO_SENDER_NAME}" <${process.env.BREVO_SENDER_EMAIL}>`,
        to: "rm.entrenador.planes@gmail.com",
        subject: "✅ Test SMTP Brevo",
        html: `
      <h2>SMTP funcionando</h2>
      <p>Este mail fue enviado usando <strong>SMTP Brevo</strong>.</p>
    `,
    })

    console.log("📧 SMTP test enviado correctamente")
}