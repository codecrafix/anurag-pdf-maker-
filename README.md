# Anurag PDF Maker — Android app with AdMob

`www/index.html` = poora app (UI + 11 PDF tools). `www/ads.js` = AdMob (App Open, Banner, Interstitial).
Browser mein khologe to ads ki jagah "TEST PLACEHOLDER" dikhega. Asli ads sirf Android app ke andar chalte hain.

## APK kaise banega (GitHub Actions — automatic)
Repo mein `.github/workflows/build-apk.yml` hai. Har push (main) par ya **Actions → Build Android APK → Run workflow** se APK banti hai.
APK download: Actions run kholo → neeche **Artifacts → anurag-pdf-maker-debug-apk**.
- Optional secret `ADMOB_APP_ID` (Settings → Secrets and variables → Actions) mein client ki asli AdMob App ID (`ca-app-pub-XXXX~YYYY`) daalo. Na daalo to Google ki TEST App ID lagti hai.
- Ye **debug** APK hai (install/test ke liye). Play Store ke liye signed AAB/release build alag se banani hogi.
- `android/` folder CI mein har baar naya banta hai, isliye repo mein commit nahi hota.

## Local build (optional — Node.js aur Android Studio chahiye)
```bash
npm install
npm run libs                # PDF libraries www/lib mein copy (offline ke liye)
npx cap add android
python3 scripts/patch-manifest.py   # AdMob App ID + camera permission
npx cap sync android
npx cap open android        # Android Studio -> Run ya Build APK/AAB
```

## Release se pehle (zaroori)
1. `www/ads.js` mein `LIVE` ke 3 ad unit IDs sahi karo (interstitial ID abhi baaki hai) aur `USE_TEST_ADS` ko sahi value do.
2. GitHub secret `ADMOB_APP_ID` mein client ki asli AdMob App ID daalo.
3. `capacitor.config.json` ka `appId` client ke package name se badlo.
4. Khud apne live ads par click mat karo (AdMob account ban ho sakta hai). Testing hamesha test IDs se.
5. Play Console mein "Contains ads" = Yes, aur Privacy Policy link do. EU users ke liye Google UMP consent form lagana chahiye.

## Ads kaha dikhte hain
- **App Open:** splash ke turant baad.
- **Banner:** bottom navigation ke upar (poore app mein).
- **Interstitial:** jab user Save to Device / WhatsApp Share / All Apps Share / Print dabaye (30 sec cooldown).

## Dhyan dene wali baatein
- `@capacitor-community/admob` ke kuch versions mein App Open API nahi hoti. Aisa ho to code apne aap launch par Interstitial dikha deta hai.
- Compress / Lock / Unlock mein pages images ban kar save hote hain (text select nahi hoga). Lock mein password asli PDF encryption se lagta hai.
- Save to Device file ko `Documents/AnuragPDFMaker/` mein rakhta hai. Purane Android (9 ya neeche) par storage permission lag sakti hai.
