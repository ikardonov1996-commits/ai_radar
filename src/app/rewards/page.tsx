import { Screen } from "@/components/TabBar";
import { RewardsScreen } from "@/components/RewardsScreen";

export const metadata = { title: "Награды · AI Radar" };

export default function RewardsPage() {
  return (
    <Screen>
      <RewardsScreen />
    </Screen>
  );
}
