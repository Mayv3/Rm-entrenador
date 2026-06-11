# Pendientes de cambios

## Estado: [ ] pendiente | [x] hecho

---

- [x] **1. Duplicar día de entrenamiento**
  - Botón para duplicar día completo (ejercicios, RPE, todo igual)

- [x] **2. Ver video al cargar ejercicio**
  - Botón de YouTube en lista de ejercicios al agregar un ejercicio al día en planificación

- [x] **3. Antropometrías ordenadas por fecha**
  - Ordenar descendente por fecha

- [x] **4. Comparar antropometrías disponible para el profesor**
  - Comparación de antros disponible en apartado del profesor (no solo alumno)
  - Botones "Comparar" + "Ver evolución" en AntroUploadDialog, reusan AntroCompareDialog/AntroAnualChart

- [x] **5. Fuente más grande en "¿Cómo estás hoy?"**
  - Agrandar la fuente de esa pregunta
  - text-sm→text-xl font-bold; subtítulo text-[11px]→text-sm

- [x] **6. Cuadro de accesorios debajo de movilidad**
  - Ejercicios categoría ACTIVADOR → bloque "Accesorios" solo-vista, debajo de movilidad / arriba de ejercicios
  - No se completan ni guardan (excluidos de ejerciciosDelDia). Muestran nombre + dosis/RPE + video

- [x] **7. Bug: Eliminar plan (hoja de planificaciones)**
  - Causa: FK RESTRICT (entrenamiento_sesiones.hoja_id/dia_id, entrenamiento_registros.planificacion_ejercicio_id) bloqueaban el delete si el alumno ya entrenó → 500 → hoja reaparecía
  - Fix: **soft delete**. Columna planificacion_hojas.deleted_at; deleteHoja hace UPDATE (no borra) + reasigna hoja_activa_id; lecturas filtran deleted_at IS NULL (getPlanificacionById, getPlanificaciones, duplicateHoja). Preserva progreso del alumno y evita RESTRICT. Front: rollback+alerta si falla
  - Verificado e2e: DELETE de hoja con sesión → ok, datos preservados, excluida de lecturas
  - **Papelera**: en plan-builder botón "Papelera" → diálogo lista hojas eliminadas del plan con "Restaurar". Endpoints GET /planificaciones/:id/hojas/eliminadas + POST /planificaciones/hojas/:hojaId/restore. Verificado e2e

- [x] **8. Semana 1: mostrar pesos de última semana del plan anterior**
  - "Plan anterior" = hoja anterior (bloque previo) del mismo plan
  - En semana 1, el bloque "anterior" por serie toma los pesos de la última semana entrenada de la hoja anterior, match por ejercicio_id (sem>1 sigue usando la semana previa por planificacion_ejercicio_id)
  - Backend: GET /portal/planificaciones/:planId/sesiones/hoja-anterior (por ejercicio_id, última semana con datos por ejercicio). Front: hojaAnterior memo + query semana 1 + label "Bloque anterior"
  - Endpoint verificado e2e. UI requiere plan con ≥2 hojas para verse

- [x] **9. Apartado de progreso para el alumno**
  - Alumno ve tabla igual que el profesor (progreso del alumno)
  - PlanProgresoDialog extraído a componente propio (plan-progreso-dialog.tsx) con prop readOnly; reusado en builder (editable) y portal alumno (solo ver)
  - Botón "Mi progreso" (TrendingUp) al lado del calendario en el sidebar Mi Plan. En readOnly la prescripción dosis/RPE/notas se muestra como texto estático (sin inputs ni guardar)

- [x] **10. Cambio de teclado en iOS en REPS**
  - Causa: input REPS usaba type="number" sin inputMode → iOS muestra teclado números+símbolos (no el keypad limpio que peso/rpe tienen con inputMode="decimal")
  - Fix: REPS ahora type="text" + inputMode="numeric" + pattern="[0-9]*" (enteros). Clamp 1-30 sigue en clampSerieValue

- [x] **11. 3 seg para cambio de input**
  - En los inputs de serie del alumno (peso/reps/rpe), 3s de inactividad tras escribir → salta al próximo input de la misma serie
  - handleSerieChange: fieldIdleTimerRef (Map por `ejId-serieIdx-field`), FIELD_IDLE_MS=3000. Solo enfoca si el usuario sigue parado en ese input (no roba foco si ya navegó). No corre si la serie quedó completa (lo maneja el advance de serie-llena 700ms). Timers limpiados en unmount
