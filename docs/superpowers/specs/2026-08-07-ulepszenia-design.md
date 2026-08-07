# IRON EMPIRE — ulepszenia własnych umiejętności

Dodatek: piąta apka w telefonie, w której gracz kupuje za gotówkę trwałe
usprawnienia tego, co robi **własnymi rękami**. Dokument jest kontraktem dla
implementacji — decyzje są w nim rozstrzygnięte, nie zostawione do domysłu.

## Zakres

W tej części:

- pięć torów ulepszeń: sprzątanie, naprawa, zarabianie, luck, cierpliwość
- drabinki wartości i cen, każda pozycja rozstrzygnięta liczbowo
- nowe pole `upgrades` w `GameState` plus migracja zapisu v7 → v8
- ekran `UpgradesScreen` i nowa apka na telefonie
- wpięcie mnożników w silnik: `App.tsx`, `economy.ts`, `rarity.ts`,
  `members.ts`, `clients.ts`

Poza zakresem: nowa waluta (ulepszenia kosztują zwykłą gotówkę `kr`),
sprzedaż i reset ulepszeń, ulepszenia dotykające personelu.

## Zasada nadrzędna: to są umiejętności gracza, nie personelu

Każdy tor poprawia czynność, którą gracz wykonuje sam. `WORK_MS` w
`content/staff.ts` zostaje nietknięte — wynajęty sprzątacz i mechanik pracują
dokładnie tak jak dziś.

Powód jest twardy: gdyby ulepszenie przyspieszało też personel, gracz kupowałby
dwa razy to samo, a późna gra — w której i tak wszystko robią pracownicy —
zamieniłaby tor sprzątania i naprawy w drugi, tańszy sposób na to, co już
załatwia wypłata. Rozdzielenie utrzymuje oba systemy przy życiu: ulepszenia są
dla gracza, który gra rękami, płace dla gracza, który automatyzuje.

Wyjątkiem z natury rzeczy są **zarabianie**, **luck** i **cierpliwość** — nie
dotyczą żadnej czynności ręcznej, tylko ekonomii i napływu ludzi, więc działają
zawsze.

## Model danych

Nowy plik `src/game/content/upgrades.ts` — tabela w stylu `machines.ts`
i `expansion.ts`:

```ts
export type UpgradeId = 'cleaning' | 'repair' | 'earnings' | 'luck' | 'patience'

export interface UpgradeLevel {
  /** Wartość toru po zakupie tego poziomu. */
  value: number
  /** Koszt przejścia na ten poziom. */
  price: number
}

export interface UpgradeTrack {
  id: UpgradeId
  /** Wartość na poziomie 0 — gra taka, jaka jest dzisiaj. */
  base: number
  /** Po jednej pozycji na kupowalny poziom; `levels[0]` to pierwszy zakup. */
  levels: UpgradeLevel[]
}
```

W `GameState` jedno pole:

```ts
/** Ile poziomów każdego toru gracz wykupił. Zero to gra bez ulepszeń. */
upgrades: Record<UpgradeId, number>
```

Sam licznik, nie wartości. Powód ten sam co przy `GameState.expansion`: tabela
jest jedynym źródłem prawdy o tym, co dany poziom daje, więc przestrojenie
balansu nie wymaga migracji zapisu ani nie zostawia w cudzych zapisach
nieaktualnych liczb.

### Odczyt

```ts
/** Wartość toru przy obecnym poziomie. Toleruje śmieci w zapisie. */
export function upgradeValue(state: GameState, id: UpgradeId): number
```

Poziom jest przycinany do zakresu tabeli — zapis ręcznie podrasowany na poziom
99 dostaje najwyższy legalny, a gra działa dalej. Dokładnie jak `expansionAt`.

## Tory

### 🧹 Sprzątanie

Czas przytrzymania nad plamą, dziś `CLEAN_HOLD_MS = 3000` w `src/App.tsx`.

| poziom | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| czas | 2,5 s | 2,0 s | 1,5 s | 1,0 s | 0,5 s |
| cena | 600 | 1 800 | 5 000 | 14 000 | 40 000 |

Baza 3,0 s bez zmian.

### 🔧 Naprawa

Czas przytrzymania nad zepsutą maszyną, dziś `REPAIR_HOLD_MS = 5000`.

| poziom | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| czas | 5,5 s | 5,0 s | 4,5 s | 4,0 s | 3,5 s | 3,0 s | 2,0 s |
| cena | 800 | 2 200 | 6 000 | 15 000 | 35 000 | 80 000 | 150 000 |

**Baza rośnie z 5,0 s do 6,0 s.** Decyzja świadoma: drabinka ma zaczynać się
wyżej niż dzisiejsza wartość, żeby pierwszy zakup miał co poprawiać. Naprawa bez
ulepszeń staje się o sekundę wolniejsza niż dziś — to jest ta cena.

