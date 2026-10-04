package sg.wheretopark.app.car;

import androidx.annotation.DrawableRes;
import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.SectionedItemList;
import androidx.car.app.model.Template;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.ArrayList;
import java.util.List;

import sg.wheretopark.app.R;

/**
 * Car home: search a destination (typed when parked, spoken while driving),
 * parking near the car, and the phone's saved and recent destinations.
 */
final class HomeScreen extends Screen {

    HomeScreen(@NonNull CarContext carContext) {
        super(carContext);
        // Saved and recent places may change on the phone while this screen
        // sits in the back stack: re-read them whenever it comes back.
        getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onResume(@NonNull LifecycleOwner owner) {
                invalidate();
            }
        });
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        int limit = getCarContext().getCarService(ConstraintManager.class)
                .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST);
        int remaining = Math.max(2, limit);

        ItemList.Builder find = new ItemList.Builder();
        find.addItem(new Row.Builder()
                .setTitle("Search destination")
                .addText("Where you're going, a mall or a postcode")
                .setImage(icon(R.drawable.car_ic_search))
                .setBrowsable(true)
                .setOnClickListener(() -> getScreenManager().push(new SearchScreen(getCarContext())))
                .build());
        find.addItem(new Row.Builder()
                .setTitle("Parking near me")
                .addText("Carparks around where you are now")
                .setImage(icon(R.drawable.car_ic_location))
                .setBrowsable(true)
                .setOnClickListener(() -> getScreenManager().push(ResultsScreen.nearMe(getCarContext())))
                .build());
        remaining -= 2;

        ListTemplate.Builder template = new ListTemplate.Builder()
                .setTitle("wheretopark.sg")
                .setHeaderAction(Action.APP_ICON)
                .addSectionedList(SectionedItemList.create(find.build(), "Find parking"));

        List<CarApi.Destination> saved = PhonePlaces.saved(getCarContext());
        if (!saved.isEmpty() && remaining > 0) {
            ItemList list = destinations(saved, Math.min(remaining, 4), R.drawable.car_ic_star);
            remaining -= list.getItems().size();
            template.addSectionedList(SectionedItemList.create(list, "Saved"));
        }

        List<CarApi.Destination> recent = PhonePlaces.recents(getCarContext());
        if (!recent.isEmpty() && remaining > 0) {
            ItemList list = destinations(recent, Math.min(remaining, 4), R.drawable.car_ic_history);
            template.addSectionedList(SectionedItemList.create(list, "Recent"));
        }

        return template.build();
    }

    private ItemList destinations(List<CarApi.Destination> places, int max, @DrawableRes int iconRes) {
        ItemList.Builder list = new ItemList.Builder();
        List<String> seen = new ArrayList<>();
        for (CarApi.Destination d : places) {
            if (seen.size() >= max) break;
            if (seen.contains(d.label.toLowerCase())) continue;
            seen.add(d.label.toLowerCase());
            list.addItem(new Row.Builder()
                    .setTitle(d.label)
                    .setImage(icon(iconRes))
                    .setBrowsable(true)
                    .setOnClickListener(() -> getScreenManager().push(ResultsScreen.near(getCarContext(), d)))
                    .build());
        }
        return list.build();
    }

    private CarIcon icon(@DrawableRes int res) {
        return new CarIcon.Builder(IconCompat.createWithResource(getCarContext(), res)).build();
    }
}
