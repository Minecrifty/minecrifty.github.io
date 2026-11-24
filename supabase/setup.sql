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
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    left(coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Jugador'
    ), 32)
  )
  on conflict (id) do nothing;
  return new;
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
