-- Tighten auth/profile/vote behavior for end-to-end Supabase-backed API mode.

-- Ensure profile row exists for each auth user.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, new.id::text), '@', 1)),
    coalesce(new.email, concat(new.id::text, '@unknown.local')),
    'member'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

-- Profile access: user can read/update only own profile.
drop policy if exists "read own profile" on user_profiles;
create policy "read own profile"
on user_profiles for select
using (auth.uid() = id);

drop policy if exists "update own profile" on user_profiles;
create policy "update own profile"
on user_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- Blind-vote protection for direct table access:
-- authenticated users can read only their own vote rows.
drop policy if exists "read all votes" on votes;
drop policy if exists "read own votes" on votes;
create policy "read own votes"
on votes for select
using (auth.uid() = voter_id);
