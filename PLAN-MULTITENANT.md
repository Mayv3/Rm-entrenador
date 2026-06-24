# Plan de Multitenancy — RM Entrenador

> Objetivo: convertir la app de **un solo entrenador** (Rodrigo / "RM") a **multitenant**,
> donde existe un rol **admin RMA** que administra entrenadores, y cada **entrenador** tiene
> su panel aislado con sus propios alumnos, planes, pagos, planificaciones, etc.

---

## 0. Cuadro sinóptico

> **Lectura en 1 línea:** cada **entrenador** es un *tenant*; todo lo suyo lleva `entrenador_id`;
> **RLS** en la base garantiza que solo vea lo propio; el **admin RMA** ve todos y los crea;
> la **biblioteca** de ejercicios se comparte (NULL) o se personaliza por entrenador.

```
                                    ┌─ ROLES ──────────┬─ Admin RMA ── ve TODO, crea entrenadores, NO tiene alumnos*
                                    │                  └─ Entrenador ── ve SOLO lo suyo (su panel aislado)
                                    │
                                    │                  ┌─ entrenadores ── tenant = id de auth.users (1:1)
                                    ├─ TABLAS NUEVAS ──┤
                                    │                  └─ perfiles ────── rol (admin/entrenador) + entrenador_id
                                    │
                                    │                  ┌─ Tenant-scoped (17) ── entrenador_id NOT NULL
                                    │                  │     alumnos, planes, servicios, pagos,
                                    │                  │     planificaciones + hijos, entrenamientos...
                                    │                  │     · raíz: alumnos
   MULTITENANT ────────────────────┤                  │     · hijos: heredan entrenador_id por TRIGGER
   (tenant = ENTRENADOR)            ├─ LAS 21 TABLAS ──┤
                                    │                  └─ Biblioteca (4) ─── entrenador_id NULLABLE
                                    │                        ejercicios, tipos, movilidad, plantillas
                                    │                        · NULL  = global (todos lo ven)
                                    │                        · valor = privado del entrenador
                                    │
                                    │                  ┌─ Helpers ── mi_entrenador_id() · es_admin()
                                    ├─ AISLAMIENTO ────┤
                                    │  (RLS en DB)     └─ Policy ──── "es admin OR entrenador_id = el mío"
                                    │                                 (hoy RLS OFF = todo expuesto ⚠️)
                                    │
                                    │                  ┌─ Entrenador/Admin ── Supabase Auth (mata user/pass hardcode)
                                    ├─ LOGIN ──────────┤
                                    │                  └─ Alumno (portal) ─── sigue Google, servido por backend
                                    │
                                    │                  ┌─ Con JWT usuario ── RLS aplica sola  (panel)
                                    ├─ BACKEND KEYS ───┤
                                    │  (no + anon fija)└─ service_role ───── portal/cron, scoping manual
                                    │
                                    │                  ┌─ Datos viejos → backfill a RODRIGO
                                    └─ MIGRACIÓN ──────┤  biblioteca base → global (NULL)
                                       (6 fases)       └─ esquema→backfill→auth→RLS ON→panel RMA→branding
```

`*` = decisión abierta #3 (¿admin también entrena?). Ver §14.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|------|----------|
| **Aislamiento de datos** | Supabase Auth + **RLS** por `entrenador_id`. Aislamiento garantizado en la base de datos, no solo en el backend. |
| **Biblioteca técnica** (ejercicios, tipos, movilidad, plantillas) | **Base compartida + propios**: `entrenador_id IS NULL` = global (visible para todos, solo lectura para no-admin); con valor = privado del entrenador. |
| **Planes y servicios** | **Únicos por entrenador** (`entrenador_id NOT NULL`). Cada entrenador cobra distinto. |
| **Alta de entrenadores** | **Solo el admin RMA** los crea desde su panel. No hay registro abierto. |
| **Datos existentes** | Se migran (backfill) al primer entrenador = **Rodrigo**. La biblioteca técnica base se marca global (`NULL`). |

---

## 2. Estado actual (lo que hay hoy)

