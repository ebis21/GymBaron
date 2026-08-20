import type { ConditionKind, SponsorId } from '../game/content/sponsors'

/**
 * Everything sponsorship puts on screen, in both languages.
 *
 * OWNER: `feat/v2-sponsors`. Nobody else edits this file.
 *
 * Brand names live here rather than in `content/sponsors.ts` for the same
 * reason machine names do: the content table decides what a deal is worth, and
 * what it is called follows whoever is reading.
 */
export interface SponsorStrings {
  title: string
  /** The line on the day's receipt, shown only when a deal paid out. */
  reportLine: string
  hint: string
  /** Shown in place of the running-deal panel when nothing is signed. */
  empty: string
  perDay: (money: string) => string
  running: string
  /** A deal signed today is not judged until tomorrow; the panel says so. */
  startsTomorrow: string
  paidLastClose: string
  /** How many days in a row have been missed, out of what ends the deal. */
  strikes: (missed: number, of: number) => string
  missed: (conditions: string) => string
  lapsed: string
  lapsedHint: (money: string) => string
  sign: string
  resign: (money: string) => string
  drop: string
  /** Why the sign button is refusing, in the order the screen checks them. */
  needsStanding: string
  short: (money: string) => string
  /** A condition and the bar it has to clear. */
  condition: Record<ConditionKind, (target: number) => string>
  /** Where the gym stands on it right now. */
  progress: (current: number, target: number) => string
  names: Record<SponsorId, string>
  blurb: Record<SponsorId, string>
}

export const sponsorsEn: SponsorStrings = {
  title: 'Sponsors',
  reportLine: 'Sponsorship',
  hint: 'A brand pays every day the gym meets its standard. Miss three days in a row and the deal is off.',
  empty: 'No deal running. Sign one below.',
  perDay: money => `${money} a day`,
  running: 'Running',
  startsTomorrow: 'Starts tomorrow',
  paidLastClose: 'Paid at the last close',
  strikes: (missed, of) => `Missed ${missed} of ${of} days`,
  missed: conditions => `Last close paid nothing: ${conditions}`,
  lapsed: 'Broken',
  lapsedHint: money => `Signing this one again costs ${money}.`,
  sign: 'Sign',
  resign: money => `Sign again — ${money}`,
  drop: 'End deal',
  needsStanding: 'The gym does not meet this brand yet',
  short: money => `${money} short`,
  condition: {
    reputation: n => `Reputation ${n} or better`,
    machines: n => `${n} machines on the floor`,
    clientsServed: n => `${n} clients served in a day`,
    cleanliness: n => (n === 1 ? 'Never more than one stain' : `Never more than ${n} stains`),
  },
  progress: (current, target) => `${current} / ${target}`,
  names: {
    'juice-bar': 'Kale & Kettle',
    'city-apparel': 'Ironside Apparel',
    supplements: 'Titan Supps',
    'energy-drink': 'Voltcan Energy',
    global: 'Meridian Global',
  },
  blurb: {
    'juice-bar': 'The juice bar two doors down. Wants a name worth standing next to.',
    'city-apparel': 'Gym wear cut in the city. Pays for a room people actually turn up to.',
    supplements: 'Tubs by the till. Cares about the kit, not the crowd.',
    'energy-drink': 'Cans in every fridge. Busy, well thought of, and spotless.',
    global: 'The badge everyone knows. It signs one gym in a city and expects it to stay at the top.',
  },
}

export const sponsorsPl: SponsorStrings = {
  title: 'Sponsorzy',
  reportLine: 'Sponsoring',
  hint: 'Marka płaci każdego dnia, w którym siłownia trzyma poziom. Trzy nietrafione dni z rzędu kończą umowę.',
  empty: 'Żadna umowa nie działa. Podpisz którąś poniżej.',
  perDay: money => `${money} dziennie`,
  running: 'W trakcie',
  startsTomorrow: 'Rusza jutro',
  paidLastClose: 'Wypłacone przy ostatnim zamknięciu',
  strikes: (missed, of) => `Nietrafione dni: ${missed} z ${of}`,
  missed: conditions => `Ostatnie zamknięcie nie zapłaciło: ${conditions}`,
  lapsed: 'Zerwana',
  lapsedHint: money => `Ponowne podpisanie tej umowy kosztuje ${money}.`,
  sign: 'Podpisz',
  resign: money => `Podpisz ponownie — ${money}`,
  drop: 'Zakończ umowę',
  needsStanding: 'Siłownia jeszcze nie spełnia wymagań tej marki',
  short: money => `brakuje ${money}`,
  condition: {
    reputation: n => `Reputacja co najmniej ${n}`,
    machines: n => `${n} maszyn na sali`,
    clientsServed: n => `${n} obsłużonych klientów dziennie`,
    cleanliness: n => (n === 1 ? 'Nigdy więcej niż jedna plama' : `Nigdy więcej niż ${n} plamy`),
  },
  progress: (current, target) => `${current} / ${target}`,
  names: {
    'juice-bar': 'Zielony Shaker',
    'city-apparel': 'Odzież Ironside',
    supplements: 'Titan Suplementy',
    'energy-drink': 'Voltcan Energia',
    global: 'Meridian Global',
  },
  blurb: {
    'juice-bar': 'Pijalnia soków dwa numery dalej. Chce nazwiska, przy którym warto stanąć.',
    'city-apparel': 'Odzież szyta w mieście. Płaci za salę, do której ludzie faktycznie przychodzą.',
    supplements: 'Puszki przy ladzie. Patrzy na sprzęt, nie na tłum.',
    'energy-drink': 'Napoje w każdej lodówce. Ruch, dobra opinia i czysto.',
    global: 'Logo, które zna każdy. Podpisuje jedną siłownię w mieście i wymaga, żeby została na szczycie.',
  },
}
