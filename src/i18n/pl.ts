import type { Strings } from './en'
import { marketingPl } from './marketing'
import { contractsPl } from './contracts'
import { sponsorsPl } from './sponsors'

/**
 * The original wording, kept as it was written rather than translated back
 * from the English — this is the version the game was designed in.
 */
export const pl: Strings = {
  languageName: { en: 'English', pl: 'Polski' },

  loading: 'Otwieranie siłowni…',

  settings: {
    title: 'Ustawienia',
    language: 'Język',
    close: 'Zamknij',
  },

  topbar: {
    afterHours: 'Po godzinach',
    day: n => `Dzień ${n}`,
    cash: 'Kasa',
    members: 'Członkowie',
    renewal: days => `karnet za ${days} ${days === 1 ? 'dzień' : 'dni'}`,
    gymClass: 'Klasa',
    reputation: 'Renoma',
    hours: '8:00 → 20:00',
    settings: 'Ustawienia',
    debt: 'Jesteś na minusie. Poniżej −20 000 wchodzi komornik.',
  },

  phone: {
    show: 'Pokaż telefon',
    hide: 'Schowaj telefon',
    day: n => `Dzień ${n}`,
    apps: {
      gym: 'Sala',
      build: 'Buduj',
      shop: 'Sklep',
      stats: 'Statystyki',
      staff: 'Personel',
      upgrades: 'Ulepszenia',
      marketing: 'Marketing',
      contracts: 'Kontrakty',
      sponsors: 'Sponsorzy',
    },
  },

  build: {
    pickTile: 'Wskaż nowe pole…',
    pickEdge: 'Wskaż nową krawędź…',
    pickEdgeForWall: 'Kliknij krawędź kafla…',
    pickTileForItem: 'Wskaż pole dla przedmiotu…',
    cancel: 'Anuluj',
    wall: 'Ścianka',
    rotate: 'Obróć',
    move: 'Przestaw',
    store: 'Schowaj',
    idle: 'Kliknij sprzęt, ściankę albo puste pole',
    inventory: n => `Ekwipunek (${n})`,
    shop: 'Sklep',
    done: '✓ Gotowe',
    bagOnEdge: 'Ścianki stawia się na krawędzi — wybierz ją, a potem kliknij krawędź kafla.',
    bagOnTile: 'Wybierz przedmiot, potem wskaż mu miejsce na sali.',
  },

  action: {
    repair: cost => `Napraw ${cost}`,
    clean: 'Posprzątaj',
    serve: 'Obsłuż klienta',
    member: 'Członek',
    passerby: 'Przechodzień',
    floorPick: 'Wybierz piętro',
    floorUnlock: 'Odblokuj piętro',
    remaining: seconds => `jeszcze ${seconds}s`,
    hold: 'przytrzymaj',
  },

  dev: {
    levelUp: 'Poziom +1',
    staffLevel: level => `Poziom ${level} (personel)`,
    teleport: 'Teleport do recepcji',
    closingTime: 'Przewiń na 20:00',
    summonLilD: 'Przywołaj LIL D.',
    rankShowcase: 'Parada rang ♀/♂',
    restart: 'Restart zapisu',
  },

  closing: {
    title: 'Po godzinach',
    stillInside: n =>
      `Nikt już nie wejdzie — ${n} ${n === 1 ? 'osoba kończy' : 'osób kończy'} trening.`,
    empty: 'Sala pusta. Rozbuduj siłownię, posprzątaj — zamknij, kiedy skończysz.',
    closeDay: 'Zamknij dzień',
  },

  shop: {
    equipment: 'Sprzęt',
    equipmentHint:
      'Mnożnik podbija wejściówkę na danej maszynie, a jego nadwyżka ponad 1,0 dokłada się do klasy siłowni, czyli do ceny każdego karnetu. Kupione rzeczy trafiają do ekwipunku.',
    furniture: 'Meble',
    furnitureHint: 'Nic nie zarabiają i zajmują pole w sali — kupujesz je dla wyglądu.',
    partitions: 'Ścianki',
    partitionsHint:
      'Stają na krawędziach kafli, więc nie zabierają miejsca pod sprzęt. W trybie budowania weź ściankę z ekwipunku i kliknij krawędź kafla. Kliknięcie postawionej ścianki wybiera ją — wtedy możesz ją przestawić albo schować z powrotem do ekwipunku.',
    partitionName: 'Ścianka działowa',
    partitionMeta: 'Jeden odcinek na jedną krawędź',
    expansion: 'Rozbudowa',
    expansionHint: (w, h) =>
      `Więcej pól pod sprzęt. Wszystko, co już stoi, zostaje na swoim polu — sala rozrasta się dookoła. Teraz masz ${w} × ${h} pól.`,
    expansionMeta: (w, h, extra) => `${w} × ${h} pól · o ${extra} pól więcej`,
    biggest: 'Największa sala — nie ma czego dokupić',
    needsLevel: level => `Wymaga poziomu ${level}`,
    short: amount => `Brakuje ${amount}`,
    machineMeta: (power, seconds, repair) =>
      `Prąd ${power}/dzień · Trening ${seconds} s · Naprawa ${repair}`,
    machineMult: (mult, fee, classGain) =>
      `×${mult} · wejściówka ${fee} · klasa +${classGain}`,
  },

  client: {
    close: 'Zamknij',
    secretKind: 'Gość specjalny · płaci grubym plikiem gotówki',
    memberKind: off => `Członek — karnet, ${off}% zniżki`,
    passerbyKind: appearance => `Przechodzień z ulicy · ${appearance}`,
    woman: 'kobieta',
    man: 'mężczyzna',
    noteValue: 'Nominał banknotów',
    guestMultiplier: 'Mnożnik gościa',
    reputation: 'Renoma',
    freeStation: 'Wolne stanowisko',
    trainer: 'Trener personalny',
    trainerOffer: free => `×1.5 za wizytę · wolnych: ${free}`,
    trainersBusy: 'Wszyscy trenerzy są w tej chwili zajęci.',
    trainersHire: 'Zatrudnij trenera w Personelu, żeby sprzedawać sesje ×1.5.',
    trainersLocked: level => `Trenerzy personalni od poziomu ${level}.`,
    takeCash: amount => `Przyjmij gotówkę · +${amount}?`,
    scan: amount => `Skanuj karnet · +${amount}`,
    noMachine: 'Brak wolnej maszyny',
  },

  report: {
    closingTime: '20:00 — zamknięcie',
    title: day => `Rachunek za dzień ${day}`,
    income: 'Przychód',
    doorFees: 'Wejściówki',
    trainerFees: '↳ w tym sesje z trenerem',
    passes: 'Karnety',
    total: 'Razem',
    counterfeitTitle: 'Wpadka przy kasie',
    counterfeit: 'Fałszywe pieniądze — LIL D.',
    counterfeitNote: 'Banknoty wyglądały legitnie. Dopiero wieczorne liczenie ujawniło przekręt.',
    due: 'Do zapłaty',
    rent: 'Czynsz',
    power: 'Prąd',
    memberUpkeep: 'Utrzymanie członków',
    wages: 'Wypłaty',
    bill: 'Rachunek',
    net: 'Bilans dnia',
    cashLabel: 'Kasa:',
    served: n => `Obsłużeni: ${n}`,
    lost: n => `Straceni: ${n}`,
    signups: n => `Nowi członkowie: +${n}`,
    churn: n => `Odeszli: −${n}`,
    lostHint: n =>
      `${n === 1 ? 'Jeden klient wyszedł' : `${n} klientów wyszło`} bez treningu. Każdy niezeskanowany to przepadła wejściówka i szansa na karnet.`,
    nextDay: 'Następny dzień →',
  },

  staff: {
    title: 'Personel',
    locked: (trainerLevel, restLevel, level) =>
      `Zatrudnianie odblokowuje się na poziomie ${trainerLevel} (trenerzy personalni), a pozostałe role na poziomie ${restLevel}. Obecny poziom: ${level}.`,
    arrears: amount => `Zaległe wypłaty: ${amount}. Nikt z zaległością nie przyjdzie do pracy.`,
    none: 'Nikogo jeszcze nie zatrudniłeś. Wszystko robisz sam.',
    trainerFree: 'Wolny — do wzięcia przy recepcji',
    trainerBusy: 'Prowadzi trening',
    striking: amount => `Strajk — zalega ${amount}`,
    perDay: amount => `${amount} / dzień`,
    pay: amount => `Zapłać ${amount}`,
    fire: 'Zwolnij',
    full: 'Komplet',
    recruit: 'Rekrutacja',
  },

  recruit: {
    title: 'Rekrutacja',
    refresh: price => `Odśwież ${price}`,
    jobHint: {
      reception: seconds => `skan co ${seconds} s`,
      cleaner: seconds => `plama w ${seconds} s`,
      repair: seconds => `naprawa w ${seconds} s`,
      trainer: mult => `trening 1:1 — ×${mult} za wejście`,
    },
    perDay: amount => `${amount} / dzień`,
    tooPoor: amount => `Za mało gotówki — brakuje ${amount}`,
    fromLevel: level => `Od poziomu ${level}`,
    needsDesk: 'Brak biurka',
    full: 'Komplet',
    hire: price => `Zatrudnij za ${price}`,
    footer:
      'Pensja schodzi codziennie na zamknięciu dnia. Kto nie dostanie wypłaty, ten nie przyjdzie następnego dnia do pracy.',
  },

  upgrades: {
    title: 'Ulepszenia',
    hint:
      'Wszystko tutaj usprawnia to, co robisz własnymi rękami, i zostaje na zawsze. Personelu to nie dotyczy — sprzątacz na wypłacie myje podłogę własnym tempem.',
    level: (level, max) => `Poziom ${level} / ${max}`,
    current: value => `Teraz ${value}`,
    step: (from, to) => `${from} → ${to}`,
    maxed: 'Ulepszone do końca',
    buy: price => price,
    seconds: value => `${value}s`,
    mult: value => `×${value}`,
    blurb: {
      cleaning: 'Jak długo trzymasz, żeby zetrzeć plamę z podłogi.',
      repair: 'Jak długo trzymasz, żeby postawić zepsutą maszynę z powrotem na nogi.',
      earnings: 'Mnoży każdą wejściówkę, którą przyjmiesz. Karnety wycenia klasa siłowni i zostają poza tym.',
      luck: 'Lepsi klienci w drzwiach i więcej takich, którzy przy wyjściu kupują karnet.',
      patience: 'Jak długo ktoś czeka przy biurku, zanim odpuści i wyjdzie.',
    },
  },

  stats: {
    gym: 'Siłownia',
    reputation: 'Renoma',
    satisfaction: 'Zadowolenie',
    machines: 'Maszyny',
    gymClass: 'Klasa',
    members: 'Członkowie',
    dailyBill: 'Rachunek dzienny',
    balance: 'Bilans',
    earned: 'Zarobiono',
    spent: 'Wydano',
    served: 'Obsłużeni',
    lost: 'Straceni',
    progress: 'Postęp',
    level: 'Poziom',
    xp: 'XP',
    days: 'Dni',
    cash: 'Kasa',
  },

  inventory: {
    title: 'Ekwipunek',
    close: 'Zamknij',
    empty:
      'Pusto. Kup sprzęt albo meble w sklepie — wszystko, co kupisz, ląduje tutaj i czeka, aż wskażesz mu miejsce.',
    asNew: 'Jak nowa',
    condition: pct => `Stan ${pct}%`,
  },

  floors: {
    unlockTitle: 'Odblokuj 1. piętro',
    unlockCopy:
      'Parter jest już maksymalnie rozbudowany. Wykup kłódkę, aby otworzyć pustą kondygnację i powiększać siłownię dalej.',
    requirement: 'Wszystkie rozbudowy parteru',
    buy: price => `Wykup kłódkę · ${price}`,
    short: amount => `Brakuje ${amount}.`,
    pickTitle: 'Wybierz piętro',
    pickCopy: 'Każda kondygnacja zachowuje własny układ, sprzęt i rozbudowę.',
    here: 'Jesteś tutaj',
    goTo: 'Przejdź na piętro',
    ground: 'Parter',
    numbered: n => `${n}. piętro`,
    groundShort: 'P',
  },

  gameOver: {
    title: 'Komornik wbił',
    copy: 'Dług przekroczył −20 000. Sprzęt pojechał na licytację, a sala stoi pusta.',
    survived: 'Przetrwałeś',
    days: n => `${n} dni`,
    balance: 'Saldo',
    served: 'Obsłużeni',
    earned: 'Zarobiono',
    restart: 'Zacznij od nowa',
  },

  welcome: {
    title: 'Witaj z powrotem',
    copy: away => `Siłownia działała bez Ciebie przez ${away}. Klienci wchodzili, rachunki leciały dalej.`,
    balance: 'Bilans nieobecności',
    dismiss: 'Wracam do roboty',
  },

  // The three v2 systems keep their own dictionaries, so the branch
  // building one never has to open this file. See `i18n/marketing.ts`.
  marketing: marketingPl,
  contracts: contractsPl,
  sponsors: sponsorsPl,

  content: {
    machines: {
      dumbbells: 'Hantle',
      bench: 'Ławka płaska',
      treadmill: 'Bieżnia',
      latpulldown: 'Wyciąg górny',
      bike: 'Rower spinningowy',
      cable: 'Brama wielofunkcyjna',
    },

    decor: {
      plant: 'Roślina doniczkowa',
      locker: 'Szafka',
      watercooler: 'Dystrybutor wody',
      reception: 'Recepcja',
    },

    roles: {
      reception: 'Recepcjonista',
      cleaner: 'Sprzątacz',
      repair: 'Naprawa',
      trainer: 'Trener personalny',
    },

    expansions: {
      start: 'Sala startowa',
      annex: 'Przybudówka',
      wing: 'Nowe skrzydło',
      hall: 'Hala główna',
    },

    rarity: {
      common: 'Zwykły',
      rare: 'Rzadki',
      epic: 'Epicki',
      legend: 'Legendarny',
      influencer: 'Influencer',
      secret: 'Tajny',
    },

    upgrades: {
      cleaning: 'Sprzątanie',
      repair: 'Naprawa',
      earnings: 'Zarabianie',
      luck: 'Szczęście',
      patience: 'Cierpliwość',
    },
  },
}
