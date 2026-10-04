package sg.wheretopark.app.car;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The wheretopark.sg endpoints the car screens use. Requests run on a
 * background thread; callbacks arrive on the main thread, where screens may
 * call invalidate().
 */
final class CarApi {

    static final String BASE = "https://wheretopark.sg";

    private static final ExecutorService IO = Executors.newFixedThreadPool(2);
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private CarApi() {}

    interface Callback<T> {
        void onResult(@Nullable T value, @Nullable String error);
    }

    /** A destination the person picked: a search result, saved place or recent. */
    static final class Destination {
        final String label;
        final double lat;
        final double lng;

        Destination(String label, double lat, double lng) {
            this.label = label;
            this.lat = lat;
            this.lng = lng;
        }
    }

    /** One place-search suggestion; resolved to coordinates on tap. */
    static final class Suggestion {
        final String placeId;
        final String primary;
        final String secondary;

        Suggestion(String placeId, String primary, String secondary) {
            this.placeId = placeId;
            this.primary = primary;
            this.secondary = secondary;
        }
    }

    /** A carpark as /api/car/nearby returns it, already priced for the stay. */
    static final class Carpark {
        String id;
        String name;
        String subtitle;
        double lat;
        double lng;
        double distanceM;
        @Nullable Integer walkMin;
        @Nullable Double cost;
        @Nullable Integer lotsAvailable;
        @Nullable Integer lotsTotal;
        @Nullable Double heightLimitM;
        @Nullable Integer evAvailable;
        @Nullable Integer evTotal;
        final List<String> rateLines = new ArrayList<>();
    }

    /** Google Places session token, shared by one typeahead and its pick. */
    static String newSessionToken() {
        return UUID.randomUUID().toString();
    }

    static void autocomplete(String query, String sessionToken, Callback<List<Suggestion>> cb) {
        Uri uri = Uri.parse(BASE + "/api/google-places-autocomplete").buildUpon()
                .appendQueryParameter("q", query)
                .appendQueryParameter("sessiontoken", sessionToken)
                .build();
        getJson(uri, cb, body -> {
            List<Suggestion> out = new ArrayList<>();
            JSONArray arr = body.optJSONArray("suggestions");
            if (arr == null) return out;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject s = arr.getJSONObject(i);
                out.add(new Suggestion(s.getString("placeId"), s.optString("primary"), s.optString("secondary")));
            }
            return out;
        });
    }

    static void placeDetails(Suggestion s, String sessionToken, Callback<Destination> cb) {
        Uri uri = Uri.parse(BASE + "/api/google-places-details").buildUpon()
                .appendQueryParameter("place_id", s.placeId)
                .appendQueryParameter("sessiontoken", sessionToken)
                .build();
        getJson(uri, cb, body -> {
            JSONObject p = body.optJSONObject("place");
            if (p == null) throw new JSONException("no place");
            String label = p.optString("label", s.primary);
            return new Destination(label.isEmpty() ? s.primary : label, p.getDouble("lat"), p.getDouble("lng"));
        });
    }

    /** Carparks around a point, ranked and priced for `hours` like the phone app. */
    static void nearby(double lat, double lng, double hours, int limit, Callback<List<Carpark>> cb) {
        Uri uri = Uri.parse(BASE + "/api/car/nearby").buildUpon()
                .appendQueryParameter("lat", String.valueOf(lat))
                .appendQueryParameter("lng", String.valueOf(lng))
                .appendQueryParameter("hours", String.valueOf(hours))
                .appendQueryParameter("limit", String.valueOf(limit))
                .build();
        getJson(uri, cb, body -> {
            List<Carpark> out = new ArrayList<>();
            JSONArray arr = body.optJSONArray("carparks");
            if (arr == null) return out;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject j = arr.getJSONObject(i);
                Carpark c = new Carpark();
                c.id = j.getString("id");
                c.name = j.getString("name");
                c.subtitle = j.optString("subtitle", "");
                c.lat = j.getDouble("lat");
                c.lng = j.getDouble("lng");
                c.distanceM = j.optDouble("distanceM", 0);
                c.walkMin = optInt(j, "walkMin");
                c.cost = optDouble(j, "cost");
                c.lotsAvailable = optInt(j, "lotsAvailable");
                c.lotsTotal = optInt(j, "lotsTotal");
                c.heightLimitM = optDouble(j, "heightLimitM");
                c.evAvailable = optInt(j, "evAvailable");
                c.evTotal = optInt(j, "evTotal");
                JSONArray lines = j.optJSONArray("rateLines");
                if (lines != null) {
                    for (int k = 0; k < lines.length(); k++) c.rateLines.add(lines.getString(k));
                }
                out.add(c);
            }
            return out;
        });
    }

    // ── plumbing ────────────────────────────────────────────────────────────

    private interface Parser<T> {
        T parse(JSONObject body) throws JSONException;
    }

    private static <T> void getJson(Uri uri, Callback<T> cb, Parser<T> parser) {
        IO.execute(() -> {
            T value = null;
            String error = null;
            try {
                JSONObject body = new JSONObject(fetch(uri.toString()));
                if (body.has("ok") && !body.optBoolean("ok")) {
                    error = body.optString("error", "Something went wrong");
                } else {
                    value = parser.parse(body);
                }
            } catch (IOException e) {
                error = "No connection. Check your phone's data.";
            } catch (JSONException e) {
                error = "Unexpected response from wheretopark.sg";
            }
            final T v = value;
            final String err = error;
            MAIN.post(() -> cb.onResult(v, err));
        });
    }

    @NonNull
    private static String fetch(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(10000);
        conn.setRequestProperty("Accept", "application/json");
        try {
            int code = conn.getResponseCode();
            InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            if (in == null) throw new IOException("HTTP " + code);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int n;
            while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
            return buf.toString(StandardCharsets.UTF_8.name());
        } finally {
            conn.disconnect();
        }
    }

    @Nullable
    private static Integer optInt(JSONObject j, String key) {
        return j.isNull(key) || !j.has(key) ? null : j.optInt(key);
    }

    @Nullable
    private static Double optDouble(JSONObject j, String key) {
        return j.isNull(key) || !j.has(key) ? null : j.optDouble(key);
    }
}
