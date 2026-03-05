## Regelfilsuppdatering, arkiv och återställning

Den här dokumentationen beskriver hur det fungerar när en befintlig granskning uppdateras till en ny regelfil, vad som anses vara en ändring, hur arkivet av borttagna krav fungerar i dag samt ett förslag på hur borttagna krav och observationer skulle kunna läggas tillbaka på ett kontrollerat sätt.

Dokumentet är uppdelat efter de fem huvuddelarna i planen:

- Nuvarande beteende vid uppdatering av regelfil
- Definition av vad som räknas som ändrat
- Nuvarande arkivfunktion och dess begränsningar
- Förslag på återställningsflöde (lägga tillbaka)
- Beslutspunkter inför eventuell implementation

---

## 1. Nuvarande beteende vid uppdatering av regelfil

### 1.1 Ingång: upptäcka att ny regelfil finns

När en granskning öppnas kontrollerar systemet om det finns en nyare version av den regelfil som granskningen använder:

- Klienten hämtar aktuell lista över regelfiler från servern.
- En jämförelse görs mellan granskningens regelfil och de publicerade regelfilerna.
- Om det finns en nyare version av samma regelfil erbjuds åtgärden att uppdatera regelfilen i granskningen.

I granskningsvyn visas då en åtgärd (knapp) som leder till ett särskilt flöde för att uppdatera regelfilen.

### 1.2 Första steg: varning och möjlighet till backup

När användaren klickar på åtgärden för att uppdatera regelfil händer följande:

- En särskild vy för regelfilsuppdatering öppnas.
- Användaren får en tydlig varning om att regelfilen kommer att bytas ut och att detta kan påverka krav, kontrollpunkter och bedömningar.
- I samma steg erbjuds användaren att spara ner hela granskningen som en JSON‑fil innan uppdateringen genomförs.

Backup‑steget fungerar så här i praktiken:

- Hela granskningens aktuella state (inklusive nuvarande regelfil, alla kravresultat, stickprov, metadata och arkiverad information som redan finns) packas ihop till ett JSON‑objekt.
- Användaren får ladda ner filen i webbläsaren.
- Denna fil kan senare användas för att manuellt återskapa granskningen om något skulle gå fel vid uppdateringen.

Det här är i dag det starkaste skyddet mot oönskade konsekvenser vid regelfilsuppdatering, eftersom precis allt sparas ned i en fristående fil.

### 1.3 Ladda och kontrollera den nya regelfilen

Efter varnings‑ och backup‑steget väljer användaren att gå vidare med själva uppdateringen. Då sker följande:

- Den nya regelfilen hämtas antingen från servern (givet ett specifikt regelset och versionsnummer) eller från en uppladdad fil.
- Regelfilen migreras vid behov till den interna struktur som verktyget använder (t.ex. om äldre regelfiler har annan struktur eller fältnamn).
- Regelfilen valideras:
  - Att alla krav har nödvändiga fält.
  - Att kontrollpunkter och godkännandekriterier har korrekt struktur.
  - Att metadata (titel, version, typ av tillsyn osv.) är rimliga.

Om valideringen misslyckas avbryts flödet och användaren får ett felmeddelande i stället för att granskningen uppdateras.

### 1.4 Analys av skillnader mellan gammal och ny regelfil

Om den nya regelfilen är giltig görs en detaljerad jämförelse mellan:

- Kraven i den regelfil som granskningen använder i dag.
- Kraven i den nya regelfilen som användaren vill uppdatera till.

Jämförelsen följer i grova drag dessa steg:

1. **Matcha krav mellan gammal och ny regelfil**  
   - I första hand matchas krav på sitt id/nyckel.  
   - Om id har ändrats försöker systemet i stället matcha på kombinationen av kravnets titel och standardreferens (t.ex. lagrum eller föreskrift).
   - Krav som bara finns i gamla regelfilen identifieras som **borttagna** krav.
   - Krav som bara finns i nya regelfilen identifieras som **nya** krav.

2. **Analysera innehållsändringar i krav som finns i båda versionerna**  
   - För krav som går att matcha (samma id eller samma titel + referens) jämförs innehållet i detalj, se avsnitt 2 nedan.
   - Om något relevant innehåll skiljer sig markeras kravet som **uppdaterat/ändrat**.

Resultatet av analysen är:

- En lista över nya krav.
- En lista över borttagna krav.
- En lista över uppdaterade krav med detaljerad information om vad som har ändrats.

Den här informationen används sedan för att visa en sammanfattning för användaren och för att bygga om granskningens state på ett kontrollerat sätt.

