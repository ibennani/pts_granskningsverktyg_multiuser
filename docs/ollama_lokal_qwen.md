# Verifiera att du använder lokal Qwen (Ollama)

I det här projektet körs **Qwen** (och andra modeller) via **Ollama** i Docker. **Open WebUI** på port 3080 är gränssnittet för chatt och använder alltid den lokala Ollama-instansen – ingen molntjänst används om du öppnar Open WebUI via localhost.

## Så vet du att du använder lokalt

1. **Du använder Open WebUI på localhost**
   - Öppna **http://localhost:3080** (inte en extern eller ngrok-URL om du vill vara säker på att allt är lokalt).
   - I vår Docker-setup är Open WebUI konfigurerad med `OLLAMA_BASE_URL=http://ollama-final:11434`, dvs den pratar bara med Ollama-containern i Docker – ingen moln-API.

2. **Kolla status via Granskningsverktygets backend**
   - När du kör `npm run dev` kan du anropa:
   - **http://localhost:3000/api/ollama-status**
   - Svarar t.ex.:
     - `"ollama": "local"` + lista på modeller (t.ex. Qwen) = lokal Ollama är igång och används.
     - `"ollama": "unreachable"` = Ollama-containern svarar inte (starta om Docker/containrarna).

3. **Kolla i Open WebUI**
   - Gå till **Connections → Ollama → Manage** (nyckelsymbol/inställningar).
   - Där ska Ollama-URL peka på den interna adressen (Open WebUI använder `OLLAMA_BASE_URL` från Docker; du kan se att anslutningen är verifierad).

4. **Modellerna du ser kommer från Ollama**
   - De modeller som visas i Open WebUI (t.ex. Qwen) är de som finns i din lokala Ollama (`ollama list` i terminalen eller `/api/tags` mot port 11434). Ingen modell hämtas från molnet om du inte själv konfigurerar en moln-anslutning i Open WebUI.

## Kort sammanfattning

| Vad du gör | Lokal Qwen? |
|------------|-------------|
| Öppnar **http://localhost:3080** och chattar med en modell (t.ex. Qwen) | **Ja** – Open WebUI använder bara Ollama i Docker. |
| Anropar **http://localhost:3000/api/ollama-status** och får `"ollama": "local"` | **Ja** – då är lokal Ollama igång och tillgänglig. |
| Använder en ngrok-URL för att nå Open WebUI från utsidan | Chatt går fortfarande via samma Ollama i Docker; trafiken till/från modellen är lokal, ngrok exponerar bara webbgränssnittet. |

Om du vill dubbelkolla: starta en chatt på http://localhost:3080, anropa sedan http://localhost:3000/api/ollama-status – om du får `"ollama": "local"` använder du en lokal version av Qwen (via Ollama).
