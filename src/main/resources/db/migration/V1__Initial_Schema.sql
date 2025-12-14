-- Миграция V1: Создание базовой схемы для Card System
-- Эта миграция создаёт все необходимые таблицы для работы системы карточек

-- Таблица карточек - содержит шаблоны всех карточек в игре
-- Важно: это НЕ инвентарь игрока, а описание карточек как таковых
CREATE TABLE cards (
                       id BIGSERIAL PRIMARY KEY,
                       name VARCHAR(255) NOT NULL,
                       description TEXT,
                       image_url VARCHAR(500),
    -- Редкость карточки: влияет на визуализацию и базовую стоимость
                       rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    -- Цена продажи в игровой валюте
                       sell_price INTEGER NOT NULL DEFAULT 10,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска карточек по редкости
-- Это пригодится, когда захочешь показать все легендарки или посчитать статистику
CREATE INDEX idx_cards_rarity ON cards(rarity);

-- Таблица наборов - контейнеры, из которых выпадают карточки
CREATE TABLE packs (
                       id BIGSERIAL PRIMARY KEY,
                       name VARCHAR(255) NOT NULL,
                       description TEXT,
                       cover_image VARCHAR(500),
    -- Сколько карточек игрок получает при открытии набора
                       cards_per_open INTEGER NOT NULL DEFAULT 5,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Связующая таблица: какие карточки входят в какие наборы и с какими шансами
-- Это ключевая таблица для всей системы выпадения
CREATE TABLE pack_cards (
                            id BIGSERIAL PRIMARY KEY,
                            pack_id BIGINT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
                            card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    -- Шанс выпадения от 0.0 до 1.0 (0% до 100%)
    -- Например: 0.5 = 50%, 0.01 = 1%, 0.001 = 0.1%
                            drop_chance DOUBLE PRECISION NOT NULL CHECK (drop_chance >= 0 AND drop_chance <= 1),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Убеждаемся, что одна карточка не может быть дважды в одном наборе
                            UNIQUE(pack_id, card_id)
);

-- Индексы для оптимизации запросов при открытии паков
CREATE INDEX idx_pack_cards_pack ON pack_cards(pack_id);
CREATE INDEX idx_pack_cards_card ON pack_cards(card_id);

-- Таблица состояния игрока (пока один виртуальный игрок)
-- В будущем это превратится в полноценную систему пользователей
CREATE TABLE player_state (
                              id BIGSERIAL PRIMARY KEY,
    -- Игровая валюта (например, золото, кристаллы и т.д.)
                              balance INTEGER NOT NULL DEFAULT 0,
                              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Инвентарь игрока - какие карточки у него есть и в каком количестве
-- Храним только количество, а не отдельные записи для каждой карточки
CREATE TABLE player_cards (
                              id BIGSERIAL PRIMARY KEY,
                              player_id BIGINT NOT NULL REFERENCES player_state(id) ON DELETE CASCADE,
                              card_id BIGINT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    -- Количество карточек данного типа у игрока
                              quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
    -- Когда игрок впервые получил эту карточку
                              first_obtained_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Когда последний раз количество менялось
                              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Один игрок не может иметь две записи для одной карточки
                              UNIQUE(player_id, card_id)
);

-- Индексы для быстрого доступа к инвентарю игрока
CREATE INDEX idx_player_cards_player ON player_cards(player_id);
CREATE INDEX idx_player_cards_card ON player_cards(card_id);

-- Создаём виртуального игрока с начальным балансом
-- ID = 1 будет использоваться как константа в коде
INSERT INTO player_state (id, balance) VALUES (1, 1000);

-- Тестовые данные: создаём несколько карточек разных редкостей
INSERT INTO cards (name, description, rarity, sell_price, image_url) VALUES
                                                                         ('Забытый рыцарь', 'Одинокий воин, потерявший память о своём прошлом. Его меч всё ещё помнит вкус крови.', 'COMMON', 10, 'https://placehold.co/300x400/1a1a1a/ffffff?text=Forgotten+Knight'),
                                                                         ('Теневой ассасин', 'Убийца, существующий между мирами. Его клинки не оставляют следов.', 'RARE', 50, 'https://placehold.co/300x400/2d1b4e/ffffff?text=Shadow+Assassin'),
                                                                         ('Кровавая жрица', 'Служительница древнего культа. Её ритуалы требуют жертв.', 'RARE', 50, 'https://placehold.co/300x400/4e1b1b/ffffff?text=Blood+Priestess'),
                                                                         ('Проклятый маг', 'Волшебник, поглощённый запретной магией. Его заклинания питаются его жизненной силой.', 'EPIC', 150, 'https://placehold.co/300x400/1b3a4e/ffffff?text=Cursed+Mage'),
                                                                         ('Костяной дракон', 'Древнее существо, восставшее из праха. Его рёв заставляет мёртвых танцевать.', 'EPIC', 150, 'https://placehold.co/300x400/4e3d1b/ffffff?text=Bone+Dragon'),
                                                                         ('Повелитель Бездны', 'Сущность из-за пределов реальности. Смотреть на него — значит терять рассудок.', 'LEGENDARY', 500, 'https://placehold.co/300x400/0a0a0a/8b0000?text=Void+Lord');

-- Создаём тестовый набор карточек
INSERT INTO packs (name, description, cover_image, cards_per_open) VALUES
    ('Стартовый набор: Тени прошлого', 'Базовый набор для новичков. Содержит карточки разных редкостей с акцентом на тёмное фэнтези.', 'https://placehold.co/400x300/1a1a1a/ffffff?text=Starter+Pack', 5);

-- Настраиваем шансы выпадения для стартового набора
-- Обрати внимание: сумма шансов НЕ обязана быть равна 1.0
-- Алгоритм сам нормализует вероятности
INSERT INTO pack_cards (pack_id, card_id, drop_chance) VALUES
-- Обычные карты: высокий шанс (50% каждая)
(1, 1, 0.50),  -- Забытый рыцарь
-- Редкие карты: средний шанс (20% каждая)
(1, 2, 0.20),  -- Теневой ассасин
(1, 3, 0.20),  -- Кровавая жрица
-- Эпические карты: низкий шанс (5% каждая)
(1, 4, 0.05),  -- Проклятый маг
(1, 5, 0.05),  -- Костяной дракон
-- Легендарная карта: очень редкая (1%)
(1, 6, 0.01);  -- Повелитель Бездны