- **Stack:** Next.js (`frontend/`) + Express (`backend/`) + Supabase (Postgres).
- **Backend:** usa **anon/publishable key fija** (`backend/lib/supabase.js`) — sin auth por usuario. Cualquier request ejecuta queries globales.
- **Login admin:** usuario/clave **hardcodeados** en env (`LOGIN_USERNAME`/`LOGIN_PASSWORD`), `frontend/app/api/login/route.ts` → `localStorage.isAuthenticated`. Sin identidad real ni tenant.
- **Portal alumno:** NextAuth Google OAuth (`app/api/auth/[...nextauth]`) → backend busca alumno por email.
- **RLS:** **apagado en las 21 tablas** (advisory crítico de Supabase: cualquiera con la anon key lee/escribe todo).
- **Frontend usa supabase-client directo en:** `app/portal/page.tsx`, `components/antropometrias/antro-upload-dialog.tsx`, `components/nutricion/nutricion-upload-dialog.tsx` (storage + lecturas). **Rompen bajo RLS** y hay que enrutarlos por backend (ver §8).

### 2.1 Las 21 tablas y su clasificación de tenancy

| Tabla | Filas | Categoría | `entrenador_id` |
|-------|------:|-----------|-----------------|
| `alumnos` | 56 | **Raíz de tenant** | NOT NULL |
| `planes` | 3 | Por entrenador | NOT NULL |
| `servicios` | 2 | Por entrenador | NOT NULL |
| `pagos` | 54 | Hijo de alumno | NOT NULL (denormalizado) |
| `historial_pagos` | 151 | Hijo de pago/alumno | NOT NULL (denormalizado) |
| `antropometrias` | 39 | Hijo de alumno | NOT NULL (denormalizado) |
| `nutricion` | 2 | Hijo de alumno | NOT NULL (denormalizado) |
| `planificaciones` | 18 | Hijo de alumno | NOT NULL (denormalizado) |
| `planificacion_hojas` | 21 | Hijo de planificación | NOT NULL (denormalizado) |
| `planificacion_dias` | 66 | Hijo de hoja | NOT NULL (denormalizado) |
| `planificacion_ejercicios` | 446 | Hijo de día | NOT NULL (denormalizado) |
| `planificacion_semanas` | 2676 | Hijo de plan_ejercicio | NOT NULL (denormalizado) |
| `planificacion_movilidad` | 122 | Hijo de hoja | NOT NULL (denormalizado) |
| `entrenamiento_sesiones` | 77 | Hijo de alumno/plan | NOT NULL (denormalizado) |
| `entrenamiento_registros` | 396 | Hijo de sesión | NOT NULL (denormalizado) |
| `entrenamiento_estado_diario` | 77 | Hijo de alumno | NOT NULL (denormalizado) |
| `asistencias_alumnos` | 65 | Hijo de alumno | NOT NULL (denormalizado) |
| `ejercicios` | 416 | **Biblioteca compartida** | NULLABLE (NULL=global) |
| `tipos_ejercicio` | 17 | **Biblioteca compartida** | NULLABLE (NULL=global) |
| `ejercicios_movilidad` | 18 | **Biblioteca compartida** | NULLABLE (NULL=global) |
| `planificacion_plantillas` | 5 | **Biblioteca compartida** | NULLABLE (NULL=global) |

> **Denormalización:** cada tabla hija lleva su propio `entrenador_id` (copiado del padre vía trigger).
> Alternativa = policies con `EXISTS` subiendo la cadena de FKs (sin columna extra pero policies lentas y complejas, sobre todo `planificacion_semanas` con 2676 filas).
> **Recomendado: denormalizar** — policies uniformes de una línea y rápidas. El costo es backfill + un trigger por tabla que copia `entrenador_id` del padre al insertar.

---

## 3. Modelo de datos nuevo

### 3.1 Tablas nuevas

```sql
-- Tenant = entrenador. id = auth.users.id (1:1 con la cuenta).
create table public.entrenadores (
  id           uuid primary key references auth.users(id) on delete cascade,
  nombre       text not null,
  email        text not null unique,
  telefono     text,
  logo_url     text,
  slug         text unique,              -- para URL/branding por entrenador (opcional)
  activo       boolean not null default true,
  creado_por   uuid references auth.users(id),  -- admin RMA que lo dio de alta
  created_at   timestamptz not null default now()
);

-- Perfil + rol de cada cuenta auth (admin RMA o entrenador).
create table public.perfiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  rol            text not null check (rol in ('admin','entrenador')),
  entrenador_id  uuid references public.entrenadores(id) on delete cascade,
  -- entrenador: entrenador_id = su propio id. admin: entrenador_id NULL.
  created_at     timestamptz not null default now(),
  constraint chk_entrenador_tiene_tenant
    check (rol = 'admin' or entrenador_id is not null)
);
```

