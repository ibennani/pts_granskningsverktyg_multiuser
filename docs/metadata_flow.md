# Metadataflöde – Granskningsmetadata

Detta dokument beskriver hur granskningsmetadata (diarienummer, granskarens namn, aktör m.m.) lagras, uppdateras och visas i applikationen.

## Var metadata lagras

Granskningsmetadata lagras centralt i `state.auditMetadata` i [js/state.js](../js/state.js). Följande fält finns:

| Fält | Beskrivning |
|------|-------------|
| `caseNumber` | Diarienummer |
| `actorName` | Aktörens namn (obligatoriskt) |
| `actorLink` | Länk till aktören |
| `auditorName` | Granskarens namn |
| `caseHandler` | Ärend handläggare |
| `internalComment` | Intern kommentar |
| `audit_edit_log` | Valfri append-only-lista (array av händelser med tid och status vid sparning mot servern). Fylls i av klienten; äldre exporterade JSON-filer kan sakna fältet tills första lyckade synk. |

## Hur uppdateringar sprids

1. Användaren sparar i [EditMetadataViewComponent](../js/components/EditMetadataViewComponent.js) via [MetadataFormComponent](../js/components/MetadataFormComponent.js).
2. `dispatch({ type: UPDATE_METADATA, payload: form_data })` anropas.
3. Reducern i `state.js` uppdaterar `auditMetadata`.
4. Alla `subscribe`-lyssnare triggas (utan `skip_render` för metadata).
5. I [main.js](../js/main.js) körs global subscribe-callback som:
   - renderar top/bottom action bar
   - uppdaterar sidtiteln via `updatePageTitleFromCurrentView()`
   - uppdaterar sidomenyn
   - re-renderar aktuell vy
6. [AuditOverviewComponent](../js/components/AuditOverviewComponent.js) har egen prenumeration och reagerar explicit på metadata-ändringar i `handle_store_update`.

## Komponenter som visar metadata

| Plats | Komponent | Fält som visas |
|-------|-----------|----------------|
| Granskningsöversikt | [AuditInfoComponent](../js/components/AuditInfoComponent.js) | Alla fält |
| Sidtitel (flik) | [main.js](../js/main.js) `build_page_title` | `actorName` |
| Stickprovslista (header) | [RequirementsListViewComponent](../js/components/RequirementsListViewComponent.js) | `actorName` |
| Kravgranskning (kontext) | [RequirementAuditComponent](../js/components/RequirementAuditComponent.js) | `actorName` |
| Export (Word, Excel, CSV, HTML) | [export_logic.js](../js/export_logic.js) | Alla fält |
| Sparfilnamn | [save_audit_logic.js](../js/logic/save_audit_logic.js) | `actorName`, `caseNumber` |

Alla komponenter läser från `getState().auditMetadata` vid render, vilket säkerställer att uppdaterad metadata visas överallt.

## Redigering av metadata

Metadata redigeras via vyn "Redigera granskningsinformation" (`edit_metadata`), som nås från knappen "Redigera" i granskningsinfopanelens header på granskningsöversikten. Efter sparning navigeras användaren tillbaka till granskningsöversikten med uppdaterad information.

Metadata kan redigeras både innan granskningen startats (`not_started`) och när den är pågående (`in_progress`). Vid sparning anropas `sync_to_server_now()` direkt (i [EditMetadataViewComponent](../js/components/EditMetadataViewComponent.js)) så att servern uppdateras innan navigering – detta säkerställer att listan över granskningar visar korrekt metadata direkt.

## Lista över granskningar (StartViewComponent)

När applikationen är ansluten till en server visas [StartViewComponent](../js/components/StartViewComponent.js) med en tabell över alla granskningar. Tabellen visar endast data från granskningsmetadata:

| Kolumn | Källa | Saknad data |
|--------|-------|-------------|
| Diarienummer | `metadata.caseNumber` | Visar "—" |
| Aktörens namn | `metadata.actorName` | Visar "—" |
| Status | `audit.status` | Visar "—" |
| Progress | Beräknat från servern | Visar "—" |
| Bristindex | Beräknat från servern | Visar "—" |
| Granskare | `metadata.auditorName` | Visar "—" |
| Ladda ner | Knapp | Nedladdning som JSON |

Varje rad har en "Ladda ner"-knapp för att ladda ner granskningen som JSON-fil. Knappens aria-label är "Ladda ner {diarienummer} {aktörens namn}".

## Granskningsstatus i databasen och i gränssnittet

Status lagras i databasen som oförändrade enum-värden. Visningsnamn styrs av översättningar (i18n), inte av migrering av befintliga rader.

| Lagrat värde (`audit.status`) | Visningsnamn i gränssnittet |
|-------------------------------|-----------------------------|
| `not_started` | Förberett |
| `in_progress` | Pågår |
| `locked` | Avslutad |
| `archived` | Arkiverad |

**Importerade eller äldre JSON-filer:** Om `auditStatus` saknas eller är ogiltig faller valideringen tillbaka till `not_started` (Förberett), i linje med befintlig logik. Fält som `audit_edit_log` kan saknas och behandlas då som tomma tills data skapats vid synk.

**Export:** För arkiverade granskningar ska fältet för senaste ändring inte följa med i Excel-exportens allmänna information (listor i startvyn visar däremot alltid kolumnen *Senast ändrad* utifrån serverns `updated_at`).
