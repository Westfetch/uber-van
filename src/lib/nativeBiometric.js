// Native biometric bridge — communicates with BiometricBridge.java via addJavascriptInterface.
// No-ops gracefully when running in a regular browser (not the APK).

export const isNativeApp = () => typeof window.NativeBiometric !== 'undefined';

export const enableBiometric = () => {
  if (typeof window.NativeBiometric !== 'undefined') {
    window.NativeBiometric.enableBiometric();
  }
};

export const disableBiometric = () => {
  if (typeof window.NativeBiometric !== 'undefined') {
    window.NativeBiometric.disableBiometric();
  }
};
