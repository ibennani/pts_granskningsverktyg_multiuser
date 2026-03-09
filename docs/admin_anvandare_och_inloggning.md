## Hantera användare och inloggning

Den här texten beskriver hur du som administratör arbetar med användare och inloggning i Granskningsverktyget. Allt nedan utgår från vyn **Hantera användare** i verktygets meny.

### 1. Översikten – tabellen med alla användare

När du går in på **Hantera användare** visas först en översikt:

- Överst ser du rubriken **Hantera användare** och en knapp **Lägg till användare**.
- Under rubriken finns en tabell där varje rad motsvarar en användare.
- Tabellen visar:
  - **Användarnamn** – det användarnamn personen loggar in med.
  - **Förnamn**.
  - **Efternamn**.
  - **Admin** – om användaren är administratör (Ja/Nej).
  - **Åtgärder** – knappar för att skapa återställningskod och hantera användaren.

I kolumnen **Åtgärder** finns två knappar:

- **Skapa återställningskod** – används när någon har tappat bort sitt lösenord.
- **Hantera användare** – öppnar en detaljvy där du kan ändra uppgifter för den valda användaren.

### 2. Lägga till en ny användare

För att skapa en ny användare:

1. Klicka på **Lägg till användare**.
2. En ny vy öppnas på samma sida med ett formulär:
   - **Användarnamn** – skriv ett unikt användarnamn (utan mellanslag rekommenderas).
   - **Förnamn**.
   - **Efternamn**.
   - **Administratör** – kryssa i om användaren ska vara administratör.
   - **Lösenord (valfritt)** – om du vill sätta ett första lösenord direkt.
3. När fälten är ifyllda har du två huvudval:
   - **Skapa ny användare** – sparar uppgifterna och lägger till användaren i tabellen.
   - **Tillbaka till tabellen utan att spara** – avbryter utan att göra några ändringar.

Efter att du klickat på **Skapa ny användare**:

- Användaren skapas i systemet.
- Du kommer tillbaka till tabellen, där den nya användaren syns som en egen rad.

### 3. Uppdatera en befintlig användare

För att uppdatera en redan befintlig användare:

1. Hitta rätt rad i tabellen.
2. Klicka på **Hantera användare** på den raden.
3. Samma formulär som vid ny användare visas, men nu förifyllt med personens uppgifter:
   - Du kan ändra **användarnamn**, **förnamn**, **efternamn** och om personen är **administratör**.
   - Du kan också skriva in ett nytt **lösenord** om du vill byta lösenord direkt.
4. Längst ned i formuläret finns tre knappar:
   - **Uppdatera användare** – sparar ändringarna.
   - **Tillbaka till tabellen utan att spara** – återgår till tabellen utan att spara.
   - **Radera användare** – öppnar en särskild bekräftelseruta (se nästa avsnitt).

När du väljer **Uppdatera användare**:

- Alla ändringar sparas.
- Du kommer tillbaka till tabellen, där uppgifterna för den användaren är uppdaterade.

### 4. Radera en användare

För att radera en användare:

1. Gå in på **Hantera användare** för rätt rad.
2. Klicka på **Radera användare** längst till höger i knapp-raden.
3. En bekräftelseruta (modal) visas med:
   - Rubriken **Radera användare {användarnamn}?**
   - En text som förklarar att åtgärden inte går att ångra och att användaren inte längre kan logga in.
   - Två knappar:
     - **Radera användare** – tar bort användaren permanent.
     - **Behåll användare** – stänger rutan utan att göra något.

Om du väljer **Radera användare**:

- Användaren tas bort från systemet.
- Raden försvinner från tabellen.

### 5. Skapa och använda återställningskod

När en användare har tappat bort sitt lösenord ska du inte se eller skicka något befintligt lösenord. I stället gör du så här:

1. Gå till **Hantera användare**.
2. Hitta personen i tabellen.
3. Klicka på **Skapa återställningskod** i kolumnen **Åtgärder**.
4. En dialogruta öppnas där du:
   - Väljer hur länge koden ska gälla (t.ex. 15, 30 eller 60 minuter).
   - Klickar på **Skapa återställningskod**.
5. Systemet visar då:
   - En text som beskriver att koden är engångs och tidsbegränsad.
   - Själva koden i ett tydligt, monospace-format.
6. Under koden finns en knapp **Kopiera återställningskod**:
   - När du klickar på den kopieras koden till urklipp.
   - Knappens text ändras till **Koden är kopierad** som kvitto.

Ge sedan koden till användaren på ett säkert sätt (t.ex. via telefon). Användaren går därefter själv till inloggningsvyn och:

- Klickar på **Jag kan inte logga in**.
- Fyller i återställningskoden och väljer ett nytt lösenord.
- När bytet lyckas blir personen automatiskt inloggad.

### 6. Själva inloggningen – användarnamn + lösenord

Efter förändringarna i projektet loggar alla användare in på samma sätt:

1. På inloggningssidan finns:
   - Ett fält för **Användarnamn**.
   - Ett fält för **Lösenord**.
2. Användaren skriver in sitt användarnamn (inte sitt fulla namn) och lösenord.
3. Vid felaktiga uppgifter får användaren ett tydligt felmeddelande.

Om användaren inte kan logga in:

- Administratören skapar en ny **återställningskod** enligt avsnittet ovan.
- Användaren använder koden i inloggningsvyn för att sätta ett nytt lösenord.

### Sammanfattning

- **Inloggning** sker alltid med **användarnamn + lösenord**.
- **Hantera användare** ger en tydlig överblick över alla konton och låter dig:
  - Lägga till nya användare.
  - Uppdatera namn, användarnamn, admin-status och lösenord.
  - Radera användare som inte längre ska ha åtkomst.
  - Skapa engångs-**återställningskoder** vid borttappade lösenord, med enkel kopiering till urklipp.

På så sätt kan du som administratör ha full kontroll över vilka som får logga in i verktyget och hur de kommer åt sina konton. 

