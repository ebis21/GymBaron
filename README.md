# GYMBARON

Symulator prowadzenia siłowni na iOS, Androida i przeglądarkę. Zaczynasz
z pustą salą i **$500** — akurat tyle, żeby kupić pierwszą maszynę i mieć
trochę zapasu. Dalej już sam: stawiasz sprzęt, skanujesz klientów przy wejściu
i pilnujesz, żeby dług nie sięgnął dna.

## Zasady

- Klienci przychodzą tylko wtedy, gdy w sali stoi **sprawna, wolna maszyna**.
  Pusta sala nie przyciągnie nikogo — dlatego pierwszy zakup coś znaczy.
- Klient w kolejce ma **8 sekund cierpliwości**. Nie zeskanujesz go na czas —
  wychodzi, a renoma leci w dół.
- Kasa **może zejść poniżej zera**. Ujemne saldo nie zatrzymuje siłowni: koszty
  naliczają się dalej, przychody spłacają dług, więc z dołka da się wyjść.
- Przekroczenie **−20 000** kończy grę ekranem „Komornik wbił".
- Gra liczy się dalej, kiedy jej nie widzisz — przychody i koszty po 100%,
  maksymalnie za **8 godzin** nieobecności.

## Architektura

Silnik w `src/game/` to czysty TypeScript. Nie zna Reacta, DOM-u ani zegara:
czas wchodzi wyłącznie jako parametr `dtMs`, a losowość wyłącznie przez ziarno
trzymane w stanie gry. Dzięki temu cała symulacja jest deterministyczna
i testowalna bez przeglądarki.

| Katalog | Odpowiada za |
| --- | --- |
| `src/game/` | reguły gry — bez Reacta, bez `Date`, bez `Math.random` |
| `src/store/` | jedyne miejsce dotykające zegara: pętla RAF, autozapis |
| `src/assets/` | jedyne miejsce znające pliki graficzne |
| `src/ui/` | komponenty — czytają stan i rysują, nie zawierają reguł |

`src/game/tick.ts` to potok systemów. Dodanie mechaniki z v2 (marketing,
kontrakty ze sprzętowcami, sponsorzy, personel) oznacza dopisanie jednej
funkcji do tablicy `SYSTEMS`.

## Uruchomienie

```bash
npm ci
npm run dev        # http://localhost:5173
```

## Weryfikacja

```bash
npm test           # pełny zestaw Vitest
npm run typecheck  # tsc --noEmit
npm run build      # produkcyjny build do dist/
```

## Pakowanie na telefon

Projekty natywne są w repozytorium — niosą blokadę orientacji pionowej,
której `npx cap add` samo by nie odtworzyło.

```bash
npm run mobile:sync     # build + synchronizacja obu projektów
# albo osobno:
npm run mobile:ios
npm run mobile:android

npx cap open ios      # otwiera Xcode
npx cap open android  # otwiera Android Studio
```

Do wydania na App Store potrzebny jest Xcode i konto Apple Developer,
do Google Play — Android Studio i konto Google Play Console.
Pełna checklista podpisywania, archiwizacji i publikacji jest w
[`docs/mobile-release.md`](docs/mobile-release.md).

## Grafika

Kod gry nigdy nie sięga po plik graficzny bezpośrednio — wszystko przechodzi
przez `assetFor(id)` w `src/assets/`. W v1 maszyny i postacie to kształty SVG:
przy kafelku ~48 px czytają się lepiej niż szczegółowa ilustracja. Logo jest
wygenerowane (Higgsfield, model `z_image`) i leży w `public/assets/`.

Materiał źródłowy i odrzucone generacje: `docs/art-reference/`.

Podmiana czegokolwiek na nową grafikę to zmiana wyłącznie w `src/assets/`.

## Zakres

v1 to rdzeń: lokal, kasa, kupno i stawianie maszyn, klienci, ręczne skanowanie,
naprawy, poziomy, dług.

Do v2: marketing (banery, ulotki, reklamy online), kontrakty z firmami
sprzętowymi, sponsorzy oraz panel zarządzania z recepcjonistkami i trenerami
personalnymi, który zastąpi ręczne skanowanie po awansie.
