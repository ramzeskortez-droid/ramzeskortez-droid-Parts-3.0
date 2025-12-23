import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, Currency } from '../types';
import { Pagination } from './Pagination';
import { 
  Search, RefreshCw, ChevronRight, FileText, 
  ArrowRight, PackageCheck, History, X, User, AlertTriangle, Edit, CheckCircle2, ChevronDown, Calendar, Car, Hash
} from 'lucide-react';

interface ActionLog {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

export const AdminInterface: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'closed'>('open');
  const [expandedTenders, setExpandedTenders] = useState<Record<string, boolean>>({});
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [adminInputs, setAdminInputs] = useState<Record<string, { price: number; currency: Currency }>>({});

  const interactionLock = useRef<number>(0);

  const fetchData = async (silent = false) => {
    if (silent && Date.now() - interactionLock.current < 10000) return;
    if (silent && SheetService.isLocked()) return;
    if (!silent) setLoading(true);
    setIsSyncing(true);
    try {
      const data = await SheetService.getOrders(true);
      setOrders(data);
    } catch(e: any) { 
      addLog("Ошибка загрузки данных", "error");
      setError(e.message || "Ошибка сервера");
    } finally {
      if (!silent) setLoading(false);
      setIsSyncing(false);
    }
  };

  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newLog: ActionLog = { id: Math.random().toString(36).substr(2, 9), time: new Date().toLocaleTimeString(), text, type };
    setLogs(prev => [newLog, ...prev].slice(50));
  };

  useEffect(() => { 
    fetchData(); 
    const interval = setInterval(() => fetchData(true), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [activeTab, searchQuery]);

  const handleUpdateRank = async (
      vin: string, 
      itemName: string, 
      offerId: string, 
      orderId: string, 
      sellerName: string,
      selectedAdminPrice: number,
      selectedAdminCurrency: Currency
  ) => {
    interactionLock.current = Date.now();
    addLog(`Выбор: ${itemName} от ${sellerName}`, "info");
    const targetItemName = itemName.trim().toLowerCase();

    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        offers: o.offers?.map(off => ({
          ...off,
          items: off.items.map(it => {
            if (it.name.trim().toLowerCase() === targetItemName) {
              return { 
                  ...it, 
                  rank: off.id === offerId ? 'ЛИДЕР' : 'РЕЗЕРВ',
                  adminPrice: off.id === offerId ? selectedAdminPrice : it.adminPrice,
                  adminCurrency: off.id === offerId ? selectedAdminCurrency : it.adminCurrency
              };
            }
            return it;
          })
        }))
      };
    }));
    
    try {
      await SheetService.updateRank(vin, itemName, offerId, selectedAdminPrice, selectedAdminCurrency);
      addLog(`Подтверждено: ${itemName}`, "success");
    } catch (e) {
      addLog(`Ошибка обновления`, "error");
      fetchData(true);
    }
  };

  const handleFormCP = async (order: Order) => {
    const orderId = order.id;
    interactionLock.current = Date.now();
    setIsSubmitting(orderId);
    setApprovedIds(prev => new Set(prev).add(orderId));
    setExpandedTenders(prev => ({ ...prev, [orderId]: false })); 
    setSuccessToast({ message: `КП по заказу ${orderId} сформировано`, id: Date.now().toString() });
    setTimeout(() => setSuccessToast(null), 3000);

    try {
      await SheetService.formCP(orderId);
      setEditingOrderId(null);
      setApprovedIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
      setVanishingIds(prev => new Set(prev).add(orderId));
      setTimeout(() => {
          setOrders(prev => prev.filter(o => o.id !== orderId));
          setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
          setIsSubmitting(null);
          fetchData(true);
      }, 700);
    } catch (err) {
      addLog(`Ошибка утверждения`, "error");
      setApprovedIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
      setIsSubmitting(null);
      fetchData(true);
    }
  };

  const filteredOrders = useMemo(() => orders.filter(o => {
    const matchSearch = o.vin.toLowerCase().includes(searchQuery.toLowerCase()) || o.id.toLowerCase().includes(searchQuery.toLowerCase());
    const isProcessed = o.isProcessed === true || o.isProcessed === 'Y';
    if (activeTab === 'open') return matchSearch && o.status === OrderStatus.OPEN && !isProcessed;
    return matchSearch && (o.status === OrderStatus.CLOSED || isProcessed);
  }), [orders, searchQuery, activeTab]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4 relative pb-20">
      {successToast && (
          <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-top-4 fade-in duration-300">
              <div className="bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700">
                  <CheckCircle2 className="text-emerald-400" size={20} />
                  <div><p className="text-[10px] font-black uppercase text-emerald-400">Успешно</p><p className="text-xs font-bold">{successToast.message}</p></div>
              </div>
          </div>
      )}

      {showLogs && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl z-[150] border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
           <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2"><History size={16}/><h2 className="text-[11px] font-black uppercase">История</h2></div>
              <button onClick={() => setShowLogs(false)} className="p-1 hover:bg-slate-200 rounded"><X size={16}/></button>
           </div>
           <div className="flex-grow overflow-y-auto p-4 space-y-3 text-[10px]">
              {logs.map(log => (
                <div key={log.id} className="font-medium border-b border-slate-50 pb-2">
                   <div className="flex justify-between mb-1"><span className="text-[8px] text-slate-400 font-bold">{log.time}</span><span className={`text-[8px] font-black uppercase ${log.type === 'success' ? 'text-emerald-500' : log.type === 'error' ? 'text-red-500' : 'text-blue-500'}`}>{log.type}</span></div>
                   <p className="text-slate-700 leading-tight">{log.text}</p>
                </div>
              ))}
           </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-sm bg-white/40">
           <div className="flex flex-col items-center gap-2"><RefreshCw className="w-8 h-8 text-slate-950 animate-spin" /><span className="text-[9px] font-black uppercase">Синхронизация...</span></div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center text-white"><FileText size={16}/></div><h1 className="text-sm font-black tracking-tight uppercase italic">Admin Panel</h1></div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowLogs(true)} className="p-1.5 bg-white border border-slate-200 rounded-lg relative"><History size={14}/></button>
           <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button onClick={() => setActiveTab('open')} className={`px-4 py-1 rounded-md text-[10px] font-bold uppercase ${activeTab === 'open' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Новые ({orders.filter(o => o.status === 'ОТКРЫТ' && !o.isProcessed).length})</button>
              <button onClick={() => setActiveTab('closed')} className={`px-4 py-1 rounded-md text-[10px] font-bold uppercase ${activeTab === 'closed' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Архив</button>
           </div>
           <button onClick={() => fetchData()} className="p-1.5 bg-slate-900 text-white rounded-lg"><RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 relative group">
            <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900"/>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Поиск по VIN или ID..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none" />
        </div>
        
        {/* TABLE HEADER - FOR DESKTOP - GRID COLS ADJUSTED FOR VIN */}
        <div className="hidden md:grid grid-cols-[80px_1.5fr_130px_1fr_110px_90px_20px] gap-4 px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
           <div>ID</div>
           <div>Автомобиль</div>
           <div>VIN</div>
           <div>Клиент</div>
           <div>Офферы</div>
           <div className="text-right">Дата</div>
           <div></div>
        </div>

        {paginatedOrders.map(order => {
          const isExpanded = expandedTenders[order.id];
          const isCurrentSubmitting = isSubmitting === order.id;
          const isEditing = editingOrderId === order.id;
          const isApproved = approvedIds.has(order.id);
          const isVanishing = vanishingIds.has(order.id);
          const isVisualSuccess = isApproved || isVanishing;
          
          let containerStyle = isVanishing ? "opacity-0 max-h-0 py-0 overflow-hidden" : isApproved ? "bg-emerald-50 border-emerald-200" : isExpanded ? "border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3" : "hover:bg-slate-50 border-b border-slate-100 last:border-0";

          const offersCount = order.offers?.length || 0;
          const hasOffers = offersCount > 0;

          return (
            <div key={order.id} className={`transition-all duration-500 border-l-4 ${containerStyle}`}>
              {/* MAIN ROW - GRID LAYOUT UPDATED */}
              <div onClick={() => !isVisualSuccess && setExpandedTenders(p => ({ ...p, [order.id]: !isExpanded }))} className="p-3 cursor-pointer select-none grid grid-cols-1 md:grid-cols-[80px_1.5fr_130px_1fr_110px_90px_20px] gap-3 md:gap-4 items-center text-[10px]">
                  
                  {/* ID */}
                  <div className="font-mono font-bold truncate flex items-center gap-2">
                     <span className="md:hidden text-slate-400">ID:</span>
                     {order.id}
                  </div>

                  {/* CAR */}
                  <div className="font-black uppercase flex flex-col min-w-0">
                    <span className="truncate flex items-center gap-1"><Car size={10} className="md:hidden inline text-slate-400"/> {order.car?.model || 'N/A'}</span>
                    <span className="text-slate-400 font-bold truncate text-[9px]">{order.car?.year} {order.car?.bodyType}</span>
                  </div>

                  {/* VIN - NEW COLUMN */}
                  <div className="font-mono font-bold text-slate-500 truncate hidden md:block">
                     {order.vin}
                  </div>

                  {/* CLIENT */}
                  <div className="font-bold uppercase text-slate-600 truncate flex items-center gap-1.5">
                     <User size={12} className="text-slate-300 shrink-0"/>
                     <span className="truncate">{order.clientName}</span>
                  </div>
                  
                  {/* OFFERS STATUS */}
                  <div className="flex">
                    <span className={`px-2.5 py-1 rounded-md font-black text-[9px] uppercase border shadow-sm flex items-center gap-1.5 ${hasOffers ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${hasOffers ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                        {offersCount} офферов
                    </span>
                  </div>

                  {/* DATE */}
                  <div className="font-bold text-slate-400 md:text-right flex items-center md:justify-end gap-1">
                     <Calendar size={10} className="md:hidden inline"/>
                     {order.createdAt.split(/[\n,]/)[0]}
                  </div>

                  {/* ACTION ICON */}
                  <div className="flex justify-end items-center">
                    {isVisualSuccess ? <CheckCircle2 size={16} className="text-emerald-600"/> : <ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-indigo-600' : ''}`}/>}
                  </div>
              </div>

              {isExpanded && !isVisualSuccess && (
                <div className="p-5 bg-white border-t border-slate-100 space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
                  <div className="space-y-3">
                     {order.items.map((item, idx) => {
                        const targetItemName = item.name.trim().toLowerCase();
                        const detailOffers = (order.offers || []).flatMap(off => off.items.filter(i => i.name.trim().toLowerCase() === targetItemName).map(i => ({ ...i, sellerName: off.clientName, offerId: off.id })));

                        return (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                             <div className="bg-slate-900 text-white px-4 py-1.5 flex justify-between items-center"><span className="text-[9px] font-black uppercase">{item.name}</span></div>
                             <div className="divide-y divide-slate-100">
                                {detailOffers.map((off, oIdx) => {
                                  const isLeader = off.rank === 'ЛИДЕР';
                                  const inputKey = `${order.id}-${off.offerId}-${item.name}`;
                                  const currentInput = adminInputs[inputKey];
                                  const valPrice = currentInput?.price ?? off.adminPrice ?? off.sellerPrice ?? 0;
                                  const valCurrency = currentInput?.currency ?? off.adminCurrency ?? off.sellerCurrency ?? 'RUB';

                                  return (
                                    <div key={oIdx} className={`p-3 grid grid-cols-[1fr_auto] gap-4 items-center ${isLeader ? 'bg-emerald-50/30' : ''}`}>
                                       <div className="flex items-center gap-4">
                                          <div className="flex flex-col"><span className="text-[10px] font-black uppercase">{off.sellerName}</span><span className="text-[9px] text-slate-500">Закуп: {off.sellerPrice} {off.sellerCurrency}</span></div>
                                       </div>
                                       <div className="flex items-center gap-3">
                                          {(activeTab === 'open' || isEditing) && (
                                              <div className="flex items-center gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                  <input 
                                                    type="text" 
                                                    value={valPrice || ''} 
                                                    onChange={e => {
                                                        const digits = e.target.value.replace(/\D/g, ''); // STRICT NUMERIC
                                                        let v = parseInt(digits) || 0;
                                                        setAdminInputs(prev => ({...prev, [inputKey]: {...(prev[inputKey] || {currency:'RUB'}), price: v}}));
                                                    }}
                                                    className="w-20 px-1 py-1 text-center text-[10px] font-bold bg-white text-slate-900 outline-none placeholder:text-slate-300" 
                                                    placeholder="Цена" 
                                                  />
                                                  <div className="w-[1px] h-4 bg-slate-200"></div>
                                                  <select value={valCurrency} onChange={e => setAdminInputs(prev => ({...prev, [inputKey]: {...(prev[inputKey] || {price:0}), currency: e.target.value as Currency}}))} className="text-[10px] font-bold bg-white text-slate-900 outline-none cursor-pointer"><option value="RUB">RUB</option><option value="USD">USD</option><option value="CNY">CNY</option></select>
                                              </div>
                                          )}
                                          <button onClick={() => handleUpdateRank(order.vin, item.name, off.offerId, order.id, off.sellerName, valPrice, valCurrency)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase shadow-sm transition-all active:scale-95 ${isLeader ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                              {isLeader ? 'Ок' : 'Выбрать'}
                                          </button>
                                       </div>
                                    </div>
                                  );
                                })}
                                {detailOffers.length === 0 && <div className="p-3 text-center text-[9px] text-slate-400 italic">Нет предложений по этой позиции</div>}
                             </div>
                          </div>
                        );
                     })}
                  </div>
                  <div className="flex justify-end pt-4"><button onClick={() => handleFormCP(order)} className="px-8 py-2.5 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95">Утвердить КП</button></div>
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