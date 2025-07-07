export interface MenuItem {
  name: string;
  type: string;
  order: number;
  price: string;
  price_numeric: number;
  is_recommended: boolean;
}

export type MenuItems = MenuItem[];