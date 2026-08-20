# Konta i zapis w chmurze — przekazanie (Agent 1)

Warstwa kont i synchronizacji zapisu. Gra nadal działa bez konta i bez
internetu; po zalogowaniu postęp przeżywa odinstalowanie aplikacji i zmianę
urządzenia.

**Nie podpięte do gry.** `src/App.tsx`, `src/ui/Phone.tsx` i `src/game/*` są
nietknięte. Spięcie ze `src/store/gameStore.ts` należy do Agenta 3 —
instrukcja w sekcji [Integracja](#integracja).

---

## Konfiguracja

Projekt Supabase: **Gymbaron** (`dmaxctvityrcbxvzbakb`, region `eu-central-1`).

```
VITE_SUPABASE_URL=https://dmaxctvityrcbxvzbakb.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

Skopiuj `.env.example` do `.env.local` i uzupełnij z panelu Supabase →
Project Settings → API. `.env.local` jest ignorowany przez `.gitignore`
(wzorzec `*.local`), więc żaden klucz nie trafia do repozytorium.

Obie wartości są bezpieczne w bundlu klienta: klucz publishable działa
wyłącznie w imieniu zalogowanego użytkownika, a dostęp do danych pilnuje RLS.
**Klucza `service_role` nigdy nie umieszczaj pod prefiksem `VITE_`** — Vite
wkleja każdą zmienną `VITE_*` do serwowanego JavaScriptu.

Bez konfiguracji aplikacja startuje w trybie lokalnym: `AccountService`
zgłasza `configured: false`, a ekran konta pokazuje komunikat zamiast
formularza. To wspierany scenariusz, nie błąd.

---

## Schemat bazy

`supabase/migrations/202608200001_accounts_and_cloud_saves.sql` (zastosowana).

### `public.profiles`

| kolumna | typ | uwagi |
| --- | --- | --- |
| `id` | `uuid` | PK, FK → `auth.users(id)` `on delete cascade` |
| `display_name` | `text` | z `raw_user_meta_data.display_name`, w razie braku część adresu e-mail przed `@` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | utrzymywane triggerem |

### `public.game_saves`

| kolumna | typ | uwagi |
| --- | --- | --- |
| `user_id` | `uuid` | PK, FK → `auth.users(id)` `on delete cascade` |
| `state` | `jsonb not null` | pełny wynik `serialize(state)` z `src/game/save.ts` |
| `revision` | `bigint not null default 1` | licznik CAS, podnoszony **wyłącznie** przez trigger |
| `save_version` | `integer not null default 0` | kopia `SAVE_VERSION` silnika |
| `updated_at` | `timestamptz not null default now()` | |

### Triggery

- `on_auth_user_created` (`after insert on auth.users`) — zakłada profil w tej
  samej transakcji co rejestracja. `security definer`, bo nowy użytkownik nie
  ma jeszcze sesji i nie przeszedłby RLS.
- `game_saves_bump_revision` (`before update`) — ustawia
  `revision = old.revision + 1`, odświeża `updated_at` i przywraca `user_id`.
  Klient nie może podać własnej wartości `revision` ani przenieść zapisu na
  inne konto (zweryfikowane na żywej bazie).
- `profiles_touch_updated_at` (`before update`).

Wszystkie trzy funkcje mają odebrany `EXECUTE` dla `public`, `anon`
i `authenticated` — inaczej byłyby wystawione jako endpointy RPC.

### RLS

RLS włączone na obu tabelach. `anon` ma odebrane wszystkie uprawnienia, więc
**pełny JSON zapisu nie jest dostępny publicznie**. Polityki `authenticated`
obejmują `select`/`insert`/`update`/`delete` na `game_saves` oraz
`select`/`update` na `profiles`, każda z warunkiem `auth.uid() = user_id`
(odpowiednio `= id`).

Zweryfikowane bezpośrednio przeciwko projektowi (20/20):

- `anon` — `permission denied for table game_saves` / `profiles`,
- użytkownik B nie widzi, nie nadpisze i nie usunie zapisu użytkownika A,
- `insert` z cudzym `user_id` → `new row violates row-level security policy`,
- zapis z nieaktualnym `revision` nie trafia w żaden wiersz, a nowszy stan
  zostaje nienaruszony,
- `select revision, updated_at` nie zwraca `state`.

`supabase db lint` / advisors: brak zgłoszeń.

---

## API

Wszystko pod `src/cloud/`, eksport przez `src/cloud/index.ts`.

### `AccountService` — jeden obiekt dla całej funkcji

```ts
import { getAccountService } from './cloud'

const account = getAccountService()   // singleton z konfiguracji Vite
await account.start()                 // idempotentne; wznawia zapisaną sesję

account.state()      // { configured, session, sync, busy, error, notice }
account.subscribe(state => ...)       // → unsubscribe
account.onCloudEvent(event => ...)    // → unsubscribe

await account.signUp(email, password) // → boolean (błąd w state().error)
await account.signIn(email, password)
await account.signOut()               // najpierw dosyła kolejkę, potem wylogowuje
```

Sesja przeżywa restart aplikacji: `supabase-js` trzyma ją przez
`@capacitor/preferences` (klucz `iron-empire-auth`), a nie przez
`localStorage` — inaczej iOS mógłby ją skasować.

### `CloudSaveService` — synchronizacja zapisu (`account.cloud`)

```ts
await cloud.push(raw)   // raw = serialize(state); throttled, nie blokuje gry
await cloud.flush()     // wyślij teraz (pauza, wejście w tło, wylogowanie)
await cloud.pull()      // pobierz bezwarunkowo
await cloud.poll()      // sprawdź, czy chmura się ruszyła; pobierz jeśli tak
cloud.startPolling(ms)  // → stop
cloud.snapshot()        // { status, userId, revision, lastSyncedAt, message, pending }
```

`push` zwraca `'saved' | 'queued' | 'idle' | 'local-only' | 'conflict' |
'offline' | 'error'`. **`'saved'` pada wyłącznie po potwierdzeniu przez
Supabase.** Żadna metoda nie rzuca — awaria sieci obniża `status`, a gra
toczy się dalej.

Throttle: domyślnie 20 s, z zachowaniem tylko najnowszego stanu w kolejce.
Autosave gry (5 s) może wołać `push` na każdym zapisie. Udany zapis otwiera
nowe okno throttle, więc rekoncyliacja po zalogowaniu nie jest natychmiast
powtarzana.

### Zdarzenia

```ts
type CloudSaveEvent =
  | { type: 'status'; snapshot: CloudSaveSnapshot }
  | { type: 'adopt'; raw: string; revision: number
      reason: 'first-login' | 'remote-changed' | 'conflict' }
```

`adopt` to zapis, na który gra ma się przełączyć. `raw` jest w dokładnie tym
samym formacie, co zapis lokalny — nadaje się wprost do `deserialize`.
Zanim zdarzenie poleci, stan jest już zapisany lokalnie.

### Rekoncyliacja przy pierwszym logowaniu

| na urządzeniu | na koncie | wynik |
| --- | --- | --- |
| jest | brak | `uploaded` — lokalna siłownia zostaje zapisem konta |
| brak | jest | `downloaded` — `adopt` z `reason: 'first-login'` |
| brak | brak | `empty` |
| jest | jest | rozstrzyga `ConflictResolver` |
| — | — | `failed` przy braku sieci; **lokalny zapis nietknięty**, próba ponawialna |

Domyślny resolver `newestWins` porównuje `lastSeenAt`, a przy remisie wybiera
chmurę: RPC doliczające zakup zmienia `state`, nie ruszając `lastSeenAt`, więc
remis nie może kasować takiej zmiany. Dostępne też `remoteWins` i `localWins`.

### Konflikty wersji

Każdy zapis niesie `revision`, którą spodziewa się zastać. Przegrana oznacza,
że ktoś zapisał nowszy stan — serwis **pobiera cudzy zapis zamiast wymuszać
własny**, emituje `adopt` z `reason: 'conflict'` i zwraca `'conflict'`.
Dokładnie tak wykrywana jest zmiana wprowadzona przez RPC Agenta 2.

> Kompromis: gra przyjmuje wtedy stan z chmury, co może cofnąć ostatnie
> kilkanaście sekund rozgrywki. Jeśli Agent 2 będzie potrzebował scalania
> (np. doliczyć różnicę gotówki zamiast podmieniać stan), miejscem na to jest
> obsługa `adopt` po stronie store'a — serwis dostarcza oba stany.

### Błędy

`CloudError` z `code` (`offline` / `conflict` / `auth` / `not-configured` /
`server` / `unknown`) i komunikatem po polsku. `toCloudError` tłumaczy
odpowiedzi supabase-js — „Invalid login credentials” → „Nieprawidłowy e-mail
lub hasło.”, „Failed to fetch” → „Brak połączenia z serwerem. Gra działa dalej
offline.” itd. Walidacja e-maila i długości hasła dzieje się przed wyjściem
w sieć.

---

## UI

`src/ui/AccountScreen.tsx` — gotowy ekran (rejestracja / logowanie /
wylogowanie, wskaźnik synchronizacji, komunikaty po polsku), w stylistyce
reszty interfejsu. Style w `src/ui/styles.css` pod `--- account ---`.

```tsx
import AccountScreen from './ui/AccountScreen'
// w routerze telefonu:
<AccountScreen />
// w teście lub na fake'u:
<AccountScreen service={fakeAccountService} />
```

Hooki: `useAccount(service?)` i `useCloudSaveEvents(listener, service?)`.
`useAccount` sam woła `start()` przy pierwszym montowaniu.

---

## Integracja

Do zrobienia przez Agenta 3 w `src/store/gameStore.ts`:

1. **Wysyłanie.** W `persist(state)`, obok istniejącego `saveRaw`:

   ```ts
   const raw = serialize({ ...state, lastSeenAt: Date.now() })
   void saveRaw(SAVE_KEY, raw)
   void getAccountService().cloud.push(raw)   // nie czekaj na sieć
   ```

2. **Przyjmowanie.** Subskrypcja `adopt` — po `deserialize` trzeba wykonać ten
   sam ciąg co w `start()`: `syncRoomSize`, `settleOffline`, `ensurePool`,
   inaczej rozbudowana siłownia wróci w złym rozmiarze:

   ```ts
   getAccountService().onCloudEvent(event => {
     if (event.type !== 'adopt') return
     const now = Date.now()
     const loaded = deserialize(event.raw, now)
     syncRoomSize(loaded)
     const settled = settleOffline(loaded, now)
     set({ state: ensurePool(settled.state), ready: true })
   })
   ```

3. **Start.** `void getAccountService().start()` obok hydratacji save'a.
   Kolejność jest bez znaczenia — rekoncyliacja czyta zapis lokalny sama.

4. **Dosyłanie.** W `stopLoop()` i w handlerze `visibilitychange` (gdy
   `document.hidden`) dodaj `void getAccountService().cloud.flush()`, żeby
   zminimalizowanie aplikacji nie zostawiało niewysłanego zapisu.

5. **Ekran.** Podepnij `<AccountScreen />` w UI telefonu.

Silnik w `src/game/*` pozostaje czystym TypeScriptem — warstwa chmury operuje
na nieprzezroczystym JSON-ie i nie importuje typu `GameState`.

---

## Testy

`npm test` — 496 testów, 34 pliki, wszystkie zielone (67 w `src/cloud`).

- `memorySaveRepository.test.ts` — kontrakt repozytorium: rewizje, CAS, izolacja kont, tryb offline.
- `cloudSave.test.ts` — rekoncyliacja, throttle, konflikty, wykrywanie zmian z chmury, zachowanie bez sieci.
- `account.test.ts` — logowanie, rejestracja, wylogowanie, komunikaty błędów, brak konfiguracji.
- `messages.test.ts`, `resolve.test.ts`, `config.test.ts`.

Testy nie dotykają sieci: `MemorySaveRepository` odtwarza trigger rewizji i
CAS, `MemoryLocalStore` zastępuje Preferences, a zegar i timery są wstrzykiwane
(`now`, `schedule`, `cancel`), więc throttle jest deterministyczny. Prawdziwe
RLS i CAS zweryfikowano osobno, skryptem jednorazowym przeciwko projektowi.

---

## Znane ograniczenia

1. **Potwierdzanie e-maila jest włączone** w projekcie Supabase. Po rejestracji
   `signUp` zwraca `needsConfirmation: true` i użytkownik nie dostaje sesji,
   dopóki nie kliknie linku. Kod obsługuje oba warianty; jeśli gra ma logować
   od razu, wyłącz *Confirm email* w Authentication → Providers → Email.
   Decyzja produktowa, nie techniczna.
2. **Wykrywanie zmian to polling** co 60 s (`stamp` — dwie kolumny, bez
   `state`). Supabase Realtime dałby natychmiastową reakcję, ale wymaga
   dopisania tabeli do publikacji; jeśli RPC Agenta 2 mają być widoczne od
   razu, to jest miejsce do zmiany.
3. **Konflikt = przyjęcie wersji z chmury.** Brak scalania — patrz uwaga wyżej.
4. **Brak resetu hasła i logowania społecznościowego.** Poza zakresem.
5. **Brak usuwania konta z poziomu gry.** RODO-owe „usuń moje dane” wymagałoby
   osobnej ścieżki (kaskada z `auth.users` jest już gotowa).
6. **Bundle rośnie o supabase-js** (~120 kB min) dopiero po podpięciu przez
   Agenta 3 — obecnie `src/cloud` nie jest importowane z drzewa aplikacji,
   więc tree-shaking je pomija.
7. **`revision` jako `bigint` wraca przez PostgREST jako `number`.** Przy
   jednym inkremencie na zapis limit `2^53` jest nieosiągalny.
