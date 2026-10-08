import { Feed } from "@/components/Feed";
import { Screen } from "@/components/TabBar";

export default function Home() {
  return (
    <Screen>
      <div className="flex h-[calc(100dvh-5rem)] min-h-[560px] flex-col">
        <Feed />
      </div>
    </Screen>
  );
}
