-- Migration: correct stale 2018 rates for popular carparks + drop a duplicate
--
-- Found during a rate/availability validation pass (2026-06-13). The airport
-- and MBS were still on LTA_DATAGOV rates dated 2018-11-01 with an impossible
-- "free on Sun/PH" tier; "Funan DigitaLife Mall" is a defunct duplicate of the
-- live "Funan Mall" (LTA:66). New rates are written as MANUAL so the ingest
-- scripts won't clobber them.
--
-- Apply via the Supabase SQL editor, `supabase db execute`, psql, or the
-- Supabase MCP apply_migration. Verify with the SELECT at the bottom.
--
-- Rate sources:
--   Changi  — changiairport.com official fees (effective 2026-04-01):
--             T2/T3/T4 $0.65/15min; Hub & Spoke (T2–JetQuay) $0.60/15min; 24/7.
--   MBS     — standard walk-in: $14 first hr + $1.50/30min, $32/day cap, 24/7.
--             (The cheaper $6/$26 figure is the Sands Rewards member rate.)

begin;

-- 1. Changi Airport T1/T2/T3 — $0.65 per 15 min, 24/7, all day types.
delete from rate_rows where carpark_id = 'LTA:changi_airport_t1_t2_t3';
insert into rate_rows (carpark_id, day_type, start_time, end_time, first_hour_cents, per_block_cents, block_minutes, per_entry_cents, cap_cents, grace_minutes, system, veh_cat, source, effective_from) values
 ('LTA:changi_airport_t1_t2_t3','WEEKDAY',null,null,null,65,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01'),
 ('LTA:changi_airport_t1_t2_t3','SAT',    null,null,null,65,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01'),
 ('LTA:changi_airport_t1_t2_t3','SUN_PH', null,null,null,65,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01');

-- 2. Changi South / Hub & Spoke (between T2 and JetQuay) — $0.60 per 15 min, 24/7.
delete from rate_rows where carpark_id = 'LTA:changi_airport_south_car_park_between_t2_and_jetquay';
insert into rate_rows (carpark_id, day_type, start_time, end_time, first_hour_cents, per_block_cents, block_minutes, per_entry_cents, cap_cents, grace_minutes, system, veh_cat, source, effective_from) values
 ('LTA:changi_airport_south_car_park_between_t2_and_jetquay','WEEKDAY',null,null,null,60,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01'),
 ('LTA:changi_airport_south_car_park_between_t2_and_jetquay','SAT',    null,null,null,60,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01'),
 ('LTA:changi_airport_south_car_park_between_t2_and_jetquay','SUN_PH', null,null,null,60,15,null,null,null,'EPS','CAR','MANUAL','2026-04-01');

-- 3. Marina Bay Sands — $14 first hr + $1.50/30min, $32/day cap, 24/7.
delete from rate_rows where carpark_id = 'LTA:marina_bay_sands';
insert into rate_rows (carpark_id, day_type, start_time, end_time, first_hour_cents, per_block_cents, block_minutes, per_entry_cents, cap_cents, grace_minutes, system, veh_cat, source, effective_from) values
 ('LTA:marina_bay_sands','WEEKDAY',null,null,1400,150,30,null,3200,null,'EPS','CAR','MANUAL','2026-05-01'),
 ('LTA:marina_bay_sands','SAT',    null,null,1400,150,30,null,3200,null,'EPS','CAR','MANUAL','2026-05-01'),
 ('LTA:marina_bay_sands','SUN_PH', null,null,1400,150,30,null,3200,null,'EPS','CAR','MANUAL','2026-05-01');

-- 4. Remove stale duplicate "Funan DigitaLife Mall" (defunct; live as LTA:66 Funan Mall).
delete from rate_rows where carpark_id = 'LTA:funan_digitalife_mall';
delete from carparks  where id        = 'LTA:funan_digitalife_mall';

commit;

-- Verify:
-- select carpark_id, day_type, first_hour_cents, per_block_cents, block_minutes, cap_cents, source, effective_from
-- from rate_rows
-- where carpark_id in ('LTA:changi_airport_t1_t2_t3','LTA:marina_bay_sands','LTA:changi_airport_south_car_park_between_t2_and_jetquay')
-- order by carpark_id, day_type;
-- select count(*) from carparks where id = 'LTA:funan_digitalife_mall';  -- expect 0
