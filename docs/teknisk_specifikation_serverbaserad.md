# Teknisk specifikation: Serverarkitektur för Leffe

**Version:** 1.1  
**Status:** Beskriver nuvarande implementation (2026)

## 1. Systemöversikt

**Leffe** körs som en SPA med **Express-backend** och **PostgreSQL**. Klienten (`js/state.js` m.m.) synkar till server via REST och WebSocket; statiska filer och API proxas via Nginx under prefix `/v2/` (se `scripts/ux-granskning-with-v2.conf`).

- **Backend:** Node.js med Express (`server/`)
- **Databas:** PostgreSQL (se migrationer under `server/migrations/`)
- **Frontend:** Vite-bygge med `base: '/v2/'`; utvecklingsproxy mot `localhost:3000`
- **Infrastruktur:** Nginx, Docker för Postgres, PM2 för Node-processer (produktion)

---

## 2. Autentisering och användarhantering

### Inloggning

- **Mekanism:** Användarnamn och lösenord. Lösenord lagras hashade (bcrypt) i databasen.
- **API:** `POST /api/auth/login` returnerar **JWT** som klienten skickar i `Authorization: Bearer …` på efterföljande anrop.
- **Återställning:** Engångskoder för lösenordsbyte (`password_reset_tokens`); administratörer kan skapa kod åt användare.

### Admin

- **Behörighet:** `is_admin = true` i databasen krävs för skyddade admin-endpoints.
- **Vy i Leffe:** Bland annat **Hantera användare** (lista, skapa, uppdatera, radera, engångskoder).

---

## 3. Datamodell (PostgreSQL)

### Tabell: `users`

| Kolumn      | Typ        |
|-------------|------------|
| id          | UUID (PK)  |
| name        | VARCHAR(255) |
| is_admin    | BOOLEAN (default false) |
| created_at  | TIMESTAMP  |

### Tabell: `rule_sets`

| Kolumn      | Typ        |
|-------------|------------|
| id          | UUID (PK)  |
| name        | VARCHAR(255) |
| content     | JSONB      |
| version     | INTEGER    |
| created_at  | TIMESTAMP  |
| updated_at  | TIMESTAMP  |

### Tabell: `audits`

| Kolumn          | Typ        |
|-----------------|------------|
| id              | UUID (PK)  |
| rule_set_id     | UUID (FK)  |
| status          | ENUM ('not_started', 'in_progress', 'locked', 'archived') |
| metadata        | JSONB      |
| version         | INTEGER (optimistic locking) |
| last_updated_by  | VARCHAR(255) |
| created_at      | TIMESTAMP  |
| updated_at      | TIMESTAMP  |

### Tabell: `audit_samples`

| Kolumn       | Typ        |
|--------------|------------|
| id           | SERIAL (PK) |
| audit_id     | UUID (FK)  |
| sample_id    | VARCHAR(255) |
| page_type    | VARCHAR    |
| description  | TEXT       |
| url          | VARCHAR    |
| content_types| JSONB      |
| created_at   | TIMESTAMP  |
| updated_at   | TIMESTAMP  |

### Tabell: `audit_results`

| Kolumn         | Typ        |
|----------------|------------|
| id             | SERIAL (PK) |
| audit_id       | UUID (FK)  |
| sample_id      | VARCHAR(255) |
| requirement_id | VARCHAR(255) |
| result         | JSONB      |
| updated_at     | TIMESTAMP  |

---

## 4. API-design (RESTful)

### Användare

| Metod   | Endpoint           | Behörighet |
|---------|--------------------|------------|
| GET     | /api/users         | Alla (för dropdown) |
| POST    | /api/users         | Admin      |
| DELETE  | /api/users/:id     | Admin      |
| PATCH   | /api/users/:id     | Admin      |

### Regelfiler

