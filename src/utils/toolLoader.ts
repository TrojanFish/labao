/**
 * Dynamic Tool Loader & Micro-Prefetching Bus for Rouleur Pro
 * Enables instantaneous zero-jank tool switching and eliminates large monolithic bundle payloads.
 */

export const TOOL_LOADERS: Record<string, () => Promise<unknown>> = {
  'power-calc': () => import('../components/tools/CyclePowerCalculator'),
  'tire-pressure': () => import('../components/tools/TirePressureCalculator'),
  'gear-calculator': () => import('../components/tools/GearSpeedCadenceCalculator'),
  'chain-calculator': () => import('../components/tools/ChainLengthCalculator'),
  'climb-pacing': () => import('../components/tools/ClimbPacingPlanner'),
  'upgrade-roi': () => import('../components/tools/UpgradeRoiCalculator'),
  'bike-fitter': () => import('../components/tools/RoadBikeFitter'),
  'pain-checker': () => import('../components/tools/RoadBikePainChecker'),
  'roadbook-library': () => import('../components/tools/RoadbookLibrary'),
  'gpx-creator': () => import('../components/tools/GpxRouteCreator'),
  'group-ride': () => import('../components/tools/GroupRideSimulator'),
  'weather-advisor': () => import('../components/tools/CyclingWeatherAdvisor'),
  'power-radar': () => import('../components/tools/PowerProfileRadar'),
  'health-calculator': () => import('../components/tools/HealthCalculator'),
  'activity-analyzer': () => import('../components/tools/FitActivityAnalyzer'),
  'workout-builder': () => import('../components/tools/WorkoutBuilder'),
  'tubeless-sealant': () => import('../components/tools/TubelessSealantCalculator'),
  'spoke-calculator': () => import('../components/tools/SpokeLengthCalculator'),
  'mtb-suspension': () => import('../components/tools/MtbSuspensionTuner'),
  'strava-cockpit': () => import('../components/tools/StravaDataCockpit'),
  'training-calendar': () => import('../components/tools/TrainingPlanCalendar'),
};

const prefetchedSet = new Set<string>();

/**
 * Prefetches the code chunk for a tool in the background on user intent
 * (e.g. mouse hover, focus, or touch start on navigation buttons/cards).
 */
export const prefetchTool = (id: string): void => {
  if (TOOL_LOADERS[id] && !prefetchedSet.has(id)) {
    prefetchedSet.add(id);
    TOOL_LOADERS[id]().catch(() => {
      prefetchedSet.delete(id);
    });
  }
};

/**
 * Progressively prefetches all tools in the background during idle time
 * so that when the user goes offline, all tool chunks are already cached in Service Worker.
 */
export const prefetchAllToolsIdle = (): void => {
  if (typeof window === 'undefined') return;

  const toolIds = Object.keys(TOOL_LOADERS);
  let index = 0;

  const scheduleNext = () => {
    if (index >= toolIds.length) return;
    const id = toolIds[index++];
    prefetchTool(id);

    if (typeof (window as unknown as { requestIdleCallback?: (cb: () => void, opt: { timeout: number }) => number }).requestIdleCallback === 'function') {
      (window as unknown as { requestIdleCallback: (cb: () => void, opt: { timeout: number }) => number }).requestIdleCallback(
        () => scheduleNext(),
        { timeout: 2000 }
      );
    } else {
      setTimeout(scheduleNext, 300);
    }
  };

  // Give initial page load and critical hydration 3 seconds of quiet time
  setTimeout(() => {
    if (typeof (window as unknown as { requestIdleCallback?: (cb: () => void, opt: { timeout: number }) => number }).requestIdleCallback === 'function') {
      (window as unknown as { requestIdleCallback: (cb: () => void, opt: { timeout: number }) => number }).requestIdleCallback(
        () => scheduleNext(),
        { timeout: 3000 }
      );
    } else {
      setTimeout(scheduleNext, 500);
    }
  }, 3000);
};
