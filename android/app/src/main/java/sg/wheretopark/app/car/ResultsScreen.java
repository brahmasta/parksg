package sg.wheretopark.app.car;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationManager;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.CarLocation;
import androidx.car.app.model.Distance;
import androidx.car.app.model.DistanceSpan;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.Metadata;
import androidx.car.app.model.Place;
import androidx.car.app.model.PlaceListMapTemplate;
import androidx.car.app.model.PlaceMarker;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import androidx.core.os.CancellationSignal;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Carparks around a destination (or around the car for "Parking near me"),
 * cheapest first for a 2-hour stay, on the host's place-list map. Rows show
 * the estimated price, live free lots and the distance.
 */
final class ResultsScreen extends Screen {

    static final double STAY_HOURS = 2;

    @Nullable private CarApi.Destination destination;
    private final boolean nearMe;
    @Nullable private List<CarApi.Carpark> carparks;
    @Nullable private String error;

    private ResultsScreen(@NonNull CarContext ctx, @Nullable CarApi.Destination destination, boolean nearMe) {
        super(ctx);
        this.destination = destination;
        this.nearMe = nearMe;
        if (nearMe) locate();
        else load();
    }

    static ResultsScreen near(@NonNull CarContext ctx, @NonNull CarApi.Destination d) {
        return new ResultsScreen(ctx, d, false);
    }

    static ResultsScreen nearMe(@NonNull CarContext ctx) {
        return new ResultsScreen(ctx, null, true);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        String title = destination == null || nearMe ? "Parking near you" : "Parking near " + destination.label;
        PlaceListMapTemplate.Builder b = new PlaceListMapTemplate.Builder()
                .setTitle(title)
                .setHeaderAction(Action.BACK)
                .setCurrentLocationEnabled(hasLocationPermission());

        if (carparks == null && error == null) {
            return b.setLoading(true).build();
        }

        ItemList.Builder list = new ItemList.Builder();
        if (error != null) {
            list.setNoItemsMessage(error);
        } else {
            list.setNoItemsMessage("No carparks found within 600 m");
            int limit = getCarContext().getCarService(ConstraintManager.class)
                    .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_PLACE_LIST);
            int n = 0;
            for (CarApi.Carpark c : carparks) {
                if (n++ >= limit) break;
                list.addItem(row(c));
            }
        }
        if (destination != null && !nearMe) {
            b.setAnchor(new Place.Builder(CarLocation.create(destination.lat, destination.lng))
                    .setMarker(new PlaceMarker.Builder().setColor(CarColor.SECONDARY).build())
                    .build());
        }
        return b.setItemList(list.build()).build();
    }

    private Row row(CarApi.Carpark c) {
        // The required distance goes first; the host formats it in the car's units.
        SpannableString line = new SpannableString("  " + summary(c));
        line.setSpan(DistanceSpan.create(distance(c.distanceM)), 0, 1, Spanned.SPAN_INCLUSIVE_INCLUSIVE);
        return new Row.Builder()
                .setTitle(c.name)
                .addText(line)
                .setMetadata(new Metadata.Builder()
                        .setPlace(new Place.Builder(CarLocation.create(c.lat, c.lng))
                                .setMarker(new PlaceMarker.Builder().build())
                                .build())
                        .build())
                .setOnClickListener(() -> getScreenManager().push(new CarparkScreen(getCarContext(), c, !nearMe)))
                .build();
    }

    /** "$3.50 · 120 free" style summary after the distance. */
    static String summary(CarApi.Carpark c) {
        StringBuilder s = new StringBuilder();
        s.append(c.cost != null ? price(c.cost) : "Rates unknown");
        if (c.lotsAvailable != null) {
            s.append(" · ").append(c.lotsAvailable == 0 ? "Full" : c.lotsAvailable + " free");
        }
        return s.toString();
    }

    static String price(double dollars) {
        return String.format(Locale.US, "$%.2f", dollars);
    }

    private static Distance distance(double meters) {
        return meters < 1000
                ? Distance.create(Math.round(meters), Distance.UNIT_METERS)
                : Distance.create(meters / 1000.0, Distance.UNIT_KILOMETERS);
    }

    // ── data ────────────────────────────────────────────────────────────────

    private void load() {
        if (destination == null) return;
        CarApi.nearby(destination.lat, destination.lng, STAY_HOURS, 12, (list, err) -> {
            carparks = list;
            error = err;
            invalidate();
        });
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(getCarContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getCarContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** "Parking near me": the phone's location, asking for permission on the car screen if needed. */
    private void locate() {
        if (!hasLocationPermission()) {
            getCarContext().requestPermissions(
                    Arrays.asList(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                    (granted, rejected) -> {
                        if (granted.isEmpty()) {
                            error = "Allow location for wheretopark.sg to find parking near you";
                            invalidate();
                        } else {
                            locate();
                        }
                    });
            return;
        }
        LocationManager lm = (LocationManager) getCarContext().getSystemService(CarContext.LOCATION_SERVICE);
        Location last = lastKnown(lm);
        // A fix from the last two minutes is good enough to search around.
        if (last != null && System.currentTimeMillis() - last.getTime() < 2 * 60_000) {
            onLocation(last);
            return;
        }
        String provider = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && lm.isProviderEnabled(LocationManager.FUSED_PROVIDER)
                ? LocationManager.FUSED_PROVIDER
                : lm.isProviderEnabled(LocationManager.GPS_PROVIDER) ? LocationManager.GPS_PROVIDER : LocationManager.NETWORK_PROVIDER;
        try {
            LocationManagerCompat.getCurrentLocation(lm, provider, new CancellationSignal(),
                    ContextCompat.getMainExecutor(getCarContext()), loc -> {
                        if (loc != null) onLocation(loc);
                        else if (last != null) onLocation(last);
                        else {
                            error = "Couldn't get your location. Try searching a destination.";
                            invalidate();
                        }
                    });
        } catch (SecurityException e) {
            error = "Allow location for wheretopark.sg to find parking near you";
            invalidate();
        }
    }

    @Nullable
    private static Location lastKnown(LocationManager lm) {
        Location best = null;
        try {
            for (String p : lm.getProviders(true)) {
                Location l = lm.getLastKnownLocation(p);
                if (l != null && (best == null || l.getTime() > best.getTime())) best = l;
            }
        } catch (SecurityException ignored) {
            // No permission: the caller asks for it first.
        }
        return best;
    }

    private void onLocation(Location loc) {
        destination = new CarApi.Destination("you", loc.getLatitude(), loc.getLongitude());
        CarToast.makeText(getCarContext(), "Finding carparks near you", CarToast.LENGTH_SHORT).show();
        load();
    }
}
