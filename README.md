# NEXUS — Stats Beyond The Game

Aplikacja statystyk League of Legends: dashboard gracza, profile, historia meczów, live game, champion explorer, buildy i runy, tier list, leaderboardy, statystyki, porównania, multi search, pro gracze i ustawienia. Działa jako strona (Next.js) i jako aplikacja na komputer (Electron) z wykrywaniem klienta LoL i overlayem w grze.

## Na gotowo: serwer + aplikacja .exe dla znajomych

Tak to działa: **jeden serwer** (Twój VPS) trzyma klucz Riot, bazę i statystyki. Aplikacja `.exe`, którą dajesz znajomym, łączy się z tym serwerem — klucza w niej nie ma, trybu demo też nie.

### 1. Klucz Riot
1. Wejdź na https://developer.riotgames.com i zaloguj się kontem Riot.
2. Skopiuj **Development API Key** (`RGAPI-…`). Nie wysyłaj go nikomu.
3. Od razu złóż wniosek o **Personal API Key** (Register Product → Personal). Dopóki go nie dostaniesz, klucz deweloperski wygasa co 24 h i trzeba go wklejać od nowa w panelu `/admin` (to 20 sekund z telefonu).

### 2. Serwer (VPS) — z telefonu przez Termius
1. Kup najtańszy VPS z **Ubuntu 24.04** i co najmniej **2 GB RAM** (np. Hetzner CX22, OVH, Mikrus 3.0+ z publicznym IPv4).
2. W Termiusie dodaj host: adres IP serwera, użytkownik `root`, hasło z maila od dostawcy. Połącz się.
3. Wklej jedną komendę (podmień `LOGIN` na swój login GitHub):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/LOGIN/nexus/main/deploy/install.sh | sudo bash -s -- https://github.com/LOGIN/nexus.git
   ```
4. Po 5–15 minutach skrypt wypisze **adres serwera** (np. `https://5-75-1-2.sslip.io`) i **hasło admina**. Zapisz je.

Skrypt sam instaluje Dockera, bazę PostgreSQL, certyfikat HTTPS i nocne zbieranie statystyk. Jeśli na serwerze działa już nginx z inną stroną, NEXUS dostaje w nim osobną stronę i certyfikat (certbot), a istniejące strony zostają nietknięte. Własna domena zamiast sslip.io: `DOMAIN=nexus.twojadomena.pl` przed komendą (rekord A domeny musi wskazywać na IP serwera). Ponowne uruchomienie tej samej komendy (albo `sudo bash /opt/nexus/deploy/install.sh`) aktualizuje NEXUS i zostawia dane.

> Repozytorium powinno być **publiczne** (w kodzie nie ma żadnych sekretów). Przy prywatnym repo trzeba podać adres z tokenem: `https://TOKEN@github.com/LOGIN/nexus.git`.

### 3. Wklej klucz
Otwórz na telefonie `https://TWÓJ-ADRES/admin`, wpisz hasło admina i wklej klucz. Serwer sprawdza go w Riot i używa od razu. Po kilku minutach startuje pierwsze zbieranie statystyk (Tier List / Champions / Builds); potem odświeżają się co noc o 4:00.

### 4. Zbuduj .exe — pojawi się na stronie do pobrania
1. Na GitHubie: **Actions → Build desktop app → Run workflow**.
2. W polu **server_url** wpisz adres serwera (np. `https://5-75-1-2.sslip.io`) i kliknij **Run workflow**. (Możesz też raz ustawić zmienną repo `NEXUS_SERVER_URL` w Settings → Secrets and variables → Actions → Variables — wtedy pole można zostawić puste.)
3. Po ok. 15 minutach GitHub opublikuje wydanie (Release), a strona **`https://TWÓJ-ADRES/download`** sama pokaże przycisk **Download for Windows** z najnowszą wersją. Ten link wysyłasz znajomym. W menu strony jest też przycisk **Download app**.

Każde kolejne „Run workflow” to nowa wersja — strona pobierania przełącza się na nią automatycznie (do 5 minut). Krótki link prosto do pliku: `https://TWÓJ-ADRES/api/download/latest`.

Windows pokaże „System Windows ochronił ten komputer”, bo instalator nie jest podpisany — **Więcej informacji → Uruchom mimo to** (to samo jest opisane na stronie pobierania).

### Codziennie / gdy coś nie działa
- Na górze aplikacji jest czerwony znaczek **KEY EXPIRED** albo **NO API KEY** → wklej nowy klucz w `/admin`.
- Logi serwera: `cd /opt/nexus && docker compose logs -f app` (statystyki: `... logs -f aggregator`).
- Klucz deweloperski: 20 zapytań/s i 100 na 2 minuty **dla wszystkich razem**. Dla kilku–kilkunastu znajomych wystarczy, ale tabela scoutingu wczytuje się wtedy wolniej.

