import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/api/auth";

/** Signed-in customer area. The session is a Supabase JWT; RLS backs this guard. */
export const Route = createFileRoute("/_account")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    // Keep customer account pages (orders, wishlist, checkout, profile) out of
    // administrator sessions, even when an admin enters a customer URL directly.
    if (user.role !== "customer") throw redirect({ to: "/admin" });
  },
  component: () => <Outlet />,
});
