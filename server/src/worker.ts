import dotenv from "dotenv"
dotenv.config()

import { initAIWorker } from "./services/aiQueue"
import { startRecommendationCron } from "./jobs/recommendationCron"

initAIWorker()
startRecommendationCron()
console.info("[Worker] AI worker and recommendation cron started")
