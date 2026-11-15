/* ads.js — AdMob bridge for Anurag PDF Maker
 *
 * Two modes:
 *  PLACEHOLDER_IN_APP = true  -> the app shows the ad placeholders (App Open popup + banner strip)
 *                                 everywhere, also inside the Android app. This matches the client's demo build.
 *  PLACEHOLDER_IN_APP = false -> inside the Android app real AdMob ads are used (@capacitor-community/admob).
 *                                 Browser preview still shows placeholders.
 *
 * Before the Play Store release: set PLACEHOLDER_IN_APP = false, add the interstitial ID and the real
 * AdMob App ID (GitHub secret ADMOB_APP_ID). Never click your own live ads.
 */
(function () {
  const CONFIG = {
    PLACEHOLDER_IN_APP: false,
    USE_TEST_ADS: false,
    TEST: {
      banner:       'ca-app-pub-3940256099942544/6300978111',
      interstitial: 'ca-app-pub-3940256099942544/1033173712',
      appOpen:      'ca-app-pub-3940256099942544/9257395921'
    },
    LIVE: {
      banner:       'ca-app-pub-1713795894529561/8535098465',   // client's banner unit
      interstitial: 'ca-app-pub-1713795894529561/XXXXXXXXXX',   // client's interstitial unit (ID not provided yet)
      appOpen:      'ca-app-pub-9882062855093591/8796601733'    // app-open unit
    },
    BANNER_HEIGHT: 56,            // px reserved above bottom nav
    INTERSTITIAL_COOLDOWN_MS: 30000
  };

  const ids = () => (CONFIG.USE_TEST_ADS ? CONFIG.TEST : CONFIG.LIVE);
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = (isNative && !CONFIG.PLACEHOLDER_IN_APP && cap.Plugins) ? cap.Plugins.AdMob : null;

  let lastInterstitial = 0;
  let initDone = false;

  /* ---------- placeholders (browser preview + demo app) ---------- */
  function placeholderPopup(label, adId, sub, onClose) {
    const logo = (typeof APP_LOGO_SVG !== 'undefined') ? APP_LOGO_SVG : '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(17,24,39,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
    wrap.innerHTML =
      '<div style="background:#fff;border-radius:22px;padding:27px 20px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 14px 34px rgba(0,0,0,.3)">' +
        '<div style="display:inline-block;background:#FEF3C7;color:#92400E;font-weight:800;font-size:11px;line-height:19px;padding:0 12px;border-radius:999px">' + label + '</div>' +
        '<div style="width:74px;height:74px;border-radius:19px;overflow:hidden;margin:10px auto 8px;box-shadow:0 7px 17px rgba(217,4,41,.28)">' + logo + '</div>' +
        '<div style="font-size:18px;font-weight:900;color:#111827;line-height:22px">Anurag PDF Maker</div>' +
        '<div style="font-size:11px;font-weight:800;color:#D90429;margin-top:3px;line-height:14px">Powerd By :- Anurag Tecnology</div>' +
        '<div style="background:#F3F4F6;color:#6B7280;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;height:24px;line-height:24px;border-radius:6px;margin:10px 0 8px;white-space:nowrap;overflow:hidden">' + adId + '</div>' +
        '<div style="color:#6B7280;font-size:12px;line-height:16px;margin-bottom:16px">' + sub + '</div>' +
        '<button id="__adClose" style="width:100%;border:none;border-radius:12px;height:50px;background:linear-gradient(135deg,#D90429,#A4001B);color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 6px 13px rgba(217,4,41,.28)">Continue to App &rarr;</button>' +
      '</div>';
    document.body.appendChild(wrap);
    wrap.querySelector('#__adClose').onclick = function () { wrap.remove(); if (onClose) onClose(); };
  }

  function placeholderBanner() {
    if (document.getElementById('adBannerSlot')) return;
    const slot = document.createElement('div');
    slot.id = 'adBannerSlot';
    slot.style.cssText = 'height:' + CONFIG.BANNER_HEIGHT + 'px;flex-shrink:0;background:#FFF7F8;border-top:1px solid #F1E4E6;display:flex;align-items:center;gap:10px;padding:0 14px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
    slot.innerHTML =
      '<span style="background:#10B981;color:#fff;font-weight:800;font-size:10px;width:25px;height:16px;line-height:16px;text-align:center;border-radius:4px;flex-shrink:0">AD</span>' +
      '<div style="flex:1;min-width:0;text-align:left">' +
        '<div style="font-size:11.5px;font-weight:800;color:#111827;line-height:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Anurag PDF Maker • AdMob Banner</div>' +
        '<div style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9.5px;color:#6B7280;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ids().banner + '</div>' +
      '</div>' +
      '<span style="background:#D90429;color:#fff;font-weight:800;font-size:11px;width:50px;height:24px;line-height:24px;text-align:center;border-radius:6px;flex-shrink:0">OPEN</span>';
    const dock = document.querySelector('.bottom-dock');
    dock.parentNode.insertBefore(slot, dock);
  }

  /* ---------- public API ---------- */
  const Ads = {
    async init() {
      if (initDone) return;
      initDone = true;
      if (AdMob) {
        try {
          await AdMob.initialize({ initializeForTesting: CONFIG.USE_TEST_ADS });
        } catch (e) { console.warn('AdMob init failed', e); }
      }
    },

    /* App Open ad — call right after the splash screen */
    async showAppOpen() {
      await Ads.init();
      if (AdMob) {
        try {
          // Some plugin versions have no App Open API. Fall back to an interstitial at launch.
          if (typeof AdMob.prepareAppOpen === 'function') {
            await AdMob.prepareAppOpen({ adId: ids().appOpen });
            await AdMob.showAppOpen();
          } else {
            await AdMob.prepareInterstitial({ adId: ids().interstitial });
            await AdMob.showInterstitial();
          }
        } catch (e) { console.warn('App open ad failed', e); }
        return;
      }
      return new Promise(function (res) { placeholderPopup('AdMob App Open Ad', ids().appOpen, 'Your PDF tools are ready.', res); });
    },

    /* Banner — pinned above bottom nav */
    async showBanner() {
      await Ads.init();
      if (AdMob) {
        try {
          await AdMob.showBanner({
            adId: ids().banner,
            adSize: 'ADAPTIVE_BANNER',
            position: 'BOTTOM_CENTER',
            margin: 68                 // bottom nav height, so banner sits above it
          });
          document.documentElement.style.setProperty('--ad-space', CONFIG.BANNER_HEIGHT + 'px');
        } catch (e) { console.warn('Banner failed', e); }
        return;
      }
      placeholderBanner();
    },

    /* Interstitial — shown after "Create PDF" (before the save/share sheet) and on share / print.
     * force = true skips the cooldown (used for the Create -> ad -> Save flow so the ad always shows). */
    async showInterstitial(force) {
      const now = Date.now();
      if (!force && now - lastInterstitial < CONFIG.INTERSTITIAL_COOLDOWN_MS) return;
      await Ads.init();
      if (AdMob) {
        try {
          await AdMob.prepareInterstitial({ adId: ids().interstitial });
          await AdMob.showInterstitial();
          lastInterstitial = Date.now();
        } catch (e) { console.warn('Interstitial failed', e); }
        return;
      }
      lastInterstitial = now;
      return new Promise(function (res) { placeholderPopup('AdMob Interstitial Ad', ids().interstitial, 'Your file is ready.', res); });
    }
  };

  window.Ads = Ads;
})();
