# Changelog — RM Entrenador

---

## Funcionalidades principales

### Portal de Alumnos
- Nuevo login en `/portal/login` con autenticación via **Google (Gmail)** — sin usuario ni contraseña
- El alumno inicia sesión y ve automáticamente **su perfil**: nombre, email, plan, estado de pago, días de entrenamiento, fecha de nacimiento, inicio y última antropometría
- Muestra el **estado de suscripción** (Activo / Inactivo / Indefinido) con fecha de vencimiento
- Botones de acceso rápido a **WhatsApp del entrenador** y al **plan de entrenamiento** en Google Drive
- Sección "Mis antropometrías" reservada para próximas funcionalidades
- La sesión **se mantiene activa 60 días** — el alumno no necesita volver a loguearse aunque cierre el navegador
- Nueva sección **Portal** en el dashboard del entrenador, con el link listo para copiar y compartir con los alumnos

### Historial de Pagos
- Cada vez que se registra o edita un pago, el sistema guarda automáticamente un **registro del cambio** en una tabla de historial
- El entrenador puede ver el historial completo de un alumno desde el módulo de pagos
- **Editar entradas del historial**: al editar la entrada más reciente, también se actualiza el pago activo del alumno
- **Eliminar entradas del historial** en caso de error
- Vista global de historial con búsqueda, estadísticas de renovaciones y total recaudado

### Editor de descripción en Planes
- El campo de descripción de cada plan ahora es un **editor de texto enriquecido** con soporte para:
  - Negrita, cursiva y subrayado
  - Alineación de texto (izquierda, centro, derecha)
  - Listas con viñetas y numeradas
  - **9 colores** de texto
- El formato se guarda y se visualiza correctamente en la tabla de planes

### Navegación mobile rediseñada
- Se reemplazó el menú de tabs superior por una **barra de navegación inferior fija** con íconos para Alumnos, Pagos, Planes y Portal — más intuitivo y moderno en celular

---

## Funcionalidades secundarias

### Pagos
- **Confirmación antes de guardar**: al registrar o editar un pago, aparece un paso de revisión con el resumen antes de confirmar
- **Duración del pago con descuentos**: botones para elegir 1, 3 o 6 meses — 3 meses aplica 10% de descuento, 6 meses aplica 15%
- El botón seleccionado queda resaltado visualmente con el color primario
- Al seleccionar un plan, el monto se completa automáticamente

### Alumnos
- El **estado de suscripción** (Activo/Inactivo) en la tabla ahora muestra la **fecha de vencimiento** al pasar el cursor o tocar el badge
- En mobile, al tocar el badge de estado aparece un tooltip con la fecha

### Planes
- En la tabla de planes, la descripción muestra solo la primera oración — el resto se guarda completo y se ve al editar

---

## Mejoras estéticas

- **Modales de eliminación** rediseñados con la misma estética que el resto de modales (header con ícono, cuerpo compacto, footer con botones)
- Foco (focus ring) eliminado en inputs y selects — look más limpio al interactuar
- **Botones flotantes** de "Agregar" en mobile subidos para no quedar tapados por la barra inferior
- Indicador de errores de desarrollo de Next.js ocultado en producción
- Header del portal de alumnos con más padding y mayor presencia visual
- Sección de planes con ancho consistente respecto a las demás secciones

---

## Cambios técnicos / arquitectura

- Reorganización de componentes por módulos: `components/students/`, `components/payments/`, `components/planes/`, `components/tables/`, `components/layout/`
- Migración completa de Google Sheets a **Supabase** como base de datos
- Implementación de **React Query (TanStack)** para manejo de caché y sincronización de datos
- Nuevo **DataGrid genérico** reutilizable basado en MUI X con soporte de columnas responsivas, row click y paginación
- Hook `use-planes` centraliza el fetching de planes en toda la app
- Utilidades `payment-utils.ts` y `query-keys.ts` compartidas entre módulos
- Autenticación de alumnos con **NextAuth + Google OAuth**
- Backend: nuevos endpoints para historial de pagos, búsqueda por email y gestión de planes
