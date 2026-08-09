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
export interface ContractStrings {
  title: string
  /** The line on the day's receipt, shown only when something was charged. */
  reportLine: string
  /** Shown by the screen until the feature does something. */
  empty: string
}

export const contractsEn: ContractStrings = {
  title: 'Contracts',
  reportLine: 'Equipment contracts',
  empty: 'No suppliers signed.',
}

export const contractsPl: ContractStrings = {
  title: 'Kontrakty',
  reportLine: 'Kontrakty sprzętowe',
  empty: 'Żaden dostawca nie jest podpisany.',
}
