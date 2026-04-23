import { MedusaService } from "@medusajs/framework/utils"
import SocialPost from "./models/social-post"
import SocialStory from "./models/social-story"
import SocialFeedback from "./models/social-feedback"

class SocialModuleService extends MedusaService({
  SocialPost,
  SocialStory,
  SocialFeedback,
}) {}

export default SocialModuleService
