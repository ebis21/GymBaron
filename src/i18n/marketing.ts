import type { CampaignId } from '../game/content/campaigns'
import type { RequirementKind } from '../game/marketing'

/**
 * Everything advertising puts on screen, in both languages.
 *
 * OWNER: `feat/v2-marketing`. Nobody else edits this file.
 *
 * It lives apart from `en.ts`/`pl.ts` for one reason: those two files are the
 * single place all three v2 branches would otherwise be inserting keys at
 * once. Here the owner adds whatever they like, and the shared dictionaries
 * keep the one import line they already have.
 */
interface CampaignCopy {
  name: string
  blurb: string
}

export interface MarketingStrings {
  title: string
  /** The line on the day's receipt, shown only when something was spent. */
  reportLine: string
  hint: string
  activeTitle: string
  remainingClosings: (count: number) => string
  trafficTitle: string
  effect: (multiplier: number) => string
  billing: (price: string) => string
  schedule: (days: number, price: string) => string
  start: string
  running: string
  alreadyRunning: string
  closed: string
  short: (amount: string) => string
  /** Combined daily fee of every campaign live at once. */
  totalBilling: (price: string) => string
  /** What the gym can actually get through in a day, desks and kit together. */
  capacityTitle: string
  capacity: (servable: number) => string
  /** Shown per offer: what it would bring in, against what can be served. */
  projected: (arrivals: number) => string
  shortReception: (arrivals: number, servable: number) => string
  shortMachines: (arrivals: number, servable: number) => string
  /** What the offer would leave behind once its own fee is paid, either way. */
  gain: (money: string) => string
  loss: (money: string) => string
  /** The one bar a locked offer is short of, and what it would take to clear it. */
  locked: Record<RequirementKind, (target: number) => string>
  campaigns: Record<CampaignId, CampaignCopy>
}

export const marketingEn: MarketingStrings = {
  title: 'Advertising',
  reportLine: 'Advertising',
  hint:
    'Campaigns stack — their multipliers multiply. Each starts now, lasts through the listed closing days, and adds its daily fee to every receipt. The bigger offers open up as the gym grows into them.',
  activeTitle: 'Live campaign',
  remainingClosings: count => `${count} closing${count === 1 ? '' : 's'} left`,
  trafficTitle: 'Walk-in traffic',
  effect: multiplier => `${multiplier.toFixed(2).replace(/0$/, '')}× arrivals`,
  billing: price => `${price} at every close`,
  schedule: (days, price) => `${days} day${days === 1 ? '' : 's'} · ${price} / day`,
  start: 'Start',
  running: 'Live',
  alreadyRunning: 'Already live.',
  closed: 'The doors are closed. Start one tomorrow.',
  short: amount => `${amount} short for the first bill.`,
  totalBilling: price => `${price} in total at every close`,
  capacityTitle: 'What you can serve',
  capacity: servable => `About ${servable} workouts a day, desks and kit together.`,
  projected: arrivals => `Would bring in about ${arrivals} a day.`,
  shortReception: (arrivals, servable) =>
    `About ${arrivals} a day against a reception that can scan about ${servable}. Add a desk and a receptionist first, or the rest walk out of the door.`,
  shortMachines: (arrivals, servable) =>
    `About ${arrivals} a day against kit that seats about ${servable}. Buy more machines first, or the rest walk out of the door.`,
  gain: money => `About ${money} a day left over once the fee is paid.`,
  loss: money => `About ${money} a day short of paying for itself.`,
  locked: {
    reputation: target => `Opens at a reputation of ${target}.`,
    machines: target => `Opens at ${target} machines in the building.`,
    members: target => `Opens at ${target} members on the books.`,
  },
  campaigns: {
    flyers: {
      name: 'Neighbourhood flyers',
      blurb: 'Cheap local reach for a gym finding its first regular crowd.',
    },
    referral: {
      name: 'Member referral scheme',
      blurb: 'Barely moves the door. Turns far more of the crowd you already have into passes.',
    },
    social: {
      name: 'Local social ads',
      blurb: 'A steady push across feeds, maps and nearby fitness groups.',
    },
    premium: {
      name: 'Premium positioning',
      blurb: 'A quarter more people, and a better class of them. Sells the clientele, not the queue.',
    },
    openDay: {
      name: 'Open day',
      blurb: 'One day at triple the footfall. Ruinous if the floor cannot seat them.',
    },
    billboards: {
      name: 'City billboards',
      blurb: 'Expensive reach that pays only when a strong reputation backs it up.',
    },
    influencer: {
      name: 'Influencer partnership',
      blurb: 'A known name trains here on camera. Fills a big floor that a billboard cannot.',
    },
    tv: {
      name: 'Television spot',
      blurb: 'The whole city hears about it. Only worth it with the kit and the desk to cope.',
    },
    national: {
      name: 'National campaign',
      blurb: 'The whole country learns the name. What a gym buys when there is nothing left to buy.',
    },
  },
}