### 1.5 Bekräftelse före uppdatering

Innan uppdateringen genomförs får användaren en överblick av analysresultatet, bland annat:

- Hur många krav som är nya.
- Hur många krav som tagits bort.
- Hur många krav som är ändrade.

Syftet är att användaren ska förstå omfattningen av ändringarna innan själva uppdateringen bekräftas. Först när användaren bekräftar genomförs uppdateringen av granskningen.

### 1.6 Vad händer i granskningen när uppdateringen bekräftas?

När användaren bekräftar att regelfilen ska uppdateras byggs granskningens interna state om enligt följande principer:

1. **Ny regelfil kopplas in**
   - En ny kopia av granskningens state skapas.
   - `ruleFileContent` i state byts ut mot den nya regelfilen.
   - Övriga delar av state, t.ex. UI‑inställningar och metadata, förs över.

2. **Stickprov och kravresultat gås igenom**
   - För varje stickprov i granskningen tittar systemet på alla kravresultat (`requirementResults`).
   - För varje kravresultat avgörs om kravet:
     - fortfarande finns oförändrat i den nya regelfilen,
     - finns men är ändrat,
     - eller inte längre finns alls (borttaget krav).

3. **Borttagna krav flyttas till arkivet**
   - Om ett krav inte längre finns i den nya regelfilen tas det bort från de ordinarie kravresultaten i respektive stickprov.
   - I stället flyttas kravet och alla dess resultat till ett särskilt arkivfält i granskningens state (se avsnitt 3 nedan).
   - På så sätt försvinner borttagna krav från den aktiva checklistan, men observationerna finns kvar i arkivet.

4. **Uppdaterade krav markeras som behöver omgranskning**
   - Om ett krav klassas som ändrat och det redan finns ett resultat (dvs. kravet har granskats tidigare) sätts en flagga på resultatet som visar att det **behöver granskas om**.
   - Kravet ligger kvar i kravresultaten, men är markerat för omgranskning i den fortsatta användningen.
   - Dessutom lagras en detaljerad struktur som beskriver vilka kontrollpunkter och godkännandekriterier som har ändrats för varje sådant krav.

5. **Oförändrade krav lämnas orörda**
   - Krav som varken är borttagna eller ändrade flyttas över utan modifiering.
   - Resultaten för dessa krav fortsätter att gälla som tidigare.

6. **Det nya state:et ersätter det gamla**
   - När alla stickprov och kravresultat har hanterats ersätter det nybyggda state:et det gamla.
   - Synkroniseringstjänsten skickar därefter upp de relevanta delarna av state till servern så att databasen uppdateras.

### 1.7 Efter uppdatering: omgranskning och arkiv

Efter att uppdateringen har genomförts får användaren:

- En vy där alla krav som behöver omgranskas listas, vilket gör det möjligt att gå igenom dem ett och ett eller bekräfta alla på en gång.
- En separat vy där borttagna krav och deras gamla resultat kan granskas i efterhand (arkivvy).

På så sätt blir både omgranskning av ändrade krav och historik för borttagna krav en del av det normala arbetsflödet efter regelfilsuppdatering.

---

## 2. Vad räknas som ändrat i dag?

När systemet avgör om ett krav ska räknas som ändrat görs en innehållsjämförelse mellan den gamla och den nya regelfilen. Detta sker på två nivåer:

- Kravnivå.
- Kontrollpunkter och godkännandekriterier.

### 2.1 Ändringar på kravnivå

På kravnivå jämförs bland annat följande fält:

- Titel.
- Förväntad observationstext.
- Undantag.
- Tips och vanliga fel.
- Innehållstyp (t.ex. dokument, observation på plats).
- Metadata.
- Instruktioner till den som granskar.
- Exempel.

Jämförelsen är gjord för att bortse från rent tekniska skillnader:

- Instruktioner kan t.ex. lagras som en sträng eller som en lista av strängar men normaliseras innan de jämförs.
- Listor, som t.ex. exempel, sorteras så att olika ordning i listan inte i sig räknas som en ändring.

Om något av dessa fält skiljer sig mellan gammal och ny regelfil klassas kravet som **uppdaterat/ändrat**.

### 2.2 Ändringar i kontrollpunkter och godkännandekriterier

För varje krav jämförs även kontrollpunkter och godkännandekriterier:

- Nya kontrollpunkter identifieras och markeras som **tillagda kontrollpunkter**.
- Kontrollpunkter som försvunnit identifieras som **borttagna kontrollpunkter**.
- Befintliga kontrollpunkter som har kvar samma id men där något i innehållet ändrats betraktas som **ändrade kontrollpunkter**.

