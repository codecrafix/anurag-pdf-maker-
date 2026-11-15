"""Adds AdMob App ID + CAMERA permission to the generated AndroidManifest.xml."""
import os, sys
path = "android/app/src/main/AndroidManifest.xml"
app_id = os.environ.get("ADMOB_APP_ID") or "ca-app-pub-3940256099942544~3347511713"  # Google TEST app id fallback
s = open(path, encoding="utf-8").read()
if "com.google.android.gms.ads.APPLICATION_ID" not in s:
    s = s.replace("</application>",
        '    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="%s"/>\n    </application>' % app_id)
if "android.permission.CAMERA" not in s:
    s = s.replace("</manifest>", '    <uses-permission android:name="android.permission.CAMERA" />\n</manifest>')
open(path, "w", encoding="utf-8").write(s)
print("Manifest patched, AdMob app id:", app_id)
