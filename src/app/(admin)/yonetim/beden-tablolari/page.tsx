import { repo } from "@/lib/data";
import { SizeChartManager } from "@/components/admin/size-chart-manager";

export default async function SizeChartsPage() {
  const charts = await repo.listSizeCharts();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Beden tabloları</h1>
        <p className="mt-1 text-sm text-muted">
          Bluz, etek, ferace gibi ürün tipleri için tablo oluşturun; ürün düzenlerken seçin. Tablo atanmayan üründe “Beden tablosu” butonu görünmez.
        </p>
      </div>
      <SizeChartManager charts={charts} />
    </div>
  );
}
