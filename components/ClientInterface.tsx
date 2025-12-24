
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, PartCategory } from '../types';
import { Pagination } from './Pagination';
import { 
  Send, Plus, Trash2, Zap, CheckCircle2, Car, MoreHorizontal, Calculator, Search, Loader2, ChevronDown, ShoppingCart, Archive, UserCircle2, LogOut, ShieldCheck, Phone, X, Calendar, Clock, Hash, Package, Ban, RefreshCw, AlertCircle, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

// --- DATA CONSTANTS ---

const POPULAR_BRANDS_LIST = [
  "Lada (ВАЗ)", "Audi", "BMW", "Changan", "Chery", "Chevrolet", "Daewoo", "Ford", "Geely", "Haval", "Honda", "Hyundai", 
  "Jaecoo", "JETOUR", "Kia", "Land Rover", "Lexus", "Mazda", "Mercedes-Benz", "Mitsubishi", "Nissan", "Omoda", "Opel", 
  "Peugeot", "Renault", "Skoda", "Subaru", "TENET", "Toyota", "Volkswagen"
];

const ALL_BRANDS_LIST = [
  "Abarth", "AC", "Acura", "Adam", "Adler", "Aito", "Aiways", "Aixam", "Alfa Romeo", "Alpina", "Alpine", "AM General", "Ambertruck", "AMC", "Apal", "Arcfox", "Ariel", "Aro", "Asia", "Aston Martin", "Auburn", "Audi", "Aurus", "Austin", "Austin Healey", "Auto Union", "Autobianchi", "Avatr", "BAIC", "Bajaj", "Baltijas Dzips", "Baojun", "Batmobile", "BAW", "Belgee", "Bentley", "Bertone", "Bestune", "Bilenkin", "Bio Auto", "Bitter", "Blaval", "BMW", "Borgward", "Brabus", "Brilliance", "Bristol", "Bufori", "Bugatti", "Buick", "BYD", "Byvin", "Cadillac", "Callaway", "Carbodies", "Caterham", "Chana", "Changan", "Changfeng", "Changhe", "Chery", "Chevrolet", "Chrysler", "Ciimo (Dongfeng-Honda)", "Citroen", "Cizeta", "Coda", "Coggiola", "Cord", "Cowin", "Cupra", "Dacia", "Dadi", "Daewoo", "Daihatsu", "Daimler", "Dallara", "Datsun", "Dayun", "De Tomaso", "Deco Rides", "Delage", "DeLorean", "Denza", "Derways", "DeSoto", "DKW", "Dodge", "Dongfeng", "Doninvest", "Donkervoort", "DR", "DS", "DW Hower", "E-Car", "Eagle", "Eagle Cars", "Enovate (Enoreve)", "Eonyx", "Everus", "Evolute", "Excalibur", "Exeed", "Facel Vega", "FAW", "Ferrari", "Fiat", "Fisker", "Flanker", "Ford", "Forthing", "Foton", "Franklin", "FSO", "FSR", "Fuqi", "GAC", "GAC Aion", "GAC Trumpchi", "Geely", "Genesis", "Geo", "GMA", "GMC", "Goggomobil", "Gonow", "Gordon", "GP", "Great Wall", "Hafei", "Haima", "Hanomag", "Hanteng", "Haval", "Hawtai", "Hedmos", "Heinkel", "Hennessey", "Hindustan", "HiPhi", "Hispano-Suiza", "Holden", "Honda", "Hongqi", "Horch", "Hozon", "HSV", "Huaihai (Hoann)", "HuangHai", "Huazi", "Hudson", "Humber", "Hummer", "Hycan", "Hyperion", "Hyundai", "iCar", "iCaur", "IM Motors (Zhiji)", "Ineos", "Infiniti", "Innocenti", "International Harvester", "Invicta", "Iran Khodro", "Isdera", "Isuzu", "Iveco", "JAC", "Jaecoo", "Jaguar", "Jeep", "Jensen", "JETOUR", "Jetta", "Jiangnan", "Jidu", "Jinbei", "JMC", "JMEV", "Jonway", "Kaiyi", "Karma", "Kawei", "KGM", "Kia", "Knewstar", "Koenigsegg", "KTM AG", "KYC", "Lada (ВАЗ)", "Lamborghini", "Lancia", "Land Rover", "Landwind", "Leapmotor", "Letin", "LEVC", "Lexus", "Li Auto (Lixiang)", "Liebao Motor", "Lifan", "Ligier", "Lincoln", "Lingxi", "Livan", "Logem", "Lotus", "LTI", "Lucid", "Luxeed", "Luxgen", "Lynk & Co", "M-Hero", "Maextro", "Mahindra", "Maple", "Marcos", "Marlin", "Marussia", "Maruti", "Maserati", "Matra", "Maxus", "Maybach", "Mazda", "McLaren", "Mega", "Mercedes-Benz", "Mercury", "Merkur", "Messerschmitt", "Metrocab", "MG", "Micro", "Microcar", "Minelli", "Mini", "Mitsubishi", "Mitsuoka", "Mobilize", "Morgan", "Morris", "Nash", "Nio", "Nissan", "Noble", "Nordcross", "Oldsmobile", "Oltcit", "Omoda", "Opel", "Ora", "Orange", "Osca", "Oshan", "Oting", "Overland", "Packard", "Pagani", "Panoz", "Perodua", "Peugeot", "PGO", "Piaggio", "Pierce-Arrow", "Plymouth", "Polar Stone (Jishi)", "Polestar", "Pontiac", "Porsche", "Premier", "Proton", "Puch", "Puma", "Punk", "Qiantu", "Qingling", "Qoros", "Qvale", "Radar", "Radford", "Ram", "Ravon", "Rayton Fissore", "Reliant", "Renaissance", "Renault", "Renault Samsung", "Rezvani", "Rimac", "Rinspeed", "Rising Auto", "Rivian", "Roewe", "Rolls-Royce", "Ronart", "Rossa", "Rover", "Rox", "Saab", "SAIC", "Saipa", "Saleen", "Sandstorm", "Santana", "Saturn", "Scion", "Scout", "Sears", "SEAT", "Seres", "Shanghai Maple", "ShuangHuan", "Simca", "Skoda", "Skywell", "Skyworth", "Smart", "Solaris", "Sollers", "Soueast", "Spectre", "Spyker", "SsangYong", "Stelato", "Steyr", "Studebaker", "Subaru", "Suzuki", "SWM", "Talbot", "Tank", "Tata", "Tatra", "Tazzari", "TENET", "Tesla", "Thairung", "Think", "Tianma", "Tianye", "Tofas", "Toyota", "Trabant", "Tramontana", "Triumph", "TVR", "Ultima", "Vauxhall", "Vector", "Venturi", "Venucia", "VGV", "VinFast", "Volga", "Volkswagen", "Volvo", "Vortex", "Voyah", "VUHL", "W Motors", "Wanderer", "Wartburg", "Weltmeister", "Westfield", "Wey", "Wiesmann", "Willys", "Wuling", "Xcite", "XEV", "Xiaomi", "Xin Kai", "Xpeng", "Yema", "Yipai", "Yudo", "Yulon", "Zastava", "Zeekr", "Zenos", "Zenvo", "Zhido", "Zibar", "Zotye", "Zubr", "ZX", "Автокам", "Амберавто", "Атом", "ГАЗ", "ЗАЗ", "ЗИЛ", "ЗиС", "Иж", "Канонир", "Комбат", "ЛуАЗ", "Москвич", "Руссо-Балт", "СМЗ", "Спортивные авто и реплики", "ТагАЗ", "УАЗ", "Яндекс Ровер", "Ё-мобиль"
];

const FULL_BRAND_SET = new Set([...POPULAR_BRANDS_LIST, ...ALL_BRANDS_LIST]);

// Demo Data
const DEMO_ITEMS_POOL = [
    { name: "Фильтр масляный", category: "Оригинал" },
    { name: "Колодки передние", category: "Аналог" },
    { name: "Бампер передний", category: "Б/У" },
    { name: "Свеча зажигания", category: "Оригинал" },
    { name: "Рычаг подвески", category: "Аналог" },
    { name: "Фара левая LED", category: "Б/У" },
    { name: "Масло 5W30 5л", category: "Оригинал" },
    { name: "Диск тормозной", category: "Аналог" },
    { name: "Радиатор охлаждения", category: "Аналог" },
    { name: "Стойка стабилизатора", category: "Оригинал" }
];

// Helper to generate full VIN
const generateVin = (prefix: string) => {
    const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
    let result = prefix;
    while (result.length < 17) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const DEMO_CARS = [
    { brand: "BMW", model: "X5 G05", prefix: "WBA" },
    { brand: "Toyota", model: "Camry V70", prefix: "JT1" },
    { brand: "Kia", model: "Rio 4", prefix: "Z94" },
    { brand: "Mercedes-Benz", model: "E-Class W213", prefix: "WDB" },
    { brand: "Volkswagen", model: "Tiguan II", prefix: "XW8" },
    { brand: "Hyundai", model: "Solaris", prefix: "X7M" },
    { brand: "Lexus", model: "RX 350", prefix: "JTJ" },
    { brand: "Skoda", model: "Octavia A7", prefix: "TMB" }
];

export const ClientInterface: React.FC = () => {
  const [clientAuth, setClientAuth] = useState(() => {
    const saved = localStorage.getItem('client_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('client_auth'));
  const [tempAuth, setTempAuth] = useState({ name: '', phone: '' });
  const [phoneFlash, setPhoneFlash] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [vin, setVin] = useState('');
  const [car, setCar] = useState({ brand: '', model: '', bodyType: '', year: '', engine: '', transmission: '' });
  const [items, setItems] = useState([{ name: '', quantity: 1, color: '', category: 'Оригинал' as PartCategory, refImage: '' }]);
  
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandListRef = useRef<HTMLDivElement>(null);
  const brandInputRef = useRef<HTMLInputElement>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'processed' | 'archive'>('processed');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);

  const [refuseModalOrder, setRefuseModalOrder] = useState<Order | null>(null);
  
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null); 

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const fetchOrders = async () => {
    setIsSyncing(true);
    try {
      const data = await SheetService.getOrders(true);
      
      const myOrders = clientAuth?.name 
        ? data.filter(o => o.clientName === clientAuth.name)
        : [];

      setOrders(prev => {
         const optimisticPending = prev.filter(o => o.id.startsWith('temp-'));
         return [...optimisticPending, ...myOrders];
      });
    } catch (e) { console.error(e); }
    finally { setIsSyncing(false); }
  };

  useEffect(() => { 
    if (clientAuth) {
        fetchOrders(); 
        const interval = setInterval(() => fetchOrders(), 15000);
        return () => clearInterval(interval);
    }
  }, [clientAuth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortConfig]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (brandListRef.current && !brandListRef.current.contains(event.target as Node) && 
            brandInputRef.current && !brandInputRef.current.contains(event.target as Node)) {
            setIsBrandOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatPhoneNumber = (value: string) => {
    let digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits[0] === '8') digits = '7' + digits.slice(1);
    else if (digits[0] !== '7') digits = '7' + digits;
    const match = digits.match(/^(\d{1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
    if (!match) return '+7'; 
    let formatted = `+${match[1]}`;
    if (match[2]) formatted += ` (${match[2]}`;
    if (match[3]) formatted += `) ${match[3]}`;
    if (match[4]) formatted += `-${match[4]}`;
    if (match[5]) formatted += `-${match[5]}`;
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digitsOnly = val.replace(/\D/g, '');
    if (digitsOnly.length > 11) {
        setPhoneFlash(true);
        setTimeout(() => setPhoneFlash(false), 300); 
        return; 
    }
    setTempAuth({...tempAuth, phone: formatPhoneNumber(val)});
  };

  const isPhoneValid = (phone: string) => phone.length === 18;

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempAuth.name.trim()) return;
    if (!isPhoneValid(tempAuth.phone)) return;
    const authData = { name: tempAuth.name.trim().toUpperCase(), phone: tempAuth.phone.trim() };
    setClientAuth(authData);
    localStorage.setItem('client_auth', JSON.stringify(authData));
    setShowAuthModal(false);
  };

  const handleDemoLogin = (num: 1 | 2) => {
    const demo = num === 1 
      ? { name: 'КЛИЕНТ № 1', phone: '+7 (999) 111-22-33' }
      : { name: 'КЛИЕНТ № 2', phone: '+7 (999) 444-55-66' };
    setClientAuth(demo);
    localStorage.setItem('client_auth', JSON.stringify(demo));
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('client_auth');
    setClientAuth(null);
    setOrders([]); 
    setShowAuthModal(true);
    setVin('');
    setCar({ brand: '', model: '', bodyType: '', year: '', engine: '', transmission: '' });
    setItems([{ name: '', quantity: 1, color: '', category: 'Оригинал' as PartCategory, refImage: '' }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'quantity') value = Math.min(1000, Math.max(1, value));
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const isValidBrand = useMemo(() => {
      return !!car.brand && FULL_BRAND_SET.has(car.brand);
  }, [car.brand]);

  const isFormValid = useMemo(() => {
      const hasItems = items.length > 0 && items.every(i => i.name.trim().length > 0);
      return isValidBrand && hasItems;
  }, [isValidBrand, items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    const finalCar = { ...car, model: `${car.brand} ${car.model}`.trim() };
    const tempId = `temp-${Date.now()}`;
    const finalVin = vin || 'N/A'; 

    const optimisticOrder: any = {
        id: tempId,
        vin: finalVin,
        clientName: clientAuth.name,
        car: finalCar,
        items,
        status: OrderStatus.OPEN,
        createdAt: new Date().toLocaleString('ru-RU'),
        offers: [],
        readyToBuy: false
    };

    setOrders(prev => [optimisticOrder, ...prev]);
    setVin('');
    setCar({ brand: '', model: '', bodyType: '', year: '', engine: '', transmission: '' });
    setItems([{ name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }]);

    try {
        const realId = await SheetService.createOrder(finalVin, items, clientAuth.name, finalCar, clientAuth.phone);
        setOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o));
        setHighlightedId(realId); 
        setSuccessToast({ message: `Заказ ${realId} успешно создан`, id: Date.now().toString() });
        setTimeout(() => setHighlightedId(null), 2000); 
        setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
        console.error("Order creation failed", err);
        setOrders(prev => prev.filter(o => o.id !== tempId));
        alert("Ошибка при создании заказа. Проверьте интернет.");
    }
  };

  const handleConfirmPurchase = async (orderId: string) => {
    setIsConfirming(orderId);
    try {
      await SheetService.confirmPurchase(orderId);
      setVanishingIds(prev => new Set(prev).add(orderId));
      setSuccessToast({ message: `Заявка на покупку отправлена! Перемещено в архив.`, id: Date.now().toString() });
      setTimeout(() => setSuccessToast(null), 4000);
      setTimeout(() => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, readyToBuy: true } : o));
        setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
        fetchOrders();
      }, 700);
    } catch (e) {
      console.error(e);
      alert('Ошибка при подтверждении покупки.');
    } finally {
      setIsConfirming(null);
    }
  };

  const openRefuseModal = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setRefuseModalOrder(order);
  };

  const confirmRefusal = async () => {
    if (!refuseModalOrder) return;
    const orderId = refuseModalOrder.id;
    
    setIsConfirming(orderId);
    setRefuseModalOrder(null);
    
    try {
      await SheetService.refuseOrder(orderId, "Отмена клиентом", 'CLIENT'); 
      setVanishingIds(prev => new Set(prev).add(orderId));
      setSuccessToast({ message: `Заказ ${orderId} аннулирован`, id: Date.now().toString() });
      setTimeout(() => setSuccessToast(null), 3000);

      setTimeout(() => {
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isRefused: true, refusalReason: "Отмена клиентом" } : o));
          setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
          fetchOrders();
      }, 700);
    } catch (e) {
      console.error(e);
      alert('Ошибка при отказе.');
    } finally {
        setIsConfirming(null);
    }
  };

  const handleDemoForm = () => {
    // Random Car
    const randomCar = DEMO_CARS[Math.floor(Math.random() * DEMO_CARS.length)];
    // GENERATE FULL VIN
    const randomVin = generateVin(randomCar.prefix);
    const randomYear = Math.floor(Math.random() * (2026 - 2000 + 1) + 2000).toString();
    
    // Random Items (1 to 4)
    const itemCount = Math.floor(Math.random() * 4) + 1;
    const shuffledItems = [...DEMO_ITEMS_POOL].sort(() => 0.5 - Math.random());
    const selectedItems = shuffledItems.slice(0, itemCount).map(i => ({
        ...i,
        quantity: Math.floor(Math.random() * 2) + 1,
        color: '',
        refImage: ''
    }));

    setVin(randomVin);
    setCar({ 
        brand: randomCar.brand, 
        model: randomCar.model, 
        bodyType: 'Седан', 
        year: randomYear, 
        engine: '2.0L', 
        transmission: 'Auto' 
    });
    setItems(selectedItems);
  };

  const handleSort = (key: string) => {
      setSortConfig(current => {
          if (current?.key === key) {
              return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
          }
          return { key, direction: 'asc' };
      });
  };

  const counts = useMemo(() => {
    const processed = orders.filter(o => o.status === OrderStatus.OPEN && !o.readyToBuy && !o.isRefused).length;
    const archive = orders.filter(o => o.status === OrderStatus.CLOSED || o.readyToBuy || o.isRefused).length;
    return { processed, archive };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders.filter(o => {
        let inTab = false;
        if (activeTab === 'archive') inTab = o.status === OrderStatus.CLOSED || o.readyToBuy || o.isRefused;
        else inTab = o.status === OrderStatus.OPEN && !o.readyToBuy && !o.isRefused;
        if (!inTab) return false;

        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        if (o.id.toLowerCase().includes(q)) return true;
        if (o.vin.toLowerCase().includes(q)) return true;
        if (o.car?.model?.toLowerCase().includes(q)) return true;
        if (o.items.some(i => i.name.toLowerCase().includes(q))) return true;
        return false;
    });

    if (sortConfig) {
        result = [...result].sort((a, b) => {
            let aVal: any = '';
            let bVal: any = '';

            switch (sortConfig.key) {
                case 'id':
                    aVal = a.id; bVal = b.id;
                    break;
                case 'model':
                    aVal = a.car?.model || ''; bVal = b.car?.model || '';
                    break;
                case 'items':
                    aVal = a.items.length; bVal = b.items.length;
                    break;
                case 'date':
                    // Date parsing
                    const parseD = (d: string) => {
                        const [day, month, year] = d.split(/[\.\,]/);
                        return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
                    };
                    aVal = parseD(a.createdAt); bVal = parseD(b.createdAt);
                    break;
                case 'status':
                    // Logic: Ready -> Processed -> New
                    const getStatusWeight = (o: Order) => {
                        if (o.readyToBuy) return 3;
                        const hasWinner = o.offers?.some(off => off.items.some(i => i.rank === 'ЛИДЕР'));
                        if (hasWinner) return 2;
                        if (o.isRefused) return 0;
                        return 1;
                    };
                    aVal = getStatusWeight(a); bVal = getStatusWeight(b);
                    break;
                default:
                    return 0;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
  }, [orders, activeTab, searchQuery, sortConfig]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const getCurrencySymbol = (curr: string = 'RUB') => {
      switch(curr) {
          case 'USD': return '$';
          case 'CNY': return '¥';
          default: return '₽';
      }
  };

  const filteredBrands = useMemo(() => {
      const q = car.brand.toLowerCase();
      if (!q) return POPULAR_BRANDS_LIST;
      return ALL_BRANDS_LIST.filter(b => b.toLowerCase().includes(q));
  }, [car.brand]);

  // Helper for Sort Icons
  const SortIcon = ({ column }: { column: string }) => {
      if (sortConfig?.key !== column) return <ArrowUpDown size={10} className="text-slate-300 ml-1 opacity-50 group-hover:opacity-100 transition-opacity" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={10} className="text-indigo-600 ml-1" /> : <ArrowDown size={10} className="text-indigo-600 ml-1" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4 relative">
      {successToast && (
          <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <div><p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Успешно</p><p className="text-xs font-bold">{successToast.message}</p></div>
              </div>
          </div>
      )}

      {refuseModalOrder && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setRefuseModalOrder(null)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                          <AlertCircle size={24}/>
                      </div>
                      <div>
                          <h3 className="text-lg font-black uppercase text-slate-900">Отказаться от заказа?</h3>
                          <p className="text-xs text-slate-500 font-bold mt-1">Это действие отменит заказ {refuseModalOrder.id}. Восстановить его будет нельзя.</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 w-full mt-2">
                          <button onClick={() => setRefuseModalOrder(null)} className="py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase hover:bg-slate-200 transition-colors">Нет, вернуться</button>
                          <button onClick={confirmRefusal} className="py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Да, отказаться</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-[400px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100"><ShieldCheck size={40} /></div>
             <div className="text-center space-y-1"><h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Вход клиента</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Авторизуйтесь для работы с заказами</p></div>
             <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => handleDemoLogin(1)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1"><UserCircle2 size={16}/> Демо Клиент 1</button>
                <button onClick={() => handleDemoLogin(2)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1"><UserCircle2 size={16}/> Демо Клиент 2</button>
             </div>
             <div className="w-full flex items-center gap-4 py-2"><div className="flex-grow h-px bg-slate-100"></div><span className="text-[9px] font-bold text-slate-300 uppercase">или создайте новый</span><div className="flex-grow h-px bg-slate-100"></div></div>
             <form onSubmit={handleLogin} className="w-full space-y-3">
                 <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Имя</label><input autoFocus value={tempAuth.name} onChange={e => setTempAuth({...tempAuth, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-600 uppercase" placeholder="ИМЯ" /></div>
                 <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Номер телефона</label><input value={tempAuth.phone} onChange={handlePhoneChange} className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none transition-all duration-300 ${phoneFlash ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-600'}`} placeholder="+7 (XXX) XXX-XX-XX" /></div>
                 <button type="submit" disabled={!tempAuth.name || !isPhoneValid(tempAuth.phone)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:active:scale-100">Создать аккаунт</button>
             </form>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner"><UserCircle2 size={24}/></div>
            <div className="flex flex-col"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Личный кабинет клиента</span><div className="flex items-center gap-2"><h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{clientAuth?.name || 'Гость'}</h3><div className="flex items-center gap-1 text-slate-400"><Phone size={10}/> <span className="text-[10px] font-bold">{clientAuth?.phone || '...'}</span></div></div></div>
         </div>
         <button onClick={handleLogout} className="p-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-100 flex items-center gap-2 group"><span className="text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">Выход</span><LogOut size={18}/></button>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div className="flex items-center gap-2"><Car size={14} className="text-slate-500"/><h2 className="text-[11px] font-bold uppercase tracking-tight">Новая заявка</h2></div>
           <button onClick={handleDemoForm} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100 uppercase"><Zap size={10}/> Демо заказ</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">VIN / Шасси</label><input value={vin} onChange={e => setVin(e.target.value.toUpperCase())} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md font-mono text-[10px] outline-none focus:border-indigo-500 transition-colors" placeholder="WBA..." /></div>
              <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Имя Клиента</label><input value={clientAuth?.name || ''} readOnly className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-400 outline-none cursor-not-allowed" /></div>
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1 relative">
                      <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Марка (Бренд)</label>
                      <div className="relative">
                          {/* Brand input with stronger validation style: Red if empty */}
                          <input ref={brandInputRef} value={car.brand} onChange={(e) => { setCar({...car, brand: e.target.value}); setIsBrandOpen(true); }} onFocus={() => setIsBrandOpen(true)} className={`w-full px-3 py-1.5 bg-white border rounded-md text-[10px] font-bold uppercase outline-none focus:border-indigo-500 transition-colors ${!car.brand ? 'border-red-400 bg-red-50/30 ring-1 ring-red-100' : 'border-slate-300'}`} placeholder="Введите марку..." />
                          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                      </div>
                      {isBrandOpen && (<div ref={brandListRef} className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100">{filteredBrands.length > 0 ? (filteredBrands.map((brand, idx) => (<div key={brand} onClick={() => { setCar({...car, brand}); setIsBrandOpen(false); }} className="px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer uppercase">{brand}</div>))) : (<div className="px-3 py-2 text-[10px] text-slate-400 italic">Ничего не найдено</div>)}</div>)}
                      {/* Only show explicit error text if dropdown isn't open and brand is NOT valid but present (invalid input) */}
                      {!isValidBrand && car.brand.length > 0 && !isBrandOpen && (<div className="text-[8px] font-bold text-red-500 mt-1 absolute -bottom-4 left-0">Выберите марку из списка</div>)}
                  </div>
                  <div className="space-y-1"><label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Модель</label><input value={car.model} onChange={e => setCar({...car, model: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-md text-[10px] font-bold outline-none uppercase focus:border-indigo-500" placeholder="Напишите модель (X5, Camry...)" /></div>
                  <div className="space-y-1"><label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Год выпуска</label><input value={car.year} onChange={e => setCar({...car, year: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-md text-[10px] font-bold text-center focus:border-indigo-500" placeholder="202X" /></div>
              </div>
          </div>
          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-950 ml-1">Позиции заказа</label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start group">
                <div className="flex-grow bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2"><input value={item.name} maxLength={90} onChange={e => updateItem(idx, 'name', e.target.value)} className={`w-full px-2 py-1 bg-slate-50 border rounded text-[10px] font-bold outline-none focus:border-indigo-300 transition-colors ${!item.name.trim() ? 'border-red-300 bg-red-50' : 'border-slate-100'}`} placeholder="Название детали (макс. 90 симв.)" /></div>
                    <div className="relative"><select value={item.category} onChange={e => updateItem(idx, 'category', e.target.value as PartCategory)} className="w-full appearance-none px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black uppercase pr-8 outline-none"><option>Оригинал</option><option>Б/У</option><option>Аналог</option></select><ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" /></div>
                    <div className="flex items-center gap-1"><input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} className="w-full px-1 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] text-center font-black" /></div>
                  </div>
                </div>
                <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} className="mt-4 p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }])} className="text-[9px] font-bold text-indigo-600 uppercase hover:underline flex items-center gap-1"><Plus size={10}/> Добавить деталь</button>
          </div>
          <button type="submit" disabled={!isFormValid} className={`w-full py-3 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${isFormValid ? 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}><Send className="w-4 h-4" /> Отправить запрос</button>
        </form>
      </section>

      <div className="space-y-4">
        <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по VIN, номеру заказа или названию детали..." className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" /></div>
        <div className="flex justify-between items-end border-b border-slate-200">
            <div className="flex gap-2 pb-1">
              <button onClick={() => setActiveTab('processed')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'processed' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>В обработке {counts.processed > 0 && <span className="ml-1 bg-indigo-50 text-indigo-700 px-1.5 rounded-sm">({counts.processed})</span>}</button>
              <button onClick={() => setActiveTab('archive')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'archive' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400'}`}>Архив {counts.archive > 0 && <span className="ml-1 opacity-40">({counts.archive})</span>}</button>
            </div>
            <button onClick={() => fetchOrders()} className="mb-1.5 p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''}/></button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-50 relative group hidden md:block">
            {/* UPDATED HEADER GRID: Added Sort Headers */}
            <div className="grid grid-cols-[80px_1fr_130px_50px_80px_110px_20px] gap-3 text-[9px] font-black uppercase text-slate-400 tracking-wider select-none">
               <div className="cursor-pointer flex items-center group" onClick={() => handleSort('id')}>№ заказа <SortIcon column="id"/></div>
               <div className="cursor-pointer flex items-center group" onClick={() => handleSort('model')}>Модель <SortIcon column="model"/></div>
               <div>VIN</div>
               <div className="cursor-pointer flex items-center group" onClick={() => handleSort('items')}>Поз. <SortIcon column="items"/></div>
               <div className="cursor-pointer flex items-center group" onClick={() => handleSort('date')}>Дата <SortIcon column="date"/></div>
               <div className="text-right cursor-pointer flex items-center justify-end group" onClick={() => handleSort('status')}>Статус <SortIcon column="status"/></div>
               <div></div>
            </div>
          </div>
          
          {filteredOrders.length === 0 && <div className="p-8 text-center text-[10px] text-slate-400 font-bold uppercase italic tracking-widest">Список пуст</div>}
          {paginatedOrders.map(order => {
            const isExpanded = expandedId === order.id;
            const isVanishing = vanishingIds.has(order.id);
            const isOptimistic = order.id.startsWith('temp-');
            const isHighlighted = highlightedId === order.id;
            
            const visibleOffers = (order.offers || []).filter(off => off.visibleToClient === 'Y');
            const winningItems = visibleOffers.flatMap(off => off.items.filter(i => i.rank === 'ЛИДЕР' || i.rank === 'LEADER'));
            const hasWinning = winningItems.length > 0;
            const totalSum = winningItems.reduce((acc, item) => acc + ((item.adminPrice ?? item.sellerPrice ?? 0) * (item.offeredQuantity || item.quantity)), 0);
            const symbol = getCurrencySymbol(winningItems[0]?.adminCurrency || winningItems[0]?.sellerCurrency || 'RUB');

            const orderDate = order.createdAt ? order.createdAt.split(/[\n,]/)[0] : '';
            const itemsCount = order.items.length;
            const displayModel = order.car?.AdminModel || order.car?.model || 'БЕЗ МОДЕЛИ';
            
            const containerStyle = isVanishing ? "opacity-0 max-h-0 py-0 overflow-hidden" : isHighlighted ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200" : order.isRefused ? "bg-red-50 border-red-200 opacity-60 grayscale-[0.5]" : isExpanded ? 'border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3' : 'hover:bg-slate-50/30 border-l-transparent border-b border-slate-100 last:border-0';

            return (
              <div key={order.id} className={`transition-all duration-700 border-l-4 ${containerStyle}`}>
                 {/* UPDATED ROW GRID: Matching Header */}
                 <div className="p-3 grid grid-cols-[80px_1fr_130px_50px_80px_110px_20px] items-center gap-3 cursor-pointer min-h-[56px]" onClick={() => !isVanishing && !isOptimistic && setExpandedId(isExpanded ? null : order.id)}>
                    <div className="flex items-center text-left">{isOptimistic ? (<div className="flex items-center gap-1.5 text-indigo-500"><Loader2 size={12} className="animate-spin"/><span className="text-[9px] font-bold uppercase tracking-wider">Создание</span></div>) : (<span className="font-mono font-bold text-[10px] text-slate-900 truncate block">{order.id}</span>)}</div>
                    <div className="flex flex-col justify-center min-w-0 text-left"><span className="font-bold text-[10px] text-slate-700 uppercase leading-none truncate block">{displayModel}</span></div>
                    <div className="flex items-center text-left"><span className="font-mono font-bold text-[10px] text-slate-500 uppercase leading-none tracking-tight truncate block">{order.vin}</span></div>
                    <div className="flex items-center gap-1 text-left"><Package size={12} className="text-slate-300"/><span className="text-[9px] font-bold text-slate-500">{itemsCount}</span></div>
                    <div className="flex items-center gap-1 text-left"><Calendar size={12} className="text-slate-300"/><span className="text-[9px] font-bold text-slate-500">{orderDate}</span></div>
                    <div className="flex justify-end text-right">
                        {order.isRefused ? (
                            <span className="px-2 py-1 rounded-md font-black text-[8px] uppercase bg-red-100 text-red-600 whitespace-nowrap shadow-sm flex items-center gap-1"><Ban size={10}/> АННУЛИРОВАН</span>
                        ) : order.readyToBuy ? (
                            <span className="px-2 py-1 rounded-md font-black text-[8px] uppercase bg-emerald-600 text-white whitespace-nowrap shadow-sm">КУПЛЕНО</span>
                        ) : (
                            // CHANGED: Status "В ОБРАБОТКЕ" is now YELLOW (amber) with amber border
                            <span className={`px-2 py-1 rounded-md font-bold text-[8px] uppercase whitespace-nowrap shadow-sm border ${hasWinning ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                {hasWinning ? 'ГОТОВО' : 'В ОБРАБОТКЕ'}
                            </span>
                        )}
                    </div>
                    <div className="flex justify-end">{isOptimistic ? null : <MoreHorizontal size={14} className="text-slate-300" />}</div>
                 </div>

                 {isExpanded && !isVanishing && !isOptimistic && (
                   <div className="p-4 bg-white border-t border-slate-100 animate-in fade-in duration-200 rounded-b-lg" onClick={e => e.stopPropagation()}>
                      {!hasWinning && (
                          <div className="space-y-3">
                             <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2"><Search size={12}/> Запрашиваемые позиции</h4>
                             <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">{order.items.map((item, idx) => (<div key={idx} className="bg-white p-3 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div><div><span className="text-[10px] font-black text-slate-900 block uppercase">{item.AdminName || item.name}</span><span className="text-[8px] font-bold text-slate-400 uppercase">{item.category} | {item.AdminQuantity || item.quantity} шт</span></div></div><div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded text-[9px] font-bold text-slate-400 uppercase"><Clock size={10} className="text-slate-300"/> В очереди</div></div>))}</div>
                          </div>
                      )}
                      
                      {(hasWinning || order.isRefused) && (
                        <div className="space-y-3">
                           {hasWinning && <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-950 flex items-center gap-2 mb-2"><CheckCircle2 size={12} className="text-emerald-500"/> Согласованные позиции</h4>}
                           <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              {hasWinning && (
                                  <div className="divide-y divide-slate-100">
                                    {winningItems.map((item, idx) => {
                                         const finalPrice = item.adminPrice ?? item.sellerPrice ?? 0;
                                         const curSymbol = getCurrencySymbol(item.adminCurrency ?? item.sellerCurrency ?? 'RUB');
                                         const displayName = item.AdminName || item.name;
                                         const displayQty = item.AdminQuantity || item.offeredQuantity || item.quantity;
                                         return (
                                            <div key={idx} className="bg-white p-3 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3"><div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div><div><span className="text-[10px] font-black text-slate-900 block uppercase">{displayName}</span><span className="text-[8px] font-bold text-slate-400 uppercase">{item.category} | {displayQty} шт</span></div></div>
                                                <div className="text-right"><div className="text-[10px] font-black text-slate-900">{(finalPrice * displayQty).toLocaleString()} {curSymbol}</div><div className="text-[8px] text-slate-400 font-bold">{finalPrice.toLocaleString()} {curSymbol} / шт</div></div>
                                            </div>
                                         );
                                    })}
                                  </div>
                              )}
                              
                              <div className="bg-slate-900 text-white p-4 flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
                                  <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4 w-full md:w-auto">
                                      {hasWinning && (
                                          <div className="flex items-center gap-4 whitespace-nowrap">
                                              <div className="flex items-center gap-2"><Calculator size={14} className="text-emerald-400"/><span className="font-black text-[10px] uppercase tracking-widest">Итого к оплате</span></div>
                                              <div className="text-base font-black tracking-tight">{totalSum.toLocaleString()} {symbol}</div>
                                          </div>
                                      )}
                                      
                                      {order.isRefused && (
                                          <div className="flex items-center gap-2 w-full md:w-auto max-w-full">
                                              <div className="text-[10px] text-red-300 font-bold uppercase flex items-center gap-2 bg-red-950/50 px-3 py-1.5 rounded-lg border border-red-900/50 w-full truncate">
                                                  <AlertCircle size={12} className="shrink-0"/> 
                                                  <span className="truncate">Причина: {order.refusalReason || "Не указана"}</span>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                                  
                                  {!order.readyToBuy && !order.isRefused ? (
                                    <div className="flex gap-2 w-full md:w-auto shrink-0">
                                        <button 
                                            type="button" 
                                            onClick={(e) => openRefuseModal(e, order)} 
                                            className="flex-1 md:flex-none px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white whitespace-nowrap"
                                        >
                                            <X size={14}/> Отказаться
                                        </button>
                                        <button onClick={() => handleConfirmPurchase(order.id)} disabled={!!isConfirming} className="flex-[2] md:flex-none px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 whitespace-nowrap">{isConfirming === order.id ? <Loader2 size={14} className="animate-spin"/> : <ShoppingCart size={14}/>} Готов купить</button>
                                    </div>
                                  ) : (
                                      !order.isRefused && (
                                        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-emerald-500/20 border-emerald-500/30 text-emerald-400 w-full md:w-auto justify-center md:justify-start">
                                            <Archive size={14}/>
                                            <span className="text-[9px] font-black uppercase whitespace-nowrap">В Архиве (Оплачено)</span>
                                        </div>
                                      )
                                  )}
                              </div>
                           </div>
                        </div>
                      )}
                   </div>
                 )}
              </div>
            );
          })}
          <Pagination totalItems={filteredOrders.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
        </div>
      </div>
    </div>
  );
};
