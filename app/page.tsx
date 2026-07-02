import { redirect } from "next/navigation";
import { DEFAULT_SEASON_ID } from "@/lib/seasons";

export default function Page() {
  redirect(`/${DEFAULT_SEASON_ID}`);
}
