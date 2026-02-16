# Fix: Radering fungerar inte på servern (404)

Om du inte kan radera regelfiler eller granskningar på servern beror det oftast på att nginx inte skickar DELETE-anrop korrekt till backend.

## Lösning

Uppdatera nginx-konfigurationen så att `location /v2/api` innehåller **rewrite** som omvandlar sökvägen.

### Steg 1: Kopiera referenskonfiguration till servern

Konfigurationen finns nu i projektmappen på servern:

```
/var/www/granskningsverktyget-v2/nginx-ux-granskning.conf
```

### Steg 2: Ersätt eller uppdatera nginx-config

**Alternativ A – Ersätt hela config:**

```bash
ssh granskning
sudo cp /etc/nginx/sites-enabled/ux-granskning.conf /etc/nginx/sites-enabled/ux-granskning.conf.bak
sudo cp /var/www/granskningsverktyget-v2/nginx-ux-granskning.conf /etc/nginx/sites-enabled/ux-granskning.conf
sudo nginx -t && sudo systemctl reload nginx
```

**Alternativ B – Lägg till rewrite manuellt:**

Öppna `/etc/nginx/sites-enabled/ux-granskning.conf` och se till att `location /v2/api` ser ut så här (med rewrite):

```nginx
location /v2/api {
    rewrite ^/v2/api(.*)$ /api$1 break;
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-User-Name $http_x_user_name;
}
```

Viktigt: `rewrite ^/v2/api(.*)$ /api$1 break;` måste finnas. Utan den får backend fel sökväg och returnerar 404.

### Steg 3: Ladda om nginx

```bash
sudo nginx -t && sudo systemctl reload nginx
```
