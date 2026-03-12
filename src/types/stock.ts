// src/types/stock.ts

export interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  min_stock?: number;
  tags?: string[];
  unit_price?: number;
  sales_price?: number;
}

export interface StockItem {
  id: string;
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  products: Product; // A API retorna os dados do produto aninhados aqui
}

export interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  unit: string;
  current_stock: number;
  quantity: number;
}