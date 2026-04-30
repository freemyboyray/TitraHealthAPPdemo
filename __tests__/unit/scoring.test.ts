import {
  scoreSleep,
  scoreHRV,
  scoreRHR,
  scoreSPO2,
  scoreRespRate,
  computeRecovery,
  computeGlp1Support,
  computeSideEffectBurden,
  computeMedicationScore,
  daysSinceInjection,
  daysBetween,
  getShotPhase,
  getIntradayPhase,
  getPhaseWeights,
  recoveryColor,
  supportColor,
  recoveryMessage,
  supportMessage,
  interpolateBenchmark,
  TRIAL_BENCHMARKS,
  type DailyActuals,
  type DailyTargets,
  type SideEffectEntry,
} from '@/constants/scoring';

// ─── scoreSleep ──────────────────────────────────────────────────────────────

describe('scoreSleep', () => {
  it('returns 1.0 for optimal sleep (7-9h)', () => {
    expect(scoreSleep(420)).toBe(1.0); // 7h
    expect(scoreSleep(480)).toBe(1.0); // 8h
    expect(scoreSleep(540)).toBe(1.0); // 9h
  });

  it('returns 0.75 for 6-7h', () => {
    expect(scoreSleep(360)).toBe(0.75);
    expect(scoreSleep(400)).toBe(0.75);
  });

  it('returns 0.5 for 5-6h', () => {
    expect(scoreSleep(300)).toBe(0.5);
    expect(scoreSleep(350)).toBe(0.5);
  });

  it('returns 0.85 for slight oversleep (9-10h)', () => {
    expect(scoreSleep(560)).toBe(0.85);
    expect(scoreSleep(600)).toBe(0.85);
  });

  it('returns 0.65 for excessive oversleep (>10h)', () => {
    expect(scoreSleep(660)).toBe(0.65);
  });

  it('scales linearly below 5h', () => {
    expect(scoreSleep(210)).toBeCloseTo(0.5, 1); // 3.5h → 210/420
  });

  it('returns 0 for 0 sleep', () => {
    expect(scoreSleep(0)).toBe(0);
  });
});

// ─── scoreHRV ────────────────────────────────────────────────────────────────

describe('scoreHRV', () => {
  it('returns 1.0 for >=60ms', () => {
    expect(scoreHRV(60)).toBe(1.0);
    expect(scoreHRV(100)).toBe(1.0);
  });

  it('returns 0.9 for 50-59ms', () => {
    expect(scoreHRV(50)).toBe(0.9);
    expect(scoreHRV(55)).toBe(0.9);
  });

  it('returns 0.75 for 40-49ms', () => {
    expect(scoreHRV(40)).toBe(0.75);
  });

  it('returns 0.55 for 30-39ms', () => {
    expect(scoreHRV(30)).toBe(0.55);
  });

  it('returns 0.35 for 20-29ms', () => {
    expect(scoreHRV(20)).toBe(0.35);
  });

  it('returns 0.1 for <20ms', () => {
    expect(scoreHRV(10)).toBe(0.1);
  });
});

// ─── scoreRHR ────────────────────────────────────────────────────────────────

describe('scoreRHR', () => {
  it('returns 1.0 for athletic HR (<55)', () => {
    expect(scoreRHR(50)).toBe(1.0);
  });

  it('returns 0.85 for good HR (55-64)', () => {
    expect(scoreRHR(60)).toBe(0.85);
  });

  it('returns 0.65 for average HR (65-74)', () => {
    expect(scoreRHR(70)).toBe(0.65);
  });

  it('returns 0.4 for elevated HR (75-84)', () => {
    expect(scoreRHR(80)).toBe(0.4);
  });

  it('returns 0.15 for high HR (>=85)', () => {
    expect(scoreRHR(90)).toBe(0.15);
  });
});

// ─── scoreSPO2 ───────────────────────────────────────────────────────────────

describe('scoreSPO2', () => {
  it('returns 1.0 for >=98%', () => {
    expect(scoreSPO2(98)).toBe(1.0);
    expect(scoreSPO2(99)).toBe(1.0);
  });

  it('returns 0.8 for 96-97%', () => {
    expect(scoreSPO2(96)).toBe(0.8);
  });

  it('returns 0.5 for 94-95%', () => {
    expect(scoreSPO2(94)).toBe(0.5);
  });

  it('returns 0 for <90%', () => {
    expect(scoreSPO2(89)).toBe(0);
  });
});

// ─── scoreRespRate ───────────────────────────────────────────────────────────

