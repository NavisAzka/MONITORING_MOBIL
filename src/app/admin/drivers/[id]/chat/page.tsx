import AdminDriverWorkspace from "@/components/AdminDriverWorkspace";

export default function AdminDriverChatPage({ params }: { params: { id: string } }) {
  return <AdminDriverWorkspace driverId={params.id} mode="chat"/>;
}
