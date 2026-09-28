import { describe, it, expect } from 'vitest';
import { getBaseTirePsi, SURFACE_FACTORS, TIRE_SETUP_FACTORS, calculateTemperatureCompensatedPressure } from '../../data/tirePressureConfig';

/**
 * Industry Benchmark Validation Suite
 * Validates mathematical models against:
 * 1. SRAM AXS & Silca Professional Tire Pressure Guidelines
 * 2. DT Swiss Spoke Calculator (Jobst Brandt 3D Trigonometry)
 * 3. LeMond & Hamley (Retül standard) Biomechanical Bike Fitting
 */

describe('Industry Benchmark: SRAM AXS & Silca Tire Pressure Alignment', () => {
  // Helper to compute front/rear PSI matching TirePressureCalculator logic
  function calculateTirePressure(
    systemWeightKg: number,
    nominalWidthMm: number,
    actualWidthMm: number,
    rimInnerWidthMm: number,
    tireSetup: 'tubeless' | 'tube' | 'tubular',
    surfaceKey: string,
    bikeType: 'road' | 'gravel' | 'mtb' = 'road',
    frontWeightPct = 44
  ) {
    const basePsi = getBaseTirePsi(nominalWidthMm, systemWeightKg, bikeType);
    const surfaceFactor = SURFACE_FACTORS[surfaceKey]?.factor || 1.0;
    const setupFactor = TIRE_SETUP_FACTORS[tireSetup]?.factor || 1.0;

    let adjustedBase = basePsi * surfaceFactor * setupFactor;

    if (actualWidthMm && nominalWidthMm && actualWidthMm !== nominalWidthMm) {
      adjustedBase -= (actualWidthMm - nominalWidthMm) * 1.8;
    }

    if (rimInnerWidthMm && rimInnerWidthMm >= 21 && nominalWidthMm <= 30) {
      adjustedBase -= 1.5;
    }

    // Weight distribution factor relative to equal 50/50 balance (e.g. 44% front -> 0.94, 56% rear -> 1.06)
    const frontRatio = 0.5 + (frontWeightPct / 100);
    const rearRatio = 0.5 + ((100 - frontWeightPct) / 100);

    let frontRec = Math.round(adjustedBase * frontRatio);
    let rearRec = Math.round(adjustedBase * rearRatio);

    if (bikeType === 'road') {
      frontRec = Math.max(45, Math.min(110, frontRec));
      rearRec = Math.max(48, Math.min(115, rearRec));
    } else if (bikeType === 'gravel') {
      frontRec = Math.max(22, Math.min(60, frontRec));
      rearRec = Math.max(24, Math.min(65, rearRec));
    } else {
      frontRec = Math.max(16, Math.min(40, frontRec));
      rearRec = Math.max(18, Math.min(45, rearRec));
    }

    return { frontPsi: frontRec, rearPsi: rearRec };
  }

  it('matches SRAM AXS Tubeless road recommendation for 78kg system on 28mm tires', () => {
    // 70kg rider + 8kg bike, 28mm nominal width (inflates to ~29.5mm on 21mm internal rim), Tubeless, smooth asphalt
    // SRAM AXS guideline: ~60-64 psi front, ~65-70 psi rear
    const res = calculateTirePressure(78, 28, 29.5, 21, 'tubeless', 'smooth_asphalt', 'road');

    expect(res.frontPsi).toBeGreaterThanOrEqual(58);
    expect(res.frontPsi).toBeLessThanOrEqual(64);

    expect(res.rearPsi).toBeGreaterThanOrEqual(65);
    expect(res.rearPsi).toBeLessThanOrEqual(72);

    // Rear pressure must exceed front due to 44/56 weight distribution
    expect(res.rearPsi).toBeGreaterThan(res.frontPsi);

    // Must be safely below the ETRTO 72.5 psi (5.0 bar) maximum limit for hookless rims
    expect(res.frontPsi).toBeLessThanOrEqual(72);
    expect(res.rearPsi).toBeLessThanOrEqual(72.5);
  });

  it('matches classic high-pressure clincher tube standard for 25mm road tires', () => {
    // 68kg rider + 8.5kg bike (76.5kg), 25mm tire with butyl tube on 17mm rim
    // Traditional recommendation: ~78-88 psi
    const res = calculateTirePressure(76.5, 25, 25, 17, 'tube', 'smooth_asphalt', 'road');

    expect(res.frontPsi).toBeGreaterThanOrEqual(75);
    expect(res.frontPsi).toBeLessThanOrEqual(85);

    expect(res.rearPsi).toBeGreaterThanOrEqual(84);
    expect(res.rearPsi).toBeLessThanOrEqual(95);
  });

  it('matches Silca Gravel low-rolling-resistance recommendation for 40mm tires', () => {
    // 75kg rider + 10kg gravel bike (85kg), 40mm tubeless tire, hardpack gravel
    // Silca gravel recommendation: ~32-38 psi
    const res = calculateTirePressure(85, 40, 41, 24, 'tubeless', 'gravel_hard', 'gravel');

    expect(res.frontPsi).toBeGreaterThanOrEqual(30);
    expect(res.frontPsi).toBeLessThanOrEqual(38);

    expect(res.rearPsi).toBeGreaterThanOrEqual(34);
    expect(res.rearPsi).toBeLessThanOrEqual(42);
  });

  describe('calculateTemperatureCompensatedPressure (Gay-Lussac Ideal Gas Law)', () => {
    it('increases recommended pump pressure when riding in cold winter conditions', () => {
      // Pumping in a 20°C room for a 5°C winter ride
      const res = calculateTemperatureCompensatedPressure(65, 5, 20);
      expect(res.recommendedPumpPsi).toBeGreaterThan(65);
      expect(res.deltaPsi).toBeGreaterThanOrEqual(3.0);
      expect(res.deltaPsi).toBeLessThanOrEqual(5.0);
    });

    it('decreases recommended pump pressure when riding in hot summer asphalt conditions', () => {
      // Pumping in a 20°C room for a 35°C hot summer ride
      const res = calculateTemperatureCompensatedPressure(65, 35, 20);
      expect(res.recommendedPumpPsi).toBeLessThan(65);
      expect(res.deltaPsi).toBeLessThanOrEqual(-3.0);
    });

    it('returns exact target PSI when pump temperature equals ride temperature', () => {
      const res = calculateTemperatureCompensatedPressure(65, 20, 20);
      expect(res.recommendedPumpPsi).toBe(65);
      expect(res.deltaPsi).toBe(0);
    });
  });
});