describe('scoreRespRate', () => {
  it('returns 1.0 for normal range (12-20)', () => {
    expect(scoreRespRate(12)).toBe(1.0);
    expect(scoreRespRate(16)).toBe(1.0);
    expect(scoreRespRate(20)).toBe(1.0);
  });

  it('returns 0.5 for mildly elevated (21-24)', () => {
    expect(scoreRespRate(22)).toBe(0.5);
  });

  it('returns 0.25 for elevated (25-28)', () => {
    expect(scoreRespRate(26)).toBe(0.25);
  });
});

// ─── computeRecovery ─────────────────────────────────────────────────────────

describe('computeRecovery', () => {
  it('returns null when no wearable data', () => {
    expect(computeRecovery({})).toBeNull();
  });

  it('computes score from sleep only', () => {
    const score = computeRecovery({ sleepMinutes: 480 });
    expect(score).toBe(100); // 1.0 * 35/35 * 100
  });

  it('computes weighted score from multiple components', () => {
    const score = computeRecovery({
      sleepMinutes: 480, // 1.0
      hrvMs: 60,         // 1.0
      restingHR: 50,     // 1.0
      spo2Pct: 98,       // 1.0
      respRateRpm: 16,   // 1.0
    });
    expect(score).toBe(100);
  });

  it('applies GLP-1 HRV offset during peak phase', () => {
    // HRV 45 without offset → scoreHRV(45) = 0.75
    // HRV 45 + 6 offset (peak) → scoreHRV(51) = 0.9
    const withoutPhase = computeRecovery({ hrvMs: 45 });
    const withPhase = computeRecovery({ hrvMs: 45 }, 'peak');
    expect(withPhase!).toBeGreaterThan(withoutPhase!);
  });

  it('applies GLP-1 RHR offset during peak phase', () => {
    // RHR 66 without offset → scoreRHR(66) = 0.65
    // RHR 66 + (-3) offset (peak) → scoreRHR(63) = 0.85
    const withoutPhase = computeRecovery({ restingHR: 66 });
    const withPhase = computeRecovery({ restingHR: 66 }, 'peak');
    expect(withPhase!).toBeGreaterThan(withoutPhase!);
  });

  it('computes degraded score for poor vitals', () => {
    const score = computeRecovery({
      sleepMinutes: 240, // very low
      hrvMs: 15,         // very low
      restingHR: 90,     // high
      spo2Pct: 91,       // low
    });
    expect(score).toBeLessThanOrEqual(30);
  });
});

// ─── computeGlp1Support ─────────────────────────────────────────────────────

describe('computeGlp1Support', () => {
  const targets: DailyTargets = {
    proteinG: 100,
    waterMl: 2500,
    fiberG: 20,
    steps: 8000,
    caloriesTarget: 1800,
    carbsG: 200,
    fatG: 60,
    activeCaloriesTarget: 300,
    proteinPriority: false,
    programPhase: 'titration',
  };

  it('returns 100 when all targets met', () => {
    const actuals: DailyActuals = {
      proteinG: 100,
      waterMl: 2500,
      fiberG: 20,
      steps: 8000,
      injectionLogged: true,
    };
    expect(computeGlp1Support(actuals, targets)).toBe(100);
  });

  it('returns 0 when nothing done', () => {
    const actuals: DailyActuals = {
      proteinG: 0,
      waterMl: 0,
      fiberG: 0,
      steps: 0,
      injectionLogged: false,
    };
    expect(computeGlp1Support(actuals, targets)).toBe(0);
  });

  it('caps individual components at their max', () => {
    const actuals: DailyActuals = {
      proteinG: 200, // over target
      waterMl: 5000, // over target
      fiberG: 40,    // over target
      steps: 16000,  // over target
      injectionLogged: true,
    };
    expect(computeGlp1Support(actuals, targets)).toBe(100);
  });

  it('medication component is 15 or 0', () => {
    const base: DailyActuals = {
      proteinG: 0, waterMl: 0, fiberG: 0, steps: 0,
      injectionLogged: false,
    };
    expect(computeGlp1Support(base, targets)).toBe(0);
    expect(computeGlp1Support({ ...base, injectionLogged: true }, targets)).toBe(15);
  });
});

// ─── computeSideEffectBurden ─────────────────────────────────────────────────