| Metod   | Endpoint           | Beskrivning |
|---------|--------------------|-------------|
| GET     | /api/rules         | Lista regelfiler |
| GET     | /api/rules/:id     | Hämta regelfil |
| GET     | /api/rules/:id/export | Backup (nedladdning) |
| POST    | /api/rules         | Skapa ny regelfil |
| POST    | /api/rules/import  | Ladda upp backup |
| PUT     | /api/rules/:id     | Uppdatera regelfil |

### Granskningar

| Metod   | Endpoint           | Beskrivning |
|---------|--------------------|-------------|
| GET     | /api/audits        | Lista granskningar (filter: status) |
| GET     | /api/audits/:id    | Hämta färdigt state-objekt |
| GET     | /api/audits/:id/export | Backup (nedladdning) |
| POST    | /api/audits        | Skapa granskning (från rule_set_id) |
| POST    | /api/audits/import  | Ladda upp backup |
| PATCH   | /api/audits/:id    | Uppdatera metadata/status |
| PATCH   | /api/audits/:id/results/:sampleId/:requirementId | Uppdatera enskilt kravresultat |
| PUT     | /api/audits/:id/results | Batch-uppdatering (vid behov) |

### Resultat – payload för granulär PATCH

```json
{
  "version": 5,
  "result": { "status": "failed", "actualObservation": "...", ... }
}
```

Om `version` inte matchar databasen → `409 Conflict`.

---

## 5. Samtidighet (Optimistic Locking)

1. Klienten hämtar audit inkl. `version`.
2. Vid varje sparning skickar klienten med `version`.
3. Servern: `UPDATE ... WHERE id = :id AND version = :submitted_version`.
4. Om 0 rader uppdateras → 409 Conflict. Klienten gör merge: hämta ny state, slå ihop per krav, försök spara igen.

### Merge-strategi

- Per krav: last-write-wins. Acceptabelt för granskningsarbete.
- Vid 409: hämta senaste state, merge per (sampleId, requirementId), visa notis, spara igen.

### Polling (fallback för realtid)

- `checkVersion()` var 30:e sekund.
- Om serverns version > lokal version: hämta ny state, merge, uppdatera UI, visa notis "Granskningen har uppdaterats av kollega."

---

## 6. Bifogade filer (bilder, videor)

- Varje granskning har egen mapp på servern. Manuell uppladdning till att börja med.
- UI för uppladdning senare.
- Referenser i `audit_results.result` pekar på server-sökväg/URL.

---

## 7. Utvecklingsmiljö (Docker)

### Förutsättningar

- Node.js 18+
- Docker

### Starta utveckling

```bash
npm install
npm run dev
```

PostgreSQL startas automatiskt i Docker (`docker-compose up -d`). Frontend körs på port 5173.

### Filer i repot

| Fil | Beskrivning |
|-----|-------------|
| `docker-compose.yml` | PostgreSQL 16, port 5432, volume pgdata |
| `.env.example` | Mall för miljövariabler. Kopiera till `.env` |
| `package.json` | `dev` startar Docker + Vite. `dev:db` startar endast databasen. `dev:client` startar endast Vite. |

### När backend är implementerad

Scripts som kan läggas till:

- `dev:app`: `wait-on tcp:localhost:5432 && npm run db:migrate && concurrently "npm run dev:server" "vite"`
- `db:migrate`: Kör migrations mot PostgreSQL
- `dev:server`: Startar Express-backend

`wait-on` är redan tillagt som dev-dependency.

---

## 8. Nginx-konfiguration

```nginx
server {
    listen 80;
    server_name a11y-audit.local;

    location / {
        root /var/www/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## 9. Frontend – nya vyer

| Route | Beskrivning |
|-------|-------------|
| #dashboard | Lista granskningar, filter, skapa ny |
| #rule-files | Lista regelfiler, skapa, redigera |
| #admin eller #admin/users | Hantera användare (endast admin) |
| #statistics | Statistik |

Användarval (dropdown) visas i global action bar eller som separat komponent vid start.
