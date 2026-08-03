# IRON EMPIRE — personel, ruch, plamy i awarie

Specyfikacja v2, część pierwsza: zatrudnianie pracowników wraz z obowiązkami,
które nadają im sens. Dokument jest kontraktem dla implementacji — decyzje są
w nim rozstrzygnięte, nie zostawione do domysłu.

## Zakres

W tej części:

- trzy zawody: recepcjonista, sprzątacz, naprawiacz
- trzy rangi: rare, epic, legend — z ceną i skutecznością
- rekrutacja z losowanej puli kandydatów
- **ruch po sali** — wspólny dla personelu i klientów
- plamy i ich wpływ na renomę
- awarie maszyn i naprawa
- wypłaty dzienne oraz strajk przy zaległości
- podniesienie trudności: rzadsze wejścia, rzadsi klienci z górnych rang

Poza tą częścią, do osobnych specyfikacji: **drugie piętro** i **powiększanie
mapy**. Obie dotyczą przestrzeni, nie personelu, i obie łatwiej zaprojektować,
gdy ruch po sali już działa — bo to ruch decyduje, czy większa sala jest
kosztem, czy tylko dekoracją.

Plamy i awarie wchodzą tutaj mimo że są osobnymi mechanikami: bez nich
sprzątacz i naprawiacz nie mają czego robić.

## Zasada nadrzędna: symulacja żyje w silniku

`src/game/` pozostaje czystym TypeScriptem bez Reacta, `Date` i `Math.random`.
Dotyczy to również ruchu. Pozycja pracownika, jego ścieżka i cel są częścią
`GameState`, a nie stanem sceny Three.js.

Powód jest twardy: `offline.ts` dosymulowuje do ośmiu godzin nieobecności przez
`advance()`. Gdyby ruch liczył się w warstwie graficznej, po powrocie do gry
sprzątacz stałby w miejscu, plamy by nie zniknęły, a maszyny zostałyby
niesprawne — mimo że gra rzekomo „liczyła się dalej".

`scene.ts` czyta `x`/`z` ze stanu i wygładza je interpolacją. Nie liczy ruchu,
nie wyznacza ścieżek, nie decyduje o zadaniach.

## Model danych

### Ruch — wspólny kształt

Klienci i personel poruszają się tym samym kodem. Wspólna część kontraktu:

```ts
/** Wszystko, co chodzi po sali. Pozycja jest w jednostkach świata, nie w kafelkach. */
export interface Walker {
  x: number
  z: number
  /** Kafelki do przejścia; głowa listy to następny krok. Puste = na miejscu. */
  path: Tile[]
  /** Dokąd ostatecznie zmierza — do przeliczenia ścieżki, gdy sala się zmieni. */
  goal: Tile | null
}

export interface Tile { x: number; y: number }
```

`Client` i `Staff` rozszerzają `Walker`. Prędkość nie jest polem — wynika
z rangi pracownika albo ze stałej dla klientów.

### Personel

```ts
export type StaffRole = 'reception' | 'cleaner' | 'repair'
export type StaffRank = 'rare' | 'epic' | 'legend'

export interface Staff extends Walker {
  uid: string
  /** Wylosowane z tabeli imion, np. "Marta K." */
  name: string
  role: StaffRole
  rank: StaffRank
  /** uid plamy, maszyny albo klienta — zależnie od zawodu. */
  targetUid: string | null
  /** ms przepracowane przy celu. Zadanie kończy się po czasie rangi. */
  workMs: number
  /** Zaległa wypłata. Większa od zera oznacza strajk. */
  owed: number
}
```

### Plamy

```ts
export interface Stain {
  uid: string
  x: number
  y: number
  /** Rośnie z czasem. Starsza plama mocniej ciągnie renomę w dół. */
  ageMs: number
}
```

### Kandydaci

```ts
/** Wpis w puli rekrutacyjnej. Nie jest jeszcze pracownikiem. */
export interface Candidate {
  uid: string
  name: string
  role: StaffRole
  rank: StaffRank
}
```

### Klienci — zmiana istniejącego typu

`ClientPhase` rozszerza się z dwóch wartości do pięciu:

```ts
export type ClientPhase =
  | 'arriving'   // od drzwi do swojego miejsca w kolejce
  | 'queue'      // stoi w kolejce, traci cierpliwość
  | 'toMachine'  // zeskanowany, idzie do przypisanej maszyny
  | 'workout'    // ćwiczy
  | 'leaving'    // wraca do drzwi, po dojściu znika
```

