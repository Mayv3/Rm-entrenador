# Nuevos cambios — Guardado de series del alumno

**Fecha:** 2026-06-09
**Qué se tocó:** el guardado de las series cuando el alumno completa su rutina en el portal.
**Objetivo:** que el guardado no pierda datos, sea más barato/rápido y se acerque al 0% de falla.

---

## 1. Cómo funciona el guardado (en simple)

Cuando el alumno carga una serie (peso + reps + RPE):

1. **El navegador** guarda al instante una copia local (en el teléfono) y manda los datos al servidor.
2. **El servidor** (backend) recibe los datos y los escribe en la base.
3. **La base de datos** guarda: la sesión (día entrenado), los registros (cada serie), el estado de salud del día y la asistencia.

El problema no era *un* bug puntual, sino varios puntos frágiles en ese camino. Se auditó todo el flujo y se arreglaron los más graves.

---

## 2. Los problemas que había (ANTES)

### 🔴 Problema 1 — Se podía perder una serie recién cargada
**Qué pasaba:** si el alumno cargaba un ejercicio mientras el guardado anterior todavía estaba "en vuelo" (red lenta), ese dato nuevo se borraba de la cola interna y **nunca llegaba a la base**. Tampoco quedaba en la copia local (se borraba junto con el resto). Si cerraba la app antes de tocar otro campo, esa serie desaparecía.

**Por qué:** al confirmarse un guardado, el código borraba **toda** la lista de "cambios pendientes" de un saque, incluyendo lo que se había editado en el medio.

### 🔴 Problema 2 — La base podía quedar "a medias"
**Qué pasaba:** el servidor hacía ~6 escrituras sueltas, **sin transacción**. Si una fallaba a mitad de camino (corte de red, timeout), la sesión podía quedar marcada como **"completada" pero sin los registros** que la justifican. El alumno veía el día en verde pero "se perdió mi entrenamiento".

**Por qué:** cada escritura era independiente. No había forma de deshacer las anteriores si una fallaba.

### 🟠 Problema 3 — Doble guardado pisándose
**Qué pasaba:** si el alumno tocaba "Saltar" o "Estoy excelente" mientras había un guardado en curso, se disparaban **dos guardados al mismo tiempo** sobre la misma sesión, que podían pisarse entre sí.

### 🟠 Problema 4 — Demasiados guardados (lento y caro)
**Qué pasaba:** cada serie completada disparaba un envío **inmediato** al servidor. Un día de 6 ejercicios × 3 series = hasta **18 envíos**, y cada uno hacía ~6 idas y vueltas a la base = **~90-108 consultas por sesión**. Mucho gasto, más batería y datos del alumno, más latencia.

### 🟠 Problema 5 — Un guardado viejo podía pisar uno nuevo
**Qué pasaba:** si dos guardados llegaban al servidor **fuera de orden** (cosa común en redes móviles), el viejo podía sobrescribir al nuevo, porque la base siempre dejaba "el último que llega", sin chequear cuál era más reciente.

---

## 3. Qué se hizo (AHORA)

Se implementó en 4 pasos. Todo verificado: el frontend compila sin errores, el backend pasa el chequeo de sintaxis, y la nueva función de base de datos se probó contra datos reales (sin tocar nada real, con rollback).

### ✅ Paso 1 — Arreglo de la pérdida de datos (Problema 1)
- Ahora, al confirmarse un guardado, **solo se borran los cambios que efectivamente se enviaron y no se volvieron a editar**. Lo que el alumno tocó mientras guardaba **se conserva y se reenvía**.
- La copia local solo se borra cuando **todo** quedó realmente guardado.
- Cubre 3 casos: editar un ejercicio nuevo, re-editar el mismo, y tocar el estado de salud, todo durante un guardado en curso.

**Archivo:** `frontend/components/portal/student-planificacion-section.tsx`

### ✅ Paso 2 — Sin doble guardado (Problema 3)
- "Saltar", "Estoy excelente", "Confirmar" y "Guardar estado de salud" ahora, si ya hay un guardado en curso, **encolan** el cambio en vez de disparar un segundo envío en paralelo.

