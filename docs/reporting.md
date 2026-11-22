# Reporting without the owner's own activity

The weekly product brief and any ad-hoc usage query should read the `reporting`
schema, not `public`:

| Instead of | Read |
| --- | --- |
| `public.search_events` | `reporting.search_events` |
| `public.app_events` | `reporting.app_events` |
| `public.visits` | `reporting.visits` |
| `public.saved_carparks` | `reporting.saved_carparks` |

Each view has the same columns as its table, minus rows from internal accounts
and their devices. Everything else (`carparks`, `rate_rows`, `ingest_runs`,
user reports) is read from `public` as before.

## Who is internal

Two tables, filled by hand in the Supabase SQL editor. They are deliberately
not seeded by a migration, so no email or device id is committed here.

```sql
-- an account: its user id and every device it has signed in on are left out
insert into reporting.internal_accounts (email, note) values ('owner@example.com', 'owner');

-- a device that never signed in (client_id from search_events / app_events)
insert into reporting.internal_devices (client_id, note) values ('<client_id>', 'test phone');
```

Emails are stored lower-case. A device joins the excluded set the first time
the account signs in on it, and its earlier signed-out activity goes with it.
A device that has never been signed in is only excluded once it is added to
`internal_devices`.

## Access

The schema is not exposed through PostgREST and the `anon` / `authenticated`
roles have no rights on it, so it cannot be read with the public anon key. Use
the service role or the SQL editor. See `db/migrations/020_reporting_excludes_internal.sql`.

The admin dashboard's "Exclude admin" toggle is separate: it passes
`ADMIN_EMAILS` to the `admin_*` functions and does not use these tables.
