import React, { useState, useEffect } from 'react';
import { Camera, Package, Skull, TrendingUp, Home, Backpack } from 'lucide-react';

/**
 * Card System — Dark Fantasy
 * BASE v0.1
 * 
 * Архитектура фронтенда:
 * - Используем React hooks (useState, useEffect) для управления состоянием
 * - Вся логика HTTP-запросов инкапсулирована в API-слой
 * - Tailwind CSS для стилизации (dark fantasy палитра)
 * - Простая навигация через state (без React Router на базовом этапе)
 * 
 * Палитра Dark Fantasy:
 * - Фон: очень тёмный серый (#0a0a0a, #1a1a1a)
 * - Акценты: кроваво-красный (#dc2626), тёмно-фиолетовый (#6b21a8)
 * - Текст: светло-серый (#e5e5e5) для читаемости
 * - Карточки: полупрозрачный чёрный с границами
 */

// === ТИПЫ ===

type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

interface Card {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  rarity: Rarity;
  sellPrice: number;
}

interface Pack {
  id: number;
  name: string;
  description: string;
  coverImage: string;
  cardsPerOpen: number;
}

interface PlayerCard {
  id: number;
  card: Card;
  quantity: number;
}

// === API СЛОЙ ===

const API_BASE = 'http://localhost:8080/api';