`Client` zyskuje pola `Walker`. Pole `phaseMs` zachowuje dotychczasowe
znaczenie — czas w bieżącej fazie.

### GameState

Dochodzą: `staff: Staff[]`, `stains: Stain[]`, `candidates: Candidate[]`,
`candidatesDay: number`.

`candidatesDay` to numer dnia, dla którego wylosowano pulę. Pozwala odróżnić
pulę nieaktualną od świeżej bez trzymania osobnej flagi.

`SAVE_VERSION` rośnie z 3 na 4. Migracja starego zapisu dopisuje puste tablice,
`candidatesDay: 0`, a klientom nadaje pozycje z ich obecnych miejsc w kolejce
i pustą ścieżkę. Zapis z v1 nadal się wczytuje.

## Ruch po sali

### Graf przejść

Nowy plik `src/game/pathfind.ts`.

Siatka sprzętu to 8×6, ale hala jest szersza o nawę wejściową. Nawa mieści
dokładnie dwie kolumny kafelków, więc graf chodzenia obejmuje:

```
x ∈ [-2, 7]    y ∈ [0, 5]      →  60 kafelków
```

Kolumny `-2` i `-1` to nawa. `build.ts` nie pozwala niczego w nich postawić
(`insideGrid` odrzuca ujemne `x`), więc są zawsze przechodnie. Drzwi
(`DOOR_X = -8.7`) leżą w kolumnie `-2`.

Krawędź między dwoma sąsiadującymi kafelkami istnieje, gdy spełnione są oba
warunki:

- na ich wspólnej krawędzi nie stoi ściana (`Wall` z pasującym `x`, `y`, `side`)
- kafelek docelowy nie jest zajęty przez maszynę ani dekorację

Ruch wyłącznie w czterech kierunkach. Po skosie postać przecinałaby róg ściany.

### Wyznaczanie ścieżki

```ts
export function findPath(
  state: GameState,
  from: Tile,
  to: Tile,
  opts?: { allowBlockedGoal?: boolean },
): Tile[] | null
```

A* z heurystyką Manhattan. Sześćdziesiąt kafelków to rozmiar, przy którym koszt
jest pomijalny, a wynik deterministyczny — kolejność rozpatrywania sąsiadów
jest ustalona (N, E, S, W), więc przy remisie kosztów zawsze wypada ta sama
ścieżka. To warunek tego, żeby ziarno pozostało jedynym źródłem losowości.

`allowBlockedGoal` obsługuje przypadek celu stojącego na zajętym kafelku:
klient idący na maszynę i naprawiacz idący do maszyny mają stanąć **na jej
kafelku**, mimo że dla przechodzących jest on nieprzejezdny.

Brak ścieżki zwraca `null`. To nie jest błąd — gracz ma prawo zamurować róg
sali. Obsługa jest opisana niżej.

### Krok w czasie

Nowy plik `src/game/walk.ts`. Jedna funkcja posuwa dowolnego `Walker`a wzdłuż
ścieżki z zadaną prędkością, zdejmując osiągnięte kafelki. Gdy `path` jest
pusta, postać stoi.

Krok dłuższy niż bieżący odcinek nie przestrzeliwuje celu: postać dochodzi do
węzła, zdejmuje go i zużywa resztę dystansu na kolejnym odcinku, aż zabraknie
dystansu albo skończy się ścieżka. Stąd bierze się gwarancja, że nikt nigdy nie
przejdzie przez ścianę — **ruch odbywa się wyłącznie po odcinkach ścieżki,
a ścieżka z definicji używa tylko dozwolonych krawędzi grafu**. Nie ma tu
znaczenia, jak duże jest `dtMs`; przy legendarnym pracowniku (3 j/s) jeden krok
`MAX_STEP_MS` to półtora kafelka, więc poleganie na małym kroku czasowym byłoby
złudne.

Docelowe miejsca nie zawsze leżą w środku kafelka — miejsce w kolejce liczy
`queueSpot()` w jednostkach świata, względem obróconego biurka. Dlatego ostatni
odcinek to dojście w linii prostej do dokładnego punktu wewnątrz kafelka
docelowego. Wewnątrz jednego kafelka nie ma przeszkód, więc prosta jest
bezpieczna.

### Postacie odgrodzone od celu

