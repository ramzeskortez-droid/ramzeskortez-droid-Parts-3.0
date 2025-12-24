
import React, { useState, useEffect, useMemo } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, Currency, RowType } from '../types';
import { Pagination } from './Pagination';
import { 
  User, CheckCircle, Search, RefreshCw, Edit2, LogOut, ShieldCheck, AlertCircle,
  BarChart3, Calendar, TrendingUp, Clock, Car, ChevronDown, ChevronRight, Loader2, CheckCircle2, UserCircle2, AlertTriangle, XCircle, FileText, Ban, Copy
} from 'lucide-react';

export const SellerInterface: React.FC = () => {
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // New Auth State
  const [sellerAuth, setSellerAuth] = useState(() => {
    const saved = localStorage.getItem('seller_auth_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(!localStorage.getItem('seller_auth_data'));
  const [tempAuth, setTempAuth] = useState({ name: '', phone: '' });
  const [phoneFlash, setPhoneFlash] = useState(false);

  const [editingItems, setEditingItems] = useState<Record<string, { price: number; currency: Currency; offeredQty: number; refImage: string }>>({});
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'new' | 'processed'>('new');
  
  const [optimisticSentIds, setOptimisticSentIds] = useState<Set<string>>(new Set());
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async (silent = false) => {
    if (!sellerAuth?.name) return;
    if (!silent) setLoading(true);
    
    setIsSyncing(true);
    try {
      const data = await SheetService.getOrders(true);
      setRawOrders(data);
    } catch (e) { console.error(e); }
    finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (sellerAuth) fetchData();
    const interval = setInterval(() => sellerAuth && fetchData(true), 20000);
    return () => clearInterval(interval);
  }, [sellerAuth]);

  // Auth Handlers for Seller (Chinese +86 format)
  const formatChinesePhoneNumber = (value: string) => {
    // Remove all non-digit chars
    let digits = value.replace(/\D/g, '');
    
    // Auto-add 86 prefix if not present or just starting
    if (!digits.startsWith('86')) {
        // If user typed '1', assume they mean +86 1...
        // But to be safe, if we force Chinese, we just prepend 86 if missing
        // However, standard logic:
        if (digits.length > 0) digits = '86' + digits;
    }
    
    // Limit to 86 + 11 digits = 13 digits total
    digits = digits.slice(0, 13);
    
    // Format: +86 1XX XXXX XXXX
    // Regex groups: (86) (3) (4) (4)
    const match = digits.match(/^(\d{2})(\d{0,3})(\d{0,4})(\d{0,4})$/);
    if (!match) return '+86';
    
    let formatted = `+${match[1]}`;
    if (match[2]) formatted += ` ${match[2]}`;
    if (match[3]) formatted += ` ${match[3]}`;
    if (match[4]) formatted += ` ${match[4]}`;
    
    return formatted;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const digitsOnly = val.replace(/\D/g, '');
    // 86 + 11 digits = 13 max digits
    if (digitsOnly.length > 13) {
        setPhoneFlash(true);
        setTimeout(() => setPhoneFlash(false), 300); 
        return; 
    }
    setTempAuth({...tempAuth, phone: formatChinesePhoneNumber(val)});
  };

  const isPhoneValid = (phone: string) => {
      // "+86 1XX XXXX XXXX" is 15 chars length including spaces
      return phone.length >= 15; 
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tempAuth.name.trim()) return;
    if (!isPhoneValid(tempAuth.phone)) return;
    const authData = { name: tempAuth.name.trim().toUpperCase(), phone: tempAuth.phone.trim() };
    setSellerAuth(authData);
    localStorage.setItem('seller_auth_data', JSON.stringify(authData));
    setShowAuthModal(false);
    fetchData(false);
  };

  const handleDemoLogin = (num: 1 | 2) => {
    const demo = num === 1 
      ? { name: 'ПОСТАВЩИК 1', phone: '+86 138 0013 8000' }
      : { name: 'ПОСТАВЩИК 2', phone: '+86 139 8888 2222' };
    setSellerAuth(demo);
    localStorage.setItem('seller_auth_data', JSON.stringify(demo));
    setShowAuthModal(false);
    fetchData(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('seller_auth_data');
    setSellerAuth(null);
    setShowAuthModal(true);
    setRawOrders([]);
  };

  const handleSearchTrigger = () => {
    setAppliedSearch(searchQuery.toLowerCase().trim());
  };

  const getMyOffer = (order: Order) => {
    if (!sellerAuth?.name) return null;
    const nameToMatch = sellerAuth.name.trim().toUpperCase();
    return order.offers?.find(off => 
      String(off.clientName || '').trim().toUpperCase() === nameToMatch
    ) || null;
  };

  const hasSentOfferByMe = (order: Order) => {
    if (!sellerAuth) return false;
    return optimisticSentIds.has(order.id) || !!getMyOffer(order);
  };

  const getOfferStatus = (order: Order) => {
    const myOffer = getMyOffer(order);
    if (!myOffer) return { label: 'Ожидание', color: 'bg-slate-100 text-slate-500', icon: <Clock size={10}/> };

    const isRefusal = myOffer.items.every(item => (item.offeredQuantity || 0) === 0);
    if (isRefusal) {
        return { label: 'ОТКАЗ', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: <Ban size={10}/> };
    }

    if (!order.isProcessed) {
        return { label: 'На проверке', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <Loader2 size={10} className="animate-spin"/> };
    }

    const winningItems = myOffer.items.filter(i => i.rank === 'ЛИДЕР' || i.rank === 'LEADER');
    const totalItems = myOffer.items.length;

    if (winningItems.length === totalItems) {
        return { label: 'ВЫИГРАЛ', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={10}/> };
    } else if (winningItems.length === 0) {
        return { label: 'ПРОИГРАЛ', color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle size={10}/> };
    } else {
        return { label: 'ЧАСТИЧНО', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <AlertTriangle size={10}/> };
    }
  };

  const parseRuDate = (dateStr: any): Date => {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return dateStr;
    const s = String(dateStr).trim().replace(/[\n\r]/g, ' ');
    const nativeDate = new Date(s);
    if (!isNaN(nativeDate.getTime())) return nativeDate;
    const match = s.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return new Date(0);
  };

  const marketStats = useMemo(() => {
    const allOrders = rawOrders.filter(o => o.type === RowType.ORDER);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    
    const startOfWeek = startOfToday - (7 * 24 * 60 * 60 * 1000);
    const startOfMonth = startOfToday - (30 * 24 * 60 * 60 * 1000);

    let today = 0, week = 0, month = 0, total = allOrders.length;
    const brandCounts: Record<string, number> = {};

    allOrders.forEach(o => {
      const d = parseRuDate(o.createdAt).getTime();
      if (d >= startOfToday && d <= endOfToday) today++;
      if (d >= startOfWeek && d <= endOfToday) week++;
      if (d >= startOfMonth && d <= endOfToday) month++;
      
      const brand = o.car?.model?.split(' ')[0]?.toUpperCase();
      if (brand && brand.length > 2) brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    });

    let leader = "N/A";
    let max = 0;
    Object.entries(brandCounts).forEach(([brand, count]) => {
      if (count > max) { max = count; leader = brand; }
    });
    return { today, week, month, total, leader };
  }, [rawOrders]);

  const filteredOrders = useMemo(() => {
    if (!sellerAuth) return [];
    return rawOrders.filter(o => {
      const isSentByMe = hasSentOfferByMe(o);
      const isRelevant = activeTab === 'new' 
        ? (o.status === OrderStatus.OPEN && !o.isProcessed && !isSentByMe && !o.isRefused)
        : isSentByMe;
      
      if (!isRelevant) return false;
      
      if (appliedSearch) {
          const searchableBuffer = [o.id, o.vin, o.car?.model].join(' ').toLowerCase();
          if (!searchableBuffer.includes(appliedSearch)) return false;
      }
      if (activeBrandFilter) {
          const brand = o.car?.model?.split(' ')[0].toUpperCase() || '';
          if (brand !== activeBrandFilter) return false;
      }
      return true;
    });
  }, [rawOrders, appliedSearch, activeTab, sellerAuth, optimisticSentIds, activeBrandFilter]);

  const availableBrands = useMemo(() => {
      const brands = new Set<string>();
      rawOrders.forEach(o => {
          if (o.status === OrderStatus.OPEN && !o.isProcessed && !hasSentOfferByMe(o) && !o.isRefused) {
              const brand = o.car?.model?.split(' ')[0].toUpperCase();
              if (brand) brands.add(brand);
          }
      });
      return Array.from(brands).sort();
  }, [rawOrders, sellerAuth, optimisticSentIds]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const isOrderValid = (order: Order) => {
      return order.items.every(item => {
          const stateKey = `${order.id}-${item.name}`;
          const state = editingItems[stateKey];
          const currentPrice = state ? state.price : 0;
          const currentQty = state ? state.offeredQty : item.quantity;
          return currentQty === 0 || currentPrice > 0;
      });
  };

  const handleSubmitOffer = async (order: Order, isRefusal: boolean) => {
    if (order.isProcessed || !sellerAuth) return;

    if (!isOrderValid(order)) {
        alert("Пожалуйста, укажите цену для всех позиций или отметьте их как 'Нет в наличии' (кнопка 🚫).");
        return;
    }

    setVanishingIds(prev => new Set(prev).add(order.id));
    setSuccessToast({ message: isRefusal ? `Отказ от заказа ${order.id} отправлен` : `Предложение к заказу ${order.id} отправлено`, id: Date.now().toString() });
    setTimeout(() => setSuccessToast(null), 3000);

    setTimeout(async () => {
        setOptimisticSentIds(prev => new Set(prev).add(order.id));
        setExpandedId(null);
        setVanishingIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
        const finalItems = order.items.map(item => {
          const stateKey = `${order.id}-${item.name}`;
          // Default currency for seller is CNY
          const state = editingItems[stateKey] || { price: 0, currency: 'CNY', offeredQty: item.quantity, refImage: '' };
          return { ...item, sellerPrice: state.price, sellerCurrency: state.currency, offeredQuantity: state.offeredQty, refImage: state.refImage, available: state.offeredQty > 0 };
        });
        try {
          await SheetService.createOffer(order.id, sellerAuth.name, finalItems, order.vin);
          fetchData(true);
        } catch (err) {
          setOptimisticSentIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
        }
    }, 600);
  };
  
  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setSuccessToast({ message: "Скопировано", id: Date.now().toString() });
      setTimeout(() => setSuccessToast(null), 1000);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6 relative">
      {successToast && (
          <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <div><p className="text-[10px] font-black uppercase text-emerald-400">Успешно</p><p className="text-xs font-bold">{successToast.message}</p></div>
              </div>
          </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-[400px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
             <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-100"><ShieldCheck size={40} /></div>
             <div className="text-center space-y-1"><h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Вход поставщика</h2><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Авторизуйтесь для работы</p></div>
             <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={() => handleDemoLogin(1)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1"><UserCircle2 size={16}/> Демо Поставщик 1</button>
                <button onClick={() => handleDemoLogin(2)} className="py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all flex flex-col items-center gap-1"><UserCircle2 size={16}/> Демо Поставщик 2</button>
             </div>
             <div className="w-full flex items-center gap-4 py-2"><div className="flex-grow h-px bg-slate-100"></div><span className="text-[9px] font-bold text-slate-300 uppercase">или</span><div className="flex-grow h-px bg-slate-100"></div></div>
             <form onSubmit={handleLogin} className="w-full space-y-3">
                 <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Название Компании</label><input autoFocus value={tempAuth.name} onChange={e => setTempAuth({...tempAuth, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:border-indigo-600 uppercase" placeholder="ООО АВТО" /></div>
                 <div className="space-y-1"><label className="text-[9px] font-bold text-slate-400 uppercase ml-1">Номер телефона</label><input value={tempAuth.phone} onChange={handlePhoneChange} className={`w-full px-4 py-3 bg-slate-50 border rounded-xl font-bold text-sm outline-none transition-all duration-300 ${phoneFlash ? 'border-red-500 bg-red-50' : 'border-slate-200 focus:border-indigo-600'}`} placeholder="+86 1XX XXXX XXXX" /></div>
                 <button type="submit" disabled={!tempAuth.name || !isPhoneValid(tempAuth.phone)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:active:scale-100">Войти</button>
             </form>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MARKET DASHBOARD</span>
            <span className="text-lg font-black text-slate-900 uppercase tracking-tight">Личный кабинет</span>
         </div>
         <div className="flex items-center gap-3 w-full sm:w-auto">
             {sellerAuth?.name && (
                 <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                        <UserCircle2 size={16} className="text-indigo-600"/>
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-tight">{sellerAuth.name}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">{sellerAuth.phone}</span>
                 </div>
             )}
             <button onClick={handleLogout} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100 ml-auto sm:ml-0">
                <LogOut size={18}/>
             </button>
         </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Clock size={16} className="text-indigo-600"/>} label="СЕГОДНЯ" value={marketStats.today} subLabel="ЗАКАЗОВ" loading={loading} />
          <StatCard icon={<Calendar size={16} className="text-indigo-600"/>} label="НЕДЕЛЯ" value={marketStats.week} subLabel="ЗАКАЗОВ" loading={loading} />
          <StatCard icon={<TrendingUp size={16} className="text-indigo-600"/>} label="МЕСЯЦ" value={marketStats.month} subLabel="ЗАКАЗОВ" loading={loading} />
          <StatCard icon={<ShieldCheck size={16} className="text-indigo-600"/>} label="ВСЕГО" value={marketStats.total} subLabel="ЗАКАЗОВ" loading={loading} />
          
          <div className="col-span-full bg-slate-900 rounded-2xl p-4 flex items-center justify-between border border-slate-800 shadow-xl overflow-hidden relative min-h-[80px]">
              <div className="z-10">
                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Лидер спроса на рынке</span>
                  <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">{marketStats.leader}</h3>
              </div>
              <Car size={64} className="text-white/10 absolute -right-4 -bottom-4 rotate-[-12deg]" />
          </div>
      </div>

      <div className="space-y-4">
         <div className="relative group flex items-center">
            <Search className="absolute left-6 text-slate-400" size={20}/>
            <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setAppliedSearch(''); }} onKeyDown={e => e.key === 'Enter' && handleSearchTrigger()} placeholder="Поиск по VIN или модели..." className="w-full pl-14 pr-32 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-300 shadow-sm" />
            <button onClick={handleSearchTrigger} className="absolute right-2 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition-all">Найти</button>
         </div>
         <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button onClick={() => setActiveBrandFilter(null)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${!activeBrandFilter ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500'}`}>Все марки</button>
            {availableBrands.map(brand => (
                <button key={brand} onClick={() => setActiveBrandFilter(activeBrandFilter === brand ? null : brand)} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeBrandFilter === brand ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500'}`}>{brand}</button>
            ))}
         </div>
      </div>

      <div className="flex justify-between items-end border-b border-slate-200">
         <div className="flex gap-4">
            <button onClick={() => setActiveTab('new')} className={`pb-2 text-[11px] font-black uppercase transition-all relative ${activeTab === 'new' ? 'text-slate-900' : 'text-slate-400'}`}>Новые <span className="ml-1 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[9px]">{rawOrders.filter(o => !hasSentOfferByMe(o) && o.status === OrderStatus.OPEN && !o.isProcessed && !o.isRefused).length}</span>{activeTab === 'new' && <span className="absolute bottom-[-2px] left-0 right-0 h-1 bg-slate-900 rounded-full"></span>}</button>
            <button onClick={() => setActiveTab('processed')} className={`pb-2 text-[11px] font-black uppercase transition-all relative ${activeTab === 'processed' ? 'text-indigo-600' : 'text-slate-400'}`}>Отправленные <span className="ml-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px]">{rawOrders.filter(o => hasSentOfferByMe(o)).length}</span>{activeTab === 'processed' && <span className="absolute bottom-[-2px] left-0 right-0 h-1 bg-indigo-600 rounded-full"></span>}</button>
         </div>
         <button onClick={() => fetchData(false)} className="mb-2 p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''}/></button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 relative group hidden md:block">
            {/* DESKTOP HEADER ROW - ALIGNED LEFT (FORCED) */}
            <div className="grid grid-cols-[70px_100px_1.5fr_60px_80px_140px_20px] gap-4 px-3 text-[9px] font-black uppercase text-slate-400 tracking-wider text-left">
               <div>№ заказа</div>
               <div>Марка</div>
               <div>Модель</div>
               <div>Год</div>
               <div>Дата</div>
               <div>Статус</div>
               <div></div>
            </div>
        </div>

        {filteredOrders.length === 0 && <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Список пуст</div>}
        {paginatedOrders.map(order => {
          const isExpanded = expandedId === order.id;
          const statusInfo = getOfferStatus(order);
          const isVanishing = vanishingIds.has(order.id);
          const myOffer = getMyOffer(order);
          const isDisabled = order.isProcessed === true;
          const canSubmit = isOrderValid(order);
          
          const isAllDeclined = order.items.every(item => {
              const stateKey = `${order.id}-${item.name}`;
              const state = editingItems[stateKey];
              const qty = state ? state.offeredQty : item.quantity;
              return qty === 0;
          });
          
          const fullModel = order.car?.AdminModel || order.car?.model || 'N/A';
          const brandPart = fullModel.split(' ')[0] || '-';
          const modelPart = fullModel.split(' ').slice(1).join(' ') || '-';
          const displayYear = order.car?.AdminYear || order.car?.year;

          const containerStyle = isVanishing ? "opacity-0 scale-95 h-0 overflow-hidden" : isExpanded ? "border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3" : "hover:bg-slate-50 border-l-transparent border-b border-slate-100 last:border-0";

          return (
            <div key={order.id} className={`transition-all duration-500 border-l-4 ${containerStyle}`}>
              {/* ROW CONTENT - ALIGNED LEFT */}
              <div onClick={() => !isVanishing && setExpandedId(isExpanded ? null : order.id)} className="p-3 cursor-pointer select-none grid grid-cols-1 md:grid-cols-[70px_100px_1.5fr_60px_80px_140px_20px] gap-3 md:gap-4 items-center text-[10px] text-left">
                  
                  {/* ID */}
                  <div className="font-mono font-bold truncate flex items-center gap-2">
                     <span className="md:hidden text-slate-400 w-12">ID:</span>
                     {order.id}
                  </div>

                  {/* BRAND */}
                  <div className="font-black uppercase truncate text-slate-800 flex items-center gap-2">
                     <span className="md:hidden text-slate-400 w-12">Марка:</span>
                     {brandPart}
                  </div>

                  {/* MODEL */}
                  <div className="font-black uppercase truncate text-slate-600 flex items-center gap-2">
                     <span className="md:hidden text-slate-400 w-12">Модель:</span>
                     {modelPart}
                  </div>

                  {/* YEAR */}
                  <div className="font-bold text-slate-500 flex items-center gap-2">
                     <span className="md:hidden text-slate-400 w-12">Год:</span>
                     {displayYear}
                  </div>

                  {/* DATE - FORCED LEFT */}
                  <div className="font-bold text-slate-400 flex items-center gap-1">
                     <span className="md:hidden text-slate-400 mr-2">Дата:</span>
                     {order.createdAt.split(/[\n,]/)[0]}
                  </div>

                  {/* STATUS - FORCED LEFT */}
                  <div className="flex justify-start">
                    <div className={`px-2 py-1 rounded-md font-black text-[8px] uppercase border flex items-center gap-1.5 shadow-sm ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                    </div>
                  </div>

                  {/* CHEVRON */}
                  <div className="flex justify-end items-center">
                    <ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-indigo-600' : ''}`}/>
                  </div>
              </div>

              {isExpanded && !isVanishing && (
                <div className="p-4 bg-white border-t border-slate-100 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 text-[10px] shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                         <FileText size={12} className="text-slate-400"/> 
                         <span className="font-black uppercase text-slate-500">Характеристики автомобиля</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                         <div className="group relative cursor-pointer" onClick={() => copyToClipboard(order.vin)}>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">VIN</span>
                            <span className="font-mono font-black text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-flex items-center gap-2 group-hover:border-indigo-300 group-hover:text-indigo-600 transition-all">
                                {order.vin} <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                            </span>
                         </div>
                         <div>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Марка</span>
                            <span className="font-black text-slate-700 uppercase">{brandPart}</span>
                         </div>
                         <div>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Модель</span>
                            <span className="font-black text-slate-700 uppercase">{modelPart}</span>
                         </div>
                         <div>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Кузов</span>
                            <span className="font-black text-slate-700 uppercase">{order.car?.bodyType || '-'}</span>
                         </div>
                         <div>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Год</span>
                            <span className="font-black text-slate-700 uppercase">{displayYear || '-'}</span>
                         </div>
                      </div>
                  </div>

                  <div className="space-y-3">
                      {order.items.map(item => {
                        const stateKey = `${order.id}-${item.name}`;
                        const offerItem = myOffer?.items.find(i => i.name === item.name);
                        // DEFAULT CURRENCY CNY
                        const state = editingItems[stateKey] || { 
                          price: offerItem?.sellerPrice || 0, 
                          currency: offerItem?.sellerCurrency || 'CNY', 
                          offeredQty: offerItem?.offeredQuantity || item.quantity, 
                          refImage: offerItem?.refImage || '' 
                        };
                        
                        const isWinner = offerItem?.rank === 'ЛИДЕР' || offerItem?.rank === 'LEADER';
                        const isPartialWin = statusInfo.label === 'ЧАСТИЧНО';
                        const isPriceEmpty = !isDisabled && !myOffer && state.price === 0;
                        const isQtyDeficit = state.offeredQty < item.quantity;
                        const isUnavailable = state.offeredQty === 0;
                        
                        const displayName = item.AdminName || item.name;
                        const displayQty = item.AdminQuantity || item.quantity;

                        const handleNumInput = (raw: string, field: 'price' | 'offeredQty', max?: number) => {
                            if (isDisabled || !!myOffer) return;
                            const digits = raw.replace(/\D/g, '');
                            let val = parseInt(digits) || 0;
                            if (max && val > max) val = max;
                            // Limit price to 1,000,000 (CAP IT, DON'T RESET TO 0)
                            if (field === 'price' && val > 1000000) val = 1000000; 

                            setEditingItems(prev => ({ ...prev, [stateKey]: { ...(prev[stateKey] || state), [field]: val } }));
                        };

                        const toggleUnavailable = () => {
                           if (isDisabled || !!myOffer) return;
                           const newVal = state.offeredQty === 0 ? displayQty : 0;
                           setEditingItems(prev => ({ ...prev, [stateKey]: { ...(prev[stateKey] || state), offeredQty: newVal } }));
                        };

                        return (
                          <div key={item.name} className={`flex flex-col md:flex-row gap-4 items-center border rounded-xl p-3 transition-all ${isWinner ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100' : 'bg-slate-50/30'} ${isPriceEmpty ? 'border-red-300 bg-red-50/10' : 'border-slate-100'}`}>
                             <div className="flex-grow w-full">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className={`font-black text-[11px] uppercase transition-all ${isUnavailable ? 'line-through text-red-400' : 'text-slate-900'}`}>{displayName}</h4>
                                    {isWinner && <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[7px] font-black uppercase">Выбрано</span>}
                                    {isDisabled && !isWinner && isPartialWin && <span className="bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded text-[7px] font-black uppercase">В резерве</span>}
                                    
                                    {!isUnavailable && isQtyDeficit && <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase flex items-center gap-1"><AlertTriangle size={8}/> Дефицит</span>}
                                    {!isUnavailable && isPriceEmpty && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase flex items-center gap-1 animate-pulse"><AlertCircle size={8}/> Укажите цену</span>}
                                    {isUnavailable && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded text-[7px] font-black uppercase flex items-center gap-1">Нет в наличии</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">{item.category}</span>
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2 rounded">Нужно: {displayQty}</span>
                                </div>
                             </div>

                             <div className="flex flex-wrap md:flex-nowrap items-end gap-2 shrink-0">
                                <div className="w-24 flex items-end gap-2">
                                    <button 
                                        onClick={toggleUnavailable} 
                                        disabled={isDisabled || !!myOffer}
                                        className={`mb-[1px] p-1.5 rounded-lg border transition-all ${isUnavailable ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200'}`}
                                        title={isUnavailable ? "Вернуть позицию" : "Нет позиции"}
                                    >
                                        <Ban size={14} />
                                    </button>
                                    <div className="space-y-1 flex-grow">
                                        <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Кол-во</label>
                                        <input type="text" disabled={isDisabled || !!myOffer} value={state.offeredQty || 0} onChange={e => handleNumInput(e.target.value, 'offeredQty', displayQty)} className={`w-full text-center font-bold text-[10px] border rounded-lg py-1.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 outline-none focus:border-indigo-500 ${isQtyDeficit && !isUnavailable ? 'text-amber-600 border-amber-200' : 'border-slate-200'}`} placeholder="0" />
                                    </div>
                                </div>

                                <div className="w-24 space-y-1">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Цена</label>
                                    <input type="text" disabled={isDisabled || !!myOffer || isUnavailable} value={isUnavailable ? 0 : state.price || ''} onChange={e => handleNumInput(e.target.value, 'price')} className={`w-full text-center font-bold text-[10px] border rounded-lg py-1.5 bg-white disabled:bg-slate-50 disabled:text-slate-400 outline-none focus:border-indigo-500 ${!isUnavailable && isPriceEmpty ? 'border-red-400 bg-red-50 text-red-600 placeholder:text-red-300' : 'border-slate-200'}`} placeholder="0" />
                                </div>
                                <div className="w-16 space-y-1">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Валюта</label>
                                    <select disabled={isDisabled || !!myOffer || isUnavailable} value={state.currency} onChange={e => setEditingItems(prev => ({...prev, [stateKey]: {...(prev[stateKey] || state), currency: e.target.value as Currency}}))} className="w-full text-center font-bold text-[10px] border border-slate-200 rounded-lg py-1.5 bg-white disabled:bg-slate-50 outline-none focus:border-indigo-500">
                                        <option value="CNY">CNY</option>
                                        <option value="RUB">RUB</option>
                                        <option value="USD">USD</option>
                                    </select>
                                </div>
                             </div>
                          </div>
                        );
                      })}
                      {!myOffer && !isDisabled && (
                        <div className="flex justify-end pt-3 border-t border-slate-100">
                          <button 
                            disabled={!canSubmit}
                            onClick={() => handleSubmitOffer(order, isAllDeclined)} 
                            className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase shadow-lg transition-all flex items-center gap-2 ${canSubmit ? (isAllDeclined ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-900 text-white hover:bg-slate-800') : 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'}`}
                          >
                              {canSubmit ? (isAllDeclined ? 'Отказаться' : 'Отправить предложение') : 'Заполните цены'} 
                              {isAllDeclined ? <XCircle size={14}/> : <CheckCircle size={14}/>}
                          </button>
                        </div>
                      )}
                      {isDisabled && (
                        <div className="flex items-center gap-2 justify-center py-3 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-center">
                           <ShieldCheck size={14} className="text-slate-400"/>
                           <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-relaxed">
                               {statusInfo.label === 'ЧАСТИЧНО' ? 'ЗАКАЗ ОБРАБОТАН. ЕСТЬ ПОЗИЦИИ, КОТОРЫЕ УТВЕРЖДЕНЫ К ПОКУПКЕ. СВЯЖИТЕСЬ С МЕНЕДЖЕРОМ CHINA-NAI' :
                                statusInfo.label === 'ВЫИГРАЛ' ? 'ЗАКАЗ ОБРАБОТАН. ВЫ ВЫИГРАЛИ ПО ВСЕМ ПОЗИЦИЯМ. СВЯЖИТЕСЬ С МЕНЕДЖЕРОМ CHINA-NAI.' :
                                statusInfo.label === 'ПРОИГРАЛ' ? 'ЗАКАЗ ОБРАБОТАН. ВАШЕ ПРЕДЛОЖЕНИЕ НЕ ПОДХОДИТ.' :
                                'ЗАКАЗ ОБРАБОТАН АДМИНОМ. РЕДАКТИРОВАНИЕ ЗАКРЫТО.'}
                           </span>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <Pagination totalItems={filteredOrders.length} itemsPerPage={itemsPerPage} currentPage={currentPage} onPageChange={setCurrentPage} onItemsPerPageChange={setItemsPerPage} />
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, subLabel, loading }: { icon: React.ReactNode, label: string, value: number, subLabel: string, loading?: boolean }) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-24">
        <div className="flex justify-between items-start">
            <div className="p-1.5 bg-indigo-50 rounded-lg">{icon}</div>
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <div>
            {loading ? <Loader2 className="animate-spin text-slate-200" size={16} /> : <h3 className="text-xl font-black text-slate-900">{value}</h3>}
            <p className="text-[7px] font-bold text-slate-500 uppercase">{subLabel}</p>
        </div>
    </div>
);