För godkännandekriterier görs en liknande analys:

- Kriterier som bara finns i den nya regelfilen markeras som **tillagda kriterier**.
- Kriterier som bara finns i den gamla regelfilen markeras som **borttagna kriterier**.
- Kriterier som finns i båda versionerna men där text eller annan relevant information ändrats markeras som **uppdaterade kriterier**.

Även här försöker systemet bortse från tekniska skillnader:

- Om endast interna id‑n ändrats, men innehållet är detsamma, ska detta i möjligaste mån inte räknas som en förändring.
- Jämförelsen fokuserar på textinnehåll och andra fält som har betydelse för hur kravet tolkas och granskas.

### 2.3 Hur ändringar påverkar granskningen

Resultatet av analysen används för att styra vad som händer i granskningen:

- Om ett krav är ändrat och redan har ett resultat i något stickprov markeras kravet som **behöver omgranskning** i dessa stickprov.
- En separat struktur i state sparar vilka kontrollpunkter och kriterier som är nya eller ändrade för varje krav.
- När användaren går in i kravvyn kan gränssnittet visa att kravet har ändrats och peka ut exakt vilka delar som är nya eller ändrade.

På så sätt kopplas regelfilsändringar tydligt till de krav och observationer som redan finns i granskningen.

---

## 3. Nuvarande arkivfunktion och dess begränsningar

### 3.1 Vad som sparas i arkivet

När ett krav tas bort i samband med en regelfilsuppdatering flyttas det från den aktiva kravlistan till ett särskilt arkivfält i granskningens state. Arkivposterna innehåller bland annat:

- Kravets id och titel.
- Standardreferens eller annan textuell referens till regelverket.
- Vilken version av regelfilen kravet kommer ifrån.
- En lista över stickprov där kravet förekom, inklusive:
  - hela kravresultatet (status, observationstext, bilagor m.m.) så som det såg ut innan uppdateringen.

Resultatet visas i en särskild arkivvy där användaren kan:

- Se vilka krav som försvunnit i samband med uppdateringen.
- Se hur många stickprov som påverkats av varje borttaget krav.
- Läsa de observationer som gjorts på dessa krav i tidigare versioner av regelfilen.

### 3.2 Arkivets koppling till servern

Klientens synkroniseringslogik är utformad så att den kan skicka med arkivet till servern när en granskning sparas:

- Om arkivet innehåller ett eller flera borttagna krav inkluderas informationen i den data som skickas i samband med uppdatering av granskningen.

I nuläget är serverdelen dock inte fullt utbyggd för att ta hand om arkivet:

- Servern tar emot uppdateringar av metadata, status, stickprov och regelfilsinnehåll.
- Information om arkivet hanteras däremot inte konsekvent i databasen än.

Konsekvensen är att:

- Arkivet är alltid korrekt i det aktuella klienttillståndet så länge granskningen är laddad.
- Arkiverad information finns också kvar i JSON‑filer som sparats manuellt (backup/export).
- Men om man enbart förlitar sig på att ladda om granskningen från servern kan arkivet i dag inte garanteras vara fullständigt bevarat över tid.

Detta är en känd begränsning och en viktig utgångspunkt för förbättringsförslaget i nästa avsnitt.

---

## 4. Förslag på återställningsflöde – lägga tillbaka borttagna krav

Det här avsnittet beskriver ett förslag på hur arkivfunktionen kan byggas ut så att borttagna krav och deras observationer kan “läggas tillbaka” på ett kontrollerat sätt, utan att själva regelfilen ändras i efterhand.

### 4.1 Server‑side persistens av arkivet

För att arkivfunktionen ska kunna användas som underlag för återställning behöver arkivet sparas fullt ut på serversidan. Förslaget är:

- Utöka uppdaterings‑endpointen för granskningar så att den:
  - Tar emot och validerar arkiverad information i inkommande data.
  - Sparar arkivet i auditens metadata eller i ett separat fält/kolumn i databasen.
- Uppdatera logiken som bygger upp granskningens state från databasen så att:
  - Sparat arkiv läses in och placeras i `archivedRequirementResults` i state när granskningen laddas.
  - Om arkivet saknas (äldre granskningar eller versioner) tolkas det som att inget arkiv finns, inte som ett fel.

På så sätt blir arkivet en beständig del av granskningens data, oavsett om granskningen laddas i ny session eller på en annan klient.

### 4.2 UX‑förslag för att lägga tillbaka krav

