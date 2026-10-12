import { AdminView } from "@/components/views/admin-view";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminView />;
}
