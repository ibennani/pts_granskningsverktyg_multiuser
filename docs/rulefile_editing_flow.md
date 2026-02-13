# Redigeringsflöde för regelfilsektioner

Detta dokument beskriver hur redigeringen av regelfilsektioner fungerar när användaren är i regelfilredigeringsläge (`auditStatus === 'rulefile_editing'`).

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

## Platshållarsektioner

Klassificeringar och Rapportmall visar för närvarande:

- Korrekt H1 (sektionens titel)
- Texten "Denna funktion kommer senare" (översättningsnyckel: `rulefile_section_coming_soon`)
