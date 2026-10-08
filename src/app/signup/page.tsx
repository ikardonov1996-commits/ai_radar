import { Screen } from "@/components/TabBar";
import { SignupFlow } from "@/components/SignupFlow";

export const metadata = { title: "Регистрация · AI Radar" };

export default function SignupPage() {
  return (
    <Screen tabs={false}>
      <SignupFlow />
    </Screen>
  );
}
