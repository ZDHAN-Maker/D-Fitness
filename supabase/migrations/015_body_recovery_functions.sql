-- 015_body_recovery_functions.sql  (Phase 4)
-- Hydration helpers. Weight, measurements, sleep and recovery use plain upserts
-- (their unique constraints and CHECKs are the integrity layer), so only water needs functions.

-- Add water and, when the day's target is reached, bump the hydration streak.
-- SECURITY INVOKER (RLS applies). update_streak / evaluate_achievements are SECURITY DEFINER
-- and scoped to auth.uid(). Back-dating is limited to the last 7 days; the streak only moves
-- for dates inside update_streak's own +-1 day window.
create or replace function public.add_water(p_date date, p_amount_ml int)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_total   int;
  v_target  int;
  v_reached boolean;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_date not between current_date - 7 and current_date + 1 then
    raise exception 'water date out of range' using errcode = '22023';
  end if;

  insert into public.water_logs (user_id, logged_on, amount_ml) values (v_uid, p_date, p_amount_ml);

  select coalesce(sum(amount_ml), 0)::int into v_total
    from public.water_logs where user_id = v_uid and logged_on = p_date;
  select water_target_ml into v_target from public.user_settings where user_id = v_uid;
  v_target := coalesce(v_target, 2500);
  v_reached := v_total >= v_target;

  if v_reached then
    begin
      perform public.update_streak('hydration', p_date);
    exception when others then
      null;   -- an older back-dated day must not fail the log itself
    end;
    perform 1 from public.evaluate_achievements();
  end if;

  return jsonb_build_object('total_ml', v_total, 'target_ml', v_target, 'reached', v_reached);
end;
$$;

-- Daily totals for a range (charts). One grouped query; range is capped to protect the database.
create or replace function public.water_totals(p_from date, p_to date)
returns table (logged_on date, total_ml int)
language sql
stable
security invoker
set search_path = public
as $$
  select w.logged_on, sum(w.amount_ml)::int
  from public.water_logs w
  where w.user_id = (select auth.uid())
    and w.logged_on between greatest(p_from, p_to - 400) and p_to
  group by w.logged_on
  order by w.logged_on
$$;

revoke execute on function public.add_water(date, int)       from public, anon;
revoke execute on function public.water_totals(date, date)   from public, anon;
grant  execute on function public.add_water(date, int)       to authenticated;
grant  execute on function public.water_totals(date, date)   to authenticated;
