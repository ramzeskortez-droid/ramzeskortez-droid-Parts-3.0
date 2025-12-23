
export enum OrderStatus {
  OPEN = 'ОТКРЫТ',
  CLOSED = 'ЗАКРЫТ',
}

export enum RowType {
  ORDER = 'ORDER',
  OFFER = 'OFFER'
}

// Ранги могут приходить как на английском, так и на русском из Google Sheets
export type RankType = 'LEADER' | 'RESERVE' | 'ЛИДЕР' | 'РЕЗЕРВ' | '';
export type PartCategory = 'Оригинал' | 'Б/У' | 'Аналог';
export type Currency = 'RUB' | 'USD' | 'CNY';

export interface CarDetails {
  model: string;
  bodyType: string;
  year: string;
  engine: string;
  transmission: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number; 
  color: string;
  address: string;
  category?: PartCategory;
  refImage?: string;
  
  // Seller side
  sellerPrice?: number;
  sellerCurrency?: Currency; // Валюта поставщика
  
  // Admin side (Client view)
  adminPrice?: number; // Цена утвержденная админом для клиента
  adminCurrency?: Currency; // Валюта для клиента
  
  offeredQuantity?: number;
  available?: boolean;
  rank?: RankType;
  comment?: string;
}

export interface Order {
  id: string;
  parentId?: string;
  type: RowType;
  vin: string;
  car?: CarDetails; // Новое поле для блока автомобиля
  items: OrderItem[];
  status: OrderStatus;
  createdAt: string; 
  location: string;
  clientName: string;
  visibleToClient?: 'Y' | 'N';
  offers?: Order[];
  // Добавлено для устранения ошибок Property 'isProcessed' does not exist on type 'Order'
  isProcessed?: boolean | 'Y' | 'N';
  // Добавлено для типизации оптимистичных обновлений в интерфейсе поставщика
  isSentOptimistic?: boolean;
  // Новое поле: подтверждение покупки клиентом
  readyToBuy?: boolean;
}
