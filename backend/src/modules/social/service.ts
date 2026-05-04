import { MedusaService } from "@medusajs/framework/utils"
import SocialPost from "./models/social-post"
import SocialStory from "./models/social-story"
import SocialFeedback from "./models/social-feedback"
import SocialActivity from "./models/social-activity"
import SocialTrendSource from "./models/social-trend-source"
import SocialTrendBrief from "./models/social-trend-brief"
import SocialSuggestion from "./models/social-suggestion"
import SocialTrendSubscription from "./models/social-trend-subscription"

class SocialModuleService extends MedusaService({
  SocialPost,
  SocialStory,
  SocialFeedback,
  SocialActivity,
  SocialTrendSource,
  SocialTrendBrief,
  SocialSuggestion,
  SocialTrendSubscription,
}) {}

export default SocialModuleService
