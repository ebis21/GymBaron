import type { SupplierId } from '../game/content/suppliers'

/**
 * Everything equipment contracts put on screen, in both languages.
 *
 * OWNER: `feat/v2-equipment-contracts`. Nobody else edits this file.
 *
 * The names of the machines a contract unlocks are the one exception that goes
 * elsewhere: they belong to `t.content.machines`, which the compiler forces
 * open the moment `SupplierMachineTypeId` stops being `never`. That block in
 * `en.ts`/`pl.ts` is this branch's to edit, and nobody else's.
 */
export interface SupplierStrings {
  name: string
  /** One line on who they are, shown under the name. */
  blurb: string
}

export interface ContractStrings {
  title: string
  hint: string
  /** The line on the day's receipt, shown only when something was charged. */
  reportLine: string
  /** Shown by the screen until the feature does something. */
  empty: string
  supplier: Record<SupplierId, SupplierStrings>
  signingFee: string
  dailyFee: (amount: string) => string
  unlocks: (count: number) => string
  sign: (price: string) => string
  cancel: string
  held: string
  needsLevel: (level: number) => string
  needsSupplier: (name: string) => string
  short: (amount: string) => string
  /** Reassurance on the cancel button; the fear it answers is real. */
  keepsKit: string
}

export const contractsEn: ContractStrings = {
  title: 'Contracts',
  hint:
    'A contract opens a supplier’s catalogue: five machines, each one earning more than the last. It costs a fee to sign and a fee every day you hold it, whether you buy from them or not.',
  reportLine: 'Equipment contracts',
  empty: 'No supplier will deal with a gym this size yet.',
  supplier: {
    ferrum: {
      name: 'Ferrum Works',
      blurb: 'Regional steel shop. Heavy, honest kit at twice the takings of the starting six.',
    },
    apex: {
      name: 'Apex Athletic',
      blurb: 'National brand, Ferrum gyms only. Earns like nothing else and bleeds power to match.',
    },
  },
  signingFee: 'To sign',
  dailyFee: amount => `${amount} / day while held`,
  unlocks: count => `Unlocks ${count} machines`,
  sign: price => `Sign · ${price}`,
  cancel: 'End contract',
  held: 'Signed',
  needsLevel: level => `Deals from level ${level}`,
  needsSupplier: name => `Requires a ${name} contract`,
  short: amount => `Short by ${amount}`,
  keepsKit: 'Ending a contract stops the daily fee. Everything you have already bought stays.',
}

export const contractsPl: ContractStrings = {
  title: 'Kontrakty',
  hint:
    'Kontrakt otwiera katalog dostawcy: pięć maszyn, każda zarabia więcej od poprzedniej. Płacisz za podpis i płacisz codziennie, dopóki go trzymasz — niezależnie od tego, czy coś u nich kupujesz.',
  reportLine: 'Kontrakty sprzętowe',
  empty: 'Żaden dostawca nie chce jeszcze rozmawiać z siłownią tej wielkości.',
  supplier: {
    ferrum: {
      name: 'Ferrum Works',
      blurb: 'Regionalna stalownia. Ciężki, uczciwy sprzęt — dwa razy większy utarg niż startowa szóstka.',
    },
    apex: {
      name: 'Apex Athletic',
      blurb: 'Marka ogólnokrajowa, tylko dla siłowni z Ferrum. Zarabia jak nic innego i tyle samo pali prądu.',
    },
  },
  signingFee: 'Za podpis',
  dailyFee: amount => `${amount} / dzień, dopóki trzymasz`,
  unlocks: count => `Odblokowuje ${count} maszyn`,
  sign: price => `Podpisz · ${price}`,
  cancel: 'Zerwij kontrakt',
  held: 'Podpisany',
  needsLevel: level => `Rozmawiają od poziomu ${level}`,
  needsSupplier: name => `Wymaga kontraktu z ${name}`,
  short: amount => `Brakuje ${amount}`,
  keepsKit: 'Zerwanie kontraktu zatrzymuje dzienną opłatę. Wszystko, co już kupiłeś, zostaje.',
}
