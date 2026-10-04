package sg.wheretopark.app.car;

import android.content.Intent;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.core.graphics.drawable.IconCompat;

import java.util.Locale;

import sg.wheretopark.app.R;

/** One carpark: price for the stay, free lots, rates and a Navigate hand-off. */
final class CarparkScreen extends Screen {

    private final CarApi.Carpark carpark;
    /** False for "Parking near me", where there is no destination to walk to. */
    private final boolean hasDestination;

    CarparkScreen(@NonNull CarContext ctx, @NonNull CarApi.Carpark carpark, boolean hasDestination) {
        super(ctx);
        this.carpark = carpark;
        this.hasDestination = hasDestination;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        CarApi.Carpark c = carpark;
        Pane.Builder pane = new Pane.Builder();

        String cost = c.cost != null ? ResultsScreen.price(c.cost) : "Rates unknown";
        Row.Builder costRow = new Row.Builder()
                .setTitle(cost + " for " + (int) ResultsScreen.STAY_HOURS + " hours");
        if (hasDestination && c.walkMin != null) costRow.addText(c.walkMin + " min walk to your destination");
        pane.addRow(costRow.build());

        if (c.lotsAvailable != null) {
            String lots = c.lotsAvailable == 0 ? "Full right now"
                    : c.lotsAvailable + (c.lotsTotal != null ? " of " + c.lotsTotal : "") + " lots free";
            pane.addRow(new Row.Builder().setTitle(lots).addText("Live availability").build());
        }

        // Rates, then height and EV, up to the pane's row limit (host enforces it too).
        if (!c.rateLines.isEmpty()) {
            Row.Builder rates = new Row.Builder().setTitle("Rates");
            for (int i = 0; i < Math.min(2, c.rateLines.size()); i++) rates.addText(c.rateLines.get(i));
            pane.addRow(rates.build());
        }
        StringBuilder extra = new StringBuilder();
        if (c.heightLimitM != null) extra.append(String.format(Locale.US, "Height limit %.1f m", c.heightLimitM));
        if (c.evTotal != null && c.evTotal > 0) {
            if (extra.length() > 0) extra.append(" · ");
            extra.append("EV charging ").append(c.evAvailable != null ? c.evAvailable + " of " + c.evTotal + " free" : "available");
        }
        if (extra.length() > 0) pane.addRow(new Row.Builder().setTitle(extra.toString()).build());

        pane.addAction(new Action.Builder()
                .setTitle("Navigate")
                .setIcon(new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), R.drawable.car_ic_navigate)).build())
                .setBackgroundColor(CarColor.PRIMARY)
                .setFlags(Action.FLAG_PRIMARY)
                .setOnClickListener(this::navigate)
                .build());

        return new PaneTemplate.Builder(pane.build())
                .setTitle(c.name)
                .setHeaderAction(Action.BACK)
                .build();
    }

    /** Hand the carpark's location to the car's navigation app. */
    private void navigate() {
        Uri geo = Uri.parse("geo:0,0?q=" + carpark.lat + "," + carpark.lng + "(" + Uri.encode(carpark.name) + ")");
        try {
            getCarContext().startCarApp(new Intent(CarContext.ACTION_NAVIGATE, geo));
        } catch (Exception e) {
            CarToast.makeText(getCarContext(), "No navigation app available", CarToast.LENGTH_LONG).show();
        }
    }
}