export const marketingPl: MarketingStrings = {
  title: 'Reklama',
  reportLine: 'Reklama',
  hint:
    'Kampanie można łączyć — ich mnożniki się mnożą. Każda startuje od razu, trwa przez podaną liczbę zamknięć i dokłada swoją opłatę do każdego paragonu. Większe oferty otwierają się, gdy siłownia do nich dorośnie.',
  activeTitle: 'Aktywne kampanie',
  remainingClosings: count => `Pozostałe zamknięcia: ${count}`,
  trafficTitle: 'Ruch z ulicy',
  effect: multiplier => `${multiplier.toFixed(2).replace('.', ',').replace(/0$/, '')}× wejść`,
  billing: price => `${price} przy każdym zamknięciu`,
  schedule: (days, price) => `${days} ${days === 1 ? 'dzień' : 'dni'} · ${price} / dzień`,
  start: 'Uruchom',
  running: 'Trwa',
  alreadyRunning: 'Już trwa.',
  closed: 'Drzwi są już zamknięte. Wróć jutro.',
  short: amount => `Do pierwszej opłaty brakuje ${amount}.`,
  totalBilling: price => `${price} łącznie przy każdym zamknięciu`,
  capacityTitle: 'Ile obsłużysz',
  capacity: servable => `Około ${servable} treningów dziennie — biurka i sprzęt razem.`,
  projected: arrivals => `Ściągnie około ${arrivals} osób dziennie.`,
  shortReception: (arrivals, servable) =>
    `Około ${arrivals} osób dziennie, a recepcja zeskanuje około ${servable}. Dostaw biurko i zatrudnij recepcjonistę, bo reszta odejdzie od drzwi.`,
  shortMachines: (arrivals, servable) =>
    `Około ${arrivals} osób dziennie, a sprzęt obsłuży około ${servable}. Dokup maszyny, bo reszta odejdzie od drzwi.`,
  gain: money => `Po opłacie zostaje około ${money} dziennie.`,
  loss: money => `Około ${money} dziennie brakuje jej na własną opłatę.`,
  locked: {
    reputation: target => `Otwiera się przy reputacji ${target}.`,
    machines: target => `Otwiera się przy ${target} maszynach w budynku.`,
    members: target => `Otwiera się przy ${target} członkach.`,
  },
  campaigns: {
    flyers: {
      name: 'Ulotki na osiedlu',
      blurb: 'Tani lokalny zasięg dla siłowni, która zbiera pierwszą stałą ekipę.',
    },
    referral: {
      name: 'Program poleceń',
      blurb: 'Ledwie rusza drzwiami. Za to o wiele więcej osób z obecnego tłumu kupuje karnet.',
    },
    social: {
      name: 'Reklamy lokalne online',
      blurb: 'Stała promocja w socialach, mapach i pobliskich grupach fitness.',
    },
    premium: {
      name: 'Pozycjonowanie premium',
      blurb: 'Ćwierć osób więcej i lepsza klasa gości. Sprzedaje klientelę, nie kolejkę.',
    },
    openDay: {
      name: 'Dzień otwarty',
      blurb: 'Jeden dzień na potrójnym ruchu. Zgubny, jeśli sala nie ma ich gdzie posadzić.',
    },
    billboards: {
      name: 'Billboardy w mieście',
      blurb: 'Drogi zasięg, który zwraca się dopiero przy mocnej reputacji.',
    },
    influencer: {
      name: 'Współpraca z influencerem',
      blurb: 'Znane nazwisko trenuje u ciebie na wizji. Zapełni dużą salę, na co billboard już nie starcza.',
    },
    tv: {
      name: 'Spot telewizyjny',
      blurb: 'Usłyszy o tobie całe miasto. Opłaca się tylko przy sprzęcie i recepcji, które to udźwigną.',
    },
    national: {
      name: 'Kampania ogólnokrajowa',
      blurb: 'Twoją nazwę poznaje cały kraj. To, co kupuje siłownia, której nie zostało już co kupować.',
    },
  },
}
