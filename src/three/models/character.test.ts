import { describe, expect, it } from 'vitest'
import { animate, buildNpc } from './character'

describe('character accessories', () => {
  it('puts LIL D. cane in his right hand and cash in his left', () => {
    const rig = buildNpc('walkin', 'secret', 1)
    const cane = rig.root.getObjectByName('accessory-cane')
    const cash = rig.root.getObjectByName('accessory-cash')

    expect(cane?.parent).toBe(rig.armR)
    expect(cash?.parent).toBe(rig.armL)
    expect(rig.stowDuringWorkout).toEqual(expect.arrayContaining([cane, cash]))
    expect(rig.steadyRightArm).toBe(true)
    expect(cane?.getObjectByName('cane-tip')?.position.y).toBeLessThan(-1)
  })

  it('keeps the cane arm planted during the walk cycle', () => {
    const rig = buildNpc('walkin', 'secret', 1)
    animate(rig, 0.25, true)

    expect(rig.armR.rotation.x).toBeCloseTo(0.03)
    expect(Math.abs(rig.armL.rotation.x)).toBeGreaterThan(0.1)
  })

  it('hangs the influencer chain from the torso and puts the syringe in hand', () => {
    const rig = buildNpc('walkin', 'influencer', 1)
    const chain = rig.root.getObjectByName('accessory-chain')
    const medallion = rig.root.getObjectByName('chain-medallion')
    const syringe = rig.root.getObjectByName('accessory-syringe')

    expect(chain?.parent).toBe(rig.hips)
    expect(medallion?.parent).toBe(chain)
    expect(syringe?.parent).toBe(rig.armR)
    expect(rig.stowDuringWorkout).toContain(syringe)
  })

  it('gives members a corded lanyard attached to the torso', () => {
    const rig = buildNpc('member', 'common', 2)
    const lanyard = rig.root.getObjectByName('accessory-lanyard')

    expect(lanyard?.parent).toBe(rig.hips)
    expect(lanyard?.children.length).toBe(3)
  })
})
