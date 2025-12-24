import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, PartCategory } from '../types';
import { Pagination } from './Pagination';
import { 
  Send, Plus, Trash2, Zap, CheckCircle2, Car, MoreHorizontal, Calculator, Search, Loader2, ChevronDown, ShoppingCart, Archive, UserCircle2, LogOut, ShieldCheck, Phone, X, Calendar, Clock, Hash, Package
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

// Combine unique sets
const FULL_BRAND_SET = new Set([...POPULAR_BRANDS_LIST, ...ALL_BRANDS_LIST]);

export const ClientInterface: React.FC = () => {
  // Auth state
  const [clientAuth, setClientAuth] = useState(() => {
    const saved = localStorage.getItem('client_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('client_auth'));
  const [tempAuth, setTempAuth] = useState({ name: '', phone: '' });
  
  // UI States
  const [phoneFlash, setPhoneFlash] = useState(false); // State for red flash animation
  
  // Form state
  const [vin, setVin] = useState('');
  const [car, setCar] = useState({ brand: '', model: '', bodyType: '', year: '', engine: '', transmission: '' });
  const [items, setItems] = useState([{ name: '', quantity: 1, color: '', category: 'Оригинал' as PartCategory, refImage: '' }]);
  
  // Brand Combobox State
  const [isBrandOpen, setIsBrandOpen] = useState(false);
  const brandListRef = useRef<HTMLDivElement>(null);
  const brandInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState(''); // New search state
  const [activeTab, setActiveTab] = useState<'processed' | 'archive'>('processed');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());
  const [highlightedId, setHighlightedId] = useState<string | null>(null); // For flashing effect

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchOrders = async () => {
    try {
      const data = await SheetService.getOrders(true);
      
      // Merge logic: Preserve local optimistic orders if they haven't appeared in backend yet
      setOrders(prev => {
         const serverIds = new Set(data.map(o => o.id));
         const optimisticPending = prev.filter(o => o.id.startsWith('temp-'));
         // Filter out optimistic ones if we found a match? No, we just blindly show backend data + pending optimistic
         return [...optimisticPending, ...data];
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchOrders(); 
    const interval = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  // Click outside handler for brand dropdown
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

  // --- PHONE MASK LOGIC ---
  const formatPhoneNumber = (value: string) => {
    let digits = value.replace(/\D/g, '').slice(0, 11); // Strict limit to 11 digits
    
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

  const isPhoneValid = (phone: string) => {
      return phone.length === 18;
  };

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
    setShowAuthModal(true);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'quantity') {
       value = Math.min(1000, Math.max(1, value));
    }
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientAuth?.name || items.some(i => !i.name)) {
      alert('Заполните названия деталей.');
      return;
    }

    if (!car.brand || !FULL_BRAND_SET.has(car.brand)) {
        alert('Выберите корректную марку из списка.');
        return;
    }

    if (!car.model) {
        alert('Укажите модель авто.');
        return;
    }

    const finalCar = {
        ...car,
        model: `${car.brand} ${car.model}`.trim()
    };

    // --- OPTIMISTIC UI LOGIC ---
    // 1. Create a Temporary ID
    const tempId = `temp-${Date.now()}`;
    const createdAtStr = new Date().toLocaleString('ru-RU').split(',')[0]; // Just date

    // 2. Add to local state immediately
    const optimisticOrder: any = {
        id: tempId,
        vin: vin || 'N/A',
        clientName: clientAuth.name,
        car: finalCar,
        items,
        status: OrderStatus.OPEN,
        createdAt: new Date().toLocaleString('ru-RU'),
        offers: [],
        readyToBuy: false
    };

    // Add to top of list
    setOrders(prev => [optimisticOrder, ...prev]);
    
    // Clear Form immediately
    setVin('');
    setCar({ brand: '', model: '', bodyType: '', year: '', engine: '', transmission: '' });
    setItems([{ name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }]);

    // 3. Send to API in background
    try {
        const realId = await SheetService.createOrder(vin, items, clientAuth.name, finalCar);
        
        // 4. Update ID in state when Real ID comes back
        setOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o));
        
        // 5. Trigger Success Effects
        setHighlightedId(realId); // Triggers green flash
        setSuccessToast({ message: `Заказ ${realId} успешно создан`, id: Date.now().toString() });
        
        setTimeout(() => setHighlightedId(null), 2000); // Remove flash class
        setTimeout(() => setSuccessToast(null), 3000);
        
    } catch (err) {
        console.error("Order creation failed", err);
        // On error, remove optimistic order
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

  const handleDemoForm = () => {
    const demoVins = ['WBA520373786', 'WAUZZZ4K2L001'];
    const randomIdx = Math.floor(Math.random() * demoVins.length);
    setVin(demoVins[randomIdx]);
    setCar({ brand: 'BMW', model: '5-Series G30', bodyType: 'Седан', year: '2022', engine: 'B48 2.0L', transmission: 'ZF8' });
    setItems([
      { name: 'Капот M-Style', quantity: 1, color: 'Черный', category: 'Оригинал', refImage: '' },
      { name: 'Фара Laser Right', quantity: 1, color: '', category: 'Б/У', refImage: '' }
    ]);
  };

  const counts = useMemo(() => {
    const processed = orders.filter(o => o.status === OrderStatus.OPEN && !o.readyToBuy).length;
    const archive = orders.filter(o => o.status === OrderStatus.CLOSED || o.readyToBuy).length;
    return { processed, archive };
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter(o => {
    // 1. Tab Filter
    let inTab = false;
    if (activeTab === 'archive') inTab = o.status === OrderStatus.CLOSED || o.readyToBuy;
    else inTab = o.status === OrderStatus.OPEN && !o.readyToBuy;
    if (!inTab) return false;

    // 2. Search Filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    
    // Search fields: ID, VIN, Car Model
    if (o.id.toLowerCase().includes(q)) return true;
    if (o.vin.toLowerCase().includes(q)) return true;
    if (o.car?.model?.toLowerCase().includes(q)) return true;
    
    // Search inside items
    if (o.items.some(i => i.name.toLowerCase().includes(q))) return true;

    return false;
  }), [orders, activeTab, searchQuery]);

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

  const isValidBrand = useMemo(() => {
      return !car.brand || FULL_BRAND_SET.has(car.brand);
  }, [car.brand]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {successToast && (
          <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Успешно</p>
                      <p className="text-xs font-bold">{successToast.message}</p>
                  </div>
              </div>
          </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-[400px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                <ShieldCheck size={40} />
             </div>
             <div className="text-center space-y-1">
                <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Вход клиента</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Авторизуйтесь для работы с заказами</p>
             </div>
             
             <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => handleDemoLogin(1)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1">
                    <UserCircle2 size={16}/> Демо Клиент 1
                </button>
                <button onClick={() => handleDemoLogin(2)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1">
                    <UserCircle2 size={16}/> Демо Клиент 2
                </button>
             </div>

             <div className="w-full flex items-center gap-4 py-2">
                <div className="flex-grow h-px bg-slate-100"></div>
                <span className="text-[9px] font-bold text-slate-300 uppercase">или создайте новый</span>
                <div className="flex-grow h-px bg-slate-100"></div>
             </div>

             <form onSubmit={handleLogin} className="w-full space-y-3">
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Имя</label>
                    <input autoFocus value={tempAuth.name} onChange={e => setTempAuth({...tempAuth, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-600 uppercase" placeholder="ИМЯ" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Номер телефона</label>
                    <input 
                      value={tempAuth.phone} 
                      onChange={handlePhoneChange} 
                      className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none transition-all duration-300 ${phoneFlash ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-600'}`} 
                      placeholder="+7 (XXX) XXX-XX-XX" 
                    />
                 </div>
                 <button type="submit" disabled={!tempAuth.name || !isPhoneValid(tempAuth.phone)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:active:scale-100">Создать аккаунт</button>
             </form>
          </div>
        </div>
      )}

      {/* CLIENT HEADER / PROFILE */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-inner">
               <UserCircle2 size={24}/>
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Личный кабинет клиента</span>
               <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{clientAuth?.name || 'Гость'}</h3>
                  <div className="flex items-center gap-1 text-slate-400">
                     <Phone size={10}/>
                     <span className="text-[10px] font-bold">{clientAuth?.phone || '...'}</span>
                  </div>
               </div>
            </div>
         </div>
         <button onClick={handleLogout} className="p-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-100 flex items-center gap-2 group">
            <span className="text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">Выход</span>
            <LogOut size={18}/>
         </button>
      </div>

      {/* FORM SECTION */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div className="flex items-center gap-2">
              <Car size={14} className="text-slate-500"/>
              <h2 className="text-[11px] font-bold uppercase tracking-tight">Новая заявка</h2>
           </div>
           <button onClick={handleDemoForm} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100 uppercase">
             <Zap size={10}/> Демо заказ
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">VIN / Шасси</label>
                <input value={vin} onChange={e => setVin(e.target.value.toUpperCase())} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md font-mono text-[10px] outline-none" placeholder="WBA..." />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Имя Клиента</label>
                <input value={clientAuth?.name || ''} readOnly className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md text-[10px] font-bold uppercase text-slate-400 outline-none cursor-not-allowed" />
              </div>
              
              {/* CAR SELECTOR SECTION */}
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1 relative">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Марка (Бренд)</label>
                    <div className="relative">
                        <input
                            ref={brandInputRef}
                            value={car.brand}
                            onChange={(e) => {
                                setCar({...car, brand: e.target.value});
                                setIsBrandOpen(true);
                            }}
                            onFocus={() => setIsBrandOpen(true)}
                            className={`w-full px-3 py-1.5 bg-white border rounded-md text-[10px] font-bold uppercase outline-none focus:border-indigo-500 ${isValidBrand ? 'border-slate-200' : 'border-red-400 text-red-600'}`}
                            placeholder="Введите марку..."
                        />
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                    </div>
                    {/* COMBOBOX DROPDOWN */}
                    {isBrandOpen && (
                        <div ref={brandListRef} className="absolute z-50 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl divide-y divide-slate-50 animate-in fade-in zoom-in-95 duration-100">
                             {filteredBrands.length > 0 ? (
                                filteredBrands.map((brand, idx) => (
                                    <div 
                                        key={brand} 
                                        onClick={() => {
                                            setCar({...car, brand});
                                            setIsBrandOpen(false);
                                        }}
                                        className="px-3 py-2 text-[10px] font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer uppercase"
                                    >
                                        {brand}
                                    </div>
                                ))
                             ) : (
                                <div className="px-3 py-2 text-[10px] text-slate-400 italic">Ничего не найдено</div>
                             )}
                        </div>
                    )}
                    {!isValidBrand && car.brand.length > 0 && !isBrandOpen && (
                        <div className="text-[8px] font-bold text-red-500 mt-1 absolute -bottom-4 left-0">Выберите марку из списка</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Модель</label>
                    <input 
                        value={car.model} 
                        onChange={e => setCar({...car, model: e.target.value})} 
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold outline-none uppercase" 
                        placeholder="Напишите модель (X5, Camry...)" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Год выпуска</label>
                    <input value={car.year} onChange={e => setCar({...car, year: e.target.value})} className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-center" placeholder="202X" />
                  </div>
              </div>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-950 ml-1">Позиции заказа</label>
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start group">
                <div className="flex-grow bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2">
                      <input 
                        value={item.name} 
                        maxLength={90}
                        onChange={e => updateItem(idx, 'name', e.target.value)} 
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold outline-none focus:border-indigo-300 transition-colors" 
                        placeholder="Название детали (макс. 90 симв.)" 
                      />
                    </div>
                    <div className="relative">
                      <select value={item.category} onChange={e => updateItem(idx, 'category', e.target.value as PartCategory)} className="w-full appearance-none px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[9px] font-black uppercase pr-8 outline-none">
                        <option>Оригинал</option>
                        <option>Б/У</option>
                        <option>Аналог</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                    </div>
                    <div className="flex items-center gap-1">
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} className="w-full px-1 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] text-center font-black" />
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} className="mt-4 p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }])} className="text-[9px] font-bold text-indigo-600 uppercase hover:underline flex items-center gap-1"><Plus size={10}/> Добавить деталь</button>
          </div>

          <button 
            type="submit" 
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
             <Send className="w-4 h-4" /> Отправить запрос
          </button>
        </form>
      </section>

      {/* TABS SECTION */}
      <div className="space-y-4">
        {/* SEARCH BAR (Task 4) */}
        <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
            <input 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder="Поиск по VIN, номеру заказа или названию детали..." 
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm" 
            />
        </div>

        <div className="flex gap-2 border-b border-slate-200 pb-1">
          <button onClick={() => setActiveTab('processed')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'processed' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400'}`}>
            В обработке {counts.processed > 0 && <span className="ml-1 bg-indigo-50 text-indigo-700 px-1.5 rounded-sm">({counts.processed})</span>}
          </button>
          <button onClick={() => setActiveTab('archive')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'archive' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400'}`}>
            Архив {counts.archive > 0 && <span className="ml-1 opacity-40">({counts.archive})</span>}
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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

            const containerStyle = isVanishing 
                ? "opacity-0 max-h-0 py-0 overflow-hidden" 
                : isHighlighted 
                    ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200"
                    : isExpanded 
                        ? 'border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3' 
                        : 'hover:bg-slate-50/30 border-l-transparent border-b border-slate-100 last:border-0';

            return (
              <div key={order.id} className={`transition-all duration-700 border-l-4 ${containerStyle}`}>
                 {/* GRID LAYOUT FOR DESKTOP (Task 8) */}
                 <div className="p-3 grid grid-cols-[80px_1fr_60px_80px_110px_20px] items-center gap-3 cursor-pointer min-h-[56px]" onClick={() => !isVanishing && !isOptimistic && setExpandedId(isExpanded ? null : order.id)}>
                    
                    {/* COL 1: ID / Loader */}
                    <div className="flex items-center">
                        {isOptimistic ? (
                            <div className="flex items-center gap-1.5 text-indigo-500">
                                <Loader2 size={12} className="animate-spin"/>
                                <span className="text-[9px] font-bold uppercase tracking-wider">Создание</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <span className="font-mono font-bold text-[10px] text-slate-900 truncate block">{order.id}</span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase leading-none tracking-tight truncate block">{order.vin}</span>
                            </div>
                        )}
                    </div>

                    {/* COL 2: CAR MODEL */}
                    <div className="flex flex-col justify-center min-w-0">
                       <span className="font-bold text-[10px] text-slate-700 uppercase leading-none truncate block">{order.car?.model || 'БЕЗ МОДЕЛИ'}</span>
                    </div>

                    {/* COL 3: ITEMS COUNT */}
                    <div className="flex items-center gap-1">
                        <Package size={12} className="text-slate-300"/>
                        <span className="text-[9px] font-bold text-slate-500">{itemsCount} поз.</span>
                    </div>

                    {/* COL 4: DATE */}
                    <div className="flex items-center gap-1">
                        <Calendar size={12} className="text-slate-300"/>
                        <span className="text-[9px] font-bold text-slate-500">{orderDate}</span>
                    </div>

                    {/* COL 5: STATUS */}
                    <div className="flex justify-end">
                        {order.readyToBuy ? (
                            <span className="px-2 py-1 rounded-md font-black text-[8px] uppercase bg-emerald-600 text-white whitespace-nowrap shadow-sm">КУПЛЕНО</span>
                        ) : (
                            <span className={`px-2 py-1 rounded-md font-bold text-[8px] uppercase whitespace-nowrap shadow-sm border ${hasWinning ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{hasWinning ? 'ГОТОВО' : 'В ОБРАБОТКЕ'}</span>
                        )}
                    </div>

                    {/* COL 6: EXPAND ICON */}
                    <div className="flex justify-end">
                         {isOptimistic ? null : <MoreHorizontal size={14} className="text-slate-300" />}
                    </div>
                 </div>

                 {isExpanded && !isVanishing && !isOptimistic && (
                   <div className="p-4 bg-white border-t border-slate-100 animate-in fade-in duration-200 rounded-b-lg" onClick={e => e.stopPropagation()}>
                      {!hasWinning && (
                          <div className="space-y-3">
                             <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2">
                               <Search size={12}/> Запрашиваемые позиции
                             </h4>
                             <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                   {order.items.map((item, idx) => (
                                       <div key={idx} className="bg-white p-3 flex justify-between items-center">
                                           <div className="flex items-center gap-3">
                                               <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                               <div>
                                                   <span className="text-[10px] font-black text-slate-900 block uppercase">{item.name}</span>
                                                   <span className="text-[8px] font-bold text-slate-400 uppercase">{item.category} | {item.quantity} шт</span>
                                               </div>
                                           </div>
                                           <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 rounded text-[9px] font-bold text-slate-400 uppercase">
                                               <Clock size={10} className="text-slate-300"/> В очереди
                                           </div>
                                       </div>
                                   ))}
                             </div>
                          </div>
                      )}
                      
                      {hasWinning && (
                        <div className="space-y-3">
                           <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-950 flex items-center gap-2 mb-2">
                             <CheckCircle2 size={12} className="text-emerald-500"/> Согласованные позиции
                           </h4>
                           <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                              <div className="divide-y divide-slate-100">
                                {winningItems.map((item, idx) => {
                                     const finalPrice = item.adminPrice ?? item.sellerPrice ?? 0;
                                     const curSymbol = getCurrencySymbol(item.adminCurrency ?? item.sellerCurrency ?? 'RUB');
                                     return (
                                        <div key={idx} className="bg-white p-3 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                                                <div>
                                                    <span className="text-[10px] font-black text-slate-900 block uppercase">{item.name}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{item.category} | {item.offeredQuantity} шт</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-slate-900">{(finalPrice * (item.offeredQuantity || item.quantity)).toLocaleString()} {curSymbol}</div>
                                                <div className="text-[8px] text-slate-400 font-bold">{finalPrice.toLocaleString()} {curSymbol} / шт</div>
                                            </div>
                                        </div>
                                     );
                                })}
                              </div>
                              <div className="bg-slate-900 text-white p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                  <div className="flex items-center gap-4">
                                      <div className="flex items-center gap-2">
                                          <Calculator size={14} className="text-emerald-400"/>
                                          <span className="font-black text-[10px] uppercase tracking-widest">Итого к оплате</span>
                                      </div>
                                      <div className="text-base font-black tracking-tight">{totalSum.toLocaleString()} {symbol}</div>
                                  </div>
                                  
                                  {!order.readyToBuy ? (
                                    <button 
                                      onClick={() => handleConfirmPurchase(order.id)}
                                      disabled={!!isConfirming}
                                      className="w-full md:w-auto px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 disabled:opacity-50"
                                    >
                                      {isConfirming === order.id ? <Loader2 size={14} className="animate-spin"/> : <ShoppingCart size={14}/>}
                                      Готов купить
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-emerald-500/20 px-4 py-2 rounded-lg border border-emerald-500/30">
                                       <Archive size={14} className="text-emerald-400"/>
                                       <span className="text-[9px] font-black uppercase text-emerald-400">В Архиве (Оплачено)</span>
                                    </div>
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