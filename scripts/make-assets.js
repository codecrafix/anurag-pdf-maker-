// Generates launcher icons, native splash and theme colours for the Android project.
// Cosmetic only: any failure here is non-fatal (the APK is still built).
const fs = require('fs');
const path = require('path');

const RES = path.join('android', 'app', 'src', 'main', 'res');
let sharp;
try { sharp = require('sharp'); } catch (e) { console.warn('sharp not available, skipping icon/splash generation'); process.exit(0); }

const png = (svg, size) => sharp(svg, { density: 600 }).resize(size, size).png().toBuffer();

(async () => {
  const logoSvg = fs.readFileSync('resources/logo.svg');
  const fgSvg = fs.readFileSync('resources/foreground.svg');

  /* ---- launcher icons ---- */
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(RES, 'mipmap-' + d);
    fs.mkdirSync(dir, { recursive: true });
    const l = Math.round(48 * k), f = Math.round(108 * k);
    const sq = await png(logoSvg, l);
    const mask = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="' + l + '" height="' + l + '"><circle cx="' + (l / 2) + '" cy="' + (l / 2) + '" r="' + (l / 2) + '"/></svg>');
    const round = await sharp(sq).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), sq);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), round);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), await png(fgSvg, f));
  }
  fs.mkdirSync(path.join(RES, 'values'), { recursive: true });
  fs.writeFileSync(path.join(RES, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#D40F2B</color>\n</resources>\n');
  console.log('launcher icons done');

  /* ---- native splash: white screen + centred logo (like the client app) ---- */
  const logo480 = await png(logoSvg, 480);
  const iconDir = path.join(RES, 'drawable-xxxhdpi');
  fs.mkdirSync(iconDir, { recursive: true });
  fs.writeFileSync(path.join(iconDir, 'splash_logo.png'),
    await sharp({ create: { width: 1152, height: 1152, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: logo480, gravity: 'center' }]).png().toBuffer());

  for (const dn of fs.readdirSync(RES)) {
    if (!dn.startsWith('drawable')) continue;
    const p = path.join(RES, dn, 'splash.png');
    if (!fs.existsSync(p)) continue;
    const m = await sharp(p).metadata();
    const lg = await png(logoSvg, Math.round(Math.min(m.width, m.height) / 3));
    fs.writeFileSync(p, await sharp({ create: { width: m.width, height: m.height, channels: 3, background: '#ffffff' } })
      .composite([{ input: lg, gravity: 'center' }]).png().toBuffer());
  }
  console.log('splash done');

  /* ---- theme: status bar #4338CA, light navigation bar, splash icon ---- */
  const sp = path.join(RES, 'values', 'styles.xml');
  if (fs.existsSync(sp)) {
    let s = fs.readFileSync(sp, 'utf8');
    const bars = '\n        <item name="android:statusBarColor">#4338CA</item>\n        <item name="android:navigationBarColor">#F8F8F8</item>\n        <item name="android:windowLightNavigationBar">true</item>';
    s = s.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, '$1' + bars);
    s = s.replace(/(<style name="AppTheme\.NoActionBarLaunch"[^>]*SplashScreen[^>]*>)/,
      '$1' + bars + '\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_logo</item>\n        <item name="windowSplashScreenBackground">#FFFFFF</item>');
    fs.writeFileSync(sp, s);
    console.log('styles patched');
  }
})().catch(e => { console.warn('asset generation failed (non-fatal):', e && e.message); });
