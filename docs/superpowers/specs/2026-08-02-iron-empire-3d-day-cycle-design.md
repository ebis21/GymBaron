# Iron Empire v2 — cykl dnia, memberzy, mnożniki, widok 3D

Data: 2026-08-02

## Cel

Zamienić Iron Empire z pasywnego symulatora z ciągłym drenażem kasy w grę
rozliczaną dobami, w której gracz chodzi po własnej siłowni w 3D i utrzymuje
bazę stałych klientów. Trzy filary:

1. **Doba jako jednostka rozgrywki** — dzień trwa od 8:00 do 20:00, kończy się
   rachunkiem i ręcznym przejściem do następnego dnia.
2. **Memberzy zamiast anonimowego ruchu** — stali klienci z karnetem, którzy
   płacą cyklicznie i których trzeba utrzymać.
3. **Sala 3D** — widok z trzeciej osoby, po sali się chodzi, a interakcje
   wymagają fizycznego podejścia do klienta lub maszyny.

## 1. Zegar i cykl dnia

Nowy moduł `src/game/clock.ts`.

| Stała | Wartość | Znaczenie |
|---|---|---|
| `HOUR_MS` | `30_000` | jedna godzina gry = 30 s realnych |
| `DAY_START_HOUR` | `8` | otwarcie |
| `DAY_END_HOUR` | `20` | zamknięcie |
| `DAY_MS` | `360_000` | 12 godzin = 6 min realnych |
| `BILLING_PERIOD_DAYS` | `7` | 7 dni = 42 min realnych |

Stan gry zyskuje `day: number` (od 1), `dayMs: number` (0…`DAY_MS`) oraz
`dayEnded: boolean`.

`advance(state, dtMs)` **nigdy nie przekracza granicy doby**. Jeśli
`dayMs + dt >= DAY_MS`, silnik przetwarza wyłącznie resztę do 20:00, ustawia
`dayEnded = true` i wywołuje `closeDay()`. Od tej chwili każde kolejne
`advance()` zwraca stan niezmieniony — symulacja stoi. Wznawia ją tylko akcja
gracza `nextDay()`.

`nextDay(state)`:

- `day += 1`, `dayMs = 0`, `dayEnded = false`
- kolejka czyszczona — przechodnie i memberzy, którzy nie doczekali, idą do domu
- trwające treningi przerwane, maszyny zwolnione
- `dayReport` wyzerowany na potrzeby nowego dnia

Zegar wyświetlany jako `HH:MM`, gdzie
`hour = 8 + floor(dayMs / HOUR_MS)`, `minute = floor((dayMs % HOUR_MS) / HOUR_MS * 60)`.

## 2. Ekonomia

### 2.1 Maszyny są mnożnikami

Maszyny nie generują gotówki samodzielnie. Każdy typ ma `revenueMultiplier`,
który skaluje przychód. **Ceny zakupu i naprawy pozostają bez zmian** —
podnosimy zarobek, nie obniżamy kosztów.

| Maszyna | Cena | Mnożnik |
|---|---|---|
| Hantle | 350 | ×1,1 |
| Ławka płaska | 420 | ×1,25 |
| Rower spinningowy | 540 | ×1,4 |
| Bieżnia | 600 | ×1,5 |
| Wyciąg górny | 780 | ×1,7 |
| Brama wielofunkcyjna | 1200 | ×1,9 |

**Klasa siłowni** = średnia arytmetyczna mnożników posiadanych maszyn; przy
pustej sali wynosi `1,0`. Wyświetlana w górnym pasku jako „Klasa ×1,4".
Dokupienie słabej maszyny zwiększa przepustowość, ale obniża klasę i tym samym
przychód z karnetów — to zamierzony wybór projektowy.

### 2.2 Wejściówka

```
wejściówka = ENTRY_FEE_BASE × mnożnik_maszyny × (member ? MEMBER_DISCOUNT : 1)
```

`ENTRY_FEE_BASE = 20`, `MEMBER_DISCOUNT = 0,1`.

Naliczana w momencie skanowania, bo wtedy znany jest przydział maszyny.
Przechodzień na hantlach płaci 22, na bramie 38. Member na hantlach płaci 2.

Reputacja **nie wpływa już na cenę** — steruje wyłącznie tempem napływu ludzi
i szansą konwersji.

### 2.3 Memberzy i karnet

