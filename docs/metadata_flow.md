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
