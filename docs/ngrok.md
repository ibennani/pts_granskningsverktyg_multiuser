# Ngrok i dev

Ngrok används för att exponera port 11434 (t.ex. Ollama/Open Web UI) mot internet under utveckling. Det startas automatiskt med `npm run dev`.

## Setup (en gång)

1. **Skapa konto och hämta authtoken**
   - Gå till [ngrok.com](https://ngrok.com) och registrera dig (gratis).
   - Öppna [Dashboard → Your authtoken](https://dashboard.ngrok.com/get-started/your-authtoken) och kopiera token.

2. **Lägg token i `.env`**
   - Skapa eller redigera `.env` i projektroten.
   - Lägg till (ersätt med din token):
   ```env
   NGROK_AUTHTOKEN=din_token_här
   ```

3. **Valfritt: fast URL**
   - Om du har en reserverad ngrok-domän, lägg till:
   ```env
   NGROK_URL=https://din-subdomain.ngrok-free.app
   ```
   - Om `NGROK_URL` inte sätts får du en slumpad URL varje gång (fungerar fint).

## Teknik

Projektet använder paketet `@ngrok/ngrok` – ingen separat ngrok-installation eller PATH krävs. Token läses från `NGROK_AUTHTOKEN` i `.env`.