### 3.2 Columna `entrenador_id` en todas las tablas tenant-scoped

```sql
-- Tablas con tenant obligatorio (raíz + hijos denormalizados):
alter table public.alumnos                     add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planes                       add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.servicios                    add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.pagos                        add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.historial_pagos             add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.antropometrias              add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.nutricion                    add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificaciones             add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_hojas         add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_dias          add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_ejercicios    add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_semanas       add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_movilidad     add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.entrenamiento_sesiones      add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.entrenamiento_registros     add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.entrenamiento_estado_diario add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.asistencias_alumnos         add column entrenador_id uuid references public.entrenadores(id) on delete cascade;

-- Biblioteca compartida (NULL = global, valor = privado del entrenador):
alter table public.ejercicios                  add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.tipos_ejercicio             add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.ejercicios_movilidad        add column entrenador_id uuid references public.entrenadores(id) on delete cascade;
alter table public.planificacion_plantillas    add column entrenador_id uuid references public.entrenadores(id) on delete cascade;

-- Índices (filtro caliente en cada query):
create index on public.alumnos (entrenador_id);
create index on public.pagos (entrenador_id);
create index on public.planificacion_semanas (entrenador_id);
-- ... un índice por tabla tenant-scoped.
```

### 3.3 Triggers que copian `entrenador_id` del padre

Para no depender del backend, cada tabla hija setea su `entrenador_id` desde el padre al insertar.

```sql
-- Ejemplo para planificacion_hojas (padre = planificaciones):
create or replace function public.set_entrenador_id_from_planificacion()
returns trigger language plpgsql security definer as $$
begin
  if new.entrenador_id is null then
    select entrenador_id into new.entrenador_id
    from public.planificaciones where id = new.planificacion_id;
  end if;
  return new;
end $$;

create trigger trg_hojas_entrenador
  before insert on public.planificacion_hojas
  for each row execute function public.set_entrenador_id_from_planificacion();
-- Repetir el patrón para cada tabla hija con su FK al padre correspondiente.
```

---

## 4. RLS (Row Level Security)

### 4.1 Funciones helper (rompen recursión, `security definer`)

```sql
-- entrenador_id del usuario actual (NULL si es admin).
create or replace function public.mi_entrenador_id()
returns uuid language sql stable security definer set search_path = public as $$
  select entrenador_id from public.perfiles where user_id = auth.uid();
$$;

-- ¿el usuario actual es admin RMA?
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'admin');
$$;
```

### 4.2 Plantilla de policy — tablas tenant-scoped

```sql
alter table public.alumnos enable row level security;

-- Admin ve/escribe todo; entrenador solo lo suyo.
create policy alumnos_tenant on public.alumnos
  for all
  using      ( public.es_admin() or entrenador_id = public.mi_entrenador_id() )
  with check ( public.es_admin() or entrenador_id = public.mi_entrenador_id() );
```
> Aplicar la misma policy (cambiando el nombre de tabla) a las **17 tablas tenant-scoped**.

### 4.3 Plantilla de policy — biblioteca compartida

```sql
alter table public.ejercicios enable row level security;

-- Lectura: admin todo; entrenador ve globales (NULL) + los suyos.
create policy ejercicios_select on public.ejercicios
  for select
  using ( public.es_admin() or entrenador_id is null or entrenador_id = public.mi_entrenador_id() );

-- Escritura: solo sobre filas propias (no se tocan las globales salvo admin).
create policy ejercicios_write on public.ejercicios
  for insert with check ( public.es_admin() or entrenador_id = public.mi_entrenador_id() );
create policy ejercicios_update on public.ejercicios
  for update using ( public.es_admin() or entrenador_id = public.mi_entrenador_id() );
create policy ejercicios_delete on public.ejercicios
  for delete using ( public.es_admin() or entrenador_id = public.mi_entrenador_id() );
```
> Aplicar a `ejercicios`, `tipos_ejercicio`, `ejercicios_movilidad`, `planificacion_plantillas`.

### 4.4 RLS de `entrenadores` y `perfiles`

```sql
alter table public.entrenadores enable row level security;
create policy entrenadores_admin on public.entrenadores for all
  using ( public.es_admin() ) with check ( public.es_admin() );
create policy entrenadores_self on public.entrenadores for select
  using ( id = auth.uid() );   -- el entrenador lee su propia ficha

alter table public.perfiles enable row level security;
create policy perfiles_self on public.perfiles for select using ( user_id = auth.uid() );
create policy perfiles_admin on public.perfiles for all
  using ( public.es_admin() ) with check ( public.es_admin() );
```