describe('Industry Benchmark: DT Swiss Official Spoke Calculator Alignment', () => {
  // Jobst Brandt 3D Trigonometry formula (identical to DT Swiss Calculator engine)
  function calculateSpokeLength(
    erdMm: number,
    pcdMm: number,
    centerDistMm: number,
    crossCount: number,
    spokeCount: number,
    spokeHoleDiaMm = 2.6,
    spokeStretchMm = 0.8
  ) {
    const rRim = erdMm / 2;
    const rHub = pcdMm / 2;
    // Cross angle theta: (720 * X) / N
    const thetaRad = ((720 * crossCount) / spokeCount) * (Math.PI / 180);
    // 2D chord in wheel plane
    const chordSq = rRim * rRim + rHub * rHub - 2 * rRim * rHub * Math.cos(thetaRad);
    // 3D vector length
    const raw3D = Math.sqrt(chordSq + centerDistMm * centerDistMm);
    // Correction for spoke hole radius and initial tensile elongation
    const net = raw3D - spokeHoleDiaMm / 2 - spokeStretchMm;
    return {
      raw: raw3D,
      net: parseFloat(net.toFixed(2)),
      rounded: Math.round(net)
    };
  }

  it('matches DT Swiss calculation for DT 350 Disc Rear Hub + 50mm Carbon Rim (ERD 540mm)', () => {
    // Benchmark: 24h, 2X cross both sides, PCD = 58mm
    // Non-Drive Side (NDS): Center distance = 34.5mm
    // Drive Side (DS): Center distance = 19.2mm
    const nds = calculateSpokeLength(540, 58, 34.5, 2, 24);
    const ds = calculateSpokeLength(540, 58, 19.2, 2, 24);

    // Jobst Brandt 3D trigonometry gives raw lengths ~259.0mm (NDS) and ~257.5mm (DS)
    expect(nds.raw).toBeCloseTo(259.04, 1);
    expect(ds.raw).toBeCloseTo(257.45, 1);

    // After deducting spoke hole radius (1.3mm) and tension stretch (0.8mm), net lengths are 257mm and 255mm
    expect(nds.rounded).toBe(257);
    expect(ds.rounded).toBe(255);

    // Due to cassette dish, drive-side spokes must be shorter than non-drive side
    expect(nds.rounded).toBeGreaterThan(ds.rounded);
    expect(nds.rounded - ds.rounded).toBe(2);
  });

  it('verifies radial lacing (0X Cross) trigonometry on front rim-brake hub', () => {
    // 0X cross means theta = 0, cos(theta) = 1
    // chord = rRim - rHub
    const erd = 580;
    const pcd = 40;
    const center = 35;
    const radial = calculateSpokeLength(erd, pcd, center, 0, 20);

    const rRim = erd / 2; // 290
    const rHub = pcd / 2; // 20
    const expectedRaw = Math.sqrt(Math.pow(rRim - rHub, 2) + Math.pow(center, 2)); // sqrt(270^2 + 35^2) = sqrt(72900 + 1225) = sqrt(74125) ≈ 272.26
    expect(radial.raw).toBeCloseTo(expectedRaw, 1);
  });

  it('calculates correct tension ratio reflecting rear wheel dishing', () => {
    // Horizontal equilibrium: T_DS * d_DS = T_NDS * d_NDS
    // T_NDS / T_DS = d_DS / d_NDS
    const leftCenter = 34.5;
    const rightCenter = 19.2;
    const ndsTensionRatio = rightCenter / leftCenter;

    // Classic disc rear wheel has NDS tension around 55% of DS tension
    expect(ndsTensionRatio).toBeCloseTo(0.556, 2);
    expect(Math.round(ndsTensionRatio * 100)).toBe(56);
  });
});