Gdy `findPath` zwróci `null`:

- **pracownik** porzuca zadanie (`targetUid = null`) i w następnym kroku szuka
  innego. Jeśli żadne nie jest osiągalne, wraca do punktu spoczynku. Jeśli
  i ten jest odcięty, stoi — nic się nie psuje, nic nie zapętla.
- **klient w fazie `arriving`** wychodzi natychmiast, licząc się jako utracony
  na tych samych zasadach co po utracie cierpliwości. Zamurowanie wejścia ma
  kosztować renomę.
- **klient w fazie `toMachine`** zwalnia rezerwację maszyny i przechodzi do
  `leaving`.

Ten akapit istnieje po to, żeby żadna postać nigdy nie utknęła w stanie bez
wyjścia. Każda gałąź kończy się zdefiniowanym zachowaniem.

## Cykl życia klienta

```
spawn przy drzwiach
   ↓ arriving   — idzie na swoje miejsce w kolejce
   ↓ queue      — czeka; PATIENCE_MS biegnie dopiero tutaj
   ↓            — scanClient(): opłata, rezerwacja maszyny
   ↓ toMachine  — idzie do maszyny
   ↓ workout    — ćwiczy przez workoutMs
   ↓ leaving    — wraca do drzwi
znika
```

Rozstrzygnięcia:

**Cierpliwość biegnie dopiero w fazie `queue`.** Klient nie może wyjść
z pretensjami, zanim w ogóle dojdzie do biurka. Bez tej zasady duża sala
karałaby gracza za samą swoją wielkość.

**Miejsce w kolejce przelicza się, gdy kolejka się skraca.** Po zeskanowaniu
pierwszej osoby pozostali przesuwają się do przodu — każdy dostaje nowy `goal`
i nową ścieżkę. Klient w `queue`, który jeszcze idzie na przesunięte miejsce,
nadal traci cierpliwość; przesuwanie się nie jest wymówką.

**Maszyna jest rezerwowana w chwili skanowania**, nie po dojściu. `occupiedBy`
ustawia się od razu, więc dwóch klientów nie może dostać tej samej maszyny.
Opłata schodzi w tym samym momencie co dziś — mnożnik maszyny jest wtedy znany.

**Awaria maszyny w trakcie drogi do niej** przenosi klienta do `leaving` i liczy
go jako utraconego. Maszyna psuje się po zakończonym treningu, więc ten
przypadek wymaga naprawiacza, który zdejmie rezerwację — jest rzadki, ale musi
być zdefiniowany.

**Faza `leaving` nie blokuje niczego.** Klient jest już rozliczony; gdyby ścieżka
do drzwi nie istniała, znika na miejscu.

## Zawody i obowiązki

### Recepcjonista

Punkt pracy: biurko recepcji (`Decor` typu `reception`). Stoi za nim i się nie
przemieszcza — chyba że gracz przestawi biurko, wtedy do niego dochodzi.

Co `scanMs` swojej rangi wywołuje istniejące `scanClient()` na pierwszym
w kolejce. **Żadnej nowej logiki ekonomicznej** — ta sama funkcja, którą dziś
wywołuje palec gracza, z tym samym naliczeniem opłaty i XP.

Zatrudnienie wymaga postawionego biurka. Spakowanie biurka do magazynu
w trybie budowy wysyła recepcjonistę do punktu spoczynku; wraca, gdy biurko
znów stanie.

### Sprzątacz

Plama pojawia się z szansą **18%** po każdym zakończonym treningu, na kafelku
maszyny. Jeśli kafelek już ma plamę, nowa nie powstaje — jedna maszyna nie
zbiera stosu.

Każda plama ciągnie renomę w dół:

| Wiek plamy | Ubytek renomy |
| --- | --- |
| do 30 s | 0.4 / s |
| powyżej 30 s | 0.8 / s |

Sprzątacz wybiera **najstarszą** plamę, idzie do niej i kasuje po czasie swojej
rangi. Wybór najstarszej, a nie najbliższej, jest celowy: to plamy zestarzałe
kosztują podwójnie.

Renoma jest ograniczona do przedziału 0–100 tak jak dziś, więc zaniedbana sala
zjeżdża do zera i przestaje przyciągać klientów ponad bazową stawkę — ale gra
się nie kończy.

### Naprawiacz

