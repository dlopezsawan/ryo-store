/**
 * PostHog overview for DEV tab — summary metrics.
 */
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getRecentEventCounts,
  getTotalEventsCount,
  getUniqueUsersCount,
  getPersonsCount,
  listFeatureFlags,
  listExperiments,
  getSurveyResponsesCount,
  isAdminConfigured,
  getPosthogProjectUrl,
} from "../../../../../lib/posthog-admin-client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  if (!isAdminConfigured()) {
    res.json({ configured: false })
    return
  }

  const [
    totalEvents7d,
    uniqueUsers7d,
    persons,
    topEvents,
    flags,
    experiments,
    surveyResponses,
  ] = await Promise.all([
    getTotalEventsCount(7),
    getUniqueUsersCount(7),
    getPersonsCount(),
    getRecentEventCounts(7),
    listFeatureFlags(),
    listExperiments(),
    getSurveyResponsesCount(),
  ])

  res.json({
    configured: true,
    summary: {
      total_events_7d: totalEvents7d,
      unique_users_7d: uniqueUsers7d,
      persons_total: persons,
      flags_count: flags.length,
      flags_active: flags.filter((f) => f.active).length,
      experiments_count: experiments.length,
      survey_responses: surveyResponses,
    },
    top_events: topEvents.slice(0, 15),
    posthog_url: getPosthogProjectUrl(),
  })
}
