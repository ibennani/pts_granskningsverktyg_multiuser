# Analys: Saknade fält och förbättringsmöjligheter för regelfilredigering

## Sammanfattning

Denna analys identifierar fält i regelfilstrukturen som antingen saknas i redigeringsgränssnittet eller har inkonsekvent hantering.

## Struktur i regelfilen

### Toppnivå-fält
- ✅ `metadata` (obligatorisk) - Redigeras i `EditRulefileMetadataViewComponent`
- ✅ `requirements` (obligatorisk) - Redigeras i `EditRulefileRequirementComponent`
- ⚠️ `reportTemplate` (valfritt) - Redigeras i metadata-vyn men är på toppnivå (inkonsekvent placering)

### Metadata-fält som redigeras

**Allmän information:**
- ✅ title, description, version, language
- ✅ monitoringType (type, text)
- ✅ dateCreated, dateModified, license

**Utgivare & källa:**
- ✅ publisher (name, contactPoint)
- ✅ source (url, title, retrievedDate, format)

**Klassificeringar:**
- ✅ keywords
- ✅ pageTypes
- ✅ contentTypes
- ✅ samples (sampleCategories, sampleTypes)
- ✅ taxonomies

**Rapportmall:**
- ✅ reportTemplate.sections (redigeras via metadata-vyn)

## Identifierade problem

### 1. `metadata.blockOrders.infoBlocks` - Kan inte redigeras direkt

**Problem:**
- `metadata.blockOrders.infoBlocks` är en array som bestämmer **global ordning** för info-blocks i alla krav
- Den används för att bestämma i vilken ordning blocks visas när man redigerar krav (expectedObservation, instructions, exceptions, etc.)
- Det finns **ingen UI** för att redigera denna ordning i metadata-vyn
- Den sätts endast automatiskt vid migration eller använder standardordning: `['expectedObservation', 'instructions', 'exceptions', 'commonErrors', 'tips', 'examples']`

**Var används den:**
- `EditRulefileRequirementComponent.js` - Läser `blockOrders.infoBlocks` för att bestämma ordning när krav redigeras
- `rulefile_migration_logic.js` - Sätter standardordning vid migration
- `RequirementInfoSections.js` - Använder ordningen för att visa info-blocks

**Förslag:**
- Lägg till en sektion i metadata-redigeringen där användaren kan ändra ordningen på info-blocks globalt
- Detta skulle påverka hur alla krav visas när de redigeras

### 2. `metadata.vocabularies` - Synkas automatiskt men redigeras inte direkt

**Problem:**
- `vocabularies` är en backup-struktur som synkas automatiskt när man redigerar pageTypes, contentTypes, taxonomies, sampleTypes
- Den redigeras inte direkt utan skapas/synkas automatiskt i `_ensure_metadata_defaults()`
- Detta är faktiskt korrekt beteende - den ska vara en synkad backup, inte något man redigerar direkt

**Status:** ✅ Fungerar som tänkt - ingen ändring behövs

### 3. `reportTemplate` - På toppnivå men redigeras i metadata-vyn

**Problem:**
- `reportTemplate` är på **toppnivå** i JSON-strukturen (samma nivå som `metadata` och `requirements`)
- Men den redigeras i `EditRulefileMetadataViewComponent` (metadata-vyn)
- Detta är inkonsekvent - användaren förväntar sig att hitta den i metadata-vyn, men strukturellt är den på toppnivå

**Förslag:**
- Antingen flytta `reportTemplate` till `metadata.reportTemplate` (strukturell förändring)
- Eller skapa en separat vy för toppnivå-fält (inklusive `reportTemplate`)
- Eller behålla som det är men dokumentera tydligt att det är på toppnivå

### 4. `metadata.blockOrders.reportSections` - Redigeras indirekt

**Status:**
- ✅ Redigeras indirekt när man ändrar ordning på reportTemplate-sections
- Fungerar korrekt - ingen ändring behövs

## Ytterligare observationer

### Fält som kan vara värdefulla att redigera

1. **`metadata.blockOrders.infoBlocks`** - Se ovan
   - Viktigt för att kunna anpassa ordningen på info-blocks globalt
   - Påverkar hur alla krav visas när de redigeras

2. **Eventuella ytterligare blockOrders-fält**
   - Om det finns andra blockOrders-fält i framtiden, bör de också kunna redigeras

## Rekommendationer

### Prioritet 1: Lägg till redigering av `metadata.blockOrders.infoBlocks`
- Skapa en ny sektion i metadata-redigeringen: "Info-blocks ordning"
- Tillåt användaren att ändra ordningen på info-blocks globalt
- Detta påverkar hur alla krav visas när de redigeras

### Prioritet 2: Överväg att flytta `reportTemplate` till `metadata.reportTemplate`
- För konsekvens med resten av strukturen
- Eller skapa en separat vy för toppnivå-fält

### Prioritet 3: Förbättra UX-strukturen
- Dela upp metadata-redigeringen i flikar/sektioner (se tidigare diskussion)
- Detta skulle göra det enklare att hitta och redigera specifika fält

## Teknisk information

### Var blockOrders.infoBlocks används:
- `js/components/EditRulefileRequirementComponent.js:101` - Läser ordningen
- `js/components/EditRulefileRequirementComponent.js:724` - Använder ordningen vid rendering
- `js/components/EditRulefileRequirementComponent.js:1328` - Använder ordningen vid sparning
- `js/logic/rulefile_migration_logic.js:44` - Sätter standardordning
- `js/components/requirement_audit/RequirementInfoSections.js:63` - Använder ordningen vid visning

### Var reportTemplate hanteras:
- `js/components/EditRulefileMetadataViewComponent.js:916-924` - Läses från toppnivå
- `js/components/EditRulefileMetadataViewComponent.js:1180-1185` - Sparas till toppnivå
- `js/validation_logic.js:49-75` - Valideras på toppnivå