Maszyna z `durability === 0` jest niesprawna. Istniejąca funkcja `isUsable()`
(`clients.ts:23`) już ją odrzuca, więc taka maszyna nie przyciąga klientów
i nie da się na nią nikogo skierować. Nie trzeba tego dopisywać.

Naprawiacz idzie do najdłużej zepsutej maszyny i po czasie swojej rangi
przywraca jej **100%** trwałości. Naprawa przez pracownika **nie kosztuje**
`repairCost` — pensja jest zapłatą za tę pracę.

### Gracz robi wszystko sam

Personel wyręcza, nie zastępuje. Gracz nadal może:

- skanować klientów tapnięciem (bez zmian)
- sprzątnąć plamę tapnięciem, gdy stoi w zasięgu `REACH`
- naprawić maszynę za `repairCost`, natychmiast

Siłownia bez personelu jest w pełni grywalna — tylko wymaga uwagi.

### Punkt spoczynku

Pracownik bez zadania nie znika i nie stoi w przejściu. Wraca do **punktu
spoczynku**: kafelka `x = -1`, `y = 0` — górny róg nawy wejściowej, poza siatką
sprzętu, więc nigdy nie koliduje z tym, co gracz postawi.

Gdy w punkcie spoczynku stoi już inny pracownik, kolejny zajmuje następny wolny
kafelek nawy, schodząc w dół kolumny `-1`, a potem `-2`. Nawa ma dwanaście
kafelków, a pracowników najwyżej pięciu, więc miejsca zawsze starczy.

Recepcjonista jest wyjątkiem: jego punktem spoczynku jest biurko. Do nawy
schodzi tylko wtedy, gdy biurka nie ma w sali.

### Zwalnianie

Gracz zwalnia pracownika z panelu. Zwolnienie jest natychmiastowe i darmowe —
pracownik znika z sali w tej samej chwili.

**Pracownika z niezerowym `owed` nie da się zwolnić, dopóki zaległość nie
zostanie spłacona.** Bez tej zasady strajk byłby darmowy: gracz zwalniałby
niewypłaconych i zatrudniał nowych, nigdy nie regulując długu. Przycisk
zwolnienia jest wtedy nieaktywny, z widoczną kwotą do spłaty.

Zwolniony pracownik nie wraca do puli kandydatów. Pula jest losowana od nowa.

## Tabela rang

| | rare | epic | legend |
| --- | --- | --- | --- |
| marsz (jednostki/s) | 1.6 | 2.2 | 3.0 |
| recepcjonista — skan | 4.0 s | 2.5 s | 1.5 s |
| sprzątacz — plama | 6.0 s | 4.0 s | 2.5 s |
| naprawiacz — maszyna | 12 s | 8 s | 5 s |

Prędkość marszu ma znaczenie, bo hala ma 20 jednostek szerokości: rare
przechodzi ją w 12 s, legendarny w niecałe 7. W dużej sali różnica rang jest
odczuwalna nawet przy tym samym zadaniu.

Klienci chodzą ze stałą prędkością **2.0 j/s**, niezależnie od swojej rzadkości.
Rzadkość klienta mówi, ile jest wart, a nie jak szybko chodzi.

## Wynagrodzenia

Stawka dzienna to **baza rangi × mnożnik zawodu**:

| | recepcjonista ×1.0 | sprzątacz ×1.5 | naprawiacz ×2.0 |
| --- | --- | --- | --- |
| rare | 1 000 | 1 500 | 2 000 |
| epic | 5 000 | 7 500 | 10 000 |
| legend | 10 000 | 15 000 | 20 000 |

Liczby są świadomie wysokie względem reszty ekonomii. Dojrzała siłownia
(10 maszyn, renoma 100, ~30 członków) zarabia około **12 000 dziennie netto**,
więc:

- rare recepcjonista kosztuje ~8% dziennego zysku — pierwszy pracownik jest
  osiągalny w połowie gry
- epic naprawiacz zjada ~83% zysku takiej siłowni
- **legendarny naprawiacz za 20 000 kosztuje więcej, niż ta siłownia zarabia**

To jest zamierzone i zaakceptowane. Górna ranga jest trofeum dla siłowni znacznie
większej niż opisana wyżej, a nie standardowym celem. Personel ma być decyzją
z konsekwencjami, nie kolejnym ulepszeniem do kupienia.

### Wypłata i strajk

