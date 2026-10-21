import VehicleDetailPage from "@/components/VehicleDetailPage";

export default function VehiclePage({ params }: { params: { imei: string } }) {
  return <VehicleDetailPage imei={params.imei} />;
}
