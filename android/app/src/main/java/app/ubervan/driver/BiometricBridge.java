package app.ubervan.driver;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

public class BiometricBridge {

    private static final String PREFS_NAME = "biometric_prefs";
    private static final String KEY_ENABLED = "biometric_enabled";

    private final Context context;

    public BiometricBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void enableBiometric() {
        getPrefs().edit().putBoolean(KEY_ENABLED, true).apply();
    }

    @JavascriptInterface
    public void disableBiometric() {
        getPrefs().edit().putBoolean(KEY_ENABLED, false).apply();
    }

    @JavascriptInterface
    public boolean isBiometricEnabled() {
        return getPrefs().getBoolean(KEY_ENABLED, false);
    }

    public static boolean shouldShowBiometric(Context ctx) {
        boolean flagSet = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_ENABLED, false);
        if (!flagSet) return false;

        BiometricManager mgr = BiometricManager.from(ctx);
        return mgr.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                == BiometricManager.BIOMETRIC_SUCCESS;
    }

    public static void showBiometricPrompt(FragmentActivity activity,
                                           String title,
                                           BiometricPrompt.AuthenticationCallback callback) {
        new Handler(Looper.getMainLooper()).post(() -> {
            BiometricPrompt prompt = new BiometricPrompt(activity,
                    ContextCompat.getMainExecutor(activity), callback);

            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle("Verify your identity to continue")
                    .setNegativeButtonText("Cancel")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .build();

            prompt.authenticate(info);
        });
    }

    private SharedPreferences getPrefs() {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }
}
