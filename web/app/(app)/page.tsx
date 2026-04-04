import { redirect } from "next/navigation";
import { DEFAULT_SIGNED_IN_PATH } from "@/lib/app-routes";

export default function AppRootPage() {
  redirect(DEFAULT_SIGNED_IN_PATH);
}