Wypłaty schodzą w `closeDay()`, **po** czynszu, prądzie i utrzymaniu członków.
Płacone w kolejności zatrudnienia — każdy w całości albo wcale. Nie ma wypłat
częściowych.

Na kogo nie starczy gotówki, ten dostaje `owed` równe swojej stawce
i **następnego dnia nie przychodzi do pracy**. Nie odchodzi — zostaje na liście.

Strajkujący **nie nalicza nowej pensji**, bo nie pracuje. Zaległość nie rośnie
w nieskończoność; zawsze da się ją spłacić.

Gracz reguluje zaległość w panelu personelu, w dowolnym momencie. Pracownik
wraca **natychmiast** — wchodzi do sali i podejmuje zadanie.

To rozwiązanie karze przeszacowanie zatrudnienia utratą automatyzacji, ale nie
kasuje legendarnego pracownika, na którego grało się tydzień. Kara jest
dotkliwa i odwracalna.

Dług nadal działa jak dziś: kasa może zejść poniżej zera, a **−20 000** kończy
grę. Wypłaty nie tworzą osobnej ścieżki bankructwa.

## Rekrutacja

Pula trzech kandydatów, losowana ziarnem raz na dzień. `candidatesDay` pilnuje,
żeby ta sama pula nie została wylosowana dwa razy ani nie przetrwała doby.

Odświeżenie puli w trakcie dnia kosztuje **500**.

Wagi rang — względne, nie procenty, tak samo jak `RARITY_WEIGHT` dla klientów:

| ranga | waga | w przybliżeniu |
| --- | --- | --- |
| rare | 70 | 70% |
| epic | 25 | 25% |
| legend | 5 | 5% |

Legendarny kandydat wypada mniej więcej raz na dwadzieścia losowań. Przy trzech
kandydatach dziennie to średnio raz na tydzień gry — i wtedy trzeba mieć 10–20
tysięcy na jego pierwszą wypłatę.

Zawód kandydata losowany równomiernie z trzech.

**Limit: pięciu pracowników.** Recepcjonista dodatkowo wymaga postawionego
biurka.

## Awarie maszyn

Dziś `wearPerUse` wynosi 0.6–1.4, więc maszyna wytrzymuje od 70 do 160
treningów — trwałość jest w praktyce niewidoczna. Nowe wartości sprowadzają to
do kilku użyć, przy czym tanie maszyny są wytrzymalsze od drogich:

| Maszyna | `wearPerUse` dziś | nowe | treningów do awarii |
| --- | --- | --- | --- |
| Hantle | 0.6 | 10.0 | 10 |
| Ławka płaska | 0.8 | 12.5 | 8 |
| Bieżnia | 1.4 | 20.0 | 5 |
| Wyciąg górny | 1.0 | 16.7 | 6 |
| Rower spinningowy | 1.2 | 20.0 | 5 |
| Brama wielofunkcyjna | 1.1 | 14.3 | 7 |

To jest **duża zmiana trudności**. Bieżnia pada po pięciu treningach, czyli po
około stu sekundach ciągłego użycia. Siłownia bez naprawiacza zatrzymuje się
szybko — i o to w tej mechanice chodzi.

Koszty napraw (90–320) zostają bez zmian.

## Podniesienie trudności

Zmiany w istniejących stałych:

| Stała | Dziś | Nowa | Skutek |
| --- | --- | --- | --- |
| `SPAWN_BASE` | 0.18 | 0.144 | −20% wejść |
| `SPAWN_PER_REP` | 0.30 | 0.24 | −20% wejść |
| `RARITY_WEIGHT.legend` | 10 | 6 | rzadsi cenni klienci |
| `RARITY_WEIGHT.influencer` | 3 | 2 | rzadsi cenni klienci |

## Potok systemów

`SYSTEMS` w `tick.ts` rozrasta się z trzech pozycji do ośmiu. Kolejność jest
istotna i wynika z zależności:

```ts
const SYSTEMS: System[] = [
  spawnWalkins,     // istniejący
  spawnMembers,     // istniejący
  moveClients,      // nowy — ruch przed rozliczeniem faz
  advanceClients,   // istniejący, przebudowany o nowe fazy
  spawnStains,      // nowy — plamy z zakończonych treningów
  assignStaff,      // nowy — przydział zadań
  moveStaff,        // nowy — ruch personelu
  workStaff,        // nowy — praca przy celu
]
```

