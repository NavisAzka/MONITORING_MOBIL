import AdminDriverWorkspace from "@/components/AdminDriverWorkspace";

export default function AdminDriverProfilePage({ params }: { params: { id: string } }) {
  return <AdminDriverWorkspace driverId={params.id} mode="profile"/>;
}
