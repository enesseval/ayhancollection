import { repo } from "@/lib/data";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function CategoriesPage() {
  const categories = await repo.listAllCategories();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Kategoriler</h1>
        <p className="mt-1 text-sm text-muted">
          Üst menüde görünen kategoriler. En fazla iki seviye: ana kategori ve alt kategori. Sıralama menüdeki sırayı belirler.
        </p>
      </div>
      <CategoryManager categories={categories} />
    </div>
  );
}
