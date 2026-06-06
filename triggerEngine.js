/**
 * triggerEngine.js – Connects app events to the insight library.
 *
 * Call fireTrigger(type, payload) from ui.js after relevant dispatches.
 * Returns the array of insight results so ui.js can show immediate toasts.
 */

import { evaluateInsights } from './insightEngine.js';
import { dispatch, getState, A } from './state.js';

export const TRIGGERS = Object.freeze({
  SATZ_ABGEHAKT:       'SATZ_ABGEHAKT',
  TAG_ABGESCHLOSSEN:   'TAG_ABGESCHLOSSEN',
  WOCHE_ABGESCHLOSSEN: 'WOCHE_ABGESCHLOSSEN',
  NEUE_WOCHE_ERSTELLT: 'NEUE_WOCHE_ERSTELLT',
  APP_GEÖFFNET:        'APP_GEÖFFNET',
});

/**
 * Fire an insight trigger.
 * @param {string} triggerType – one of TRIGGERS values
 * @param {object} payload     – event data (di, ei, si as needed)
 * @returns {object[]} insight results (may be empty)
 */
export function fireTrigger(triggerType, payload = {}) {
  const state    = getState();
  const event    = { type: triggerType, payload };
  const insights = evaluateInsights(state, event);

  if (insights.length > 0) {
    dispatch(A.INSIGHTS_SET, { insights: insights.map(i => i.result) });
  }

  return insights.map(i => i.result);
}
