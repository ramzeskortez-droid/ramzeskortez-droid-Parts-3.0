import { Order, OrderStatus, OrderItem, RowType, Currency } from '../types';

// Default URL provided by configuration
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

// Helper to handle API URL from localStorage or fallback to default
const getApiUrl = () => localStorage.getItem('GAS_API_URL') || DEFAULT_API_URL;

// New JSON-oriented structure matching Version 3.0 Backend
interface SheetRow {
  id: string;      // Col A (0)
  parentId: string;// Col B (1)
  type: string;    // Col C (2)
  status: string;  // Col D (3)
  vin: string;     // Col E (4)
  clientName: string; // Col F (5)
  summary: string; // Col G (6)
  json: string;    // Col H (7) - The source of truth for app logic
  rank: string;    // Col I (8) - Now "Readable Status" string (e.g. "✅ Item | 5000")
  createdAt: string; // Col J (9)
  location: string; // Col K (10)
  processed: string; // Col L (11) (Y/N)
  readyToBuy?: string; // Col M (12) (Y/N)
}

export class SheetService {
  private static cache: Order[] = [];
  private static lastFetch = 0;
  private static isMutationLocked = false;

  static isLocked() {
    return this.isMutationLocked;
  }

  static setMutationLock() {
    this.isMutationLocked = true;
    setTimeout(() => { this.isMutationLocked = false; }, 5000); // Auto unlock after 5s safety
  }

  // Reliable date parser for sorting and logic
  private static safeParseDate(str: string): number {
      if (!str) return 0;
      try {
          const clean = str.replace(/\n/g, ' ').replace(/\s+/g, ' ').split(/[\s,]/)[0];
          const parts = clean.split(/[\.\-\/]/);
          if (parts.length === 3) {
              const [d, m, y] = parts[0].length === 4 ? [parts[2], parts[1], parts[0]] : [parts[0], parts[1], parts[2]];
              return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
          }
      } catch (e) {}
      const native = new Date(str).getTime();
      return isNaN(native) ? 0 : native;
  }

  static async getOrders(force = false): Promise<Order[]> {
    if (!force && this.cache.length > 0 && (Date.now() - this.lastFetch < 10000)) {
      return this.cache;
    }

    const rawUrl = getApiUrl();
    if (!rawUrl) return [];
    const url = rawUrl.trim();

    try {
      const response = await fetch(`${url}?action=getData&_t=${Date.now()}`, {
        method: 'GET',
        redirect: 'follow'
      });
      
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      
      let rows: SheetRow[];
      try {
        rows = await response.json();
      } catch (e) {
        throw new Error("Invalid response format from server");
      }
      
      if (!Array.isArray(rows)) return [];

      const ordersMap = new Map<string, Order>();
      const offersList: { row: SheetRow, items: OrderItem[] }[] = [];

      rows.forEach(row => {
        let parsedItems: OrderItem[] = [];
        try {
          parsedItems = row.json ? JSON.parse(row.json) : [];
        } catch (e) {}

        if (row.type === 'ORDER') {
          const isProcessed = row.processed === 'Y';
          const carDetails = parsedItems.length > 0 ? (parsedItems[0] as any).car : undefined;

          ordersMap.set(row.id, {
            id: row.id,
            type: RowType.ORDER,
            vin: row.vin,
            status: row.status as OrderStatus,
            clientName: row.clientName,
            createdAt: row.createdAt,
            location: row.location,
            visibleToClient: isProcessed ? 'Y' : 'N',
            items: parsedItems,
            offers: [],
            car: carDetails,
            isProcessed: isProcessed,
            readyToBuy: row.readyToBuy === 'Y'
          });
        } else if (row.type === 'OFFER') {
          offersList.push({ row, items: parsedItems });
        }
      });

      offersList.forEach(({ row, items }) => {
        const parentOrder = ordersMap.get(row.parentId);
        if (parentOrder) {
          parentOrder.offers = parentOrder.offers || [];
          parentOrder.offers.push({
            id: row.id,
            parentId: row.parentId,
            type: RowType.OFFER,
            vin: row.vin,
            status: row.status as OrderStatus,
            clientName: row.clientName,
            createdAt: row.createdAt,
            location: row.location,
            visibleToClient: parentOrder.isProcessed ? 'Y' : 'N',
            items: items,
            isProcessed: true
          });
        }
      });

      const orders = Array.from(ordersMap.values());
      // Сортировка по времени создания (новые сверху)
      orders.sort((a, b) => this.safeParseDate(b.createdAt) - this.safeParseDate(a.createdAt));

      this.cache = orders;
      this.lastFetch = Date.now();
      return orders;

    } catch (error) {
      if (this.cache.length > 0) return this.cache;
      throw error;
    }
  }

  private static async postData(payload: any): Promise<void> {
    const rawUrl = getApiUrl();
    if (!rawUrl) throw new Error("API URL not set");
    const url = rawUrl.trim();

    await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
      },
      body: JSON.stringify(payload)
    });
  }

  static async createOrder(vin: string, items: any[], clientName: string, car: any): Promise<string> {
    const orderId = `ORD-${Math.floor(Math.random() * 100000)}`;
    const payload = {
      action: 'create',
      order: {
        id: orderId,
        type: 'ORDER',
        status: 'ОТКРЫТ',
        vin,
        clientName,
        createdAt: new Date().toLocaleString('ru-RU'),
        location: 'РФ',
        items: items.map(i => ({...i, car})),
        visibleToClient: 'N'
      }
    };

    await this.postData(payload);
    this.lastFetch = 0;
    return orderId;
  }

  static async createOffer(orderId: string, sellerName: string, items: any[], vin: string): Promise<void> {
    const offerId = `OFF-${Math.floor(Math.random() * 100000)}`;
    const payload = {
      action: 'create',
      order: {
        id: offerId,
        parentId: orderId,
        type: 'OFFER',
        status: 'ОТКРЫТ',
        vin,
        clientName: sellerName,
        createdAt: new Date().toLocaleString('ru-RU'),
        location: 'РФ',
        items: items,
        visibleToClient: 'N'
      }
    };

    await this.postData(payload);
    this.lastFetch = 0;
  }

  static async updateRank(vin: string, itemName: string, offerId: string, adminPrice?: number, adminCurrency?: Currency): Promise<void> {
    await this.postData({
      action: 'update_rank',
      vin,
      detailName: itemName,
      leadOfferId: offerId,
      adminPrice,
      adminCurrency
    });
    this.lastFetch = 0;
  }

  static async formCP(orderId: string): Promise<void> {
    await this.postData({
      action: 'form_cp',
      orderId
    });
    this.lastFetch = 0;
  }

  static async confirmPurchase(orderId: string): Promise<void> {
    await this.postData({
      action: 'confirm_purchase',
      orderId
    });
    this.lastFetch = 0;
  }
}