describe('computeSideEffectBurden', () => {
  const refDate = new Date('2025-03-15');

  it('returns 0 burden for empty logs', () => {
    const result = computeSideEffectBurden([], 'balance', 14, refDate);
    expect(result.burden).toBe(0);
    expect(result.thiamineRisk).toBe(false);
  });

  it('computes burden for GI effects with 1.3x multiplier', () => {
    const logs: SideEffectEntry[] = [
      { effect_type: 'nausea', severity: 7, phase_at_log: 'peak', logged_at: '2025-03-14' },
    ];
    const result = computeSideEffectBurden(logs, 'peak', 14, refDate);
    expect(result.burden).toBeGreaterThan(0);
  });

  it('detects thiamine risk for severe nausea within 72h', () => {
    const logs: SideEffectEntry[] = [
      { effect_type: 'nausea', severity: 8, phase_at_log: 'peak', logged_at: '2025-03-14T10:00:00Z' },
    ];
    const result = computeSideEffectBurden(logs, 'peak', 14, refDate);
    expect(result.thiamineRisk).toBe(true);
  });

  it('no thiamine risk for low severity nausea', () => {
    const logs: SideEffectEntry[] = [
      { effect_type: 'nausea', severity: 3, phase_at_log: 'peak', logged_at: '2025-03-14T10:00:00Z' },
    ];
    const result = computeSideEffectBurden(logs, 'peak', 14, refDate);
    expect(result.thiamineRisk).toBe(false);
  });

  it('applies low-concern multiplier for fatigue', () => {
    const nauseaLogs: SideEffectEntry[] = [
      { effect_type: 'nausea', severity: 5, phase_at_log: 'balance', logged_at: '2025-03-14' },
    ];
    const fatigueLogs: SideEffectEntry[] = [
      { effect_type: 'fatigue', severity: 5, phase_at_log: 'balance', logged_at: '2025-03-14' },
    ];
    const nauseaResult = computeSideEffectBurden(nauseaLogs, 'balance', 14, refDate);
    const fatigueResult = computeSideEffectBurden(fatigueLogs, 'balance', 14, refDate);
    // Nausea (1.3x) should produce higher burden than fatigue (0.8x)
    expect(nauseaResult.burden).toBeGreaterThan(fatigueResult.burden);
  });
});

// ─── daysSinceInjection ──────────────────────────────────────────────────────

describe('daysSinceInjection', () => {
  it('returns injFreqDays when no injection date', () => {
    expect(daysSinceInjection(null)).toBe(7);
    expect(daysSinceInjection(undefined, undefined, 14)).toBe(14);
  });

  it('returns 0 on injection day', () => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    expect(daysSinceInjection(todayStr, today)).toBe(0);
  });

  it('caps at injFreqDays', () => {
    const result = daysSinceInjection('2020-01-01', new Date('2025-01-01'), 7);
    expect(result).toBe(7);
  });
});

// ─── daysBetween ─────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2025-03-15', '2025-03-15')).toBe(0);
  });

  it('returns correct days between dates', () => {
    expect(daysBetween('2025-03-10', '2025-03-15')).toBe(5);
  });

  it('is order-independent', () => {
    expect(daysBetween('2025-03-15', '2025-03-10')).toBe(5);
  });
});

// ─── getShotPhase ────────────────────────────────────────────────────────────

describe('getShotPhase', () => {
  it('returns shot on day 1 (7-day cycle)', () => {
    expect(getShotPhase(1)).toBe('shot');
  });

  it('returns peak on day 2-3 (7-day cycle)', () => {
    expect(getShotPhase(2)).toBe('peak');
    expect(getShotPhase(3)).toBe('peak');
  });

  it('returns balance mid-cycle', () => {
    expect(getShotPhase(5)).toBe('balance');
  });

  it('returns reset near end of cycle', () => {
    expect(getShotPhase(7)).toBe('reset');
  });

  it('scales thresholds for 14-day cycle', () => {
    expect(getShotPhase(1, 14)).toBe('shot');
    expect(getShotPhase(2, 14)).toBe('shot');  // 14*0.15 = ~2
    expect(getShotPhase(5, 14)).toBe('peak');
    expect(getShotPhase(10, 14)).toBe('balance');
    expect(getShotPhase(13, 14)).toBe('reset');
  });
});

// ─── getIntradayPhase ────────────────────────────────────────────────────────