Naprawa jest droższa od sprzątania na każdym szczeblu, bo zepsuta maszyna nie
przynosi nic, a plama tylko obniża renomę.

### 💰 Zarabianie

Mnożnik doklejany do `entryFee()`. **Tylko wejściówki** — karnety zostają
wyceniane wyłącznie klasą siłowni, jak dotąd.

| poziom | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| mnożnik | ×1,2 | ×1,4 | ×1,6 | ×1,8 | ×2,0 | ×3,0 | ×4,0 |
| cena | 2 500 | 8 000 | 22 000 | 55 000 | 120 000 | 400 000 | 1 200 000 |

Dwa ostatnie szczeble dają +1,0 zamiast +0,2 — pięciokrotnie więcej niż
poprzednie — i stąd skok cen. ×4,0 kosztuje więcej niż odblokowanie piętra
(`FLOOR_UNLOCK_COST = 100 000`) i jest celowo najdroższą rzeczą w grze: celem na
sam koniec, a nie kolejną pozycją na liście zakupów.

Mnożnik nie dotyka `LIL_D_FAKE_PAYMENT` — sekretny gość rozlicza się poza
`entryFee()` i jego fałszywe banknoty mają zostać stratą.

### 🍀 Luck

| poziom | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| mnożnik | ×1,5 | ×2,0 | ×3,0 | ×4,0 |
| cena | 6 000 | 25 000 | 120 000 | 500 000 |

Luck robi dwie rzeczy naraz.

**Rzadkość klientów.** Wagi w `content/rarity.ts` mnożone przez `luck^i`, gdzie
`i` to numer tieru: common 0, rare 1, epic 2, legend 3, influencer 4.

Przy ×4,0 wagi `50 / 40 / 20 / 6 / 2` stają się `50 / 160 / 320 / 384 / 512`.
Średni mnożnik rzadkości rośnie z **1,57 do 2,47** — o 57% więcej przy bramce —
a INFLUENCER staje się najczęstszym tierem (36% zamiast 1,7%).

Rozważana była prostsza wersja: jeden mnożnik na wszystkie wagi powyżej common.
Dawała +11% przy ×4,0, czyli mniej niż jeden szczebel zarabiania kosztujący
ułamek tej ceny. Potęgowanie po tierach jest tym, co sprawia, że luck czuć jak
luck — górne tiery wystrzeliwują, zamiast drgnąć.

**Konwersja na karnety.** `signupChance` mnożone przez `1 + (luck − 1) × 0,30`,
z twardym sufitem **0,24**.

Sufit jest konieczny. Komentarz w `members.ts` zapisuje, dlaczego konwersja
zjechała kiedyś z 40%: przy tamtej stopie membership i przychód z abonamentów
odrywały się od reszty ekonomii. Ulepszenie nie ma prawa cofnąć tamtej naprawy.

Skutek uboczny sufitu jest pożądany: przy pełnej satysfakcji baza (0,18) i tak
siedzi tuż pod sufitem, więc luck realnie pomaga siłowni **średniej**, gdzie
baza wynosi 0,03–0,12. Luck ratuje słabą siłownię, a nie dopala i tak już
świetnej.

### ⏳ Cierpliwość

`PATIENCE_MS`, dziś 26 s — jak długo klient stoi w kolejce, zanim wyjdzie.

| poziom | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| czas | 30 s | 35 s | 42 s | 50 s |
| cena | 1 500 | 5 000 | 16 000 | 45 000 |

Tor dorzucony do zestawu, żeby domknąć trójkę: sprzątanie i naprawa to tempo,
zarabianie i luck to pieniądze, cierpliwość to **utrzymanie klienta**. Tnie
`clientsLost` i utratę renomy wprost, i jest jedynym ulepszeniem, które pomaga
graczowi biegającemu przez całą salę.

## Zakup

Czysta funkcja w `src/game/upgrades.ts`, wzorem `hire` w `staff.ts`:

```ts
export function buyUpgrade(state: GameState, id: UpgradeId): GameState
```

Odmawia — zwracając stan bez zmian, co `commit` w sklepie wykrywa
tożsamością — gdy:

- gra jest skończona (`gameOver`)
- tor jest już na maksymalnym poziomie
- gotówki jest mniej niż cena następnego poziomu

Przy powodzeniu: pobiera cenę, podnosi licznik o jeden i dolicza wydatek do
`stats.totalSpent`. Ulepszenia są **na zawsze** — nie ma sprzedaży ani resetu.

Sklep dostaje akcję `buyUpgrade: (id: UpgradeId) => void`.

### Brak bram poziomowych

Maszyny mają `minLevel`, ekspansje mają `minLevel`, ulepszenia **nie mają**.
Cena jest jedyną barierą.

