package sg.wheretopark.app.car;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.constraints.ConstraintManager;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.Row;
import androidx.car.app.model.SearchTemplate;
import androidx.car.app.model.Template;

import java.util.ArrayList;
import java.util.List;

/**
 * Destination search. The car shows a keyboard only when parked; while
 * driving it offers speech-to-text, and both feed the same callback. Results
 * come from the site's Google Places proxy, as on the phone, and update as
 * the person types or speaks.
 */
final class SearchScreen extends Screen implements SearchTemplate.SearchCallback {

    private static final long DEBOUNCE_MS = 300;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final String sessionToken = CarApi.newSessionToken();
    private String query = "";
    private List<CarApi.Suggestion> suggestions = new ArrayList<>();
    private boolean loading;
    private String error;
    private int requestSeq;

    SearchScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        SearchTemplate.Builder b = new SearchTemplate.Builder(this)
                .setHeaderAction(Action.BACK)
                .setSearchHint("Destination, mall or postcode")
                .setShowKeyboardByDefault(true)
                .setInitialSearchText(query);
        if (loading) {
            b.setLoading(true);
            return b.build();
        }

        int limit = getCarContext().getCarService(ConstraintManager.class)
                .getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST);
        ItemList.Builder list = new ItemList.Builder();
        if (query.trim().length() < 2) {
            // Before typing: recent destinations, so a repeat trip is one tap.
            for (CarApi.Destination d : take(PhonePlaces.recents(getCarContext()), limit)) {
                list.addItem(new Row.Builder()
                        .setTitle(d.label)
                        .addText("Recent")
                        .setOnClickListener(() -> getScreenManager().push(ResultsScreen.near(getCarContext(), d)))
                        .build());
            }
        } else if (error != null) {
            list.setNoItemsMessage(error);
        } else {
            list.setNoItemsMessage("No places found in Singapore");
            int n = 0;
            for (CarApi.Suggestion s : suggestions) {
                if (n++ >= limit) break;
                Row.Builder row = new Row.Builder().setTitle(s.primary).setOnClickListener(() -> pick(s));
                if (s.secondary != null && !s.secondary.isEmpty()) row.addText(s.secondary);
                list.addItem(row.build());
            }
        }
        return b.setItemList(list.build()).build();
    }

    @Override
    public void onSearchTextChanged(@NonNull String text) {
        query = text;
        handler.removeCallbacksAndMessages(null);
        if (text.trim().length() < 2) {
            suggestions = new ArrayList<>();
            error = null;
            invalidate();
            return;
        }
        handler.postDelayed(this::runSearch, DEBOUNCE_MS);
    }

    @Override
    public void onSearchSubmitted(@NonNull String text) {
        query = text;
        handler.removeCallbacksAndMessages(null);
        runSearch();
    }

    private void runSearch() {
        final int seq = ++requestSeq;
        final String q = query.trim();
        if (q.length() < 2) return;
        CarApi.autocomplete(q, sessionToken, (list, err) -> {
            if (seq != requestSeq) return; // a newer search is on its way
            suggestions = list != null ? list : new ArrayList<>();
            error = err;
            invalidate();
        });
    }

    private void pick(CarApi.Suggestion s) {
        loading = true;
        invalidate();
        CarApi.placeDetails(s, sessionToken, (dest, err) -> {
            loading = false;
            if (dest == null) {
                CarToast.makeText(getCarContext(), err != null ? err : "Couldn't find that place", CarToast.LENGTH_LONG).show();
                invalidate();
                return;
            }
            getScreenManager().push(ResultsScreen.near(getCarContext(), dest));
            invalidate();
        });
    }

    private static <T> List<T> take(List<T> items, int max) {
        return items.size() <= max ? items : items.subList(0, max);
    }
}
