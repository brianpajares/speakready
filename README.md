# SpeakReady

SpeakReady is a privacy-first English speaking practice prototype. Choose a goal and level, record an answer in the browser, type its transcript, and review a local estimate of your pace and filler words.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The interface is available in Spanish, English, and Portuguese. `GET /api/health` reports whether the web app is running.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run engine:verify
npm run licenses
npm run build
npm run test:e2e
npm run test:a11y
```

## Current scope

The browser records audio only for the active tab. SpeakReady does not upload or save the recording or transcript. Only practice summaries are stored in local browser storage. Pace and filler-word metrics are deterministic estimates based on the transcript the user enters. Pronunciation scoring, accounts, payments, and cloud inference are not connected; the app does not present a global or official exam score.
