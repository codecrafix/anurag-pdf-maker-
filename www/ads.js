/* ads.js — AdMob bridge for Anurag PDF Maker
 *
 * Launch flow: splash -> "Continue to App" popup -> tap -> App Open ad -> app opens.
 *
 * PLACEHOLDER_IN_APP = true  -> no real AdMob SDK calls, only the placeholder popups/banner strip.
 * PLACEHOLDER_IN_APP = false -> inside the Android app real AdMob ads are used (@capacitor-community/admob).
 *                               Browser preview still shows placeholders.
 *
 * USE_TEST_ADS = true  -> Google's official test ad units (safe, always fill). Use while testing.
 * USE_TEST_ADS = false -> the LIVE ad units below. Set this after the app is published and AdMob review is done.
 * LIVE_FORMATS         -> formats that always use the LIVE unit, even while USE_TEST_ADS is true.
 * DEBUG = true         -> shows a small toast if the App Open ad fails (set false before release).
 * Never click your own live ads.
 */
(function () {
  const CONFIG = {
    PLACEHOLDER_IN_APP: false,
    USE_TEST_ADS: true,
    LIVE_FORMATS: [],
    DEBUG: true,
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

  const unit = k => ((CONFIG.USE_TEST_ADS && CONFIG.LIVE_FORMATS.indexOf(k) < 0) ? CONFIG.TEST[k] : CONFIG.LIVE[k]);
  const ids = () => ({ banner: unit('banner'), interstitial: unit('interstitial'), appOpen: unit('appOpen') });
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const AdMob = (isNative && !CONFIG.PLACEHOLDER_IN_APP && cap.Plugins) ? cap.Plugins.AdMob : null;

  let lastInterstitial = 0;
  let initDone = false;
  let bannerOn = false;
  let bannerHidden = false;
  let watching = false;
  let appOpenListeners = false;
  let lastAppOpenError = null;

  function debugToast(msg) {
    if (CONFIG.DEBUG && typeof toast === 'function') { try { toast(String(msg).slice(0, 110)); } catch (e) {} }
  }

  /* ---------- banner vs. popups ----------
   * The native banner floats above the web page. While a tool / export popup is open it would cover the
   * bottom buttons (Create PDF, Save to Device ...), so the banner is hidden while any popup is open
   * and shown again when the popup closes. */
  function callBanner(method) {
    try { const p = AdMob[method](); if (p && p.catch) p.catch(function () {}); } catch (e) {}
  }
  function syncBanner() {
    if (!AdMob || !bannerOn) return;
    const open = !!document.querySelector('.modal-overlay.open');
    if (open && !bannerHidden) { bannerHidden = true; callBanner('hideBanner'); }
    else if (!open && bannerHidden) { bannerHidden = false; callBanner('resumeBanner'); }
  }
  function watchModals() {
    if (watching) return;
    watching = true;
    document.querySelectorAll('.modal-overlay').forEach(function (el) {
      new MutationObserver(syncBanner).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }

  /* ---------- popup (launch popup + browser/demo placeholders) ----------
   * label      : small yellow badge on top (empty string = no badge)
   * beforeClose: optional async function that runs when the button is tapped (used to show the real ad);
   *              the popup closes after it finishes. */
  function placeholderPopup(label, adId, sub, onClose, beforeClose) {
    const logo = (typeof APP_LOGO_SVG !== 'undefined') ? APP_LOGO_SVG : '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(17,24,39,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;';
    wrap.innerHTML =
      '<div style="background:#fff;border-radius:22px;padding:27px 20px 24px;max-width:380px;width:100%;text-align:center;box-shadow:0 14px 34px rgba(0,0,0,.3)">' +
        (label ? '<div style="display:inline-block;background:#FEF3C7;color:#92400E;font-weight:800;font-size:11px;line-height:19px;padding:0 12px;border-radius:999px">' + label + '</div>' : '') +
        '<div style="width:74px;height:74px;border-radius:19px;overflow:hidden;margin:' + (label ? '10px' : '0') + ' auto 8px;box-shadow:0 7px 17px rgba(217,4,41,.28)">' + logo + '</div>' +
        '<div style="font-size:18px;font-weight:900;color:#111827;line-height:22px">Anurag PDF Maker</div>' +
        '<div style="font-size:11px;font-weight:800;color:#D90429;margin-top:3px;line-height:14px">Powerd By :- Anurag Tecnology</div>' +
        '<div style="background:#F3F4F6;color:#6B7280;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10.5px;height:24px;line-height:24px;border-radius:6px;margin:10px 0 8px;white-space:nowrap;overflow:hidden">' + adId + '</div>' +
        '<div style="color:#6B7280;font-size:12px;line-height:16px;margin-bottom:16px">' + sub + '</div>' +
        '<button id="__adClose" style="width:100%;border:none;border-radius:12px;height:50px;background:linear-gradient(135deg,#D90429,#A4001B);color:#fff;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 6px 13px rgba(217,4,41,.28)">Continue to App &rarr;</button>' +
      '</div>';
    document.body.appendChild(wrap);
    const btn = wrap.querySelector('#__adClose');
    let busy = false;
    btn.onclick = async function () {
      if (busy) return;
      busy = true;
      if (beforeClose) {
        btn.style.opacity = '.6';
        btn.textContent = 'Loading ad...';
        try { await beforeClose(); } catch (e) { console.warn('Ad step failed', e); }
      }
      wrap.remove();
      if (onClose) onClose();
    };
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

  /* ---------- native App Open ad (runs when the launch popup button is tapped) ---------- */
  async function runAppOpenAd() {
    try {
      // The plugin's App Open API is loadAppOpen() + isAppOpenLoaded() + showAppOpen().
      if (typeof AdMob.loadAppOpen === 'function' && typeof AdMob.showAppOpen === 'function') {
        if (!appOpenListeners && typeof AdMob.addListener === 'function') {
          appOpenListeners = true;
          try {
            AdMob.addListener('appOpenAdFailedToLoad', function (err) { lastAppOpenError = err; });
            AdMob.addListener('appOpenAdFailedToShow', function (err) { lastAppOpenError = err; });
          } catch (e) {}
        }
        await AdMob.loadAppOpen({ adId: ids().appOpen });
        // wait (max ~7 s) until the ad is really loaded
        let ready = typeof AdMob.isAppOpenLoaded !== 'function';
        for (let i = 0; i < 14 && !ready; i++) {
          try { const r = await AdMob.isAppOpenLoaded(); ready = !!(r && r.value); } catch (e) { ready = true; }
          if (!ready) await new Promise(function (r) { setTimeout(r, 500); });
        }
        if (!ready) throw new Error((lastAppOpenError && lastAppOpenError.message) || 'ad did not load (no fill / unit not active yet)');
        await AdMob.showAppOpen();
        return;
      }
      if (typeof AdMob.prepareAppOpen === 'function') {
        await AdMob.prepareAppOpen({ adId: ids().appOpen });
        await AdMob.showAppOpen();
        return;
      }
      throw new Error('App Open API missing in plugin');
    } catch (e) {
      console.warn('App open ad failed', e);
      debugToast('App Open: ' + ((e && e.message) || (lastAppOpenError && lastAppOpenError.message) || e));
      // Fallback: show an interstitial so an ad is always shown after the tap
      try {
        await AdMob.prepareInterstitial({ adId: ids().interstitial });
        await AdMob.showInterstitial();
      } catch (e2) { console.warn('Fallback interstitial failed', e2); }
    }
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

    /* Launch popup — call right after the splash screen.
     * The user taps "Continue to App" -> the App Open ad is shown -> the popup closes and the app opens. */
    async showAppOpen() {
      await Ads.init();
      return new Promise(function (res) {
        placeholderPopup('', ids().appOpen, 'Your PDF tools are ready.', res, AdMob ? runAppOpenAd : null);
      });
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
          bannerOn = true;
          watchModals();
          syncBanner();
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
