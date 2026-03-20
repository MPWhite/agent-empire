import { describe, it, expect } from 'vitest';
import { resolveCombat } from '../combat.js';

describe('resolveCombat', () => {
  it('favors attacker at 3:1 ratio', () => {
    const result = resolveCombat(9, 3);
    // 3:1 ratio: attackerStrength=0.7, defenderStrength=0.2
    // defenderLosses = min(3, ceil(3 * 0.7)) = min(3, ceil(2.1)) = min(3, 3) = 3
    // attackerLosses = floor(9 * 0.2) = 1
    expect(result.defenderLosses).toBe(3);
    expect(result.attackerLosses).toBe(1);
    expect(result.conquered).toBe(true);
  });

  it('is even at 1:1 ratio', () => {
    const result = resolveCombat(5, 5);
    // 1:1 ratio: attackerStrength=0.4, defenderStrength=0.4
    // defenderLosses = min(5, ceil(5 * 0.4)) = ceil(2.0) = 2
    // attackerLosses = floor(5 * 0.4) = 2
    expect(result.defenderLosses).toBe(2);
    expect(result.attackerLosses).toBe(2);
    expect(result.conquered).toBe(false);
  });

  it('favors defender at 1:2 ratio', () => {
    const result = resolveCombat(3, 6);
    // 0.5 ratio: attackerStrength=0.3, defenderStrength=0.5
    // defenderLosses = min(6, ceil(6 * 0.3)) = ceil(1.8) = 2
    // attackerLosses = floor(3 * 0.5) = 1
    expect(result.defenderLosses).toBe(2);
    expect(result.attackerLosses).toBe(1);
    expect(result.conquered).toBe(false);
  });

  it('conquers when attacker overwhelms', () => {
    const result = resolveCombat(10, 2);
    // 5:1 ratio: attackerStrength=0.9, defenderStrength=0.1
    // defenderLosses = min(2, ceil(2 * 0.9)) = min(2, 2) = 2
    // attackerLosses = floor(10 * 0.1) = 1
    // defenders remaining = 0, attackers remaining = 9
    expect(result.conquered).toBe(true);
    expect(result.defenderLosses).toBe(2);
    expect(result.attackerLosses).toBe(1);
  });

  it('does not conquer when defenders survive', () => {
    const result = resolveCombat(3, 10);
    // 0.3 ratio: attackerStrength=0.2, defenderStrength=0.6
    // defenderLosses = min(10, ceil(10 * 0.2)) = 2
    // attackerLosses = floor(3 * 0.6) = 1
    expect(result.conquered).toBe(false);
    expect(result.defenderLosses).toBe(2);
    expect(result.attackerLosses).toBe(1);
  });

  it('handles 1v1 combat', () => {
    const result = resolveCombat(1, 1);
    // 1:1 ratio: attackerStrength=0.4, defenderStrength=0.4
    // defenderLosses = min(1, ceil(1 * 0.4)) = min(1, 1) = 1
    // attackerLosses = floor(1 * 0.4) = 0
    // defenders remaining = 0, attackers remaining = 1
    expect(result.conquered).toBe(true);
    expect(result.defenderLosses).toBe(1);
    expect(result.attackerLosses).toBe(0);
  });
});
