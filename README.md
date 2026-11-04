# PZC Hub v2.0 — GitHub PWA migration (staging)

Source extracted from the user's uploaded `Index(1).html`, `Client(2).html`, and `Style.html` on 4 November 2026.

## Status

- Static frontend and PWA shell prepared; official club logo included.
- **Not production-ready:** `apiBase` and Firebase public API key remain blank intentionally.
- The original Apps Script `google.script.run` adapter was replaced with `PZC_API.rpc`.
- Existing `Api.gs` and `Community.gs` remain on the Apps Script server. They are not browser JavaScript and must not be copied to GitHub Pages.
- A separately secured, authenticated API gateway must be built and tested before activating login or data operations.
- The current Netlify redirect and Google Apps Script production deployment are unchanged.

## GitHub Pages staging

1. Create a new repository `PZC-Hub` (separate from `Ride_ZTGPutrajaya`).
2. Add the contents of this folder to the repository root, then deploy GitHub Pages from the `main` branch root.
3. Expect the login to display a configuration error until the backend gateway is ready. Do not invite members yet.
4. Configure only the public Firebase web API key and the trusted gateway base URL in `js/config.js` after the gateway is secured.
5. Confirm ID-token verification, role permissions, request limits, CORS allowlist, and write/audit behavior before production traffic.

## Safety and offline scope

The service worker caches only public static shell assets. It never caches member records, API responses, authentication tokens, or photos. Data editing requires connectivity.

## Files deliberately excluded

Private Apps Script server code, backend credentials, Google Sheet identifiers and deployment-specific secrets are not bundled into this public static artifact.
