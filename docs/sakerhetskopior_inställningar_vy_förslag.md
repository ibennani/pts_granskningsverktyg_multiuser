# Förslag: Egen vy för inställningar för säkerhetskopior (Leffe)

Detta dokument beskriver ett förslag på att flytta inställningarna för säkerhetskopior i **Leffe** från en modal till en egen vy. Syftet är att ge plats åt fler inställningar (bland annat schema) och göra gränssnittet tydligare utan att modalen blir för full.

---

## 1. Bakgrund

Idag finns en modal "Inställningar för säkerhetskopior" som öppnas från knappen med samma namn på sidan Säkerhetskopior. I modalen kan användaren:

- se när schemalagd backup körs (read-only);
- ändra hur många dagar backupfiler sparas (1–365);
- spara eller stänga utan att spara.

För att kunna styra **när** backupen körs och **hur många gånger per dygn** behövs fler fält och lite mer förklaring. Det blir trångt och rörigt i en modal. Därför föreslås en **egen vy** för dessa inställningar.

---

## 2. Förslag på vy och navigation

### 2.1 Ny vy

- **Vynamn (routing):** t.ex. `backup_settings`.
- **URL (hash):** t.ex. `#/backup_settings` eller `#/backup?view=settings` (beroende på hur ni vill strukturera backup-undertexter).
- **Titel (sidetitel):** "Inställningar för säkerhetskopior" / "Backup settings".

### 2.2 Hur man kommer till vyn

- **Alternativ A:** Från sidan Säkerhetskopior: knappen "Inställningar för säkerhetskopior" navigerar till den nya vyn (ersätter att modalen öppnas).
- **Alternativ B:** Samma knapp som idag, men den öppnar vyn istället för modalen; ingen modal längre för dessa inställningar.

Vänstermenyn kan antingen:

- visa "Säkerhetskopior" och "Inställningar för säkerhetskopior" som två punkter när man är under backup/inställningar, eller
- bara "Säkerhetskopior"; inställningsvyn nås enbart via knappen på Säkerhetskopior-sidan.

---

## 3. Innehåll i den nya vyn

Vyn ska innehålla ett formulär med följande delar.

### 3.1 Sektion: När backupen körs

**Spärr (gäller både UI och server):** Säkerhetskopiering får högst köras en gång per timme (max 24 gånger per dygn).

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| **Antal säkerhetskopior per dygn** | Listruta | Alternativ: 1, 2, 3, 4, 6, 8, 12, 24. Max 24 pga spärr. |
| **Första körningen (klockslag)** | Listruta | 00:00, 01:00, … 23:00 (hela timmar). Övriga tider beräknas jämnt från denna. |
| **Sammanfattning** | Text (read-only) | T.ex. "Backup körs 4 gånger per dygn: 06:00, 12:00, 18:00, 00:00". Uppdateras när användaren ändrar antal eller starttid. |

**Infotext:**  
"Säkerhetskopiering kan högst köras en gång per timme. Övriga körningar fördelas jämnt över dygnet från den tid du väljer."

### 3.2 Sektion: Hur länge filer sparas

| Fält | Typ | Beskrivning |
|------|-----|-------------|
| **Spara filer i antal dagar** | Tal (input) | 1–365. Filer äldre än detta raderas automatiskt. |

**Infotext:**  
"Filer äldre än detta antal dagar raderas automatiskt. Mellan 1 och 365 dagar."

### 3.3 Knappar

- **Spara:** Sparar både schema och antal dagar. Bekräftelse (t.ex. "Inställningarna sparades."). Vid fel: tydligt felmeddelande.
- **Tillbaka till säkerhetskopior:** Navigerar tillbaka till sidan Säkerhetskopior (ingen sparning av ändringar om användaren inte klickat Spara).

Eventuellt kan "Stäng utan att spara" användas som alternativ text till "Tillbaka till säkerhetskopior" om det ska betonas att man lämnar utan att spara.

---

## 4. Tekniska ändringar (översikt)

- **Ny komponent:** t.ex. `BackupSettingsViewComponent` som renderar formuläret (schema + retention + knappar).
- **Routing:** Registrera vyn `backup_settings` i `main.js` och koppla till den nya komponenten; sidtitel för vyn.
- **API:**  
  - GET `/api/backup/settings` – returnera bland annat `schedule_cron` (eller motsvarande) och `retention_days`.  
  - PUT `/api/backup/settings` – ta emot t.ex. `retention_days` och schema (antingen cron-sträng eller antal per dygn + starttid) och spara.
- **Server (schema):**  
  - Spara schema i samma inställningsfil (eller motsvarande) som idag.  
  - Vid start och vid sparande: läsa inställningar och antingen starta om cron-uppgiften (stop + ny schedule) eller beräkna nästa körning utifrån antal per dygn + starttid.  
  - Validering: max 24 körningar per dygn, minst 1 timmes mellanrum.
- **Säkerhetskopior-sidan:** Knappen "Inställningar för säkerhetskopior" ska navigera till `backup_settings`-vyn istället för att öppna modalen (modalen för dessa inställningar tas bort eller används inte längre).

---

## 5. Beslutspunkter inför implementation

1. **Menystruktur:** Ska "Inställningar för säkerhetskopior" finnas som egen punkt i vänstermenyn när man är på Säkerhetskopior, eller endast nås via knappen på Säkerhetskopior-sidan?
2. **URL:** Ska det vara `#/backup_settings` eller något som `#/backup?view=settings` (eller annat mönster)?
3. **Schema-format på servern:** Spara färdig cron-sträng (t.ex. `0 0,6,12,18 * * *`) eller spara "antal per dygn" + "starttid" och räkna ut cron/planering på servern? (Det andra underlättar validering och spärr.)
4. **Återställning vid fel:** Om inställningsfilen blir ogiltig eller saknas – ska servern alltid falla tillbaka till ett säkert standard-schema (t.ex. 4 gånger per dygn, 00/06/12/18) och 30 dagars retention?

---

## 6. Sammanfattning

- **Egen vy** för inställningar för säkerhetskopior ger plats för schema (antal per dygn + första körningen) och behåller retention (antal dagar).
- **Spärr:** Max en körning per timme (max 24 per dygn); både i UI och i serverlogik.
- **Navigering:** Knappen "Inställningar för säkerhetskopior" på Säkerhetskopior-sidan leder till den nya vyn; modal för dessa inställningar behöver inte längre användas.
- När ni vill implementera kan detta dokument användas som underlag för vy, formulär, API och serverlogik.