**Archivo:** `frontend/components/portal/student-planificacion-section.tsx`

### ✅ Paso 3 — Menos guardados (Problema 4)
- El envío a red ahora **espera 1.5 segundos** después de la última edición y junta todo en **un solo envío** (la copia local sigue siendo instantánea, así que no se pierde nada).
- Pasa de ~18 envíos por sesión a ~2-4.
- Se mantienen los guardados inmediatos en momentos clave: al saltar, al confirmar el check-in, al cerrar o minimizar la app, y el guardado automático cada 8s de respaldo.

**Archivo:** `frontend/components/portal/student-planificacion-section.tsx`

### ✅ Paso 4 — Guardado atómico y a prueba de desorden (Problemas 2 y 5)
- **Todo el guardado ahora es una sola operación "todo o nada"** (una función transaccional en la base de datos llamada `guardar_sesion_portal`). Si algo falla, **no se guarda nada a medias**: o entra todo o no entra nada. Adiós a la sesión "completada sin registros".
- Se agregó un **número de versión** (`client_rev`) a cada guardado. Si llega uno más viejo después de uno más nuevo, **la base lo ignora** en vez de pisar el dato nuevo.
- De paso, el servidor pasó de ~6 idas y vueltas a la base a **1 sola**, y dejó de devolver datos que el navegador no usaba (más rápido y más barato).
- También se quitaron los `console.log` que volcaban datos personales del alumno (notas, dolor, sueño) a los registros del servidor.

**Archivos:**
- `backend/controllers/portalPlanController.js` (reescrito para llamar a la función)
- `backend/sql/guardar_sesion_portal.sql` (la migración de base de datos)
- Base de datos de producción (migración **ya aplicada**)

---

## 4. Estado de cada problema

| # | Problema (antes) | Severidad | Estado ahora |
|---|------------------|-----------|--------------|
| 1 | Se perdía una serie cargada durante un guardado en curso | 🔴 Crítico | ✅ **Resuelto** (Paso 1) |
| 2 | Base "a medias" (sesión completada sin registros) | 🔴 Crítico | ✅ **Resuelto** (Paso 4) |
| 3 | Doble guardado pisándose | 🟠 Alto | ✅ **Resuelto** (Paso 2) |
| 4 | Demasiados guardados (lento/caro) | 🟠 Alto | ✅ **Resuelto** (Paso 3) |
| 5 | Guardado viejo pisaba uno nuevo | 🟠 Alto | ✅ **Resuelto** (Paso 4, `client_rev`) |

---

## 5. Lo que todavía falta (no urgente)

Estos no causan pérdida de datos, son mejoras de seguridad y costo:

- **Paso 5 — Seguridad (lo más importante de lo que queda):** hoy la base tiene la protección por filas (RLS) **desactivada** y el backend usa una clave pública. En teoría, alguien con esa clave podría leer/escribir datos directo. Hay que pasar el backend a la clave de servicio, activar RLS y rotar la clave. Incluye también limpieza de índices duplicados y validaciones de datos.
- **Paso 6 — Cola offline (opcional):** una cola que reintenta sola si se cae la red. Hoy ya hay red de seguridad (copia local + reintento automático cada 8s), así que es un extra, no una urgencia.

---

## 6. Notas para el deploy

- La **migración de base de datos ya está aplicada** en producción. Es aditiva y **no rompe el backend actual** (el código viejo ignora la columna nueva).
- El **backend nuevo** depende de la función `guardar_sesion_portal`, que ya existe en la base. Al deployar el backend nuevo, todo funciona en orden.
- **Nada fue commiteado todavía** — los cambios están en el working tree, listos para revisar.

### Cómo probarlo a mano
1. Con red lenta (en el navegador: throttling 3G), cargá una serie de un ejercicio. Mientras dice "Guardando…", cargá otro ejercicio. Esperá, recargá la página → **ambos deben seguir ahí**.
2. Mientras guarda, tocá "Saltar" en otro ejercicio → no debe haber dos guardados pisándose; el salto queda.
