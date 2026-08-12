# CMP-hantering i sidrapporter

Sidrapporter skapas automatiskt i bakgrunden när du sparar en granskningsdel med webbadress. Leffe försöker hantera cookie-banners så att skärmdumpen och det tekniska underlaget inte domineras av CMP-gränssnitt.

## Vad Leffe gör

1. **Blockerar CMP-nätverksanrop** under capture (script, stylesheet, XHR m.m. från kända CMP-domäner).
2. **Återanvänder sparat samtycke** om samma domän har lyckats tidigare (domän-cache, ca 90 dagar).
3. **Klickar på «Godkänn»** när en banner hittas (leverantörsspecifika selectors och svenska/engelska knapptexter).
4. **Döljer kvarvarande banners** visuellt inför skärmdump om de inte går bort.
5. **Varning i manifest** om banner troligen fortfarande syns (`cmp_banner_remaining`).

## Kända CMP-leverantörer

Leffe har explicit stöd för (urval):

- Cookiebot, OneTrust, Usercentrics, Didomi
- CookieYes, Termly, iubenda
- Complianz, Borlabs Cookie, Real Cookie Banner (WordPress)
- CookieFirst, Tarteaucitron, Commanders Act / TrustCommander
- Sourcepoint / Schibsted, Osano, TrustArc, Axeptio, Klaro
- Cookie Information, Quantcast, Consent Manager med flera

Okända CMP:er kan delvis träffas av generiska mönster (domäner med `consent`, `cookie`, `cmp.` osv.).

## Manifest och felsökning

I `manifest.json` i den nedladdade zip-filen:

| Fält | Betydelse |
|------|-----------|
| `captureAdjustments.cookieBannerClicked` | Leffe klickade på en accept-knapp |
| `captureAdjustments.cookieBannerElementsHidden` | Antal element dolda visuellt |
| `captureAdjustments.cmpRequestsBlocked` | Antal blockerade CMP-nätverksanrop |
| `captureAdjustments.cookieBannerVisibleAfterCapture` | Banner troligen kvar efter alla steg |

Varning `cmp_banner_remaining` betyder att cookie-bannern kan synas i skärmdumpen.

## Manuell seed (svåra sajter)

Om en sajt fortfarande visar banner:

1. Öppna sidan i Chrome, klicka «Godkänn alla».
2. DevTools → Application → Cookies / Local Storage.
3. Lägg värden i `server/data/cmp_consent_seed.json` under domänen (utan `www.`), eller i miljövariabel `GV_CMP_CONSENT_SEED_FILE`.
4. Skapa ny sidrapport.

Se `_vendors` i seed-filen för typiska cookie-namn per leverantör.

## Begränsningar

- CMP i cross-origin iframe kan inte alltid dismissas.
- Seninladdade banners (efter flera sekunder) kan missas.
- Generiska nätverksmönster kan i undantagsfall blockera icke-CMP-resurser.

Teknisk implementation: `server/services/cmp/` och `server/services/page_capture_session.ts`.