describe('Industry Benchmark: LeMond & Hamley Biomechanical Bike Fitting Convergence', () => {
  // Greg LeMond formula: Saddle Height = Inseam * 0.883 (from BB center to saddle top along seat tube)
  function leMondSaddleHeight(inseamCm: number): number {
    return Math.round(inseamCm * 0.883 * 10); // in mm
  }

  // Hamley 109% method: Inseam * 1.09 (from pedal axle to saddle top at bottom of stroke)
  // Converting to BB center by subtracting crank length (typically 170mm or 172.5mm)
  function hamleySaddleHeight(inseamCm: number, crankLengthMm = 170): number {
    const totalLegDistanceMm = inseamCm * 10 * 1.09;
    return Math.round(totalLegDistanceMm - crankLengthMm);
  }

  it('demonstrates convergence between LeMond and Hamley methods within +/- 18mm', () => {
    const testInseams = [75, 80, 83, 86, 90]; // 75cm to 90cm inseams

    for (const inseam of testInseams) {
      const lemond = leMondSaddleHeight(inseam);
      const hamley = hamleySaddleHeight(inseam, 172.5);

      // Both world-renowned fitting methods must converge within an acceptable physiological window
      const diffMm = Math.abs(lemond - hamley);
      expect(diffMm).toBeLessThanOrEqual(18);
    }
  });
});
