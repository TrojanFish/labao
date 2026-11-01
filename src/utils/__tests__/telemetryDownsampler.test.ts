import { describe, it, expect } from 'vitest';
import { downsampleLttb } from '../telemetryDownsampler';

describe('LTTB Downsampling Engine (Telemetry Optimization)', () => {
  it('returns original points if threshold is greater than or equal to data length', () => {
    const raw = [
      { time: 0, power: 150 },
      { time: 1, power: 160 },
      { time: 2, power: 170 }
    ];
    const result = downsampleLttb(raw, 5, p => p.time, p => p.power);
    expect(result).toHaveLength(3);
    expect(result).toEqual(raw);
  });

  it('returns original points if data length is 2 or fewer', () => {
    const raw = [
      { time: 0, power: 150 },
      { time: 1, power: 160 }
    ];
    const result = downsampleLttb(raw, 2, p => p.time, p => p.power);
    expect(result).toHaveLength(2);
  });

  it('downsamples large stream to exactly specified threshold', () => {
    // Generate 1000 points
    const raw = Array.from({ length: 1000 }, (_, i) => ({
      time: i,
      power: 200 + Math.sin(i / 10) * 50
    }));

    const result = downsampleLttb(raw, 100, p => p.time, p => p.power);
    expect(result).toHaveLength(100);
    // Preserves strictly first and last points
    expect(result[0].time).toBe(0);
    expect(result[result.length - 1].time).toBe(999);
  });

  it('guarantees preservation of acute sprint power spikes', () => {
    // 500 flat points at 150W with a violent 1200W sprint spike at index 250
    const raw = Array.from({ length: 500 }, (_, i) => ({
      time: i,
      power: i === 250 ? 1200 : 150
    }));

    const downsampled = downsampleLttb(raw, 30, p => p.time, p => p.power);
    expect(downsampled).toHaveLength(30);

    // The maximum power in downsampled data must be the 1200W sprint
    const maxPower = Math.max(...downsampled.map(p => p.power));
    expect(maxPower).toBe(1200);
  });

  it('handles negative, zero, and floating point coordinates safely without NaN', () => {
    const raw = [
      { x: -5, y: -10 },
      { x: -2, y: 0 },
      { x: 0, y: 5 },
      { x: 3, y: -2 },
      { x: 7, y: 15 },
      { x: 10, y: 8 }
    ];

    const downsampled = downsampleLttb(raw, 4, p => p.x, p => p.y);
    expect(downsampled).toHaveLength(4);
    for (const pt of downsampled) {
      expect(Number.isNaN(pt.x)).toBe(false);
      expect(Number.isNaN(pt.y)).toBe(false);
    }
  });
});
