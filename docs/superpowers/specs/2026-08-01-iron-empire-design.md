# IRON EMPIRE — Gym Tycoon: specyfikacja v1

Data: 2026-08-01
Status: zatwierdzona przez użytkownika

## Cel

Symulator prowadzenia siłowni. Gracz zaczyna z pustym lokalem i $500, kupuje
pierwszą maszynę i rozbudowuje siłownię, ręcznie obsługując klientów.

v1 to działająca, grywalna pętla ekonomiczna — nie demo. Aplikacja webowa
przygotowana do spakowania na iOS i Android bez przepisywania kodu.

## Zakres v1

W zakresie:

- lokal na siatce kafelków, stawianie maszyn
- gotówka, sklep ze sprzętem, katalog maszyn
- klienci w czasie rzeczywistym: napływ, kolejka, trening, wyjście
- ręczne skanowanie kart wstępu (główna interakcja gracza)
- koszty: czynsz dzienny, prąd, zużycie i naprawa sprzętu
- reputacja, satysfakcja, XP i poziomy
- zapis stanu i zarobek offline
- gotowość pod Capacitor (iOS + Android)

Poza zakresem (v2, świadoma decyzja użytkownika):

- kampanie marketingowe
- kontrakty ze sprzętowcami
- sponsorzy
- personel: recepcjonistki, trenerzy personalni

Architektura ma te systemy przewidziane, ale v1 ich nie implementuje.

## Stack

- Vite + React 19 + TypeScript
- Zustand — stan aplikacji
- Capacitor 7 — pakowanie do natywnego iOS i Android
- Vitest — testy silnika
- brak backendu; zapis lokalny

Uzasadnienie: Capacitor pakuje ten sam build webowy do projektu Xcode i Android
Studio. Jedna baza kodu obsługuje przeglądarkę i oba sklepy.

## Architektura

Podział na czysty silnik i warstwę prezentacji.

```
src/
  game/           czysty TypeScript, zero Reacta
    types.ts        GameState, Machine, Client, Tile
    content/        katalog sprzętu — dane, nie kod
    economy.ts      przychód, koszty, reputacja
    clients.ts      napływ i cykl życia klienta
    tick.ts         advance(state, dtMs) → state
    save.ts         serializacja i migracje
    offline.ts      zarobek za czas nieobecności
  store/          Zustand + pętla requestAnimationFrame
  ui/             ekrany: Siłownia, Sklep, Statystyki
  assets/         assetFor(id) — warstwa grafiki
```

### Silnik: `game/`

Cały silnik to czyste funkcje bez zależności od Reacta, DOM-u i zegara
systemowego. Czas wchodzi wyłącznie jako parametr `dtMs`. Dzięki temu silnik jest
deterministyczny i testowalny bez uruchamiania interfejsu.

Rdzeniem jest `advance(state, dtMs) → state` — potok systemów wykonywanych po
kolei:

```
[spawnClients, moveClients, chargeCosts, decayDurability]
```

Losowość wchodzi przez ziarno zapisane w stanie, nie przez `Math.random`. Dzięki
temu ten sam stan i `dtMs` zawsze dają ten sam wynik, co czyni testy stabilnymi.

Dodanie systemu w v2 (marketing, personel) oznacza dopisanie jednej funkcji do
tej tablicy. Żaden istniejący system nie wymaga zmian.

### Warstwa React: `store/` i `ui/`

`store/` opakowuje silnik w Zustand i napędza go pętlą `requestAnimationFrame`.
Jest jedynym miejscem, które zna czas rzeczywisty. `ui/` czyta stan i renderuje
— nie zawiera logiki gry.

### Warstwa grafiki: `assets/`

Dostęp do grafiki wyłącznie przez `assetFor(id)`. Kod gry i interfejsu nigdy nie
odwołuje się do pliku graficznego bezpośrednio. Podmiana źródła grafiki to zmiana
implementacji `assetFor` — reszta kodu pozostaje nietknięta.

## Rozgrywka

Start: lokal 8×6 kafelków, $500, poziom 1, reputacja 0.

1. Gracz kupuje maszynę w sklepie i stawia ją tapnięciem na wolny kafelek.
2. Czas płynie sam: 1 dzień gry = 3 minuty rzeczywiste.
3. Klienci pojawiają się w tempie zależnym od reputacji i liczby wolnych maszyn.
4. Klient staje w kolejce przy recepcji z ikoną karty. Gracz tapie go, żeby
   zeskanować kartę — klient płaci za wejście. Brak reakcji w 8 sekund oznacza
   wyjście klienta i spadek reputacji.
5. Zeskanowany klient zajmuje wolną maszynę, ćwiczy, podnosi satysfakcję
   i wychodzi.
6. Koszty naliczają się niezależnie od gracza: czynsz, prąd od każdej maszyny,
   zużycie sprzętu.
7. Skanowanie i ukończone treningi dają XP. Poziom odblokowuje droższy sprzęt.

Napięcie v1: każda maszyna zarabia, ale pobiera prąd i się zużywa. Zbyt szybka
rozbudowa wpędza w dług, a dług bez rosnących przychodów kończy się komornikiem.

