import AdminNav from "@/components/AdminNav";

export const metadata = {
  title: "Administration — QR Platform",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AdminNav />
      <main className="max-w-6xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
