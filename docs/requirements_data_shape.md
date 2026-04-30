# Kravdata i regelfilen (objekt eller array)

## Översikt

Regelfilens `requirements` kan levereras som **nycklat objekt** (varje krav under en fast nyckel) eller som **lista**. Verktyget ska bete sig likvärdigt i granskning, filter och export. Gemensamt uppslag sker via granskningslogikens hjälpfunktioner och, där det behövs, via `RequirementLookup` / normalisering till en enhetlig karta för bearbetning.

## Var data används (kategorier)

1. **Granskning och stickprov** – lista relevanta krav, läsa och skriva bedömningar, sidomeny och hash-länkar. Här ska samma uppslag som i `find_requirement_definition` användas så att både publikt id och lagringsnyckel fungerar.
2. **Regelfilsredigering** – ändra enskilt krav, infoblock och innehållstyper. I praktiken ofta objektformat efter migrering; uppslag ska ändå vara tolerant mot lista om filen inte normaliserats.
3. **Export (Word, Excel, CSV, HTML)** – många moduler itererar krav. Vid objekt används poster och nycklar; vid lista måste iteration och id för export härledas från kravpostens `id`/`key`, inte från listindex som enda id.
4. **Poäng / bristindex** – räknar över alla krav per stickprov; iteration måste ge samma mängd kravdefinitioner oavsett list- eller objektformat.
5. **Innehållstyper i regelfil** – räkna och filtrera krav per innehållstyp; här krävs korrekt iteration så att listformat inte felaktigt använder index som krav-id.
6. **Validering vid inläsning** – regelfil och sparad granskning kontrolleras att `requirements` är giltigt objekt eller icke-tom array med samma innehållskrav per post.

## Riktlinjer för vidare arbete

- Vid **ny** kod: hämta krav via `find_requirement_definition` / `RequirementLookup` i stället för direkt `requirements[id]`, om inte du uttryckligen redigerar den nycklade kartan i regelfilsredigeraren.
- När du **ändrar** en modul som idag använder `Object.entries` på `requirements`: kontrollera att listformat ger rätt id till användaren (inte bara `"0"`, `"1"`).
- **Normalisering till record** (`normalize_requirements_to_record`) lämpar sig för jämförelser, exportdelar och mutationer som bygger om ett objekt; **återställ till array** om den inkommande regelfilen var array och användaren förväntar sig listordning oförändrad.
