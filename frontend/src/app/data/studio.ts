export const portfolioItems = [
  {
    id: 1,
    title: 'Тихий портрет',
    category: 'Портрет',
    image:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    description: 'Нейтральный фон, мягкий свет и внимание только к лицу, фактуре и выражению.',
  },
  {
    id: 2,
    title: 'Редакционный кадр',
    category: 'Editorial',
    image:
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
    description: 'Сдержанная fashion-подача для лукбуков, брендов и персональных визуальных историй.',
  },
  {
    id: 3,
    title: 'Повседневная сцена',
    category: 'Lifestyle',
    image:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    description: 'Камерные кадры с естественным ритмом, воздухом и спокойной бытовой пластикой.',
  },
];

export const hallShowcase = [
  {
    key: 'cyclorama',
    title: 'Циклорама',
    price_per_hour: 3500,
    equipment: ['3 импульсных моноблока', 'Рефлектор и софтбокс', 'Фоновые стойки'],
    image:
      'https://unsplash.com/photos/WPD64XgO5zk/download?force=true&w=1400',
    description: 'Светлый зал с чистым фоном для каталогов, портретов, кампейнов и съёмок на ровном белом фоне.',
  },
  {
    key: 'interior-hall',
    title: 'Интерьерный зал',
    price_per_hour: 4500,
    equipment: ['Постоянный свет LED', 'Отражатели', 'Стойки C-Stand'],
    image:
      'https://unsplash.com/photos/MRx-rSdOKtk/download?force=true&w=1400',
    description: 'Спокойный интерьер для lifestyle, семейных съёмок, брендов и кадров с живой фактурой пространства.',
  },
  {
    key: 'loft-hall',
    title: 'Лофт',
    price_per_hour: 5500,
    equipment: ['Большие окна', '2 генератора света', 'Подвесы для фонов'],
    image:
      'https://unsplash.com/photos/XriehBZJ7Zk/download?force=true&w=1400',
    description: 'Просторный зал с большими окнами и индустриальным характером для lookbook, видео и командных съёмок.',
  },
];

export const valuePoints = [
  'Спокойные залы без лишнего визуального шума.',
  'Естественный свет и продуманная геометрия интерьера.',
  'Понятное онлайн-бронирование без звонков и переписки.',
  'Чистый интерфейс, в котором кадр и зал остаются главными.',
];

export const workflowSteps = [
  'Выберите зал под формат съёмки и нужное настроение.',
  'Проверьте свободные интервалы и соберите бронь в пару шагов.',
  'Подтвердите заказ и оплату прямо в личном кабинете.',
  'Приезжайте в подготовленное пространство и снимайте без суеты.',
];

export const contacts = {
  phone: '+7 (495) 120-18-30',
  email: 'hello@exposition.studio',
  address: 'Москва, Бауманская, 11с8',
  hours: 'Ежедневно с 08:00 до 23:00',
};

function normalizeHallTitle(name: string, fallback: string) {
  const trimmed = name.trim();
  if (!trimmed) return fallback;

  const lowered = trimmed.toLowerCase();
  const looksGeneric =
    lowered.includes('main hall') ||
    lowered.includes('vip hall') ||
    lowered.includes('temp hall') ||
    lowered.includes('hall') ||
    lowered.includes('test') ||
    lowered.includes('sneaky');

  return looksGeneric ? fallback : trimmed;
}

export function getHallPresentation(name: string, id: number) {
  const source = hallShowcase[(id - 1 + hallShowcase.length) % hallShowcase.length];
  const title = normalizeHallTitle(name, source.title);

  return {
    title,
    description: `${source.description} Зал «${title}» вписан в спокойную эстетику фотостудии «Экспозиция» и подходит для аккуратной студийной работы.`,
    image: source.image,
    equipment: source.equipment,
  };
}
