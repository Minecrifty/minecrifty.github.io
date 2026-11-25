-- Minecrifty Web · configuración de Supabase
-- Pégalo completo en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

-- 1) Tabla de perfiles (una fila por cuenta) ------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text not null check (char_length(username) between 1 and 32),
  avatar_url       text check (avatar_url is null or avatar_url ~ '^https://'),
  bedrock_gamertag text check (bedrock_gamertag is null or bedrock_gamertag ~ '^[A-Za-z0-9][A-Za-z0-9 #]{0,19}$'),
  skin_url         text check (skin_url is null or skin_url ~ '^https://'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Permisos de la API: cada cuenta solo llega a su propia fila gracias a las reglas RLS de abajo
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- 2) Perfil automático al crear una cuenta ---------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  i int := 0;
begin
  base := left(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Jugador'
  ), 32);
  candidate := base;
  loop
    begin
      insert into public.profiles (id, username) values (new.id, candidate)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      -- Nombre ocupado: se añade un sufijo corto (la persona puede cambiarlo luego en su perfil)
      i := i + 1;
      if i > 5 then raise; end if;
      candidate := left(base, 26) || '_' || substr(md5(new.id::text || i::text), 1, 5);
    end;
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Perfiles para cuentas que ya existían antes de ejecutar este script
insert into public.profiles (id, username)
select u.id, left(coalesce(nullif(split_part(u.email, '@', 1), ''), 'Jugador'), 32)
from auth.users u
on conflict (id) do nothing;

-- 3) updated_at automático ---------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 4) Almacenamiento: fotos de perfil y skins ---------------------------------------------
-- Públicos para lectura (se muestran con una URL); solo el dueño puede escribir en su carpeta <user_id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 524288, array['image/png', 'image/jpeg', 'image/webp']),
  ('skins',   'skins',   true, 262144, array['image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

do $$
declare b text;
begin
  foreach b in array array['avatars', 'skins'] loop
    execute format('drop policy if exists %I on storage.objects', b || '_select_own');
    execute format('drop policy if exists %I on storage.objects', b || '_insert_own');
    execute format('drop policy if exists %I on storage.objects', b || '_update_own');
    execute format('drop policy if exists %I on storage.objects', b || '_delete_own');

    execute format($p$create policy %I on storage.objects for select to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_select_own', b);
    execute format($p$create policy %I on storage.objects for insert to authenticated
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_insert_own', b);
    execute format($p$create policy %I on storage.objects for update to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_update_own', b, b);
    execute format($p$create policy %I on storage.objects for delete to authenticated
      using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b || '_delete_own', b);
  end loop;
end $$;

-- 5) Inicio de sesión con nombre de usuario o correo --------------------------------------
-- Los nombres de usuario deben ser únicos (sin distinguir mayúsculas). Si hubiera repetidos, se renombran.
with d as (
  select id, row_number() over (partition by lower(username) order by created_at, id) as rn
  from public.profiles
)
update public.profiles p
   set username = left(p.username, 26) || '_' || substr(md5(p.id::text), 1, 5)
  from d
 where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- ¿Está libre ese nombre? Solo responde sí/no.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
     where lower(username) = lower(btrim(coalesce(p_username, '')))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

-- Intentos fallidos de inicio de sesión con usuario (límite contra fuerza bruta). Nadie puede leerla desde la web.
create table if not exists public.login_attempts (
  username     text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_user_idx on public.login_attempts (username, attempted_at);
create index if not exists login_attempts_time_idx on public.login_attempts (attempted_at);
alter table public.login_attempts enable row level security;

-- Devuelve el correo de ese usuario SOLO si la contraseña es correcta (así nadie puede sacar correos ajenos).
-- Tras 8 intentos fallidos con un mismo usuario se bloquea 10 minutos; por correo siempre se puede entrar.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.login_email(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_name   text := lower(btrim(coalesce(p_username, '')));
  v_email  text;
  v_hash   text;
  v_recent int;
begin
  if v_name = '' or coalesce(p_password, '') = '' then
    return null;
  end if;

  select count(*) into v_recent
    from public.login_attempts
   where username = v_name and attempted_at > now() - interval '10 minutes';
  if v_recent >= 8 then
    return null;
  end if;

  select u.email, u.encrypted_password into v_email, v_hash
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(p.username) = v_name
   limit 1;

  if v_email is not null and coalesce(v_hash, '') <> '' and v_hash = crypt(p_password, v_hash) then
    delete from public.login_attempts where username = v_name;
    return v_email;
  end if;

  insert into public.login_attempts (username) values (v_name);
  delete from public.login_attempts where attempted_at < now() - interval '1 day';
  return null;
end;
$$;

revoke all on function public.login_email(text, text) from public;
grant execute on function public.login_email(text, text) to anon, authenticated;
