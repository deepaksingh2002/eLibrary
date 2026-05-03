import cron from "node-cron";
import { computeRecommendations } from "../services/recommendationEngine";

export function startRecommendationCron(): void {
  cron.schedule("0 2 * * *", async () => {
    console.info("[Cron] Starting nightly recommendation computation...");
    try {
      await computeRecommendations();
      console.info("[Cron] Recommendation computation complete");
    } catch (err) {
      console.error("[Cron] Recommendation computation FAILED:", err);
    }
  }, {
    timezone: "UTC"
  });

  console.info("[Cron] Recommendation cron scheduled for 02:00 UTC daily");
}