Ruch wyprzedza rozliczenie faz, żeby postać, która właśnie doszła na miejsce,
zaczęła pracę w tym samym kroku, a nie dopiero w następnym. `spawnStains` stoi
po `advanceClients`, bo to tam kończą się treningi.

## Podział na pliki

Nowe w silniku:

| Plik | Odpowiada za |
| --- | --- |
| `game/pathfind.ts` | graf przejść i A* |
| `game/walk.ts` | krok wzdłuż ścieżki, wspólny dla wszystkich |
| `game/staff.ts` | przydział zadań, praca, zatrudnianie i zwalnianie |
| `game/staffMove.ts` | ruch personelu i wybór punktu spoczynku |
| `game/stains.ts` | powstawanie plam i ich wpływ na renomę |
| `game/recruit.ts` | pula kandydatów, losowanie, imiona |
| `game/content/staff.ts` | tabela rang, stawek i czasów pracy |

Nowe w interfejsie: `ui/StaffPanel.tsx` (lista, stan, spłata zaległości)
i `ui/RecruitScreen.tsx` (pula kandydatów) — obie jako zakładki w `Phone.tsx`.
`DayReportModal` dostaje wiersz „Wypłaty".

### Refaktoryzacja `scene.ts`

`src/three/scene.ts` ma dziś **977 linii**. Dołożenie do niego postaci
personelu, plam i wygładzania ruchu wypchnęłoby go grubo ponad 1200 — do
rozmiaru, w którym każda kolejna zmiana staje się ryzykowna.

Wydzielam z niego renderowanie i aktualizację postaci do `three/actors.ts`.
Klienci i personel korzystają z tego samego kodu — obaj są `Walker`ami z tym
samym modelem postaci i tym samym wygładzaniem pozycji.

To jedyna refaktoryzacja w tej specyfikacji. Robię ją, bo i tak muszę w tym
miejscu pracować, a nie przy okazji.

## Testy

Silnik jest deterministyczny i testowalny bez przeglądarki. To zostaje.

**Wyznaczanie ścieżek**
- ściana między dwoma kafelkami wymusza obejście
- cel odgrodzony ze wszystkich stron zwraca `null`
- `allowBlockedGoal` pozwala wejść na kafelek maszyny
- ta sama para punktów zawsze daje tę samą ścieżkę

**Ruch**
- postać dochodzi dokładnie do punktu docelowego i się zatrzymuje
- krok większy niż długość odcinka przechodzi na kolejny odcinek ścieżki
  i zużywa resztę dystansu, zamiast przestrzelić cel
- postać nigdy nie przecina ściany, nawet przy `dtMs` starczającym na kilka
  kafelków

**Cykl klienta**
- cierpliwość nie biegnie w fazie `arriving`
- zeskanowana maszyna jest zarezerwowana natychmiast
- awaria maszyny w trakcie drogi zwalnia rezerwację

**Personel**
- pracownik bez osiągalnego zadania wraca do punktu spoczynku
- recepcjonista skanuje w tempie swojej rangi
- sprzątacz wybiera najstarszą plamę
- naprawiacz przywraca 100% i nie pobiera `repairCost`

**Wypłaty**
- na dwóch pracowników starcza tylko na pierwszego — drugi dostaje `owed`
- strajkujący nie nalicza nowej pensji
- spłata zaległości natychmiast przywraca do pracy

**Plamy**
- plama zestarzała powyżej 30 s ciągnie renomę mocniej
- renoma nie schodzi poniżej zera

**Zapis**
- zapis w wersji 3 wczytuje się i dostaje puste tablice personelu i plam

## Co ta specyfikacja rozstrzyga

Decyzje podjęte świadomie, żeby kolejna sesja ich nie odgadywała:

1. **Ruch jest w silniku**, nie w Three.js — bo gra dolicza się offline.
2. **Klienci i personel chodzą tym samym kodem** — jeden system, nie dwa.
3. **Cierpliwość biegnie dopiero w kolejce** — duża sala nie może być karą.
4. **Strajk zamiast zwolnienia** — kara dotkliwa, ale odwracalna.
5. **Stawki legend zostają wysokie** — górna ranga jest trofeum, nie celem.
6. **Awarie co 5–10 użyć** — bez naprawiacza siłownia staje.
7. **Drugie piętro i powiększanie mapy wypadają z tej części** — osobna
   specyfikacja, po tym jak ruch zacznie działać.
