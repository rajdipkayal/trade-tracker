# Trade Tracker — Stock P&L Journal

React + Vite web app. Tracks long/short trades, auto-calculates Indian
equity charges (Brokerage, STT, Exchange txn charges, SEBI fee, Stamp duty,
GST), shows weekly/monthly/quarterly/yearly P&L, win rate, equity curve,
and a per-trade journal with pasted chart images. Data is stored locally
in your browser (localStorage) — nothing is sent to a server.

## Run it (website)

Requires Node.js 18+ installed.

```bash
cd trade-tracker
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). It also works
fine on your phone's browser — either deploy it (see below) or run
`npm run dev -- --host` and open `http://<your-pc-ip>:5173` from your
phone on the same WiFi.

## Deploy it as a real website (free)

Easiest options — push this folder to GitHub, then:
- **Vercel**: import the repo, framework = Vite, deploy.
- **Netlify**: `npm run build`, drag the generated `dist` folder into Netlify's deploy UI.

## Turn it into an installable Android app

You do NOT need to rewrite anything. Wrap the same code with Capacitor:

```bash
cd trade-tracker
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Trade Tracker" "com.yourname.tradetracker" --web-dir=dist
npx cap add android
npx cap sync
npx cap open android
```

The last command opens Android Studio. From there just click **Run** to
install it on your phone/emulator, or **Build > Generate Signed Bundle/APK**
to get an installable `.apk`.

(Alternative, zero-install: on your phone, open the deployed website in
Chrome → menu → "Add to Home screen". That gives you an app icon that
opens fullscreen like a native app — no Android Studio needed.)

## Editing charge rates

Go to the **Settings** tab in the app. Default rates are approximate
(typical discount-broker NSE equity rates) — edit them to match your
actual broker's contract note, since brokerage plans and stamp duty vary.

## Notes / limitations

- Data lives only in the browser it was entered in (localStorage). Clearing
  browser data will erase trades — export/backup is a good next feature to add.
- Journal images are stored as base64 in localStorage; very large numbers
  of high-res images may hit browser storage limits (~5-10MB). Swap to
  IndexedDB later if you outgrow this.
- Charge formulas are simplified/approximate — always cross-check against
  your actual contract note before relying on them for tax filing.
