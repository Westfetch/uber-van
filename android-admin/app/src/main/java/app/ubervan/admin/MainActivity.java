package app.ubervan.admin;

import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricPrompt;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private View overlayView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register JS interface for web <-> native biometric communication
        getBridge().getWebView().post(() -> {
            getBridge().getWebView().addJavascriptInterface(
                new BiometricBridge(this), "NativeBiometric"
            );
        });

        // Show biometric gate if enabled
        if (BiometricBridge.shouldShowBiometric(this)) {
            showBiometricOverlay();
        }
    }

    private void showBiometricOverlay() {
        FrameLayout root = findViewById(android.R.id.content);
        overlayView = LayoutInflater.from(this)
                .inflate(R.layout.biometric_overlay, root, false);
        root.addView(overlayView);

        Button retryBtn = overlayView.findViewById(R.id.bio_retry_btn);
        Button fallbackBtn = overlayView.findViewById(R.id.bio_fallback_btn);
        TextView statusText = overlayView.findViewById(R.id.bio_status_text);

        retryBtn.setOnClickListener(v -> {
            retryBtn.setVisibility(View.GONE);
            fallbackBtn.setVisibility(View.GONE);
            statusText.setText("Verifying identity...");
            promptBiometric(retryBtn, fallbackBtn, statusText);
        });

        fallbackBtn.setOnClickListener(v -> {
            new BiometricBridge(this).disableBiometric();
            removeOverlay();
        });

        promptBiometric(retryBtn, fallbackBtn, statusText);
    }

    private void promptBiometric(Button retryBtn, Button fallbackBtn, TextView statusText) {
        BiometricBridge.showBiometricPrompt(this, "Unlock VanHQ Admin",
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    removeOverlay();
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    statusText.setText("Authentication required");
                    retryBtn.setVisibility(View.VISIBLE);
                    fallbackBtn.setVisibility(View.VISIBLE);
                }
            });
    }

    private void removeOverlay() {
        if (overlayView != null && overlayView.getParent() != null) {
            overlayView.animate()
                .alpha(0f)
                .setDuration(200)
                .withEndAction(() -> {
                    ((ViewGroup) overlayView.getParent()).removeView(overlayView);
                    overlayView = null;
                })
                .start();
        }
    }
}