const api = {
  async getPacks(): Promise<Pack[]> {
    const res = await fetch(`${API_BASE}/packs`);
    if (!res.ok) throw new Error('Failed to fetch packs');
    return res.json();
  },
  
  async openPack(packId: number): Promise<{ cards: Card[]; newBalance: number }> {
    const res = await fetch(`${API_BASE}/packs/${packId}/open`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to open pack');
    return res.json();
  },
  
  async getInventory(): Promise<PlayerCard[]> {
    const res = await fetch(`${API_BASE}/inventory`);
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return res.json();
  },
  
  async getBalance(): Promise<number> {
    const res = await fetch(`${API_BASE}/inventory/balance`);
    if (!res.ok) throw new Error('Failed to fetch balance');
    const data = await res.json();
    return data.balance;
  },
  
  async sellCard(cardId: number): Promise<{ newBalance: number; priceReceived: number; cardName: string }> {
    const res = await fetch(`${API_BASE}/inventory/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId })
    });
    if (!res.ok) throw new Error('Failed to sell card');
    return res.json();
  }
};

// === УТИЛИТЫ ===

// Цвета для разных редкостей
const rarityColors: Record<Rarity, string> = {
  COMMON: 'border-gray-500 bg-gray-900/30',
  RARE: 'border-blue-500 bg-blue-900/30',
  EPIC: 'border-purple-500 bg-purple-900/30',
  LEGENDARY: 'border-yellow-500 bg-yellow-900/30'
};

const rarityTextColors: Record<Rarity, string> = {
  COMMON: 'text-gray-400',
  RARE: 'text-blue-400',
  EPIC: 'text-purple-400',
  LEGENDARY: 'text-yellow-400'
};

// === КОМПОНЕНТЫ ===


// Компонент отдельной карточки
const CardComponent: React.FC<{ card: Card; onSell?: () => void; quantity?: number }> = ({ card, onSell, quantity }) => {
  return (
    <div className={`border-2 rounded-lg p-4 ${rarityColors[card.rarity]} transition-all hover:scale-105`}>
      <img 
        src={card.imageUrl} 
        alt={card.name}
        className="w-full h-48 object-cover rounded mb-3"
      />
      <h3 className="text-lg font-bold text-gray-100 mb-1">{card.name}</h3>
      <p className={`text-sm font-semibold mb-2 ${rarityTextColors[card.rarity]}`}>
        {card.rarity}
      </p>
      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{card.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-yellow-500">
          <TrendingUp size={16} />
          <span className="text-sm font-semibold">{card.sellPrice}</span>
        </div>
        
        {quantity !== undefined && (
          <span className="text-xs text-gray-500">x{quantity}</span>
        )}
        
        {onSell && (
          <button
            onClick={onSell}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            Продать
          </button>
        )}
      </div>
    </div>
  );
};

// Компонент набора
const PackCard: React.FC<{ pack: Pack; onOpen: () => void }> = ({ pack, onOpen }) => {
  return (
    <div className="border-2 border-gray-700 rounded-lg p-6 bg-gray-900/50 hover:border-red-600 transition-all">
      <img 
        src={pack.coverImage} 
        alt={pack.name}
        className="w-full h-40 object-cover rounded mb-4"
      />
      <h3 className="text-xl font-bold text-gray-100 mb-2">{pack.name}</h3>
      <p className="text-sm text-gray-400 mb-4">{pack.description}</p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {pack.cardsPerOpen} карт
        </span>
        <button
          onClick={onOpen}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
        >
          Открыть
        </button>
      </div>
    </div>
  );
};

// === ГЛАВНЫЙ КОМПОНЕНТ ===

export default function App() {
  const [page, setPage] = useState<'home' | 'pack-open' | 'inventory'>('home');
  const [packs, setPacks] = useState<Pack[]>([]);
  const [inventory, setInventory] = useState<PlayerCard[]>([]);
  const [balance, setBalance] = useState(0);
  const [openedCards, setOpenedCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка начальных данных
  useEffect(() => {
    loadPacks();
    loadBalance();
  }, []);

  const loadPacks = async () => {
    try {
      const data = await api.getPacks();
      setPacks(data);
    } catch (err) {
      setError('Не удалось загрузить наборы');
    }
  };

  const loadInventory = async () => {
    try {
      const data = await api.getInventory();
      setInventory(data);
    } catch (err) {
      setError('Не удалось загрузить инвентарь');
    }
  };

  const loadBalance = async () => {
    try {
      const bal = await api.getBalance();
      setBalance(bal);
    } catch (err) {
      setError('Не удалось загрузить баланс');
    }
  };

  const handleOpenPack = async (packId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.openPack(packId);
      setOpenedCards(result.cards);
      setBalance(result.newBalance);
      setPage('pack-open');
    } catch (err) {
      setError('Не удалось открыть набор');
    } finally {
      setLoading(false);
    }
  };

  const handleSellCard = async (cardId: number) => {
    setLoading(true);
    try {
      const result = await api.sellCard(cardId);
      setBalance(result.newBalance);
      await loadInventory();
    } catch (err) {
      setError('Не удалось продать карточку');
    } finally {
      setLoading(false);
    }
  };
  

  const goToInventory = () => {
    setPage('inventory');
    loadInventory();
  };

  const goHome = () => {
    setPage('home');
    setOpenedCards([]);
  };

  // === РЕНДЕР ===

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-gray-100">
      {/* Шапка */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skull className="text-red-600" size={32} />
            <h1 className="text-2xl font-bold">Card System</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-yellow-500 font-semibold">
              <TrendingUp size={20} />
              <span>{balance}</span>
            </div>
            
            <nav className="flex gap-2">
              <button
                onClick={goHome}
                className={`px-4 py-2 rounded transition-colors ${
                  page === 'home' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <Home size={20} />
              </button>
              <button
                onClick={goToInventory}
                className={`px-4 py-2 rounded transition-colors ${
                  page === 'inventory' ? 'bg-red-600' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <Backpack size={20} />
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-600 rounded text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-t-transparent"></div>
          </div>
        )}

        {/* Главная страница - список наборов */}
        {page === 'home' && !loading && (
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Package className="text-red-600" />
              Доступные наборы
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packs.map(pack => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onOpen={() => handleOpenPack(pack.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Страница результата открытия */}
        {page === 'pack-open' && !loading && (
          <div>
            <h2 className="text-3xl font-bold mb-6 text-center">Вы получили:</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
              {openedCards.map((card, idx) => (
                <CardComponent key={idx} card={card} />
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={goHome}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded transition-colors"
              >
                Вернуться к наборам
              </button>
            </div>
          </div>
        )}
        

        {/* Страница инвентаря */}
        {page === 'inventory' && !loading && (
          <div>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Backpack className="text-red-600" />
              Ваш инвентарь
            </h2>
            
            {inventory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>Инвентарь пуст. Откройте набор, чтобы получить карточки!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {inventory.map(pc => (
                  <CardComponent
                    key={pc.id}
                    card={pc.card}
                    quantity={pc.quantity}
                    onSell={() => handleSellCard(pc.card.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}