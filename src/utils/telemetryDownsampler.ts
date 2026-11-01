/**
 * Largest Triangle Three Buckets (LTTB) Downsampling Engine
 * 
 * High-performance, visual-preserving decimation algorithm for high-frequency cycling telemetry.
 * Downsamples 1Hz telemetry series (20,000+ points) down to optimal chart resolution (~1,000-2,000 points)
 * while preserving critical peak power surges, maximum heart rate spikes, and elevation summits.
 * 
 * Reference: Sveinn Steinarsson (2013) "Downsampling Time Series for Visual Representation"
 */

export interface PointLike {
  x: number;
  y: number;
}

/**
 * Downsamples an array of points using the Largest Triangle Three Buckets (LTTB) algorithm.
 *
 * @param data Array of source items
 * @param threshold Maximum number of points in downsampled output (must be >= 3)
 * @param getX Accessor for X-axis numeric value (e.g. time seconds, distance km)
 * @param getY Accessor for Y-axis numeric value (e.g. watts, bpm, altitude)
 * @returns Decimated array with peak visual fidelity preserved
 */
export function downsampleLttb<T>(
  data: readonly T[],
  threshold: number,
  getX: (item: T) => number,
  getY: (item: T) => number
): T[] {
  const dataLength = data.length;
  if (threshold >= dataLength || threshold <= 2 || dataLength <= 2) {
    return Array.from(data);
  }

  const sampled: T[] = [];
  const bucketSize = (dataLength - 2) / (threshold - 2);

  let aIndex = 0; // First point of bucket A
  sampled.push(data[aIndex]);

  for (let i = 0; i < threshold - 2; i++) {
    // 1. Calculate average point for the next bucket (bucket C)
    const cStart = Math.floor((i + 1) * bucketSize) + 1;
    const cEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, dataLength);
    const cCount = cEnd - cStart;

    let avgX = 0;
    let avgY = 0;

    if (cCount > 0) {
      for (let c = cStart; c < cEnd; c++) {
        avgX += getX(data[c]) || 0;
        avgY += getY(data[c]) || 0;
      }
      avgX /= cCount;
      avgY /= cCount;
    } else {
      const fallbackIdx = Math.min(cStart, dataLength - 1);
      avgX = getX(data[fallbackIdx]) || 0;
      avgY = getY(data[fallbackIdx]) || 0;
    }

    // 2. Find the point in current bucket (bucket B) that maximizes triangle area with A and avg(C)
    const bStart = Math.floor(i * bucketSize) + 1;
    const bEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, dataLength);

    const ax = getX(data[aIndex]) || 0;
    const ay = getY(data[aIndex]) || 0;

    let maxArea = -1;
    let maxAreaIndex = bStart;

    for (let b = bStart; b < bEnd; b++) {
      const bx = getX(data[b]) || 0;
      const by = getY(data[b]) || 0;

      // Area of triangle: 0.5 * |ax(by - cy) + bx(cy - ay) + cx(ay - by)|
      const area = Math.abs(
        (ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay)
      );

      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = b;
      }
    }

    sampled.push(data[maxAreaIndex]);
    aIndex = maxAreaIndex;
  }

  // Always include the very last data point
  sampled.push(data[dataLength - 1]);

  return sampled;
}
