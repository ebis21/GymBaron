import type { ClientRarity, DecorTypeId, MachineTypeId, StaffRole } from '../game/types'
import type { ExpansionId } from '../game/content/expansion'
import type { UpgradeId } from '../game/content/upgrades'
import { marketingEn } from './marketing'
import { contractsEn } from './contracts'
import { sponsorsEn } from './sponsors'

/**
 * English is the source of truth: `Strings` is inferred from this object, so
 * every other language is checked against it and a missing key is a compile
 * error rather than a blank label discovered in play.
 *
 * Anything the player reads lives here, including the names of machines,
 * furniture and job titles — those used to sit in the content tables, which
 * meant the shop and the tags over employees' heads each had their own idea of
 * what a thing was called.
 */
export const en = {
  /** Written in their own language on purpose — that is how you find yours. */
  languageName: { en: 'English', pl: 'Polski' },

  loading: 'Opening the gym…',

  settings: {
    title: 'Settings',
    language: 'Language',
    close: 'Close',
  },

  topbar: {
    afterHours: 'After hours',
    day: (n: number) => `Day ${n}`,
    cash: 'Cash',
    members: 'Members',
    renewal: (days: number) => `pass in ${days} ${days === 1 ? 'day' : 'days'}`,
    gymClass: 'Class',
    reputation: 'Reputation',
    hours: '8:00 → 20:00',
    settings: 'Settings',
    debt: 'You are in the red. Below −20,000 the bailiff moves in.',
  },

  phone: {
    show: 'Show phone',
    hide: 'Hide phone',
    day: (n: number) => `Day ${n}`,
    apps: {
      gym: 'Floor',
      build: 'Build',
      shop: 'Shop',
      stats: 'Stats',
      staff: 'Staff',
      upgrades: 'Upgrades',
      marketing: 'Marketing',
      contracts: 'Contracts',
      sponsors: 'Sponsors',
    },
  },

  build: {
    pickTile: 'Pick a new tile…',
    pickEdge: 'Pick a new edge…',
    pickEdgeForWall: 'Click a tile edge…',
    pickTileForItem: 'Pick a tile for the item…',
    cancel: 'Cancel',
    wall: 'Partition',
    rotate: 'Rotate',
    move: 'Move',
    store: 'Put away',
    idle: 'Click equipment, a partition, or an empty tile',
    inventory: (n: number) => `Inventory (${n})`,
    shop: 'Shop',
    done: '✓ Done',
    bagOnEdge: 'Partitions go on an edge — pick one, then click a tile edge.',
    bagOnTile: 'Pick an item, then show it where to stand.',
  },

  action: {
    repair: (cost: string) => `Repair ${cost}`,
    clean: 'Clean up',
    serve: 'Serve client',
    member: 'Member',
    passerby: 'Passer-by',
    floorPick: 'Pick a floor',
    floorUnlock: 'Unlock floor',
    remaining: (seconds: string) => `${seconds}s left`,
    hold: 'hold',
  },

  dev: {
    levelUp: 'Level +1',
    staffLevel: (level: number) => `Level ${level} (staff)`,
    teleport: 'Teleport to reception',
    closingTime: 'Skip to 20:00',
    summonLilD: 'Summon LIL D.',
    rankShowcase: 'Rank showcase ♀/♂',
    restart: 'Restart save',
  },

  closing: {
    title: 'After hours',
    stillInside: (n: number) =>
      `Nobody else is coming in — ${n} ${n === 1 ? 'person is' : 'people are'} finishing up.`,
    empty: 'The floor is empty. Build, clean up — close when you are done.',
    closeDay: 'Close the day',
  },

  shop: {
    equipment: 'Equipment',
    equipmentHint:
      'The multiplier raises the door fee on that machine, and whatever it carries above 1.0 feeds the gym class — which is the price of every pass. Anything you buy goes to your inventory.',
    furniture: 'Furniture',
    furnitureHint: 'None of it earns anything and it all takes a tile — you buy it for the look.',
    partitions: 'Partitions',
    partitionsHint:
      'They stand on tile edges, so they cost no equipment space. In build mode take one from your inventory and click a tile edge. Clicking a partition selects it — then you can move it or put it back.',
    partitionName: 'Partition',
    partitionMeta: 'One segment per edge',
    expansion: 'Expansion',
    expansionHint: (w: number, h: number) =>
      `More tiles for equipment. Everything already standing keeps its tile — the room grows around it. Right now you have ${w} × ${h} tiles.`,
    expansionMeta: (w: number, h: number, extra: number) =>
      `${w} × ${h} tiles · ${extra} more`,
    biggest: 'The biggest room — nothing left to buy',
    needsLevel: (level: number) => `Requires level ${level}`,
    short: (amount: string) => `${amount} short`,
    machineMeta: (power: string, seconds: number, repair: string) =>
      `Power ${power}/day · Workout ${seconds}s · Repair ${repair}`,
    machineMult: (mult: string, fee: string, classGain: string) =>
      `×${mult} · door fee ${fee} · class +${classGain}`,
  },

  client: {
    close: 'Close',
    secretKind: 'Special guest · pays in a thick wad of cash',
    memberKind: (off: number) => `Member — on a pass, ${off}% off`,
    passerbyKind: (appearance: string) => `Passer-by · ${appearance}`,
    woman: 'woman',
    man: 'man',
    noteValue: 'Note value',
    guestMultiplier: 'Guest multiplier',
    reputation: 'Reputation',
    freeStation: 'Free station',
    trainer: 'Personal trainer',
    trainerOffer: (free: number) => `×1.5 per visit · ${free} free`,
    trainersBusy: 'Every trainer is busy right now.',
    trainersHire: 'Hire a trainer in Staff to sell ×1.5 sessions.',
    trainersLocked: (level: number) => `Personal trainers from level ${level}.`,
    takeCash: (amount: string) => `Take the cash · +${amount}?`,
    scan: (amount: string) => `Scan pass · +${amount}`,
    noMachine: 'No machine free',
  },

  report: {
    closingTime: '20:00 — closing',
    title: (day: number) => `Day ${day} takings`,
    income: 'Income',
    doorFees: 'Door fees',
    trainerFees: '↳ of which trainer sessions',
    passes: 'Passes',
    total: 'Total',
    counterfeitTitle: 'Trouble at the till',
    counterfeit: 'Counterfeit money — LIL D.',
    counterfeitNote:
      'The notes looked legitimate. Only the evening count turned up the con.',
    due: 'To pay',
    rent: 'Rent',
    power: 'Power',
    memberUpkeep: 'Member upkeep',
    wages: 'Wages',
    bill: 'Bill',
    net: 'Day balance',
    cashLabel: 'Cash:',
    served: (n: number) => `Served: ${n}`,
    lost: (n: number) => `Lost: ${n}`,
    signups: (n: number) => `New members: +${n}`,
    churn: (n: number) => `Left: −${n}`,
    lostHint: (n: number) =>
      `${n === 1 ? 'One client walked out' : `${n} clients walked out`} without training. Every one unscanned is a lost door fee and a lost shot at a pass.`,
    nextDay: 'Next day →',
  },

  staff: {
    title: 'Staff',
    locked: (trainerLevel: number, restLevel: number, level: number) =>
      `Hiring opens at level ${trainerLevel} (personal trainers) and the other roles at level ${restLevel}. You are level ${level}.`,
    arrears: (amount: string) =>
      `Unpaid wages: ${amount}. Nobody owed money turns up for work.`,
    none: 'You have not hired anybody yet. You do all of it yourself.',
    trainerFree: 'Free — available at reception',
    trainerBusy: 'Running a session',
    striking: (amount: string) => `On strike — owed ${amount}`,
    perDay: (amount: string) => `${amount} / day`,
    pay: (amount: string) => `Pay ${amount}`,
    fire: 'Fire',
    full: 'Full house',
    recruit: 'Recruit',
  },

  recruit: {
    title: 'Recruit',
    refresh: (price: string) => `Refresh ${price}`,
    jobHint: {
      reception: (seconds: string) => `scan every ${seconds}s`,
      cleaner: (seconds: string) => `a stain in ${seconds}s`,
      repair: (seconds: string) => `a repair in ${seconds}s`,
      trainer: (mult: number) => `1:1 session — ×${mult} per visit`,
    },
    perDay: (amount: string) => `${amount} / day`,
    tooPoor: (amount: string) => `Not enough cash — ${amount} short`,
    fromLevel: (level: number) => `From level ${level}`,
    needsDesk: 'No front desk',
    full: 'Full house',
    hire: (price: string) => `Hire for ${price}`,
    footer:
      'Wages come out at the close of every day. Anybody who goes unpaid does not turn up the next morning.',
  },

  upgrades: {
    title: 'Upgrades',
    hint:
      'Everything here sharpens what you do yourself, and none of it wears off. Your staff are unaffected — a cleaner you pay a wage to mops at their own speed.',
    level: (level: number, max: number) => `Level ${level} / ${max}`,
    current: (value: string) => `Now ${value}`,
    step: (from: string, to: string) => `${from} → ${to}`,
    maxed: 'Fully upgraded',
    buy: (price: string) => price,
    seconds: (value: string) => `${value}s`,
    mult: (value: string) => `×${value}`,
    blurb: {
      cleaning: 'How long you hold to wipe a stain off the floor.',
      repair: 'How long you hold to bring a dead machine back into service.',
      earnings: 'Multiplies every door fee you take. Passes are priced by gym class and stay out of it.',
      luck: 'Better clients through the door, and more of them buying a pass on the way out.',
      patience: 'How long somebody waits at the desk before giving up and walking out.',
    } satisfies Record<UpgradeId, string>,
  },

  stats: {
    gym: 'Gym',
    reputation: 'Reputation',
    satisfaction: 'Satisfaction',
    machines: 'Machines',
    gymClass: 'Class',
    members: 'Members',
    dailyBill: 'Daily bill',
    balance: 'Balance',
    earned: 'Earned',
    spent: 'Spent',
    served: 'Served',
    lost: 'Lost',
    progress: 'Progress',
    level: 'Level',
    xp: 'XP',
    days: 'Days',
    cash: 'Cash',
  },

  inventory: {
    title: 'Inventory',
    close: 'Close',
    empty:
      'Empty. Buy equipment or furniture in the shop — everything you buy lands here and waits for you to place it.',
    asNew: 'As new',
    condition: (pct: number) => `Condition ${pct}%`,
  },

  floors: {
    unlockTitle: 'Unlock the 1st floor',
    unlockCopy:
      'The ground floor is fully built out. Buy the padlock to open an empty storey and keep growing.',
    requirement: 'Every ground-floor expansion',
    buy: (price: string) => `Buy the padlock · ${price}`,
    short: (amount: string) => `${amount} short.`,
    pickTitle: 'Pick a floor',
    pickCopy: 'Each storey keeps its own layout, equipment and expansion.',
    here: 'You are here',
    goTo: 'Go to this floor',
    ground: 'Ground floor',
    numbered: (n: number) => `Floor ${n}`,
    groundShort: 'G',
  },

  gameOver: {
    title: 'The bailiff arrived',
    copy: 'The debt passed −20,000. The kit went to auction and the floor stands empty.',
    survived: 'You lasted',
    days: (n: number) => `${n} days`,
    balance: 'Balance',
    served: 'Served',
    earned: 'Earned',
    restart: 'Start over',
  },

  welcome: {
    title: 'Welcome back',
    copy: (away: string) =>
      `The gym ran without you for ${away}. Clients came in and the bills kept coming.`,
    balance: 'While you were away',
    dismiss: 'Back to work',
  },

  // The three v2 systems keep their own dictionaries, so the branch
  // building one never has to open this file. See `i18n/marketing.ts`.
  marketing: marketingEn,
  contracts: contractsEn,
  sponsors: sponsorsEn,

  content: {
    machines: {
      dumbbells: 'Dumbbells',
      bench: 'Flat bench',
      treadmill: 'Treadmill',
      latpulldown: 'Lat pulldown',
      bike: 'Spin bike',
      cable: 'Cable crossover',
    } satisfies Record<MachineTypeId, string>,

    decor: {
      plant: 'Potted plant',
      locker: 'Locker',
      watercooler: 'Water cooler',
      reception: 'Front desk',
    } satisfies Record<DecorTypeId, string>,

    roles: {
      reception: 'Receptionist',
      cleaner: 'Cleaner',
      repair: 'Repairs',
      trainer: 'Personal trainer',
    } satisfies Record<StaffRole, string>,

    expansions: {
      start: 'Starter room',
      annex: 'Annex',
      wing: 'New wing',
      hall: 'Main hall',
    } satisfies Record<ExpansionId, string>,

    upgrades: {
      cleaning: 'Cleaning',
      repair: 'Repairs',
      earnings: 'Earnings',
      luck: 'Luck',
      patience: 'Patience',
    } satisfies Record<UpgradeId, string>,

    /**
     * The tier words on the tags over clients' heads stay English in both
     * languages — see `RARITY_LABEL`. These are the prose forms, used where a
     * sentence needs the tier rather than the tag.
     */
    rarity: {
      common: 'Common',
      rare: 'Rare',
      epic: 'Epic',
      legend: 'Legendary',
      influencer: 'Influencer',
      secret: 'Secret',
    } satisfies Record<ClientRarity, string>,
  },
}

export type Strings = typeof en
