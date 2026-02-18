alter table user_profiles
  add column if not exists last_accessed_at timestamptz default null;

create or replace function public.touch_last_accessed_at(p_user_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update user_profiles
  set last_accessed_at = now()
  where id = p_user_id
    and (last_accessed_at is null or last_accessed_at < now() - interval '15 min');
$$;
