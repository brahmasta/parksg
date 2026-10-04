/** PostgREST select for a carpark with its rate rows: the columns the
 *  Carpark mapping (carparkMapping.ts) reads. Shared by the browser fetcher
 *  (api/dbCarparks.ts) and server endpoints, which can't import that file
 *  because it reads import.meta.env at load. */
export const CARPARK_SELECT =
  'id,agency,source_code,name,address,lat,lng,car_park_type,parking_system,central_area,total_lots,lot_types,motorcycle_lots,heavy_lots,height_limit_m,source,rate_rows(day_type,start_time,end_time,per_block_cents,block_minutes,first_hour_cents,first_block_minutes,per_entry_cents,cap_cents,grace_minutes,system,veh_cat,source,effective_from)';