## Dla programisty (lokalnie)

## Szybki start

Wymagania: Node.js 20+ (zalecane 22), npm.

```bash
npm install
cp .env.example .env      # na Windows: copy .env.example .env
npm run dev               # http://localhost:3000
```

Bez klucza Riot (i bez `NEXUS_DISABLE_DEMO=1`) aplikacja działa w **trybie demo** — wszystkie dane są oznaczone plakietką „Demo data”.

### Prawdziwe dane

1. Weź klucz na https://developer.riotgames.com (klucz deweloperski wygasa po 24 h; na stałe potrzebny „Personal/Production key”).
2. Wpisz go do `.env`: `RIOT_API_KEY=RGAPI-...` i zrestartuj serwer.

Klucz jest używany wyłącznie po stronie serwera (`server/`), nigdy nie trafia do przeglądarki.

### Baza danych (opcjonalnie)

PostgreSQL włącza trwały cache, śledzenie zmian LP mecz po meczu, pozycję w drabince i zbiór zagregowanych statystyk.

```bash
# .env: DATABASE_URL=postgresql://user:pass@localhost:5432/nexus
npm run db:push
npm run aggregate -- --platform euw1 --players 60 --matches 15
```

`aggregate` zbiera mecze graczy Master+ i liczy win/pick/ban rate, buildy, runy, kolejność skilli i matchupy. Dopóki go nie uruchomisz, Tier List / Champions / Builds pokazują oznaczony zbiór demo.

## Wersja na komputer (Electron)

```bash
npm run desktop:dev       # Next na :3210 + okno aplikacji
npm run desktop:build     # instalator w release/ (Windows .exe, macOS .dmg, Linux AppImage)
```

Co daje wersja desktop:
- wykrywa uruchomiony klient LoL (plik `lockfile` / argumenty procesu), konto i fazę gry,
- po starcie meczu otwiera stronę Live Game, a statystyki z lokalnego Live Client Data API (KDA, CS, przedmioty) są pokazane z plakietką „Local client”,
- overlay w grze: **Ctrl+Shift+N** (twoje KDA/CS/złoto i rekomendowany build z podświetlonym następnym przedmiotem).

Instalator zbudowany z `NEXUS_SERVER_URL` łączy się z Twoim serwerem. Adres można zmienić bez przebudowy: plik `%APPDATA%\NEXUS\.env` z linią `NEXUS_SERVER_URL=https://…`. Bez adresu aplikacja uruchamia własny lokalny serwer i czyta `RIOT_API_KEY` z tego samego pliku.

## Funkcje w grze (tylko aplikacja na komputer)