---

## 5. Backfill de datos existentes (a Rodrigo)

```sql
-- 1. Crear cuenta auth de Rodrigo (vía panel admin o SQL/admin API) y obtener su uuid → :rodrigo.
-- 2. Fila de entrenador + perfil:
insert into public.entrenadores (id, nombre, email, activo) values (:rodrigo, 'Rodrigo', :email, true);
insert into public.perfiles (user_id, rol, entrenador_id) values (:rodrigo, 'entrenador', :rodrigo);
-- (la cuenta admin RMA se crea aparte: perfiles.rol='admin', entrenador_id NULL)

-- 3. Asignar TODO lo tenant-scoped a Rodrigo:
update public.alumnos                     set entrenador_id = :rodrigo where entrenador_id is null;
update public.planes                       set entrenador_id = :rodrigo where entrenador_id is null;
update public.servicios                    set entrenador_id = :rodrigo where entrenador_id is null;
update public.pagos                        set entrenador_id = :rodrigo where entrenador_id is null;
-- ... idem para las 17 tablas tenant-scoped.

-- 4. Biblioteca técnica base → GLOBAL (queda NULL, no se toca):
--    ejercicios, tipos_ejercicio, ejercicios_movilidad quedan con entrenador_id NULL = compartidos.
--    DECISIÓN PENDIENTE: ¿las 5 plantillas de Rodrigo quedan globales (NULL) o privadas de Rodrigo?
--    Por defecto las dejamos privadas de Rodrigo:
update public.planificacion_plantillas    set entrenador_id = :rodrigo where entrenador_id is null;

-- 5. Recién después de backfillear, poner NOT NULL en las tablas tenant-scoped:
alter table public.alumnos alter column entrenador_id set not null;
-- ... idem las 17.
```

---

## 6. Auth / Login

### 6.1 Entrenador + Admin RMA (panel)
- **Reemplazar** el login hardcodeado (`api/login/route.ts` + `localStorage.isAuthenticated`) por **Supabase Auth email/password** (`supabase.auth.signInWithPassword`).
- Tras login, el frontend obtiene la **sesión Supabase** (access token JWT). El JWT lleva `sub = auth.uid()`; el rol/tenant se resuelve por `perfiles`.
- **Routing por rol** tras login:
  - `rol = 'admin'` → panel RMA (gestión de entrenadores, vista global).
  - `rol = 'entrenador'` → su panel (igual al actual, pero scoped).
- El frontend manda el **access token en `Authorization: Bearer`** a cada request del backend.

### 6.2 Portal alumno
- Se mantiene NextAuth Google OAuth.
- El alumno **no** es usuario de Supabase Auth → sus datos se sirven **vía backend con service_role** (ver §7), scopeando por el alumno resuelto del email de la sesión NextAuth.
- **Edge case:** hoy el match es por email global. Con varios entrenadores, dos podrían tener un alumno con el mismo email. Definir: email único global, o resolver `(email, entrenador_id)`. Ver §10.

### 6.3 Estrategia de keys del backend (clave del aislamiento)
El backend deja de usar una anon key fija. Pasa a:

| Tipo de request | Cliente Supabase a usar |
|-----------------|-------------------------|
| Entrenador / Admin (con JWT) | Cliente **per-request** creado con el `Authorization: Bearer <jwt>` del usuario → **RLS aplica automáticamente**. |
| Portal alumno (NextAuth, sin JWT Supabase) | Cliente **service_role** + scoping manual por `alumno_id`/`entrenador_id` en el código. |
| Cron / mailing (sin usuario) | Cliente **service_role** + scoping explícito. |

```js
// backend/lib/supabase.js  (nuevo)
import { createClient } from '@supabase/supabase-js';

// Cliente con el JWT del usuario → respeta RLS.
export function supabaseForUser(jwt) {
  return createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

// Cliente service_role → bypassa RLS (solo portal/cron, con scoping manual).
export const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
```
> **Nueva env requerida:** `SUPABASE_SERVICE_ROLE_KEY` (solo backend, **nunca** en el frontend).

---

## 7. Cambios en el backend

1. **Middleware de auth/tenant** (nuevo `backend/middleware/auth.js`):
   - Lee `Authorization: Bearer`, valida el JWT (`supabaseAdmin.auth.getUser(jwt)`).
   - Carga `perfiles` → `req.user = { id, rol, entrenadorId }`.
   - Rechaza si no hay sesión válida en rutas protegidas.
   - Crea `req.supabase = supabaseForUser(jwt)` para que los controllers usen RLS.
