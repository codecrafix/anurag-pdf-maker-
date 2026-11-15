#!/usr/bin/env bash
# Builds the debug APK. Called from .github/workflows/build-apk.yml
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
echo "ANDROID_HOME=$ANDROID_HOME"

# Accept SDK licenses with the SDK that is already installed on the runner
SDKM="$(ls "$ANDROID_HOME"/cmdline-tools/*/bin/sdkmanager 2>/dev/null | head -n1 || true)"
if [ -n "$SDKM" ]; then
  echo "Accepting licenses with $SDKM"
  yes | "$SDKM" --licenses > /dev/null 2>&1 || true
fi

npm install
npm run libs

npx cap add android
python3 scripts/patch-manifest.py
npx cap sync android

cd android
chmod +x gradlew
./gradlew assembleDebug --no-daemon --stacktrace

echo "APK files:"
find app/build/outputs -name "*.apk"