- **Auto-akceptacja kolejki:** gdy mecz zostanie znaleziony, NEXUS klika „Akceptuj” po wybranym opóźnieniu (0–8 s). Ustawienia → Asystent klienta LoL.
- **Asystent wyboru bohatera:** gdy zaczyna się champ select, NEXUS pokazuje kontry na przeciwnika z Twojej linii (z prawdziwych meczów), Twój win rate na tych bohaterach i propozycje banów.
- **Podsumowanie po meczu:** po każdej grze strona `/post-game` pokazuje zmianę LP, ocenę linii i porównanie z przeciwnikiem oraz z Twoją średnią.
- **Status na Discordzie:** bohater, tryb i czas gry na Twoim profilu Discord. Wymaga Discord Application ID przy budowaniu (pole `discord_client_id` w Actions albo zmienna repo `NEXUS_DISCORD_CLIENT_ID`; utworzysz je na https://discord.com/developers/applications → New Application „NEXUS”).
- **Buildy na wszystkie tryby:** Rankingowe/normalne, ARAM, ARAM: Chaos, Arena i URF — osobne statystyki i auto-import dopasowany do kolejki.

- **Auto-import w champ selecie:** gdy zablokujesz bohatera, NEXUS tworzy stronę run „NEXUS …”, ustawia czary (Flash na D albo F, do wyboru) i dodaje zestaw przedmiotów do sklepu. Każdą z tych rzeczy można osobno wyłączyć w Ustawieniach → Auto import. Na stronach buildów jest też przycisk „Import to client”.
- **Tabela scoutingu (jak Porofessor):** pokazuje się na ekranie ładowania i jest też w Live Game → Scouting. Zawiera rangę, mastery, KDA i WR na bohaterze, kółka 12h / główna rola / 30 dni oraz tagi wyliczone z ostatnich meczów (np. „Good CSer”, „OTP”, „Waking up”, „Loss streak”).
- **Widgety w grze:** build z następnym itemem, Twoje statystyki, timery obiektów, przeciwnik z linii i czary wrogów. Każdy włączasz osobno w Ustawieniach → In-game widgets.

Skróty: **Ctrl+Shift+N** pokazuje lub ukrywa widgety, **Ctrl+Shift+E** przełącza tryb przesuwania widgetów, **Ctrl+Shift+S** pokazuje lub ukrywa tabelę scoutingu. Overlay jest widoczny tylko wtedy, gdy LoL działa w trybie **Bez ramki** albo **Okno**.

Z kluczem deweloperskim Riot (100 zapytań na 2 minuty) tabela scoutingu wczytuje się stopniowo, około 1–2 minut przy 10 meczach na gracza. Z kluczem produkcyjnym trwa to kilka sekund.

## Budowanie .exe bez komputera (GitHub Actions)

Opisane wyżej w punkcie 4. Zakładka **Actions → Build desktop app → Run workflow**, pole `server_url`. Instalator trafia do Releases (i na stronę `/download`) oraz do **Artifacts**.

## Język

Interfejs jest po polsku i po angielsku (Ustawienia → Wygląd → Język). Tłumaczenia są w `lib/i18n/pl.ts` — klucze to angielskie teksty z kodu; brakujące teksty zostają po angielsku.

## „Co poprawić”

Na profilu i w Statystykach NEXUS wypisuje wnioski z ostatnich meczów: farma, wizja, śmierci i obrażenia na tle przeciwnika z linii, pory dnia z najlepszym win rate, gra po porażce, długość gier i najlepsi/najsłabsi bohaterowie. Wszystko jest liczone z Twoich meczów, nic nie jest zgadywane.

## Uczciwość danych

- Spectator-V5 nie podaje KDA, złota, przedmiotów ani timerów obiektów — strona Live Game pokazuje dla nich stan „niedostępne” (chyba że dane czyta wersja desktop z twojego klienta).
- Zmiana LP po meczu jest pokazywana tylko, gdy da się ją ustalić z migawek rangi (wymaga bazy).
- Peak rank z poprzednich sezonów i pozycja w drabince poniżej Master nie są dostępne w API.
- Pro gracze: Riot nie ma takiego API — skopiuj `data/pro-players.example.json` do `data/pro-players.json` (na serwerze: do wolumenu danych, `docker compose cp plik.json app:/data/pro-players.json`) i uzupełnij. Bez pliku serwer produkcyjny pokazuje pustą listę, a tryb demo — fikcyjną.
- Gracze z włączoną opcją prywatności Riot są w scoutingu pokazani jako „Hidden player” — NEXUS ich nie wyszukuje.
- Timery obiektów w overlayu są domyślnie wyłączone; NEXUS nie śledzi cooldownów przeciwników.

## Struktura

```
app/                 strony (App Router) i API routes (/api/*)
components/          UI: layout, ui (design system), game, profile, matches, live, builds, stats, charts, views
lib/                 typy, regiony/routing, formatowanie, ustawienia, klient API, hooki TanStack Query
server/riot/         klient Riot: rate limiter, retry/backoff, walidacja Zod, endpointy, mapowanie
server/services/     logika: gracz, mecze, live, statystyki, championy, leaderboard
server/demo/         deterministyczny zbiór demo
prisma/schema.prisma cache, migawki LP, drabinka, agregaty
electron/            okno desktop, wykrywanie klienta LoL, overlay
scripts/             agregator statystyk, build Electrona
deploy/              instalacja serwera (install.sh), Caddy (HTTPS), pętla statystyk
Dockerfile, docker-compose.yml   serwer produkcyjny
tests/               testy (npm test)
```

## Komendy

| Komenda | Opis |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build && npm start` | wersja produkcyjna web |
| `npm test` | testy logiki (routing, rate limiter, mapowanie, demo, klient LoL) |
| `npm run typecheck` | sprawdzenie typów |
| `npm run aggregate` | budowa zbioru statystyk |
| `npm run desktop:dev` / `desktop:build` | aplikacja na komputer |

## Wdrożenie web

Najprościej: `deploy/install.sh` (wyżej). Ręcznie: dowolny hosting Node — ustaw `RIOT_API_KEY` (albo `ADMIN_PASSWORD` i wklej klucz w `/admin`), `NEXUS_DISABLE_DEMO=1` i `DATABASE_URL`. `next.config.ts` używa `output: "standalone"` — na VPS uruchom `node .next/standalone/server.js` (skopiuj obok `.next/static` i `public`).

NEXUS isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