2. **Refactor de controllers**: reemplazar `import { supabase }` por `req.supabase` (rutas de panel) o `supabaseAdmin` (portal/cron). Quitar la instancia global fija.
3. **Inserts**: setear `entrenador_id = req.user.entrenadorId` en `addClientSupabase`, `addPlan`, `addServicio`, etc. (los hijos lo heredan por trigger).
4. **Rutas admin RMA** (nuevo `backend/controllers/entrenadoresController.js`): CRUD de entrenadores (crear cuenta auth vía `supabaseAdmin.auth.admin.createUser`, fila `entrenadores` + `perfiles`, activar/desactivar).
5. **Portal/cron**: revisar `portalPlanController.js`, `mailingController.js`, `scripts/*` → usar `supabaseAdmin` con scoping por `entrenador_id` (los recordatorios deben agruparse por entrenador y mandar desde el remitente correcto).
6. **Cache** (`lib/cache.js`): las keys deben incluir `entrenador_id` para no mezclar tenants (`plan:<entrenadorId>:<...>`).

---

## 8. Cambios en el frontend

1. **Login** (`app/login/page.tsx`): pasar a `signInWithPassword`; guardar sesión Supabase (no `localStorage.isAuthenticated`).
2. **Cliente API**: adjuntar `Authorization: Bearer <access_token>` a cada fetch al backend (helper central).
3. **Guard de rutas por rol**: `admin` → `/admin` (panel RMA); `entrenador` → `/dashboard`. Bloquear `/admin` a no-admin.
4. **Panel admin RMA** (nuevo `app/admin/...`): listar entrenadores, crear (form: nombre, email, clave inicial), activar/desactivar, ver métricas básicas.
5. **Branding por entrenador**: logo/nombre del entrenador en su panel (hoy hardcodeado a Rodrigo/LOGO-RM). Usar `entrenadores.logo_url`/`nombre`.
6. **Mover usos directos de supabase-client** que rompen con RLS:
   - `app/portal/page.tsx`, `antro-upload-dialog.tsx`, `nutricion-upload-dialog.tsx` → enrutar por backend (o usar **signed URLs** de storage emitidas por el backend con service_role).

---

## 9. Storage (PDFs antro/nutrición, logos)

- Hoy los uploads van directo desde el frontend con anon key.
- Con RLS, definir **paths por tenant**: `antros/<entrenador_id>/<alumno_id>/<archivo>.pdf`.
- Opción A (recomendada): el frontend pide al backend una **signed upload/download URL** (backend usa service_role y valida el tenant). 
- Opción B: políticas RLS de Storage por prefijo de path = `entrenador_id`. Requiere que el alumno/entrenador esté autenticado en Supabase Auth (no aplica al portal alumno con NextAuth → usar Opción A para el portal).

---

## 10. Onboarding de un entrenador nuevo (flujo)

1. Admin RMA → "Nuevo entrenador" → ingresa nombre, email, clave inicial.
2. Backend (`supabaseAdmin.auth.admin.createUser`) crea la cuenta → uuid.
3. Inserta `entrenadores` (id=uuid) + `perfiles` (rol='entrenador', entrenador_id=uuid).
4. El entrenador arranca **vacío** de alumnos/planes, pero **ve la biblioteca global** (ejercicios/tipos/movilidad `NULL`).
5. (Opcional) seed inicial: planes/servicios por defecto, o clonar plantillas globales.
6. El entrenador entra con sus credenciales → ve solo su panel.

> **Alumnos cross-tenant:** decidir si el email de alumno es único global o por entrenador. Recomendado para el portal: el alumno elige/identifica a su entrenador (o email único global) para evitar ambigüedad en el login Google.

---

## 11. Fases de despliegue (orden seguro)

> Hacer todo primero en un **branch de Supabase** (`create_branch`) o staging, validar, y recién `merge`.

- **Fase 0 — Preparación**
  - [ ] Backup de la DB. Crear branch de Supabase para probar.
  - [ ] Agregar `SUPABASE_SERVICE_ROLE_KEY` al backend.
- **Fase 1 — Esquema (sin romper nada, RLS aún OFF)**
  - [ ] Migración: tablas `entrenadores`, `perfiles`.
  - [ ] Migración: columnas `entrenador_id` (nullable) + índices.
  - [ ] Migración: triggers de herencia de `entrenador_id`.