Stan przechowuje `members: Member[]`, gdzie `Member = { uid, joinedDay }`.
Licznik memberów to długość tablicy, prezentowana w górnym pasku.

- **Zapis** — przechodzień, który ukończył trening, zapisuje się z szansą
  `p = 0,05 + satysfakcja/100 × 0,35`. W chwili zapisu do kasy natychmiast
  wpada pierwszy karnet.
- **Karnet** = `MEMBER_FEE (200) × klasa_siłowni`. Naliczany przy zamknięciu
  dnia każdemu memberowi, dla którego `(day − joinedDay) > 0` oraz
  `(day − joinedDay) % 7 == 0`. Każdy member ma więc własny cykl liczony od
  swojego dnia zapisu.
- **Wizyty** — memberzy pojawiają się w kolejce jak przechodnie i **wymagają
  skanowania**; różni ich tylko 90% zniżki. Tempo ich napływu rośnie z liczbą
  memberów. Limit kolejki rośnie z `MAX_QUEUE = 6` do `10`, bo od teraz
  konkurują o nią dwa źródła ruchu.
- **Odpływ** — przy zamknięciu dnia, gdy satysfakcja jest niska, część memberów
  rezygnuje: `odpływ = round(members × (0,02 + (1 − satysfakcja/100) × 0,08))`.

### 2.4 Rachunek dnia

Koszty **nie są już naliczane w sposób ciągły** — `chargeCosts` znika z pętli
symulacji. W trakcie dnia kasa wyłącznie rośnie. Przy zamknięciu dnia:

```
rachunek = DAILY_RENT + suma(powerPerDay maszyn) + MEMBER_UPKEEP × liczba_memberów
```

`DAILY_RENT = 60`, `MEMBER_UPKEEP = 14`.

**Rachunek nie ma górnego limitu.** Przychodzi w pełnej wysokości nawet wtedy,
gdy gracz wydał całą gotówkę na maszyny — kasa może zejść poniżej zera.
Przychód dnia może być niższy od rachunku, bo zależy od zaangażowania gracza:
niezeskanowany klient to utracony przychód. Bankructwo poniżej `DEBT_LIMIT`
(−20 000) sprawdzane jest wyłącznie przy zamknięciu dnia.

### 2.5 Paragon

`closeDay()` zapisuje w stanie `dayReport: DayReport`, który zasila modal
końca dnia:

```ts
interface DayReport {
  day: number
  entryFees: number        // suma wejściówek zebranych w ciągu dnia
  subscriptions: number    // pierwsze karnety zapłacone przy zapisach w ciągu
                           // dnia + odnowienia naliczone przy zamknięciu
  signups: number          // liczba nowych memberów tego dnia
  churn: number            // liczba memberów, którzy odeszli
  rent: number
  power: number
  memberUpkeep: number
  bill: number             // suma trzech powyższych
  net: number              // przychód − rachunek
  cashBefore: number
  cashAfter: number
  clientsServed: number
  clientsLost: number
}
```

Start gry: `START_CASH = 500`, pusta sala. Gracza stać na hantle (350) lub
ławkę (420) — pierwsza decyzja zakupowa jest realna.

## 3. Widok 3D

### 3.1 Stos

Czyste **three.js** renderowane do `<canvas>`, bez react-three-fiber. Powód:
brak ryzyka niezgodności z React 19, pełna kontrola nad pętlą renderowania,
która i tak jest już prowadzona przez store, oraz mniejszy bundle.

```
src/three/
  scene.ts             renderer, kamera, światła, rampa toon
  palette.ts           kolory w jednym miejscu
  models/floor.ts      hala: podłoga, ściany, okna, rośliny, recepcja
  models/machines.ts   builder na każdy typ maszyny
  models/character.ts  awatar gracza i NPC-e
  controls.ts          WASD + wirtualny joystick → wektor ruchu
  GymScene3D.tsx       most React ↔ scena, synchronizacja stanu z obiektami
```

### 3.2 Styl Hay Day

- `MeshToonMaterial` z trzystopniową rampą — płaskie, kreskówkowe cieniowanie
- `RoundedBoxGeometry` na wszystkich bryłach — grube, zaokrąglone kształty
- nasycona, ciepła paleta; jasne drewno i pastelowe ściany zamiast ciemnej stali
- światło hemisferyczne (niebo/ziemia) + kierunkowe słońce z miękkimi cieniami
  `PCFSoftShadowMap`
