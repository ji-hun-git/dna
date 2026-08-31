import { HealthExperience } from "@/components/experience/HealthExperience";
import { IntegratedHealthExperience } from "@/components/integrated/IntegratedHealthExperience";

export default function Page() {
  return process.env.GC_INTEGRATED_SYNTHETIC_UI === "true"
    ? <IntegratedHealthExperience />
    : <HealthExperience />;
}
