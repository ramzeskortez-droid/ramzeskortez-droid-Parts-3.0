import React, { useState } from 'react';
import { ClientInterface } from './components/ClientInterface';
import { SellerInterface } from './components/SellerInterface';
import { AdminInterface } from './components/AdminInterface';
import { Users, ShoppingBag, ShieldCheck } from 'lucide-react';

enum AppView {
  CLIENT = 'CLIENT',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN'
}

// Хардкодим URL по умолчанию
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbxooqVnUce3SIllt2RUtG-KJ5EzNswyHqrTpdsTGhc6XOKW6qaUdlr6ld77LR2KQz0-/exec';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CLIENT);
  
  // URL всегда берем из константы или локального хранилища
  const apiUrl = localStorage.getItem('GAS_API_URL') || DEFAULT_API_URL;

  const renderContent = () => {
    switch (currentView) {
      case AppView.SELLER:
        return <SellerInterface />;
      case AppView.ADMIN:
        return <AdminInterface />;
      case AppView.CLIENT:
      default:
        return <ClientInterface />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <img src="https://i.vgy.me/0lR7Mt.png" alt="logo" className="w-8 h-8 object-contain" />
             <span className="font-black tracking-tight uppercase hidden sm:inline text-[11px]">
               autoparts market | <span className="text-indigo-600">china-nai</span>
             </span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
               onClick={() => setCurrentView(AppView.CLIENT)} 
               className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === AppView.CLIENT ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <Users size={14}/> <span className="hidden sm:inline">Клиент</span>
             </button>
             <button 
               onClick={() => setCurrentView(AppView.SELLER)} 
               className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === AppView.SELLER ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <ShoppingBag size={14}/> <span className="hidden sm:inline">Поставщик</span>
             </button>
             <button 
               onClick={() => setCurrentView(AppView.ADMIN)} 
               className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${currentView === AppView.ADMIN ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
             >
               <ShieldCheck size={14}/> <span className="hidden sm:inline">Админ</span>
             </button>
          </div>
          
          <div className="w-8"></div>
        </div>
      </header>

      <main className="pt-6">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;