- **Fase 2 — Backfill**
  - [ ] Crear cuenta admin RMA + cuenta/entrenador Rodrigo.
  - [ ] Backfill de todas las filas a Rodrigo; biblioteca base → global (NULL).
  - [ ] `SET NOT NULL` en las 17 tablas tenant-scoped.
- **Fase 3 — Auth backend/frontend (RLS todavía OFF)**
  - [ ] `lib/supabase.js` per-request + service_role.
  - [ ] Middleware de auth/tenant. Refactor de controllers a `req.supabase`.
  - [ ] Login Supabase en frontend + token en requests.
  - [ ] Verificar que Rodrigo ve exactamente lo de siempre y el portal funciona.
- **Fase 4 — Funciones + RLS ON**
  - [ ] Funciones `mi_entrenador_id()`, `es_admin()`.
  - [ ] `ENABLE RLS` + policies tabla por tabla. Resolver advisory crítico.
  - [ ] Re-test completo (entrenador, admin, portal alumno, cron/mailing, storage).
- **Fase 5 — Panel admin RMA + alta de entrenadores**
  - [ ] CRUD de entrenadores (backend + `app/admin`).
  - [ ] Onboarding de un segundo entrenador de prueba → verificar aislamiento real (no ve datos de Rodrigo).
- **Fase 6 — Branding + limpieza**
  - [ ] Logo/nombre dinámico por entrenador.
  - [ ] Quitar `LOGIN_USERNAME`/`LOGIN_PASSWORD` y `localStorage.isAuthenticated`.

---

## 12. Riesgos y puntos a vigilar

- **RLS rompe el portal alumno** (NextAuth ≠ Supabase Auth) → portal debe ir por backend con service_role + scoping. **No olvidar** o el alumno deja de ver su plan.
- **service_role bypassa RLS** → todo código que la use debe scopear manualmente por `entrenador_id`. Es la principal superficie de bug de fuga de datos.
- **`planificacion_semanas` (2676 filas)**: confirmar que el trigger + índice no degraden el guardado masivo (`guardarPlanCompleto`/`saveAll`).
- **Cache en memoria** (`lib/cache.js`) sin tenant en la key = fuga entre entrenadores. Prefijar con `entrenador_id`.
- **Mailing/cron**: hoy asume un solo remitente. Multi-tenant → agrupar por entrenador y respetar su config de envío.
- **Migración irreversible parcial**: `SET NOT NULL` solo después de backfill 100% completo; si no, falla.
- **Email de alumno duplicado entre entrenadores** (login Google del portal). Definir antes de onboardear el 2º entrenador.
- **Frontend nunca debe tener la `service_role` key.**

---

## 13. Resumen de archivos a tocar

**Backend**
- `lib/supabase.js` (reescribir: per-request + service_role)
- `middleware/auth.js` (nuevo)
- `controllers/entrenadoresController.js` (nuevo)
- Todos los `controllers/*.js` (usar `req.supabase` / `supabaseAdmin`, setear `entrenador_id`)
- `server.js` (aplicar middleware, rutas `/admin/entrenadores`)
- `lib/cache.js` (prefijo de tenant)
- `controllers/mailingController.js`, `controllers/portalPlanController.js`, `scripts/*`

**Frontend**
- `app/login/page.tsx`, `app/api/login/route.ts` (Supabase Auth)
- helper de fetch (Bearer token)
- guard de rutas por rol
- `app/admin/*` (panel RMA — nuevo)
- `app/portal/page.tsx`, `components/antropometrias/antro-upload-dialog.tsx`, `components/nutricion/nutricion-upload-dialog.tsx` (storage vía backend)
- branding dinámico (logo/nombre)

**Base de datos (migraciones)**
- `entrenadores`, `perfiles`
- `entrenador_id` + índices (21 tablas)
- triggers de herencia
- funciones `mi_entrenador_id()`, `es_admin()`
- `ENABLE RLS` + policies (23 tablas)
- backfill a Rodrigo

---

## 14. Pregunta abierta antes de empezar a codear

1. Las **5 plantillas** de Rodrigo: ¿globales (todas las ven) o privadas suyas? (default del plan: privadas).
2. **Email de alumno**: ¿único global, o un alumno puede repetir email entre entrenadores?
3. ¿El admin RMA es **además** entrenador (tiene sus propios alumnos) o es **solo** administrador?