Ręczne skanowanie jest celowo uciążliwe. To praca, którą w v2 przejmie
zatrudniona recepcjonistka — zdjęcie tej uciążliwości ma być odczuwalną nagrodą.

## Ekonomia

| Wartość | Zakres | Rola |
| --- | --- | --- |
| `cash` | ≥ −20 000 | gotówka; może zejść na minus, poniżej progu gra się kończy |
| `reputation` | 0–100 | steruje tempem napływu klientów i ceną wejścia |
| `satisfaction` | 0–100 | średnia z ostatnich klientów; spada od kolejki i braku wolnych maszyn |
| `durability` | 0–100 na maszynę | spada z użycia; 0 wyłącza maszynę do czasu naprawy |
| `dailyRent` | rośnie z rozmiarem lokalu | stały koszt dzienny |
| `level` / `xp` | od 1 | odblokowuje kolejne pozycje w katalogu sprzętu |

Katalog sprzętu jest danymi (`content/`), nie kodem. Każda pozycja ma: cenę,
pobór prądu, czas treningu, przyrost satysfakcji, tempo zużycia, koszt naprawy
i wymagany poziom.

Zadłużenie: `cash` może zejść poniżej zera. Ujemna gotówka nie blokuje działania
siłowni — koszty naliczają się dalej, przychody spłacają dług. Gracz może więc
wyjść z dołka, jeśli siłownia zarabia.

Próg końca gry to **−20 000**. Przekroczenie go kończy rozgrywkę ekranem
„Komornik wbił" z podsumowaniem i opcją rozpoczęcia od nowa. Interfejs ostrzega
gracza wizualnie, gdy gotówka jest ujemna, i wyraźniej po przekroczeniu połowy
progu.

v1 nie nalicza odsetek od długu. Sam próg wystarcza za presję.

## Zapis i zarobek offline

Autozapis co 5 sekund przez Capacitor Preferences — działa identycznie
w przeglądarce i natywnie.

Zapis zawiera numer wersji schematu. `save.ts` przeprowadza migracje przy
wczytaniu, więc przyszłe aktualizacje nie kasują postępu graczy.

Przy powrocie `offline.ts` liczy zarobek na podstawie `lastSeenAt`. Przychody
naliczają się w pełnej wysokości, tak samo jak koszty. Obowiązuje limit
8 godzin — dłuższa nieobecność nie nalicza się dalej.

Jeżeli rozliczenie nieobecności zepchnie gotówkę poniżej progu −20 000, gracz po
powrocie trafia od razu na ekran „Komornik wbił".

## Grafika

Zestaw assetów powstaje w Higgsfield przez CLI, model `recraft_v4_1` w trybie
`vector` (1.25 kredytu za obraz, dostępne 10 kredytów).

Zamiast generować każdą ikonę osobno, powstają **arkusze sprite'ów** — jeden
obraz zawiera siatkę kilku ikon w jednym stylu, cięty następnie w kodzie. To
gwarantuje spójność stylu i obniża koszt.

| Asset | Zawartość | Koszt |
| --- | --- | --- |
| arkusz maszyn | 6 ikon sprzętu | 1.25 |
| arkusz postaci | klienci siłowni | 1.25 |
| tło | podłoga i ściany siłowni | 1.25 |
| marka | ikona aplikacji i logo | 1.25 |

Razem 5 kredytów; pozostałe 5 stanowi zapas na poprawki nieudanych generacji.

Do czasu wygenerowania assetów `assetFor` zwraca zastępcze kształty SVG, więc
gra jest grywalna niezależnie od stanu grafiki.

## Gotowość mobilna

Wymagania obowiązujące od pierwszego commita, nie doklejane na końcu:

- orientacja pionowa
- `safe-area-inset` pod notch i pasek gestów
- cele dotykowe minimum 44 px
- brak interakcji zależnych od najechania kursorem
- manifest PWA, ikona aplikacji, ekran startowy
- skonfigurowane platformy iOS i Android w Capacitorze

## Testy

Vitest pokrywa silnik `game/`:

- determinizm `advance` — ten sam stan i `dtMs` dają ten sam wynik
- bilans ekonomii — przychody i koszty zgadzają się na przestrzeni dnia gry
- dług — gotówka schodzi na minus, siłownia działa dalej, przychody spłacają dług
- koniec gry — przekroczenie −20 000 kończy rozgrywkę; −19 999 jeszcze nie
- migracje zapisu — stary zapis wczytuje się do bieżącego schematu
- zarobek offline — limit 8 godzin działa na granicy, przychody i koszty pełne
- koniec gry po powrocie — rozliczenie nieobecności może przekroczyć próg

Interfejs nie jest testowany automatycznie w v1.

## Kryteria ukończenia v1

- gra uruchamia się w przeglądarce i jest grywalna od pustego lokalu
- gracz może kupić maszynę, postawić ją, obsłużyć klienta i zarobić
- zejście na dług, wyjście z długu oraz ekran „Komornik wbił" są osiągalne
- awans na kolejny poziom jest osiągalny
- stan przeżywa przeładowanie strony, zarobek offline nalicza się poprawnie
- testy silnika przechodzą
- `npx cap add ios` i `npx cap add android` wykonują się bez błędu
