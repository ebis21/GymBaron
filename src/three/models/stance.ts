import type { MachineTypeId } from '../../game/types'
import {
  poseBenchPress,
  poseCablePull,
  poseCurl,
  poseCycle,
  poseRun,
  poseSeatedPull,
  type Pose,
} from './character'

/**
 * Where a client stands — or sits, or lies — to use a machine, in the
 * machine's own local space. Every number here is read off the model: the
 * saddle of the bike is 1.15 up, so that is where the hips go, and the head
 * end of the bench is where the bar is, so that is where the head goes.
 *
 * Before this existed everybody was parked half a tile in front of whatever
 * they were using and told to wave their arms, which on a flat bench left them
 * standing on top of it.
 */
export interface Stance {
  /** Offset from the machine's centre, along its local X and Z. */
  x: number
  z: number
  /** Height of the feet: a treadmill deck and a saddle are not the floor. */
  lift: number
  /** Turn away from the machine's own facing, in radians. */
  facing: number
  pose: Pose
}

export const STANCES: Record<MachineTypeId, Stance> = {
  // In front of the rack, facing the shelves.
  dumbbells: { x: 0, z: 0.86, lift: 0, facing: Math.PI, pose: poseCurl },

  // Lying along the pad, head under the bar at the machine's −X end. The
  // quarter turn is what puts the figure's own −Z there. The lift stays at
  // zero — the pose raises the hips to the pad on its own, and the feet still
  // want to hang towards the floor.
  bench: { x: 0.16, z: 0, lift: 0, facing: Math.PI / 2, pose: poseBenchPress },

  // Up on the belt, facing the console.
  treadmill: { x: 0, z: 0.22, lift: 0.52, facing: Math.PI, pose: poseRun },

  // On the seat, under the bar.
  latpulldown: { x: 0, z: 0.18, lift: 0.23, facing: Math.PI, pose: poseSeatedPull },

  // On the saddle, reaching for the bars.
  bike: { x: 0, z: 0.24, lift: 0.63, facing: Math.PI, pose: poseCycle },

  // Between the two towers, a handle in each hand.
  cable: { x: 0, z: 0.62, lift: 0, facing: Math.PI, pose: poseCablePull },
}

export const stanceFor = (type: MachineTypeId): Stance => STANCES[type]
