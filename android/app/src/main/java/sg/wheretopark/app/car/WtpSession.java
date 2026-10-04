package sg.wheretopark.app.car;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;

/** One car session: starts on the home screen. */
public final class WtpSession extends Session {

    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        return new HomeScreen(getCarContext());
    }
}
