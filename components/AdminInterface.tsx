
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SheetService } from '../services/sheetService';
import { Order, OrderStatus, Currency } from '../types';
import { Pagination } from './Pagination';
import { 
  Search, RefreshCw, ChevronRight, FileText, 
  History, X, User, Edit, CheckCircle2, Calendar, Ban, Save, Edit3, Loader2, AlertTriangle, AlertCircle
} from 'lucide-react';

interface ActionLog {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface AdminModalState {
  type: 'ANNUL' | 'VALIDATION';
  orderId?: string;
  missingItems?: string[];
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
  
  // States for Edit Mode
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null); 
  const [editForm, setEditForm] = useState<any>(null); 
  
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [vanishingIds, setVanishingIds] = useState<Set<string>>(new Set());
  const [successToast, setSuccessToast] = useState<{message: string, id: string} | null>(null);

  // New Modal State replacing window.confirm/alert
  const [adminModal, setAdminModal] = useState<AdminModalState | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Store admin price inputs. Key: "orderId-offerId-itemName"
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
      currentAdminPrice: number,
      currentAdminCurrency: Currency
  ) => {
    const inputKey = `${orderId}-${offerId}-${itemName}`;
    const inputState = adminInputs[inputKey];
    
    const finalPrice = inputState?.price ?? currentAdminPrice ?? 0;
    const finalCurrency = inputState?.currency ?? currentAdminCurrency ?? 'RUB';

    interactionLock.current = Date.now();
    addLog(`Выбор: ${itemName} от ${sellerName} (${finalPrice} ${finalCurrency})`, "info");
    const targetItemName = itemName.trim().toLowerCase();

    // Optimistic Update
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        offers: o.offers?.map(off => ({
          ...off,
          items: off.items.map(it => {
            if (it.name.trim().toLowerCase() === targetItemName) {
              if (off.id === offerId) {
                  return { ...it, rank: 'ЛИДЕР', adminPrice: finalPrice, adminCurrency: finalCurrency };
              } else {
                  return { ...it, rank: 'РЕЗЕРВ' };
              }
            }
            return it;
          })
        }))
      };
    }));
    
    try {
      await SheetService.updateRank(vin, itemName, offerId, finalPrice, finalCurrency);
      addLog(`Подтверждено: ${itemName}`, "success");
    } catch (e) {
      addLog(`Ошибка обновления`, "error");
      fetchData(true); 
    }
  };

  const handleFormCP = async (e: React.MouseEvent, order: Order) => {
    e.stopPropagation(); 
    e.preventDefault();

    try {
        const missingLeaders: string[] = [];
        const safeItems = order.items || [];
        const safeOffers = order.offers || [];

        safeItems.forEach(item => {
            const itemNameLower = (item.name || '').trim().toLowerCase();
            const hasLeader = safeOffers.some(off => 
                (off.items || []).some(offItem => {
                    const offNameLower = (offItem.name || '').trim().toLowerCase();
                    return offNameLower === itemNameLower && (offItem.rank === 'ЛИДЕР' || offItem.rank === 'LEADER');
                })
            );
            if (!hasLeader) {
                missingLeaders.push(item.AdminName || item.name || 'Без названия');
            }
        });

        if (missingLeaders.length > 0) {
            // Replaced alert with Custom Modal
            setAdminModal({
                type: 'VALIDATION',
                missingItems: missingLeaders
            });
            return;
        }

        const orderId = order.id;
        interactionLock.current = Date.now();
        setIsSubmitting(orderId);
        setApprovedIds(prev => new Set(prev).add(orderId));
        setExpandedTenders(prev => ({ ...prev, [orderId]: false })); 
        setSuccessToast({ message: `КП по заказу ${orderId} сформировано`, id: Date.now().toString() });
        setTimeout(() => setSuccessToast(null), 3000);

        await SheetService.formCP(orderId);
        setEditingOrderId(null);
        setApprovedIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
        setVanishingIds(prev => new Set(prev).add(orderId));
        
        setTimeout(() => {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isProcessed: true } : o));
            setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
            setIsSubmitting(null);
            fetchData(true);
        }, 700);

    } catch (err) {
        console.error("Error approving CP:", err);
        alert("Произошла ошибка при утверждении КП. Проверьте консоль.");
        setApprovedIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
        setIsSubmitting(null);
    }
  };

  const startEditing = (e: React.MouseEvent, order: Order) => {
     e.stopPropagation();
     setEditingOrderId(order.id);
     setEditForm(JSON.parse(JSON.stringify(order))); 
  };

  const saveChanges = async (e: React.MouseEvent) => {
     e.stopPropagation();
     if (!editingOrderId || !editForm) return;
     
     const originalOrder = orders.find(o => o.id === editingOrderId);
     if (!originalOrder) return;
     
     const newCar: any = { ...originalOrder.car }; 
     newCar.AdminModel = editForm.car.model; 
     newCar.AdminYear = editForm.car.year;
     
     const newItems = originalOrder.items.map((origItem, idx) => {
         const editedItem = editForm.items[idx];
         if (!editedItem) return origItem;
         
         const newItem = { ...origItem };
         newItem.AdminName = editedItem.name;
         newItem.AdminQuantity = editedItem.quantity;
         newItem.car = newCar; 
         
         if (idx === 0 && originalOrder.clientPhone) {
             (newItem as any).clientPhone = originalOrder.clientPhone;
         }
         return newItem;
     });
     
     setIsSubmitting(editingOrderId);
     
     setOrders(prev => prev.map(o => {
         if (o.id === editingOrderId) {
             return { ...o, car: newCar, items: newItems };
         }
         return o;
     }));

     setSuccessToast({ message: "Изменения сохранены", id: Date.now().toString() });
     setEditingOrderId(null);
     setEditForm(null);

     try {
         await SheetService.updateOrderJson(editingOrderId, newItems);
         setTimeout(() => fetchData(true), 1000); 
     } catch (e) {
         console.error(e);
         alert("Ошибка сохранения на сервере, но локально данные обновлены.");
     } finally {
         setIsSubmitting(null);
         setTimeout(() => setSuccessToast(null), 3000);
     }
  };

  const cancelEditing = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingOrderId(null);
      setEditForm(null);
  };

  // 1. Opens the modal
  const handleAnnulOrder = (e: React.MouseEvent, orderId: string) => {
      e.stopPropagation();
      e.preventDefault(); 
      setAdminModal({
          type: 'ANNUL',
          orderId: orderId
      });
  };

  // 2. Performs the action
  const processAnnulment = async () => {
      if (!adminModal?.orderId) return;
      const orderId = adminModal.orderId;
      setAdminModal(null); // Close modal immediately

      setIsSubmitting(orderId);
      setVanishingIds(prev => new Set(prev).add(orderId));
      
      try {
          await SheetService.refuseOrder(orderId);
          setTimeout(() => {
              setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isRefused: true } : o));
              setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
              setIsSubmitting(null);
              fetchData(true);
          }, 700);
      } catch (e) {
          console.error(e);
          alert("Ошибка аннулирования");
          setVanishingIds(prev => { const n = new Set(prev); n.delete(orderId); return n; });
          setIsSubmitting(null);
      }
  };

  const filteredOrders = useMemo(() => orders.filter(o => {
    const matchSearch = o.vin.toLowerCase().includes(searchQuery.toLowerCase()) || o.id.toLowerCase().includes(searchQuery.toLowerCase());
    const isProcessed = o.isProcessed === true || o.isProcessed === 'Y';
    
    if (activeTab === 'open') return matchSearch && o.status === OrderStatus.OPEN && !isProcessed && !o.isRefused; 
    return matchSearch && (o.status === OrderStatus.CLOSED || isProcessed || o.isRefused);
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

      {/* CUSTOM ADMIN MODAL */}
      {adminModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setAdminModal(null)}>
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-col items-center gap-4 text-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${adminModal.type === 'ANNUL' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                          {adminModal.type === 'ANNUL' ? <AlertCircle size={24}/> : <AlertTriangle size={24}/>}
                      </div>
                      
                      {adminModal.type === 'ANNUL' && (
                          <>
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-900">Аннулировать заказ?</h3>
                                <p className="text-xs text-slate-500 font-bold mt-1">Это действие необратимо. Заказ {adminModal.orderId} будет перемещен в архив со статусом "Аннулирован".</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full mt-2">
                                <button onClick={() => setAdminModal(null)} className="py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs uppercase hover:bg-slate-200 transition-colors">Нет, назад</button>
                                <button onClick={processAnnulment} className="py-3 rounded-xl bg-red-600 text-white font-black text-xs uppercase hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Да, аннулировать</button>
                            </div>
                          </>
                      )}

                      {adminModal.type === 'VALIDATION' && (
                          <>
                             <div>
                                <h3 className="text-lg font-black uppercase text-slate-900">Невозможно утвердить КП</h3>
                                <p className="text-xs text-slate-500 font-bold mt-2">Не выбран поставщик (ЛИДЕР) для позиций:</p>
                                <div className="mt-3 bg-red-50 rounded-xl p-3 text-left border border-red-100">
                                    <ul className="list-disc pl-4 space-y-1">
                                        {adminModal.missingItems?.map((item, idx) => (
                                            <li key={idx} className="text-[10px] font-black uppercase text-red-700">{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold mt-3">Пожалуйста, отметьте галочкой предложения поставщиков для каждой позиции.</p>
                            </div>
                            <button onClick={() => setAdminModal(null)} className="w-full py-3 rounded-xl bg-slate-900 text-white font-black text-xs uppercase hover:bg-slate-800 transition-colors mt-2">Понятно</button>
                          </>
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2"><div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center text-white"><FileText size={16}/></div><h1 className="text-sm font-black tracking-tight uppercase italic">Admin Panel</h1></div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowLogs(true)} className="p-1.5 bg-white border border-slate-200 rounded-lg relative"><History size={14}/></button>
           <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button onClick={() => setActiveTab('open')} className={`px-4 py-1 rounded-md text-[10px] font-bold uppercase ${activeTab === 'open' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>Новые ({orders.filter(o => o.status === 'ОТКРЫТ' && !o.isProcessed && !o.isRefused).length})</button>
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
        
        <div className="hidden md:grid grid-cols-[80px_100px_1.5fr_60px_130px_1fr_110px_90px_20px] gap-4 px-4 py-3 bg-slate-50/80 border-b border-slate-100 text-[9px] font-black uppercase text-slate-400 tracking-wider">
           <div>ID</div>
           <div>Марка</div>
           <div>Модель</div>
           <div>Год</div>
           <div>VIN</div>
           <div>Клиент</div>
           <div>Офферы</div>
           <div className="text-right">Дата</div>
           <div></div>
        </div>

        {paginatedOrders.map(order => {
          const isExpanded = expandedTenders[order.id];
          const isEditing = editingOrderId === order.id;
          const isApproved = approvedIds.has(order.id);
          const isVanishing = vanishingIds.has(order.id);
          const isVisualSuccess = isApproved || isVanishing;
          const isProcessingAction = isSubmitting === order.id;

          const effectiveModel = order.car?.AdminModel || order.car?.model || 'N/A';
          const effectiveYear = order.car?.AdminYear || order.car?.year || '-';
          
          const fullModel = effectiveModel;
          const brandPart = fullModel.split(' ')[0];
          const modelPart = fullModel.split(' ').slice(1).join(' ') || '-';
          
          let containerStyle = isVanishing ? "opacity-0 max-h-0 py-0 overflow-hidden" : isApproved ? "bg-emerald-50 border-emerald-200" : order.isRefused ? "bg-red-50 border-red-200 opacity-60 grayscale-[0.5]" : isExpanded ? "border-l-indigo-600 ring-1 ring-indigo-600 shadow-xl bg-white relative z-10 rounded-xl my-3" : "hover:bg-slate-50 border-b border-slate-100 last:border-0";

          const offersCount = order.offers?.length || 0;
          const hasOffers = offersCount > 0;
          const currentData = isEditing ? editForm : order;

          return (
            <div key={order.id} className={`transition-all duration-500 border-l-4 ${containerStyle}`}>
              <div onClick={() => !isVisualSuccess && setExpandedTenders(p => ({ ...p, [order.id]: !isExpanded }))} className="p-3 cursor-pointer select-none grid grid-cols-1 md:grid-cols-[80px_100px_1.5fr_60px_130px_1fr_110px_90px_20px] gap-3 md:gap-4 items-center text-[10px]">
                  <div className="font-mono font-bold truncate flex items-center gap-2"><span className="md:hidden text-slate-400">ID:</span>{order.id}</div>
                  <div className="font-black uppercase truncate text-slate-800 flex items-center gap-2"><span className="md:hidden text-slate-400 w-12">Марка:</span>{brandPart}</div>
                  <div className="font-black uppercase truncate text-slate-600 flex items-center gap-2"><span className="md:hidden text-slate-400 w-12">Модель:</span>{modelPart}</div>
                  <div className="font-bold text-slate-500 flex items-center gap-2"><span className="md:hidden text-slate-400 w-12">Год:</span>{effectiveYear}</div>
                  <div className="font-mono font-bold text-slate-500 truncate hidden md:block">{order.vin}</div>
                  <div className="font-bold uppercase text-slate-600 truncate flex items-center gap-1.5"><User size={12} className="text-slate-300 shrink-0"/><span className="truncate">{order.clientName}</span></div>
                  <div className="flex">
                    {order.isRefused ? <span className="px-2.5 py-1 rounded-md font-black text-[9px] uppercase border shadow-sm bg-red-100 text-red-600 border-red-200 flex items-center gap-1"><Ban size={10}/> АННУЛИРОВАН</span> : 
                    <span className={`px-2.5 py-1 rounded-md font-black text-[9px] uppercase border shadow-sm flex items-center gap-1.5 ${hasOffers ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {order.isProcessed && <CheckCircle2 size={10} className="text-emerald-600"/>}
                        {offersCount} офферов
                    </span>}
                  </div>
                  <div className="font-bold text-slate-400 md:text-right flex items-center md:justify-end gap-1"><Calendar size={10} className="md:hidden inline"/>{order.createdAt.split(/[\n,]/)[0]}</div>
                  <div className="flex justify-end items-center">{isVisualSuccess ? <CheckCircle2 size={16} className="text-emerald-600"/> : <ChevronRight size={14} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-indigo-600' : ''}`}/>}</div>
              </div>

              {isExpanded && !isVisualSuccess && (
                <div className="p-5 bg-white border-t border-slate-100 space-y-4 cursor-default" onClick={e => e.stopPropagation()}>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 text-[10px] shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2">
                             <FileText size={12} className="text-slate-400"/> 
                             <span className="font-black uppercase text-slate-500">Детали заказа</span>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                         <div><span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Клиент</span><span className="font-black text-indigo-700 uppercase">{order.clientName}</span></div>
                         <div><span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Телефон</span><span className="font-bold text-slate-700">{order.clientPhone || '-'}</span></div>
                         <div><span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">VIN</span><span className="font-mono font-black text-slate-800">{order.vin}</span></div>
                         <div className={isEditing ? 'bg-white p-1 rounded ring-2 ring-blue-100' : ''}>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Модель</span>
                            {isEditing ? <input value={currentData.car?.model || ''} onChange={e => setEditForm({...editForm, car: {...editForm.car, model: e.target.value}})} className="w-full text-[10px] font-black uppercase outline-none border-b border-blue-300" /> : <span className="font-black text-slate-700 uppercase">{effectiveModel}</span>}
                         </div>
                         <div><span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Марка</span><span className="font-black text-slate-700 uppercase">{brandPart}</span></div>
                         <div className={isEditing ? 'bg-white p-1 rounded ring-2 ring-blue-100' : ''}>
                            <span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Год</span>
                            {isEditing ? <input value={currentData.car?.year || ''} onChange={e => setEditForm({...editForm, car: {...editForm.car, year: e.target.value}})} className="w-full text-[10px] font-black uppercase outline-none border-b border-blue-300" /> : <span className="font-black text-slate-700 uppercase">{effectiveYear}</span>}
                         </div>
                         <div><span className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Кузов</span><span className="font-black text-slate-700 uppercase">{order.car?.bodyType || '-'}</span></div>
                      </div>
                  </div>

                  <div className="space-y-3">
                     {currentData.items.map((item: any, idx: number) => {
                        const effectiveItemName = isEditing ? item.name : (item.AdminName || item.name);
                        const originalName = order.items[idx]?.name || item.name;
                        const targetItemName = originalName.trim().toLowerCase();
                        const detailOffers = (order.offers || []).flatMap(off => off.items.filter(i => i.name.trim().toLowerCase() === targetItemName).map(i => ({ ...i, sellerName: off.clientName, offerId: off.id })));

                        return (
                          <div key={idx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                             <div className={`px-4 py-2 flex justify-between items-center ${isEditing ? 'bg-blue-50 border-b border-blue-200' : 'bg-slate-900 text-white'}`}>
                                 {isEditing ? (
                                     <div className="flex gap-2 w-full">
                                         <input value={item.name} onChange={e => { const newItems = [...editForm.items]; newItems[idx].name = e.target.value; setEditForm({...editForm, items: newItems}); }} className="bg-transparent border-b border-blue-300 outline-none w-2/3 text-[10px] font-black uppercase text-blue-900" />
                                         <input type="number" value={item.quantity} onChange={e => { const newItems = [...editForm.items]; newItems[idx].quantity = parseInt(e.target.value); setEditForm({...editForm, items: newItems}); }} className="bg-transparent border-b border-blue-300 outline-none w-1/6 text-[10px] font-black uppercase text-blue-900 text-center" />
                                     </div>
                                 ) : (
                                     <span className="text-[9px] font-black uppercase">{effectiveItemName} ({item.AdminQuantity || item.quantity} шт)</span>
                                 )}
                             </div>
                             
                             <div className="divide-y divide-slate-100">
                                {detailOffers.map((off, oIdx) => {
                                  const isLeader = off.rank === 'ЛИДЕР';
                                  const inputKey = `${order.id}-${off.offerId}-${originalName}`;
                                  const currentInput = adminInputs[inputKey];
                                  const valPrice = currentInput?.price ?? off.adminPrice ?? off.sellerPrice ?? 0;
                                  const valCurrency = currentInput?.currency ?? off.adminCurrency ?? off.sellerCurrency ?? 'RUB';

                                  return (
                                    <div key={oIdx} className={`p-3 grid grid-cols-[1fr_100px_70px_100px] gap-4 items-center ${isLeader ? 'bg-emerald-50/30' : ''}`}>
                                       <div className="flex items-center gap-4 min-w-0">
                                          <div className="flex flex-col truncate"><span className="text-[10px] font-black uppercase truncate">{off.sellerName}</span><span className="text-[9px] text-slate-500">Закуп: {off.sellerPrice} {off.sellerCurrency}</span></div>
                                       </div>
                                       <div className="flex items-center bg-white border border-slate-200 rounded-lg h-8 px-2 shadow-sm focus-within:ring-1 focus-within:ring-indigo-200">
                                          <input type="text" value={valPrice || ''} onChange={e => { const digits = e.target.value.replace(/\D/g, ''); let v = parseInt(digits) || 0; setAdminInputs(prev => ({...prev, [inputKey]: {...(prev[inputKey] || {currency: valCurrency}), price: v}})); }} className="w-full text-center text-[10px] font-bold bg-transparent outline-none placeholder:text-slate-300" placeholder="0" />
                                       </div>
                                       <div className="flex items-center bg-white border border-slate-200 rounded-lg h-8 px-1 shadow-sm">
                                          <select value={valCurrency} onChange={e => setAdminInputs(prev => ({...prev, [inputKey]: {...(prev[inputKey] || {price: valPrice}), currency: e.target.value as Currency}}))} className="w-full text-[10px] font-bold bg-transparent outline-none cursor-pointer text-center"><option value="RUB">RUB</option><option value="USD">USD</option><option value="CNY">CNY</option></select>
                                       </div>
                                       <div className="flex justify-end">
                                          {!order.isRefused && (
                                              <button type="button" onClick={() => handleUpdateRank(order.vin, originalName, off.offerId, order.id, off.sellerName, valPrice, valCurrency)} className={`w-full h-8 rounded-lg text-[9px] font-black uppercase shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1 ${isLeader ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}>
                                                  {isLeader ? <><CheckCircle2 size={12}/> Лидер</> : 'Выбрать'}
                                              </button>
                                          )}
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
                  
                  {!order.isRefused && (
                      <div className="flex justify-end items-center pt-4 border-t border-slate-100 gap-4 mt-2 relative z-50">
                          {isEditing ? (
                              <div className="flex gap-2 w-full justify-end animate-in fade-in slide-in-from-left-4 duration-300">
                                 <button type="button" onClick={cancelEditing} disabled={!!isSubmitting} className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 font-bold uppercase text-[10px] border border-slate-200 transition-all">
                                     <X size={14}/> Отмена
                                 </button>
                                 <button type="button" onClick={saveChanges} disabled={!!isSubmitting} className="flex items-center gap-1.5 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black uppercase text-[10px] shadow-lg shadow-blue-200 active:scale-95 transition-all min-w-[120px] justify-center">
                                     {isSubmitting === order.id ? <Loader2 size={14} className="animate-spin"/> : <><Save size={14}/> Сохранить</>}
                                 </button>
                              </div>
                          ) : (
                              <>
                                  <div className="flex gap-2">
                                     <button type="button" onClick={(e) => startEditing(e, order)} className="flex items-center gap-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-bold uppercase text-[9px] border border-blue-200 transition-all">
                                         <Edit3 size={12}/> Изменить
                                     </button>
                                     <button type="button" onClick={(e) => handleAnnulOrder(e, order.id)} disabled={!!isProcessingAction} className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold uppercase text-[9px] border border-red-200 transition-all disabled:opacity-50 min-w-[100px] justify-center">
                                         {isProcessingAction ? <Loader2 size={12} className="animate-spin"/> : <><Ban size={12}/> Аннулировать</>}
                                     </button>
                                  </div>
                                  
                                  <div className="w-[1px] h-8 bg-slate-200"></div>

                                  <button type="button" onClick={(e) => handleFormCP(e, order)} disabled={!!isProcessingAction} className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 min-w-[140px] flex justify-center">
                                      {isProcessingAction ? <Loader2 size={14} className="animate-spin"/> : 'Утвердить КП'}
                                  </button>
                              </>
                          )}
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
  );
};
