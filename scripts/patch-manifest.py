"""Adds AdMob App ID + CAMERA + storage permissions to the generated AndroidManifest.xml."""
import os, sys
path = "android/app/src/main/AndroidManifest.xml"
app_id = os.environ.get("ADMOB_APP_ID") or "ca-app-pub-9882062855093591~3831900301"  # AdMob App ID (secret ADMOB_APP_ID overrides if set)
s = open(path, encoding="utf-8").read()
if "com.google.android.gms.ads.APPLICATION_ID" not in s:
    s = s.replace("</application>",
        '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s"/>\n    </application>' % app_id)
if "android.permission.CAMERA" not in s:
    s = s.replace("</manifest>", '    <uses-permission android:name="android.permission.CAMERA" />\n</manifest>')
# Storage permission for saving PDFs to Documents on Android 12 and below (Android 13+ does not need it)
if "android.permission.WRITE_EXTERNAL_STORAGE" not in s:
    s = s.replace("</manifest>", '    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>')
if "android.permission.READ_EXTERNAL_STORAGE" not in s:
    s = s.replace("</manifest>", '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n</manifest>')
open(path, "w", encoding="utf-8").write(s)
print("Manifest patched, AdMob app id:", app_id)
