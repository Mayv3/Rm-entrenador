create table if not exists public.servicios (
  id bigserial primary key,
  nombre text not null,
  precio numeric not null default 0,
  descripcion text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.servicios add column if not exists color text;

create index if not exists servicios_nombre_idx on public.servicios (nombre);

create or replace function public.set_servicios_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists servicios_set_updated_at on public.servicios;
create trigger servicios_set_updated_at
before update on public.servicios
for each row
execute function public.set_servicios_updated_at();
