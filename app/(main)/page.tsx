import { getDiscounts } from "@/actions/home.actions";
import ProductCard, { StoreName } from "@/components/shared/ProductCard";

export default async function Page() {
  const discounts = await getDiscounts();

  return (
    <div className="flex gap-4 py-8 overflow-x-auto">
      <div className="shrink-0 w-0" />
      {discounts.map((item) => (
        <div key={item.id} className="shrink-0">
          <ProductCard
            imageUrl={item.product.imageUrl}
            brandName={item.product.brand.name}
            productName={item.product.name}
            price={item.price.toString()}
            oldPrice={item.oldPrice.toString()}
            stores={[item.store.name as StoreName]}
          />
        </div>
      ))}
      <div className="shrink-0 w-4" />
    </div>
  );
}
