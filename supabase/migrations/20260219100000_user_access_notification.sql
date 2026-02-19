-- Add 'user_access_notification' to email_notification_type enum (for oversight emails when last_accessed_at changes)
alter type email_notification_type add value if not exists 'user_access_notification';

-- Must drop before changing return type (void -> table)
drop function if exists public.touch_last_accessed_at(uuid);

create or replace function public.touch_last_accessed_at(p_user_id uuid)
returns table(updated boolean, last_accessed_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with upd as (
    update user_profiles
    set last_accessed_at = now()
    where id = p_user_id
      and (last_accessed_at is null or last_accessed_at < now() - interval '15 min')
    returning user_profiles.last_accessed_at
  )
  select (select count(*) from upd) > 0,
         (select upd.last_accessed_at from upd limit 1);
$$;