När arkivet är stabilt sparat kan det användas för att lägga tillbaka borttagna krav på två huvudsakliga sätt:

1. **Återaktivera som extra krav i den aktuella granskningen**  
   - Användaren går in i arkivvyn och ser en lista över borttagna krav.  
   - På varje krav finns en åtgärd “Lägg tillbaka i den här granskningen”.  
   - Kravet återaktiveras då som ett extra krav i just den granskningen, under en tydlig rubrik i checklistan, t.ex. “Krav från tidigare regelfil”.

2. **Koppla mot ett annat, kvarvarande krav i nya regelfilen**  
   - I vissa fall kan ett borttaget krav i praktiken vara samma som ett nytt krav i den nya regelfilen, men med omformulering eller nytt id.  
   - Användaren skulle då kunna välja att koppla arkivposten mot ett befintligt krav i den nya regelfilen, t.ex. via en dialog där man väljer “detta borttagna krav motsvarar det här nya kravet”.
   - Resultatet blir att observationerna i arkivet knyts till det nya kravet i stället för att ligga kvar som ett fristående arkivkrav.

I båda fallen är det viktigt att gränssnittet tydligt visar:

- Att kravet ursprungligen kommer från en äldre regelfil.
- Om det är en fristående återaktivering eller en manuell koppling till ett nytt krav.

### 4.3 Tekniskt förslag på hur återläggning kopplas in i state

På en övergripande nivå kan återläggning av borttagna krav fungera så här i state:

- När användaren väljer att “lägga tillbaka” ett arkiverat krav:
  - Skapas en intern nyckel för kravet som inte krockar med befintliga krav i regelfilen, till exempel med ett prefix som markerar att det är ett återlagt arkivkrav.
  - För de stickprov där kravet hade resultat skapas nya poster i `requirementResults` baserade på de sparade arkivresultaten.
  - Själva kravdefinitionen för arkivkravet läggs i en separat struktur, till exempel en lista med extra krav som kompletterar den ordinarie regelfilen.
- Logik som tar fram relevanta krav för ett stickprov behöver anpassas så att dessa extra krav tas med när det är lämpligt:
  - Antingen alltid, under en särskild rubrik.
  - Eller styrt av en inställning på granskningen.

På så sätt kan återlagda krav delta i samma granskning som den aktuella regelfilen, utan att man behöver ändra själva regelfilsdefinitionen på serversidan.

### 4.4 Begränsningar och tydlighet mot användaren

För att undvika förvirring och misstag är det viktigt att tydligt definiera vad återläggning innebär:

- Själva regelfilen ändras inte bakåt i tiden – det som ändras är kravlistan i just den aktuella granskningen.
- Återlagda krav bör markeras visuellt i checklistan (t.ex. ikon eller etikett) så att det framgår att de inte ingår i det nuvarande, publicerade regelverket.
- Vid export och rapportering kan en flagga på granskningen eller på enskilda krav användas för att:
  - Tala om att granskningen innehåller krav från tidigare regelfiler.
  - Eventuellt separera dessa krav i rapporter, så att det blir tydligt för mottagaren vad som är aktuellt regelverk och vad som är kompletterande historik.

---

## 5. Beslutspunkter inför vidare arbete

Innan själva återläggningsfunktionen implementeras fullt ut är det några viktiga beslut som behöver tas:

1. **Ska återlagda krav räknas in i samma index och framstegsberäkningar som ordinarie krav?**  
   - Alternativ 1: Ja, de behandlas som vilka krav som helst i granskningen.  
   - Alternativ 2: Nej, de räknas separat och redovisas som “kompletterande” krav.

2. **Hur ska koppling till nya krav i regelfilen hanteras?**  
   - Ska det vara möjligt att mappa ett arkiverat krav till ett specifikt nytt krav (manuell koppling), eller ska återlagda krav alltid vara fristående?

3. **Hur tydligt ska det synas i UI att ett krav kommer från en äldre regelfil?**  
   - Behövs t.ex. särskild ikon, etikett eller sektion i checklistan?
   - Ska information om ursprunglig regelfilversion visas tydligt i kravvyn?

4. **Hur ska export och rapportering hantera återlagda krav?**  
   - Ska de grupperas för sig, eller blandas med ordinarie krav?  
   - Behöver rapporterna förklara att vissa krav inte längre finns i nuvarande regelverk?

Det här dokumentet är tänkt att vara underlag för dessa beslut och för framtida implementation, så att både beteendet vid uppdatering av regelfil och hanteringen av borttagna krav blir tydlig och spårbar.