- czarny kontur przez odwróconą, lekko powiększoną kopię siatki (`BackSide`)
- kamera perspektywiczna, FOV 35, ~45° nad graczem, podąża z opóźnieniem

### 3.3 Sterowanie i interakcja

Siatka pozostaje `8 × 6`, kafel ma 2 jednostki, więc hala ma 16 × 12. Gracz
porusza się swobodnie w granicach hali; zajęte kafle są przeszkodami
(kolizja AABB).

- **Desktop** — WASD lub strzałki
- **Dotyk** — wirtualny joystick w lewym dolnym rogu

Interakcja działa przez **bliskość**: silnik wyznacza najbliższy obiekt
interaktywny w promieniu 2,5 jednostki, a HUD pokazuje jeden kontekstowy
przycisk w prawym dolnym rogu:

| Obiekt w pobliżu | Przycisk |
|---|---|
| Klient w kolejce | „Skanuj (+22 kr)" |
| Zepsuta maszyna | „Napraw (−180 kr)" |
| Wolny kafel z kupioną maszyną „w ręku" | „Postaw tutaj" |

Przy stawianiu maszyny kafel pod graczem podświetla się duchowym podglądem
modelu.

### 3.4 HUD

Płaskie UI nad canvasem, przestylowane na jasną paletę:

- **Górny pasek** — zegar `HH:MM`, dzień, kasa, licznik memberów, klasa
  siłowni, reputacja
- **Pasek postępu dnia** — 8:00 po lewej, 20:00 po prawej
- **Dolna nawigacja** — Sala / Sklep / Statystyki; sklep i statystyki
  pozostają płaskimi ekranami nad sceną
- **Modal końca dnia** — paragon z rozpisanym `DayReport` i przyciskiem
  **„Następny dzień"**, bez możliwości zamknięcia w inny sposób

## 4. Tryb offline

Czas spędzony poza grą dolicza się **wyłącznie do końca bieżącej doby** i tam
się zatrzymuje. Gracz nigdy nie przeskoczy dnia będąc poza grą — przycisk musi
wcisnąć sam. `settleOffline` zachowuje istniejący limit `OFFLINE_CAP_MS`, ale
efektywnie ogranicza go pozostały czas doby.

## 5. Migracja zapisu

`SAVE_VERSION` rośnie do `2`. Zapisy w wersji 1 nie dają się sensownie
zmapować (brak dni, memberów, mnożników), więc `deserialize` odrzuca je i
zwraca świeży stan — zgodnie z istniejącą zasadą, że uszkodzony zapis nigdy
nie może zablokować aplikacji.

`stats.daysPassed` znika — zastępuje je pole `day` na najwyższym poziomie
stanu, bo doba przestaje być pochodną `elapsedMs`, a staje się jednostką
sterowaną przez gracza.

## 6. Testy

Silnik pozostaje czysty i deterministyczny, cała logika testowalna bez DOM-u.

- `clock.test.ts` — `advance` zatrzymuje się dokładnie na 20:00; kolejne
  `advance` po `dayEnded` nie zmieniają stanu; `nextDay` resetuje dobę
- `economy.test.ts` — wejściówka uwzględnia mnożnik maszyny i zniżkę membera;
  klasa siłowni to średnia; pusta sala daje klasę 1,0
- `members.test.ts` — zapis wypłaca pierwszy karnet natychmiast; karnet wraca
  w dniach 7/14/21 od dnia zapisu, nie w innych; odpływ rośnie przy niskiej
  satysfakcji
- `dayClose.test.ts` — rachunek rośnie z liczbą memberów; nie jest ograniczany
  przychodem; kasa może zejść poniżej zera; `DayReport` się bilansuje
- `tick.test.ts` — brak ciągłego drenażu kasy w trakcie dnia

Warstwa 3D nie jest testowana jednostkowo; weryfikacja przez uruchomienie i
oględziny.

## 7. Poza zakresem

Personel, marketing, wiele sal, multiplayer, generowane modele z zewnętrznych
narzędzi AI. Warstwa `src/three/models/machines.ts` jest jedynym miejscem,
które trzeba ruszyć, gdyby modele proceduralne miały zostać kiedyś podmienione
na wczytywane pliki glTF.
