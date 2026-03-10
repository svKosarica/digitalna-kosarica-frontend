export interface Brand {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  brand: Brand;
  name: string;
  title: string;
  unit: string;
  imageUrl: string;
}

export interface Store {
  id: number;
  name: string;
  url: string;
  imageUrl: string;
}

export interface DiscountItem {
  id: number;
  product: Product;
  store: Store;
  price: number;
  oldPrice: number;
  pricePerUnit: number;
  discountPct: number;
  isAvailable: boolean;
  cardDiscount: boolean;
  url: string;
}
