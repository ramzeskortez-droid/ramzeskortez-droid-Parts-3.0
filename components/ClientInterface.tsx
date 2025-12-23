
import React, { useState, useEffect, useMemo } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, PartCategory } from '../types';
import { Pagination } from './Pagination';
import { 
  Send, Plus, Trash2, Zap, CheckCircle2, Car, Camera, Palette, MoreHorizontal, Calculator, Search, Loader2, ChevronDown, ShoppingCart, Archive
} from 'lucide-react';

export const ClientInterface: React.FC = () => {
  const [vin, setVin] = useState('');
  const [clientName, setClientName] = useState('');
  const [car, setCar] = useState({ model: '', bodyType: '', year: '', engine: '', transmission: '' });
  const [items, setItems] = useState([{ name: '', quantity: 1, color: '', category: 'Оригинал' as PartCategory, refImage: '' }]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'waiting' | 'processed' | 'archive'>('waiting');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchOrders = async () => {
    try {
      const data = await SheetService.getOrders(true);
      setOrders(data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    fetchOrders(); 
    const interval = setInterval(() => fetchOrders(), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || items.some(i => !i.name)) {
      alert('Заполните имя и названия деталей.');
      return;
    }

    const tempId = `ORD-TX-${Date.now().toString().slice(-4)}`;
    const newOrder: any = {
       id: tempId, vin: vin || 'N/A', clientName, car, items,
       status: OrderStatus.OPEN, createdAt: 'Отправка...', offers: [], readyToBuy: false
    };

    setOrders([newOrder, ...orders]);
    setSuccessToast({ message: `Заказ ${tempId} успешно создан`, id: Date.now().toString() });
    setTimeout(() => setSuccessToast(null), 3000);

    setVin('');
    setCar({ model: '', bodyType: '', year: '', engine: '', transmission: '' });
    setItems([{ name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }]);

    SheetService.createOrder(vin, items, clientName, car).then(() => fetchOrders());
  };

  const handleConfirmPurchase = async (orderId: string) => {
    setIsConfirming(orderId);
    
    try {
      await SheetService.confirmPurchase(orderId);
      
      // Анимация ухода
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

  const handleDemo = () => {
    const demoNames = ['Виталий', 'Артем', 'Максим', 'Денис', 'Руслан'];
    const demoCars = [
      { model: 'BMW G30 5-Series', bodyType: 'Седан', year: '2022', engine: 'B48 2.0L', transmission: 'ZF8' },
      { model: 'Audi A6 C8', bodyType: 'Универсал', year: '2021', engine: '3.0 TDI', transmission: 'S-tronic' },
      { model: 'Mercedes E W213', bodyType: 'Седан', year: '2023', engine: 'OM654', transmission: '9G-Tronic' }
    ];
    const demoVins = ['WBA520373786', 'WAUZZZ4K2L001', 'WDD2130041B9'];
    const randomIdx = Math.floor(Math.random() * demoCars.length);
    setVin(demoVins[randomIdx]);
    setClientName(demoNames[Math.floor(Math.random() * demoNames.length)]);
    setCar(demoCars[randomIdx]);
    setItems([
      { name: 'Капот M-Style', quantity: 1, color: 'Черный', category: 'Оригинал', refImage: '' },
      { name: 'Фара Laser Right', quantity: 1, color: '', category: 'Б/У', refImage: '' }
    ]);
  };

  const counts = useMemo(() => {
    const waiting = orders.filter(o => o.status === OrderStatus.OPEN && !o.readyToBuy && !o.offers?.some(off => off.visibleToClient === 'Y')).length;
    const processed = orders.filter(o => o.status === OrderStatus.OPEN && !o.readyToBuy && o.offers?.some(off => off.visibleToClient === 'Y')).length;
    const archive = orders.filter(o => o.status === OrderStatus.CLOSED || o.readyToBuy).length;
    return { waiting, processed, archive };
  }, [orders]);

  const filteredOrders = useMemo(() => orders.filter(o => {
    const hasVisibleOffers = o.offers?.some(off => off.visibleToClient === 'Y');
    if (activeTab === 'archive') return o.status === OrderStatus.CLOSED || o.readyToBuy;
    if (activeTab === 'waiting') return o.status === OrderStatus.OPEN && !o.readyToBuy && !hasVisibleOffers;
    return o.status === OrderStatus.OPEN && hasVisibleOffers && !o.readyToBuy;
  }), [orders, activeTab]);

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

      {/* FORM SECTION */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div className="flex items-center gap-2">
              <Car size={14} className="text-slate-500"/>
              <h2 className="text-[11px] font-bold uppercase tracking-tight">Новая заявка</h2>
           </div>
           <button onClick={handleDemo} className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100 uppercase">
             <Zap size={10}/> Демо
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
                <input value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] font-bold uppercase" placeholder="ИМЯ" />
              </div>
              <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Модель</label>
                    <input value={car.model} onChange={e => setCar({...car, model: e.target.value})} className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold" placeholder="BMW G30" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold text-slate-400 uppercase ml-1">Год</label>
                    <input value={car.year} onChange={e => setCar({...car, year: e.target.value})} className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[9px] font-bold text-center" placeholder="2022" />
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
                      <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold outline-none" placeholder="Деталь" />
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
                      <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-1 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] text-center font-black" />
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} className="mt-4 p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
              </div>
            ))}
            <button type="button" onClick={() => setItems([...items, { name: '', quantity: 1, color: '', category: 'Оригинал', refImage: '' }])} className="text-[9px] font-bold text-indigo-600 uppercase hover:underline flex items-center gap-1"><Plus size={10}/> Добавить деталь</button>
          </div>

          <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-3">
             Отправить запрос <Send className="w-4 h-4" />
          </button>
        </form>
      </section>

      {/* TABS SECTION */}
      <div className="space-y-2">
        <div className="flex gap-2 border-b border-slate-200 pb-1">
          <button onClick={() => setActiveTab('waiting')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'waiting' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400'}`}>
            В ожидании {counts.waiting > 0 && <span className="ml-1 opacity-60">({counts.waiting})</span>}
          </button>
          <button onClick={() => setActiveTab('processed')} className={`px-2 py-1 text-[10px] font-black uppercase transition-all ${activeTab === 'processed' ? 'text-emerald-700 border-b-2 border-emerald-600' : 'text-slate-400'}`}>
            Предложения {counts.processed > 0 && <span className="ml-1 bg-emerald-100 text-emerald-700 px-1 rounded-sm">({counts.processed})</span>}
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
            const visibleOffers = (order.offers || []).filter(off => off.visibleToClient === 'Y');
            
            // Фильтрация позиций ЛИДЕР (поддерживаем оба варианта написания)
            const winningItems = visibleOffers.flatMap(off => 
              off.items.filter(i => i.rank === 'ЛИДЕР' || i.rank === 'LEADER')
            );
            
            const hasWinning = winningItems.length > 0;
            const totalSum = winningItems.reduce((acc, item) => acc + ((item.adminPrice ?? item.sellerPrice ?? 0) * (item.offeredQuantity || item.quantity)), 0);
            const symbol = getCurrencySymbol(winningItems[0]?.adminCurrency || winningItems[0]?.sellerCurrency || 'RUB');

            const containerStyle = isVanishing 
                ? "opacity-0 max-h-0 py-0 overflow-hidden" 
                : isExpanded 
                    ? 'border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3' 
                    : 'hover:bg-slate-50/30 border-l-transparent border-b border-slate-100 last:border-0';

            return (
              <div key={order.id} className={`transition-all duration-500 border-l-4 ${containerStyle}`}>
                 <div className="p-3 grid grid-cols-[120px_1fr_80px] items-center gap-4 cursor-pointer min-h-[56px]" onClick={() => !isVanishing && setExpandedId(isExpanded ? null : order.id)}>
                    <div className="flex flex-col justify-center min-w-0">
                       <span className="font-mono font-bold text-[10px] text-slate-900 truncate block">{order.id}</span>
                       <span className="text-[8px] font-bold text-slate-400 uppercase leading-none tracking-tight truncate block">{order.vin}</span>
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                       <span className="font-bold text-[10px] text-slate-700 uppercase leading-none truncate block">{order.car?.model || 'БЕЗ МОДЕЛИ'}</span>
                       <div className="flex items-center gap-2 mt-1 min-h-[10px]">
                          <span className="text-[8px] font-bold text-slate-400 uppercase leading-none">{order.items.length} поз.</span>
                       </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        {order.readyToBuy ? (
                            <span className="px-2 py-0.5 rounded-full font-black text-[8px] uppercase bg-emerald-600 text-white">КУПЛЕНО</span>
                        ) : (
                            visibleOffers.length > 0 && <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${hasWinning ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{hasWinning ? 'ГОТОВО' : 'ПРЕДЛОЖЕНИЕ'}</span>
                        )}
                        <MoreHorizontal size={14} className="text-slate-300" />
                    </div>
                 </div>

                 {isExpanded && !isVanishing && (
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
                                               <Loader2 size={10} className="animate-spin"/> Поиск...
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
