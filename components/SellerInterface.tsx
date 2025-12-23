
import React, { useState, useEffect, useMemo } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, Currency, RowType } from '../types';
import { Pagination } from './Pagination';
import { 
  User, CheckCircle, Search, RefreshCw, Edit2, LogOut, ShieldCheck, AlertCircle,
  BarChart3, Calendar, TrendingUp, Clock, Car, ChevronDown, ChevronRight, Loader2, CheckCircle2, UserCircle2
} from 'lucide-react';

export const SellerInterface: React.FC = () => {
  const [rawOrders, setRawOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [sellerName, setSellerName] = useState(() => localStorage.getItem('seller_token') || '');
  const [showTokenModal, setShowTokenModal] = useState(!localStorage.getItem('seller_token'));
  const [tempToken, setTempToken] = useState('');

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
    if (!sellerName) return;
    
    // Если это принудительное обновление, очищаем текущий список для визуального отклика
    if (!silent) {
        setLoading(true);
        setRawOrders([]); 
    }
    
    setIsSyncing(true);
    try {
      // ПРИНУДИТЕЛЬНО вызываем getOrders(true) для обхода кэша
      const data = await SheetService.getOrders(true);
      setRawOrders(data);
    } catch (e) { console.error(e); }
    finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (sellerName) fetchData();
    const interval = setInterval(() => sellerName && fetchData(true), 20000);
    return () => clearInterval(interval);
  }, [sellerName]);

  const handleSearchTrigger = () => {
    setAppliedSearch(searchQuery.toLowerCase().trim());
  };

  const hasSentOfferByMe = (order: Order) => {
    if (optimisticSentIds.has(order.id)) return true;
    if (!sellerName) return false;
    return order.offers?.some(off => 
      String(off.clientName || '').trim().toUpperCase() === sellerName.toUpperCase()
    ) || false;
  };

  const parseRuDate = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date(0);
    try {
      const cleanStr = dateStr.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      const datePart = cleanStr.split(/[\s,]/)[0];
      const parts = datePart.split(/[\.\-\/]/);
      if (parts.length === 3) {
          let d, m, y;
          if (parts[0].length === 4) { [y, m, d] = parts.map(Number); }
          else { [d, m, y] = parts.map(Number); }
          if (isNaN(d) || isNaN(m) || isNaN(y)) return new Date(0);
          const dateObj = new Date(y, m - 1, d);
          const timeMatch = cleanStr.match(/(\d{1,2}):(\d{1,2}):?(\d{1,2})?/);
          if (timeMatch) {
              dateObj.setHours(parseInt(timeMatch[1]) || 0);
              dateObj.setMinutes(parseInt(timeMatch[2]) || 0);
              dateObj.setSeconds(parseInt(timeMatch[3]) || 0);
          }
          return dateObj;
      }
      const native = new Date(dateStr);
      return isNaN(native.getTime()) ? new Date(0) : native;
    } catch (e) { return new Date(0); }
  };

  const marketStats = useMemo(() => {
    const allOrders = rawOrders.filter(o => o.type === RowType.ORDER);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);

    let today = 0, week = 0, month = 0, total = allOrders.length;
    const brandCounts: Record<string, number> = {};

    allOrders.forEach(o => {
      const d = parseRuDate(o.createdAt);
      const ts = d.getTime();
      if (ts > 0) {
          if (ts >= startOfToday) today++;
          if (ts >= sevenDaysAgo) week++;
          if (ts >= thirtyDaysAgo) month++;
      }
      const brand = o.car?.model?.split(' ')[0]?.toUpperCase() || 
                    o.items?.[0]?.name?.split(' ')[0]?.toUpperCase();
      if (brand && brand.length > 2 && brand !== 'БЕЗ' && brand !== 'N/A') {
          brandCounts[brand] = (brandCounts[brand] || 0) + 1;
      }
    });

    let leader = "N/A";
    let max = 0;
    Object.entries(brandCounts).forEach(([brand, count]) => {
      if (count > max) { max = count; leader = brand; }
    });
    return { today, week, month, total, leader };
  }, [rawOrders]);

  const filteredOrders = useMemo(() => {
    return rawOrders.filter(o => {
      const isSentByMe = hasSentOfferByMe(o);
      const isRelevant = activeTab === 'new' 
        ? (o.status === OrderStatus.OPEN && !o.isProcessed && !isSentByMe)
        : isSentByMe;
      if (!isRelevant) return false;
      if (appliedSearch) {
          const searchableBuffer = [o.id, o.vin, o.clientName, o.car?.model, o.car?.year, ...(o.items?.map(i => `${i.name} ${i.category}`) || [])].join(' ').toLowerCase();
          if (!searchableBuffer.includes(appliedSearch)) return false;
      }
      if (activeBrandFilter) {
          const brand = o.car?.model?.split(' ')[0].toUpperCase() || '';
          if (brand !== activeBrandFilter) return false;
      }
      return true;
    });
  }, [rawOrders, appliedSearch, activeTab, sellerName, optimisticSentIds, activeBrandFilter]);

  const availableBrands = useMemo(() => {
      const brands = new Set<string>();
      rawOrders.forEach(o => {
          if (o.status === OrderStatus.OPEN && !o.isProcessed && !hasSentOfferByMe(o)) {
              const brand = o.car?.model?.split(' ')[0].toUpperCase();
              if (brand) brands.add(brand);
          }
      });
      return Array.from(brands).sort();
  }, [rawOrders, sellerName, optimisticSentIds]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const handleSubmitOffer = async (order: Order) => {
    setVanishingIds(prev => new Set(prev).add(order.id));
    setSuccessToast({ message: `Предложение к заказу ${order.id} отправлено`, id: Date.now().toString() });
    setTimeout(() => setSuccessToast(null), 3000);

    setTimeout(async () => {
        setOptimisticSentIds(prev => new Set(prev).add(order.id));
        setExpandedId(null);
        setVanishingIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
        const finalItems = order.items.map(item => {
          const stateKey = `${order.id}-${item.name}`;
          const state = editingItems[stateKey] || { price: 0, currency: 'RUB', offeredQty: item.quantity, refImage: '' };
          return { ...item, sellerPrice: state.price, sellerCurrency: state.currency, offeredQuantity: state.offeredQty, refImage: state.refImage, available: state.offeredQty > 0 };
        });
        try {
          await SheetService.createOffer(order.id, sellerName, finalItems, order.vin);
          fetchData(true);
        } catch (err) {
          setOptimisticSentIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
        }
    }, 600);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempToken.trim()) return;
    const name = tempToken.trim().toUpperCase();
    
    // Сбрасываем текущие данные перед авторизацией
    setOptimisticSentIds(new Set());
    setRawOrders([]);
    
    setSellerName(name);
    localStorage.setItem('seller_token', name);
    setShowTokenModal(false);
    
    // Принудительная загрузка
    fetchData(false);
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

      {showTokenModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <form onSubmit={handleLogin} className="bg-white rounded-[2rem] p-8 w-full max-w-[340px] shadow-2xl relative overflow-hidden flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
             
             {/* Logo / Icon */}
             <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <ShieldCheck size={32} />
             </div>

             {/* Header */}
             <div className="text-center space-y-2">
                <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight">Вход для поставщика</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Введите название вашей фирмы</p>
             </div>

             {/* Inputs */}
             <div className="w-full space-y-3">
                 <input 
                    autoFocus 
                    value={tempToken} 
                    onChange={e => setTempToken(e.target.value)} 
                    className="w-full px-4 py-3 bg-white border-2 border-indigo-100 rounded-xl font-bold text-center text-sm outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-50/50 transition-all uppercase placeholder:text-slate-300" 
                    placeholder="НАЗВАНИЕ ФИРМЫ" 
                 />
                 <button 
                    type="submit" 
                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                 >
                    Войти в систему
                 </button>
             </div>
          </form>
        </div>
      )}

      {/* DASHBOARD HEADER */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">MARKET DASHBOARD</span>
            <span className="text-lg font-black text-slate-900 uppercase tracking-tight">Личный кабинет</span>
         </div>
         
         <div className="flex items-center gap-3 w-full sm:w-auto">
             {sellerName && (
                 <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg shadow-sm">
                    <UserCircle2 size={16} className="text-indigo-600"/>
                    <span className="text-[10px] font-black uppercase text-slate-700 tracking-tight">{sellerName}</span>
                 </div>
             )}
             <button 
                onClick={() => { localStorage.removeItem('seller_token'); setSellerName(''); setShowTokenModal(true); }} 
                className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-100 ml-auto sm:ml-0"
                title="Выйти"
             >
                <LogOut size={18}/>
             </button>
         </div>
      </div>

      {/* STATS SECTION */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Clock size={16} className="text-indigo-600"/>} label="СЕГОДНЯ" value={marketStats.today} subLabel="ОРДЕРОВ" loading={loading} />
            <StatCard icon={<Calendar size={16} className="text-indigo-600"/>} label="НЕДЕЛЯ" value={marketStats.week} subLabel="ОРДЕРОВ" loading={loading} />
            <StatCard icon={<BarChart3 size={16} className="text-indigo-600"/>} label="МЕСЯЦ" value={marketStats.month} subLabel="ОРДЕРОВ" loading={loading} />
            <StatCard icon={<TrendingUp size={16} className="text-indigo-600"/>} label="ВСЕГО" value={marketStats.total} subLabel="В БАЗЕ (ORD)" loading={loading} />
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 relative overflow-hidden shadow-xl border border-slate-800">
            <div className="relative z-10 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Car size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Лидер спроса</span>
                </div>
                <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter">{marketStats.leader}</h3>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Чаще всего ищут</p>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-1/4 bg-indigo-600/10 -skew-x-12 translate-x-12"></div>
            <div className="absolute -right-8 -bottom-8 opacity-10 text-white select-none"><Car size={160} /></div>
        </div>
      </div>

      <div className="space-y-4">
         <div className="relative group flex items-center">
            <Search className="absolute left-6 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={20}/>
            <input 
              value={searchQuery} 
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setAppliedSearch(''); }} 
              onKeyDown={e => e.key === 'Enter' && handleSearchTrigger()}
              placeholder="Поиск по VIN, модели авто или названию детали..." 
              className="w-full pl-14 pr-32 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm placeholder:text-slate-300" 
            />
            <button onClick={handleSearchTrigger} className="absolute right-2 px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 active:scale-95 transition-all shadow-md">Найти</button>
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
            <button onClick={() => setActiveTab('new')} className={`pb-2 text-[11px] font-black uppercase transition-all relative ${activeTab === 'new' ? 'text-slate-900' : 'text-slate-400'}`}>Новые запросы <span className="ml-1 bg-slate-900 text-white px-1.5 py-0.5 rounded text-[9px]">{rawOrders.filter(o => !hasSentOfferByMe(o) && o.status === OrderStatus.OPEN && !o.isProcessed).length}</span>{activeTab === 'new' && <span className="absolute bottom-[-2px] left-0 right-0 h-1 bg-slate-900 rounded-full"></span>}</button>
            <button onClick={() => setActiveTab('processed')} className={`pb-2 text-[11px] font-black uppercase transition-all relative ${activeTab === 'processed' ? 'text-indigo-600' : 'text-slate-400'}`}>Отправленные <span className="ml-1 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px]">{rawOrders.filter(o => hasSentOfferByMe(o)).length}</span>{activeTab === 'processed' && <span className="absolute bottom-[-2px] left-0 right-0 h-1 bg-indigo-600 rounded-full"></span>}</button>
         </div>
         <button onClick={() => fetchData(false)} className="mb-2 p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all flex items-center gap-2"><span className="text-[9px] font-black uppercase hidden sm:inline">Обновить</span><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''}/></button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredOrders.length === 0 && <div className="p-12 text-center text-[10px] font-black text-slate-300 uppercase italic tracking-widest">Ничего не найдено</div>}
        {paginatedOrders.map(order => {
          const isExpanded = expandedId === order.id;
          const isSent = hasSentOfferByMe(order);
          const isVanishing = vanishingIds.has(order.id);
          const containerStyle = isVanishing ? "opacity-0 scale-95 my-0 h-0 overflow-hidden" : isExpanded ? "border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3" : "hover:bg-slate-50 border-l-transparent border-b border-slate-100 last:border-0";

          return (
            <div key={order.id} className={`transition-all duration-500 border-l-4 ${containerStyle}`}>
              <div onClick={() => !isVanishing && setExpandedId(isExpanded ? null : order.id)} className="p-2 cursor-pointer select-none flex items-center gap-4 text-[10px]">
                  <div className="font-mono font-bold w-20 truncate">{order.id}</div>
                  <div className="font-black uppercase flex-grow truncate">{order.car?.model || 'N/A'} <span className="font-bold ml-1 text-slate-400">{order.car?.year}</span></div>
                  <div className="font-bold uppercase w-32 truncate hidden sm:block text-slate-400">{order.vin}</div>
                  <div className="w-16 hidden sm:block text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-center">{order.items.length} поз.</div>
                  <div className="font-bold w-24 text-right text-slate-400">{order.createdAt.split(/[\n,]/)[0]}</div>
                  <div className="w-24 flex justify-end">
                    {isSent ? <div className="text-[9px] font-bold text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded">Ок</div> : <div className="px-3 py-1 rounded text-[9px] font-black uppercase text-white bg-slate-900">Дать цену</div>}
                  </div>
              </div>

              {isExpanded && !isVanishing && (
                <div className="p-4 bg-white border-t border-slate-100 animate-in fade-in duration-200" onClick={e => e.stopPropagation()}>
                  <div className="space-y-3">
                      {order.items.map(item => {
                        const stateKey = `${order.id}-${item.name}`;
                        const state = editingItems[stateKey] || { price: 0, currency: 'RUB', offeredQty: item.quantity, refImage: '' };
                        const isDisabled = isSent;
                        
                        const isPriceMissing = state.price === 0;
                        const isQtyPartial = state.offeredQty < item.quantity;
                        const hasErrors = !isDisabled && (isPriceMissing || isQtyPartial);

                        const handleNumInput = (raw: string, field: 'price' | 'offeredQty', max?: number) => {
                            const digits = raw.replace(/\D/g, '');
                            if (digits === '' && raw !== '') return;
                            let val = parseInt(digits) || 0;
                            if (field === 'price' && val > 1000000) val = 1000000;
                            if (max && val > max) val = max;
                            
                            setEditingItems(prev => {
                                const existing = prev[stateKey] || { price: 0, currency: 'RUB' as Currency, offeredQty: item.quantity, refImage: '' };
                                return {
                                    ...prev,
                                    [stateKey]: { ...existing, [field]: val }
                                };
                            });
                        };

                        return (
                          <div key={item.name} className={`flex flex-col md:flex-row gap-4 items-center border rounded-xl p-3 transition-all ${hasErrors ? 'border-red-200 bg-red-50/30 ring-1 ring-red-100' : 'border-slate-100 bg-slate-50/30'}`}>
                             <div className="flex-grow w-full">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <h4 className="font-black text-[11px] uppercase text-slate-900 whitespace-nowrap">{item.name}</h4>
                                    <div className="flex gap-1">
                                        {isPriceMissing && !isDisabled && <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm whitespace-nowrap">нет цены</span>}
                                        {isQtyPartial && !isDisabled && <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase shadow-sm whitespace-nowrap">меньше, чем нужно</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase bg-white border border-slate-200 px-1.5 py-0.5 rounded">{item.category}</span>
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-2 rounded">Нужно: {item.quantity}</span>
                                </div>
                             </div>

                             <div className="flex flex-wrap md:flex-nowrap items-end gap-2 shrink-0">
                                <div className="w-16 space-y-1">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Кол-во</label>
                                    <input 
                                        type="text" 
                                        disabled={isDisabled} 
                                        value={state.offeredQty || ''} 
                                        onChange={e => handleNumInput(e.target.value, 'offeredQty', item.quantity)} 
                                        className={`w-full text-center font-bold text-[10px] border rounded-lg py-1.5 outline-none bg-white ${isQtyPartial && !isDisabled ? 'border-orange-200 text-orange-700' : 'border-slate-200'}`} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="w-24 space-y-1">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Цена</label>
                                    <input 
                                        type="text" 
                                        disabled={isDisabled} 
                                        value={state.price || ''} 
                                        onChange={e => handleNumInput(e.target.value, 'price')} 
                                        className={`w-full text-center font-bold text-[10px] border rounded-lg py-1.5 outline-none bg-white ${isPriceMissing && !isDisabled ? 'border-red-200 animate-pulse' : 'border-slate-200'}`} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="w-16 space-y-1 relative">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Валюта</label>
                                    <div className="relative group/sel">
                                        <select 
                                            disabled={isDisabled} 
                                            value={state.currency} 
                                            onChange={e => setEditingItems(prev => ({...prev, [stateKey]: {...(prev[stateKey] || {price:0, currency: 'RUB' as Currency, offeredQty: item.quantity, refImage: ''}), currency: e.target.value as Currency}}))} 
                                            className="w-full appearance-none text-center font-bold text-[10px] border border-slate-200 rounded-lg py-1.5 bg-white outline-none pr-4"
                                        >
                                            <option value="RUB">RUB</option>
                                            <option value="USD">USD</option>
                                            <option value="CNY">CNY</option>
                                        </select>
                                        <ChevronDown size={8} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                    </div>
                                </div>
                                <div className="w-24 space-y-1">
                                    <label className="text-[7px] font-bold text-slate-400 uppercase block text-center">Фото (URL)</label>
                                    <input 
                                        disabled={isDisabled} 
                                        value={state.refImage} 
                                        onChange={e => setEditingItems(prev => ({...prev, [stateKey]: {...(prev[stateKey] || {price:0, currency:'RUB' as Currency, offeredQty: item.quantity, refImage: ''}), refImage: e.target.value}}))} 
                                        className="w-full text-center font-bold text-[10px] border border-slate-200 rounded-lg py-1.5 focus:border-slate-900 outline-none truncate px-2 bg-white" 
                                        placeholder="http://..." 
                                    />
                                </div>
                             </div>
                          </div>
                        );
                      })}
                      {!isSent && (
                        <div className="flex justify-end pt-3 border-t border-slate-100">
                          <button onClick={() => handleSubmitOffer(order)} className="px-8 py-2.5 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all flex items-center gap-2">Отправить предложение <CheckCircle size={14}/></button>
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
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-28 relative overflow-hidden group">
        <div className="flex justify-between items-start z-10">
            <div className="p-1.5 bg-indigo-50 rounded-lg">{icon}</div>
            <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">{label}</span>
        </div>
        <div className="z-10">
            {loading ? <Loader2 className="animate-spin text-slate-300" size={20} /> : <h3 className="text-2xl font-black text-slate-900">{value}</h3>}
            <p className="text-[8px] font-bold text-slate-400 uppercase">{subLabel}</p>
        </div>
        <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-slate-50 rounded-full"></div>
    </div>
);
