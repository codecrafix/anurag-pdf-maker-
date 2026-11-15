#!/usr/bin/env bash
# Builds the debug APK. Called from .github/workflows/build-apk.yml
set -euo pipefail

# Capacitor 8 needs JDK 21 (preinstalled on the GitHub runner)
if [ -n "${JAVA_HOME_21_X64:-}" ]; then
  export JAVA_HOME="$JAVA_HOME_21_X64"
  export PATH="$JAVA_HOME/bin:$PATH"
fi
java -version

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

# Client's splash status text (matches the client's app)
sed -i 's/Loading PDF Tools\.\.\./Preparing AdMob \& PDF Studio.../' www/index.html

npx cap add android
python3 scripts/patch-manifest.py

# Capacitor 8 targets SDK 36 (forced edge-to-edge on Android 15+). Keep targetSdk 34 so the app layout stays exactly the same as before.
if [ -f android/variables.gradle ]; then
  sed -i 's/targetSdkVersion = 36/targetSdkVersion = 34/' android/variables.gradle || true
  grep -n "targetSdkVersion" android/variables.gradle || true
fi

# Launcher icon, native splash, status/nav bar colours (non-fatal if it fails)
npm install --no-save sharp || echo "sharp install failed (non-fatal)"
node scripts/make-assets.js || echo "make-assets failed (non-fatal)"

npx cap sync android

# Download the smaller Gradle distribution (-bin instead of -all): fewer network failures, same build result
sed -i 's/-all\.zip/-bin.zip/' android/gradle/wrapper/gradle-wrapper.properties || true

cd android
chmod +x gradlew

# The Gradle download / dependency fetch can fail with "Connection reset" on the CI runner.
# Retry up to 3 times before giving up.
for attempt in 1 2 3; do
  if ./gradlew assembleDebug --no-daemon --stacktrace; then
    break
  fi
  if [ "$attempt" -eq 3 ]; then
    echo "Gradle build failed 3 times"
    exit 1
  fi
  echo "Gradle attempt $attempt failed, retrying in 15 seconds..."
  sleep 15
done

echo "APK files:"
find app/build/outputs -name "*.apk"
