# SQL a agregar: notas del profesor por ejercicio

Este cambio agrega **1 columna nueva** a la tabla `planificacion_ejercicios` para que el profesor pueda dejar notas/instrucciones por ejercicio, visibles para el alumno.

## SQL

```sql
alter table public.planificacion_ejercicios
  add column if not exists notas_profesor text null;
```

## Resultado esperado

- Se agrega la columna `notas_profesor` (nullable) a `planificacion_ejercicios`.
- El profesor puede editar la nota desde el plan builder (debajo de cada ejercicio).
- El alumno la ve como lectura en su sección de planificación, encima del campo "Mis notas".
- No rompe nada existente — columna opcional.