Ulepszenia są nagrodą za granie, nie kolejną blokadą — a ceny same z siebie
układają kolejność zakupów: przy 500 kr na start pierwsze sprzątanie za 600 jest
poza zasięgiem, a zarabianie ×4,0 za 1 200 000 zostaje niedostępne przez wiele
dni gry, bez ani jednej linijki sprawdzającej poziom.

## Wpięcie w silnik

| Miejsce | Zmiana |
|---|---|
| `App.tsx:42-43` | `CLEAN_HOLD_MS` / `REPAIR_HOLD_MS` → odczyt z `upgradeValue()` |
| `economy.ts` `entryFee()` | nowy parametr `earnings = 1`, mnoży wynik |
| `content/rarity.ts` `rollRarity()` | nowy parametr `luck = 1`, waży tabelę |
| `members.ts` `signupChance()` | nowy parametr `luck = 1` plus sufit |
| `clients.ts` | `PATIENCE_MS` → `patienceMs(state)` |

Każdy nowy parametr ma wartość domyślną odpowiadającą grze bez ulepszeń —
dokładnie jak `reputation = 0` i `withTrainer = false` w dzisiejszym
`entryFee()`. Dzięki temu istniejące wywołania i testy zostają nietknięte, a
przypadek neutralny nadal da się wywołać w dwóch linijkach.

Silnik pozostaje czystym TypeScriptem: żadna z tych funkcji nie sięga po nic
spoza przekazanego stanu.

## Zapis

`SAVE_VERSION` rośnie z 7 na 8.

`migrateV7` dopisuje `upgrades` z zerami na wszystkich pięciu torach — stara
siłownia wznawia dokładnie tam, gdzie stanęła. `looksLikeV8` sprawdza, że
`upgrades` jest obiektem i że każdy z pięciu identyfikatorów niesie liczbę
całkowitą; zapis podający się za v8 bez tego jest uszkodzony, nie stary, i ma
zostać odrzucony na rzecz świeżego stanu. Wzorzec jest ten sam co przy
`looksLikeV6` i `looksLikeV7`.

## Interfejs

Nowa apka w `Phone.tsx`: `{ id: 'upgrades', glyph: '⬆️', tint: 'sky' }`, bez
`minLevel`. Typ `PhoneApp` rozszerzony o `'upgrades'`.

`src/ui/UpgradesScreen.tsx` — po jednej sekcji na tor, każda pokazuje:

- nazwę i jednozdaniowy opis, co tor robi
- obecną wartość i wartość po następnym zakupie (np. „3,0 s → 2,5 s")
- pasek postępu: ile poziomów z ilu
- przycisk z ceną, wyszarzony z powodem, gdy nie stać albo maksimum

Powody zakupu niemożliwego korzystają z istniejących wzorców `ShopScreen`:
`t.shop.short(...)` przy braku gotówki, własny `t.upgrades.maxed` na szczycie.
Klasy CSS `shop-row`, `shop-info`, `shop-name`, `shop-meta`, `shop-reason` są
reużyte — ekran ma wyglądać jak część sklepu, bo jest.

## Teksty

Nowe klucze w `src/i18n/en.ts` (źródło prawdy) i `pl.ts`:

- `phone.apps.upgrades` — „Upgrades" / „Ulepszenia"
- `upgrades.*` — tytuł, podpowiedź, `level(n, max)`, `current`, `step(z, na)`,
  `maxed`, plus formatery `seconds` i `mult` oraz `blurb` po jednym na tor
- `content.upgrades` — pięć nazw torów, `satisfies Record<UpgradeId, string>`

`satisfies` jest tu obowiązkowe: to ono zamienia zapomniany tor w błąd
kompilacji zamiast w pustą etykietę odkrytą w grze.

## Testy

Nowy `src/game/upgrades.test.ts`:

- każdy tor ma drabinkę monotoniczną (czasy maleją, mnożniki rosną)
- ceny rosną na każdym szczeblu
- `upgradeValue` zwraca bazę na poziomie 0 i przycina poziom spoza zakresu
- `buyUpgrade` pobiera cenę, podnosi licznik i księguje wydatek
- `buyUpgrade` odmawia przy braku gotówki, na maksimum i po `gameOver`

Rozszerzenia istniejących zestawów:

- `economy.test.ts` — `entryFee` z mnożnikiem zarabiania, i że domyślnie 1
- `rarity.test.ts` — przy luck > 1 górne tiery wypadają częściej; suma wag
  zgadza się z tabelą; przy luck = 1 rozkład jest identyczny jak dziś
- `members.test.ts` — luck podnosi konwersję, ale nigdy powyżej 0,24
- `save.test.ts` — migracja v7 → v8 daje pięć zer; zapis v8 bez `upgrades`
  jest odrzucany
