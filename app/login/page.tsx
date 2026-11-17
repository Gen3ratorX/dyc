import type { Metadata } from "next";
import Pilot from "../pilot";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Staff sign in | Camp Victory",
  description: "Sign in with your approved Camp Victory staff account.",
};
export default function Login() {
  return <Pilot />;
}
