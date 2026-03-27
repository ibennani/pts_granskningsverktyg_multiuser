# Redigeringsflöde för regelfilsektioner (Leffe)

Detta dokument beskriver hur redigeringen av regelfilsektioner fungerar i **Leffe** när användaren är i regelfilredigeringsläge (`auditStatus === 'rulefile_editing'`).

## Översikt

Sidomenyn visar åtta alternativ som leder till olika sektioner. Varje sektion har antingen visningsläge (read-only) eller redigeringsläge (formulär).

## Sektioner och routes

| Menyalternativ     | Route                 | Sektion           | Visning                    | Redigering                          |
|--------------------|-----------------------|-------------------|----------------------------|-------------------------------------|
| Allmän information | rulefile_sections     | general           | Definition list            | EditGeneralSectionComponent         |
| Krav               | rulefile_requirements | –                 | Lista med länkar           | RulefileRequirementsListComponent + EditRulefileRequirementComponent |
| Stickprov          | rulefile_sections     | sample_types      | Punktlista                 | EditSampleTypesSectionComponent     |
| Sidtyper           | rulefile_sections     | page_types        | Lista med underkategorier  | EditPageTypesSectionComponent       |
| Innehållstyper     | rulefile_sections     | content_types     | Nästlad lista              | EditContentTypesSectionComponent    |
| Informationsblock  | rulefile_sections     | info_blocks_order | Numrerad lista             | EditInfoBlocksSectionComponent      |
| Klassificeringar   | rulefile_sections     | classifications   | Platshållare               | –                                   |
| Rapportmall        | rulefile_sections     | report_template   | Platshållare               | –                                   |

## URL-format

- **Visning:** `#rulefile_sections?section=<section_id>`
- **Redigering:** `#rulefile_sections?section=<section_id>&edit=true`
- **Krav:** `#rulefile_requirements`, `#rulefile_view_requirement?id=...`, `#rulefile_edit_requirement?id=...`, `#rulefile_add_requirement`

## Komponentansvar

### RulefileSectionsViewComponent

- Hanterar routing för `rulefile_sections` med `section`-param
- Visar header (h1) och antingen visningsinnehåll eller redigeringsformulär
- Laddar dynamiskt Edit*SectionComponent för redigeringsläge
- För Klassificeringar och Rapportmall: visar platshållare med "Denna funktion kommer senare"

### Edit*SectionComponent

Varje sektion har en dedikerad redigeringskomponent:

- **EditGeneralSectionComponent** – Allmän information, utgivare, källa
- **EditSampleTypesSectionComponent** – Stickprovskategorier och typer
- **EditPageTypesSectionComponent** – Sidtyper med underkategorier
- **EditContentTypesSectionComponent** – Innehållstyper (hierarki)
- **EditInfoBlocksSectionComponent** – Informationsblock (ordning och namn)

### RulefileRequirementsListComponent

- Lista över alla krav
- Länkar till visa/redigera/lägg till via `rulefile_view_requirement`, `rulefile_edit_requirement`, `rulefile_add_requirement`

## Autospar

Alla redigeringsformulär följer projektets autospar-regler:

- 250 ms debounce vid `input`
- Triggas inte vid `blur`
- Bevarar fokus och scroll vid autospar
- Trimning endast vid manuell sparning eller när vyn lämnas

## Relaterat: Uppdatera regelfil i pågående granskning

Det finns ett separat flöde för att **byta till en nyare regelfil** (från servern) i en pågående granskning, utan att redigera innehållet i gränssnittet:

1. **Ingång:** Granskning öppen. Knappen "Uppdatera regelfil (version X)" visas när en nyare version av samma regelfil finns på servern. Synlighet: i **Granskningsåtgärder** (AuditActionsViewComponent) och på **Granskningsöversikten** (AuditOverviewComponent, liten banner med länk). "Nyare version" bestäms i `js/logic/newer_rule_check.js` (`find_newer_rule_for_audit`): om granskningen har `ruleSetId` jämförs endast den regeluppsättningens `metadata_version` mot granskningens `ruleFileContent.metadata.version`; saknas `ruleSetId` matchas på regelfilens titel och monitoring-typ. Om granskningens regelfil saknar `metadata.version` visas inte knappen.
2. **UpdateRulefileViewComponent:** Steg 1 – varning och rekommendation att spara säkerhetskopia. Användaren kan **spara säkerhetskopia**, **hoppa över** ("Fortsätt utan säkerhetskopia") eller **gå tillbaka** till granskningsöversikten. Steg 2 – "Använd regelfil från servern" (med laddningsindikator) hämtar publicerad version via `get_rule(ruleId)`, migrerar och validerar, kör `RulefileUpdaterLogic.analyze_rule_file_changes`. Steg 3 – användaren ser rapport: **uppdaterade krav** (markerade för omgranskning), **borttagna krav** och **nya krav** (som finns i nya regelfilen men inte i den gamla). Bekräfta eller "Fortsätt med gammal regelfil".
3. **Efter bekräftelse:** `RulefileUpdaterLogic.apply_rule_file_update` bygger nytt state (ny regelfil, samples med mappade krav-nycklar, borttagna borttagna, ändrade märkta `needsReview`). Dispatch `REPLACE_RULEFILE_AND_RECONCILE`. Om minst ett krav har `needsReview` skickas användaren till vyn **Hantera uppdaterade bedömningar** (`confirm_updates`); annars till granskningsöversikten.
4. **Omgranskning:** ConfirmUpdatesViewComponent listar alla krav med `needsReview`. Användaren kan gå till respektive krav (requirement_audit) och bekräfta bedömningen, eller "Bekräfta alla" → FinalConfirmUpdatesViewComponent → godkänn alla på en gång.
5. **Persistens:** Efter dispatch triggas vanlig `schedule_sync_to_server`. PATCH till `/audits/:id` skickar även `ruleFileContent` så att granskningens kopia (`audits.rule_file_content`) uppdateras på servern. Vid nästa laddning används denna sparade kopia.

Skillnad mot "regelfilsredigering" ovan: här ersätts hela regelfilen med serverns version; det är ingen sektion-för-sektion-redigering.

## Platshållarsektioner

Klassificeringar och Rapportmall visar för närvarande:

- Korrekt H1 (sektionens titel)
- Texten "Denna funktion kommer senare" (översättningsnyckel: `rulefile_section_coming_soon`)
