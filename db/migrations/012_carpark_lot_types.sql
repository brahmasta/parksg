-- Migration: carparks.lot_types + motorcycle_lots + heavy_lots
--
-- WHY
--
-- The app only knew which vehicle lots a carpark has from the live HDB feed,
-- so every URA carpark rendered as car-only and dropped out of the motorcycle /
-- heavy-vehicle filters. URA publishes per-carpark lot counts by vehicle type
-- ("Capacity of URA Parking Places", data.gov.sg); these columns hold them
-- (npm run ingest:ura-capacity) and can later carry manual overrides for any
-- carpark whose live feed misses a lot type.
--
--   lot_types        vehicle lot types present: 'C' car, 'M' motorcycle,
--                    'H' heavy vehicle. NULL = unknown (app falls back to
--                    the live feed, then car-only).
--   motorcycle_lots  motorcycle lot count, NULL = unknown.
--   heavy_lots       heavy-vehicle lot count, NULL = unknown.
--
-- Car capacity stays in the existing total_lots column.
--
-- Additive and nullable: existing rows and writers are unaffected.
--
-- Apply via the Supabase SQL editor, psql, or the MCP apply_migration.

alter table public.carparks
  add column if not exists lot_types text[]
    check (lot_types is null or lot_types <@ array['C', 'M', 'H']::text[]),
  add column if not exists motorcycle_lots integer check (motorcycle_lots >= 0),
  add column if not exists heavy_lots integer check (heavy_lots >= 0);
