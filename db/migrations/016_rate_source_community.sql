-- Migration: a rate source for community-reported prices
--
-- Motorcycle prices for malls and offices come from the r/singapore "SG
-- Motorcycle Parking" Google My Map (Dec 2022) — rider-reported, not from the
-- operator. 'COMMUNITY' keeps them distinguishable from operator / hand-
-- checked 'MANUAL' rows, so the app can label them and a later operator
-- import can replace them.
--
-- Its own migration because Postgres won't let a transaction use an enum
-- value it just added; 017 inserts the rows.

alter type public.rate_source add value if not exists 'COMMUNITY';
