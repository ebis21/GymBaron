import type { CampaignId } from '../game/content/campaigns'

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
  campaigns: Record<CampaignId, CampaignCopy>
}

export const marketingEn: MarketingStrings = {
  title: 'Advertising',
  reportLine: 'Advertising',
  hint:
    'Campaigns stack — their multipliers multiply. Each starts now, lasts through the listed closing days, and adds its daily fee to every receipt.',
  activeTitle: 'Live campaign',
  remainingClosings: count => `${count} closing${count === 1 ? '' : 's'} left`,
  trafficTitle: 'Walk-in traffic',
  effect: multiplier => `${multiplier.toFixed(2).replace(/0$/, '')}× arrivals`,
  billing: price => `${price} at every close`,
  schedule: (days, price) => `${days} days · ${price} / day`,
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
  campaigns: {
    flyers: {
      name: 'Neighbourhood flyers',
      blurb: 'Cheap local reach for a gym finding its first regular crowd.',
    },
    social: {
      name: 'Local social ads',
      blurb: 'A steady push across feeds, maps and nearby fitness groups.',
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
  },
}

export const marketingPl: MarketingStrings = {
  title: 'Reklama',
  reportLine: 'Reklama',
  hint:
    'Kampanie można łączyć — ich mnożniki się mnożą. Każda startuje od razu, trwa przez podaną liczbę zamknięć i dokłada swoją opłatę do każdego paragonu.',
  activeTitle: 'Aktywne kampanie',
  remainingClosings: count => `Pozostałe zamknięcia: ${count}`,
  trafficTitle: 'Ruch z ulicy',
  effect: multiplier => `${multiplier.toFixed(2).replace('.', ',').replace(/0$/, '')}× wejść`,
  billing: price => `${price} przy każdym zamknięciu`,
  schedule: (days, price) => `${days} dni · ${price} / dzień`,
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
  campaigns: {
    flyers: {
      name: 'Ulotki na osiedlu',
      blurb: 'Tani lokalny zasięg dla siłowni, która zbiera pierwszą stałą ekipę.',
    },
    social: {
      name: 'Reklamy lokalne online',
      blurb: 'Stała promocja w socialach, mapach i pobliskich grupach fitness.',
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
  },
}
