# AI-inställningar (admin)

Administratörer kan konfigurera hur Leffe ansluter till en språkmodell (LLM). Inställningarna gäller hela systemet och sparas i databasen.

## Var hittar jag vyn?

Logga in som administratör och öppna **AI-inställningar** i sidomenyn.

## Vad ska jag fylla i?

| Fält | Exempel | Kommentar |
|------|---------|-----------|
| Leverantör | Ollama (lokal) | I steg 1 stöds Ollama |
| Bas-URL | `http://127.0.0.1:11434` | Adressen **Leffe-servern** använder, inte webbläsaren |
| Modell | `qwen2.5:7b` | Exakt namn från `ollama list` eller Ollamas modellista |
| API-nyckel | (tom) | Behövs normalt inte för lokal Ollama |
| Timeout | `60000` | Millisekunder (1–600 sekunder) |
| Aktivera AI | på/av | Stäng av utan att radera konfigurationen |

### Nätverk: var körs vad?

- **Leffe-server på värddatorn + Ollama i Docker** (som i `docker-compose.yml`): använd `http://127.0.0.1:11434`.
- **Leffe-server i samma Docker-nät som Ollama**: använd t.ex. `http://ollama-final:11434`.

Miljövariabeln `OLLAMA_BASE_URL` används som standard om inget annat är sparat i databasen.

## Testa anslutning

Klicka **Testa anslutning** innan du sparar om du ändrat URL eller modell. Leffe hämtar då modellistan från Ollama och visar om den angivna modellen finns.

Sparad status kan även läsas via API: `GET /api/llm/status` (endast admin, inloggad).

## Säkerhet

- API-nycklar lagras på servern och visas aldrig i klartext i gränssnittet efter sparning.
- All LLM-trafik ska gå via Leffe-backend (`/api/llm/...`), inte direkt från webbläsaren.
- Den tidigare publika endpointen `/api/ollama-status` är borttagen; använd admin-endpointen ovan.

## Chatta med Leffe och systemdata

I **Chatta med Leffe** har modellen **verktyg** mot databasen (samma data som API:erna exponerar för inloggade användare):

| Verktyg | Vad det gör |
|---------|-------------|
| `list_audits` | Lista granskningar |
| `get_audit` | Översikt om en granskning |
| `get_audit_content` | Stickprov, bedömningar och observationer i en granskning |
| `list_rule_sets` / `get_rule_set` | Regelfiler |
| `get_statistics` | Statistik för avslutade granskningar |
| `update_audit_metadata` | Uppdatera granskningsmetadata |
| `update_requirement_result` | Uppdatera kravbedömning i stickprov |

Modellen hämtar mer data vid behov (agentloop) i stället för att få hela databasen i varje meddelande.

**Inte inkluderat:** filer på serverdisk (backup-mappar, källkod), hemligheter och data utanför Leffes API.

**Modellkrav:** verktygsanrop fungerar bäst med modeller som stödjer tools (t.ex. `qwen3.6:27b`, `gemma4:12b`).

Om du har en granskning eller regelfil öppen skickas det som ledtråd så Leffe vet vad du arbetar med.

## Felsökning chatt

Vid `npm run dev` loggas varje chatt i **serverterminalen** med prefix `[llm-chat]`: fråga, verktygsanrop, rundor och om slutsvar skapades.

Sätt `LLM_CHAT_DEBUG=1` i `.env` för att tvinga logg även utanför development.

I webbläsarens konsol (F12) visas `[ai-chat]`-rader i dev-läge när du skickar och när svar kommer tillbaka.
