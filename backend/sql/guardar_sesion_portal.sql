-- Paso 4 — Guardado atómico de la sesión del portal del alumno.
-- Reemplaza la secuencia de ~6 upserts sueltos (no transaccional) del controller por UNA
-- función plpgsql que corre en una sola transacción: o se guarda todo o no se guarda nada.
-- Elimina las escrituras parciales (sesión 'completado' sin registros) y agrega LWW por
-- client_rev para que un guardado reordenado/atrasado por la red no pise datos más nuevos.
--
-- Idempotente: se puede correr varias veces sin efecto adverso.

-- 1) Columna de revisión monotónica del cliente (anti-reordenamiento). Default 0 para filas viejas;
--    los guardados nuevos usan Date.now() (>> 0), así que el primer save tras el deploy siempre gana.
alter table public.entrenamiento_sesiones  add column if not exists client_rev bigint not null default 0;
alter table public.entrenamiento_registros add column if not exists client_rev bigint not null default 0;

-- 2) Función transaccional única.
create or replace function public.guardar_sesion_portal(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_alumno_id  bigint   := (p->>'alumno_id')::bigint;
  v_plan_id    bigint   := (p->>'planificacion_id')::bigint;
  v_hoja_id    bigint   := (p->>'hoja_id')::bigint;
  v_dia_id     bigint   := (p->>'dia_id')::bigint;
  v_semana     smallint := (p->>'semana')::smallint;
  v_estado     text     := coalesce(p->>'estado', 'abierta');
  v_fecha      date     := nullif(p->>'fecha_entrenamiento', '')::date;
  v_rev        bigint   := coalesce((p->>'client_rev')::bigint, 0);
  v_has_estado boolean  := (p ? 'estado_diario');
  v_sesion_id  bigint;
  v_invalidos  int;
  v_estado_fin text;
begin
  -- 1. Validar que cada registro enviado pertenezca al día (parityy con el chequeo previo del controller).
  select count(*) into v_invalidos
  from jsonb_array_elements(coalesce(p->'registros', '[]'::jsonb)) r
  left join planificacion_ejercicios pe
    on pe.id = (r->>'planificacion_ejercicio_id')::bigint
   and pe.planificacion_dia_id = v_dia_id
  where pe.id is null;

  if v_invalidos > 0 then
    raise exception 'EJERCICIO_NO_PERTENECE';
  end if;

  -- 2. Upsert de la sesión. El estado solo avanza si el client_rev entrante es >= al guardado (LWW).
  insert into entrenamiento_sesiones
    (alumno_id, planificacion_id, hoja_id, dia_id, semana, estado, fecha_entrenamiento, client_rev)
  values
    (v_alumno_id, v_plan_id, v_hoja_id, v_dia_id, v_semana, v_estado, v_fecha, v_rev)
  on conflict (alumno_id, planificacion_id, hoja_id, dia_id, semana) do update set
    estado = case when excluded.client_rev >= entrenamiento_sesiones.client_rev
                  then excluded.estado else entrenamiento_sesiones.estado end,
    fecha_entrenamiento = coalesce(excluded.fecha_entrenamiento, entrenamiento_sesiones.fecha_entrenamiento),
    client_rev = greatest(excluded.client_rev, entrenamiento_sesiones.client_rev)
  returning id into v_sesion_id;

  -- 3. Estado diario + asistencia (solo si el cliente envió el check-in).
  if v_has_estado then
    insert into entrenamiento_estado_diario
      (sesion_id, durmio_mal, fatiga, desmotivacion, dolor, excelente)
    values
      (v_sesion_id,
       coalesce((p#>>'{estado_diario,durmio_mal}')::boolean,    false),
       coalesce((p#>>'{estado_diario,fatiga}')::boolean,        false),
       coalesce((p#>>'{estado_diario,desmotivacion}')::boolean, false),
       coalesce((p#>>'{estado_diario,dolor}')::boolean,         false),
       coalesce((p#>>'{estado_diario,excelente}')::boolean,     false))
    on conflict (sesion_id) do update set
      durmio_mal    = excluded.durmio_mal,
      fatiga        = excluded.fatiga,
      desmotivacion = excluded.desmotivacion,
      dolor         = excluded.dolor,
      excelente     = excluded.excelente;

    -- Asistencia best-effort: si choca con el OTRO unique (alumno_id, fecha) de otra sesión del
    -- mismo día, se ignora sin abortar el guardado (mismo comportamiento que el controller actual,
    -- pero ahora dentro de la transacción mediante un savepoint implícito del bloque begin/exception).
    begin
      insert into asistencias_alumnos (alumno_id, fecha, planificacion_id, sesion_id)
      values (v_alumno_id, coalesce(v_fecha, current_date), v_plan_id, v_sesion_id)
      on conflict (alumno_id, sesion_id) do update set
        fecha            = excluded.fecha,
        planificacion_id = excluded.planificacion_id;
    exception when unique_violation then
      null;
    end;
  end if;

  -- 4. Upsert masivo de registros con los snapshots derivados por join (sin round-trips extra).
  if jsonb_array_length(coalesce(p->'registros', '[]'::jsonb)) > 0 then
    insert into entrenamiento_registros
      (sesion_id, planificacion_ejercicio_id, ejercicio_id, peso_kg, repeticiones, rpe,
       notas, series, ejercicio_nombre_snapshot, categoria_snapshot,
       prescripcion_dosis, prescripcion_rpe, client_rev)
    select
      v_sesion_id,
      pe.id,
      pe.ejercicio_id,
      coalesce((r#>>'{series,0,peso_kg}')::numeric,      (r->>'peso_kg')::numeric),
      coalesce((r#>>'{series,0,repeticiones}')::smallint,(r->>'repeticiones')::smallint),
      coalesce((r#>>'{series,0,rpe}')::numeric,          (r->>'rpe')::numeric),
      nullif(btrim(r->>'notas'), ''),
      coalesce(r->'series', '[]'::jsonb),
      coalesce(ej.nombre, 'Ejercicio'),
      pe.categoria,
      ps.dosis,
      ps.rpe,
      v_rev
    from jsonb_array_elements(p->'registros') r
    join planificacion_ejercicios pe
      on pe.id = (r->>'planificacion_ejercicio_id')::bigint
     and pe.planificacion_dia_id = v_dia_id
    left join ejercicios ej on ej.id = pe.ejercicio_id
    left join planificacion_semanas ps
      on ps.planificacion_ejercicio_id = pe.id and ps.semana = v_semana
    on conflict (sesion_id, planificacion_ejercicio_id) do update set
      peso_kg                   = excluded.peso_kg,
      repeticiones              = excluded.repeticiones,
      rpe                       = excluded.rpe,
      notas                     = excluded.notas,
      series                    = excluded.series,
      ejercicio_nombre_snapshot = excluded.ejercicio_nombre_snapshot,
      categoria_snapshot        = excluded.categoria_snapshot,
      prescripcion_dosis        = excluded.prescripcion_dosis,
      prescripcion_rpe          = excluded.prescripcion_rpe,
      client_rev                = greatest(excluded.client_rev, entrenamiento_registros.client_rev)
    where excluded.client_rev >= entrenamiento_registros.client_rev;
  end if;

  select estado into v_estado_fin from entrenamiento_sesiones where id = v_sesion_id;

  return jsonb_build_object('ok', true, 'sesion_id', v_sesion_id, 'estado', v_estado_fin);
end;
$func$;

grant execute on function public.guardar_sesion_portal(jsonb) to anon, authenticated, service_role;