describe('getIntradayPhase', () => {
  it('returns post_dose shortly after liraglutide (Tmax=11h)', () => {
    expect(getIntradayPhase(2, 'liraglutide')).toBe('post_dose'); // < 5.5h
  });

  it('returns peak at Tmax for liraglutide', () => {
    expect(getIntradayPhase(11, 'liraglutide')).toBe('peak'); // between 5.5 and 22
  });

  it('returns trough late for liraglutide', () => {
    expect(getIntradayPhase(23, 'liraglutide')).toBe('trough'); // > 22h
  });

  it('oral sema has very short post_dose (Tmax=1h)', () => {
    expect(getIntradayPhase(0.3, 'oral_semaglutide')).toBe('post_dose');
    expect(getIntradayPhase(1, 'oral_semaglutide')).toBe('peak');
    expect(getIntradayPhase(3, 'oral_semaglutide')).toBe('trough');
  });
});

// ─── getPhaseWeights ─────────────────────────────────────────────────────────

describe('getPhaseWeights', () => {
  it('returns initiation weights', () => {
    const w = getPhaseWeights('initiation');
    expect(w.medication).toBe(45);
    expect(w.medication + w.sideEffects + w.nutrition + w.activity).toBe(100);
  });

  it('returns titration weights by default', () => {
    const w = getPhaseWeights('titration');
    expect(w.medication).toBe(35);
    expect(w.medication + w.sideEffects + w.nutrition + w.activity).toBe(100);
  });

  it('returns maintenance weights', () => {
    const w = getPhaseWeights('maintenance');
    expect(w.activity).toBe(20); // highest activity weight
  });

  it('defaults to titration for unknown phase', () => {
    expect(getPhaseWeights('unknown')).toEqual(getPhaseWeights('titration'));
  });
});

// ─── Color/Message helpers ───────────────────────────────────────────────────

describe('recoveryColor', () => {
  it('returns red for <40', () => expect(recoveryColor(30)).toBe('#E53E3E'));
  it('returns orange for 40-59', () => expect(recoveryColor(50)).toBe('#E8960C'));
  it('returns yellow for 60-79', () => expect(recoveryColor(70)).toBe('#F6CB45'));
  it('returns green for >=80', () => expect(recoveryColor(85)).toBe('#2B9450'));
});

describe('supportColor', () => {
  it('returns red for <40', () => expect(supportColor(30)).toBe('#E53E3E'));
  it('returns blue for 60-79', () => expect(supportColor(70)).toBe('#5B8BF5'));
  it('returns green for >=80', () => expect(supportColor(85)).toBe('#2B9450'));
});

describe('recoveryMessage', () => {
  it('returns correct messages per tier', () => {
    expect(recoveryMessage(30)).toBe('Under stress today');
    expect(recoveryMessage(50)).toBe('Light recovery day');
    expect(recoveryMessage(70)).toBe('Moderately recovered');
    expect(recoveryMessage(90)).toBe('Well recovered');
  });
});

describe('supportMessage', () => {
  it('returns correct messages per tier', () => {
    expect(supportMessage(30)).toBe('Needs attention');
    expect(supportMessage(50)).toBe('Getting there');
    expect(supportMessage(70)).toBe('Supporting well');
    expect(supportMessage(90)).toBe('Excellent support');
  });
});

// ─── interpolateBenchmark ────────────────────────────────────────────────────

describe('interpolateBenchmark', () => {
  const semaData = TRIAL_BENCHMARKS.semaglutide[0].data;

  it('returns null before first data point', () => {
    expect(interpolateBenchmark(semaData, 2)).toBeNull();
  });

  it('returns exact value at data point', () => {
    expect(interpolateBenchmark(semaData, 4)).toBe(2.1);
  });

  it('interpolates between data points', () => {
    const val = interpolateBenchmark(semaData, 6)!;
    expect(val).toBeGreaterThan(2.1);
    expect(val).toBeLessThan(4.2);
  });

  it('returns last value past final week', () => {
    expect(interpolateBenchmark(semaData, 100)).toBe(14.9);
  });

  it('returns null for empty data', () => {
    expect(interpolateBenchmark([], 10)).toBeNull();
  });
});

// ─── computeMedicationScore ──────────────────────────────────────────────────

describe('computeMedicationScore', () => {
  it('returns 0 with no injection logs', () => {
    expect(computeMedicationScore([], 7)).toBe(0);
  });

  it('returns score for on-time injection with time logged', () => {
    const today = new Date().toISOString().slice(0, 10);
    const score = computeMedicationScore(
      [{ injection_date: today, injection_time: '09:00' }],
      7,
    );
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(35);
  });

  it('rewards streak for consecutive weekly injections', () => {
    const logs = [];
    for (let i = 0; i < 8; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      logs.push({ injection_date: d.toISOString().slice(0, 10) });
    }
    const score = computeMedicationScore(logs, 7);
    expect(score).toBeGreaterThanOrEqual(30); // streak bonus kicks in
  });
});
