package sg.wheretopark.app.car;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Saved and recent destinations from the phone app. The web app mirrors them
 * to Capacitor Preferences (src/lib/storage.ts), which stores them in this
 * SharedPreferences file, so the car can offer them without signing in.
 */
final class PhonePlaces {

    private static final String PREFS = "CapacitorStorage";

    private PhonePlaces() {}

    /** Saved destinations that have coordinates, newest first. */
    static List<CarApi.Destination> saved(Context ctx) {
        return read(ctx, "psg.savedDestinations", "name");
    }

    /** Recent destinations that have coordinates, newest first. */
    static List<CarApi.Destination> recents(Context ctx) {
        return read(ctx, "psg.recents", "name");
    }

    private static List<CarApi.Destination> read(Context ctx, String key, String labelField) {
        List<CarApi.Destination> out = new ArrayList<>();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = prefs.getString(key, null);
        if (raw == null) return out;
        try {
            JSONArray arr = new JSONArray(raw);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject o = arr.optJSONObject(i);
                if (o == null || !o.has("lat") || !o.has("lng") || o.isNull("lat") || o.isNull("lng")) continue;
                String label = o.optString(labelField, "").trim();
                if (label.isEmpty()) continue;
                out.add(new CarApi.Destination(label, o.getDouble("lat"), o.getDouble("lng")));
            }
        } catch (Exception ignored) {
            // A malformed value just means no shortcuts.
        }
        return out;
    }
}
