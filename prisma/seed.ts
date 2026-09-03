import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createDatabaseAdapter } from '../src/lib/db-adapter.js';
import { ORDER_NUMBER_START } from '../src/lib/constants.js';
import { toMinor } from '../src/lib/money.js';
import { DEFAULT_SETTINGS } from '../src/lib/settings.js';
import { buildSearchText } from '../src/lib/search.js';

/**
 * تعبئة قاعدة البيانات.
 *
 *   npm run db:seed              → البيانات الأساسية + محتوى تجريبي
 *   npm run db:seed -- --no-demo → البيانات الأساسية فقط (للإنتاج)
 *
 * «البيانات الأساسية» = إعدادات، مدن، تصنيفات، صفحات سياسات، عدّاد الطلبات.
 * «المحتوى التجريبي» = منتجات وصور وعلامات مستوحى منها — يُحذف قبل الإطلاق.
 *
 * لا توجد أسعار توصيل ولا أرقام هواتف مفترضة: المدن تُنشأ برسوم صفرية
 * والإعدادات بحقول فارغة، ويحدّدها المدير من لوحة التحكم.
 */

const adapter = createDatabaseAdapter(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const includeDemo = !process.argv.includes('--no-demo');

// ─────────────────────────── البيانات الأساسية ───────────────────────────

/** مدن ليبيا الرئيسية — الرسوم والمدد يحددها المدير لاحقًا */
const CITIES = [
  'طرابلس',
  'بنغازي',
  'مصراتة',
  'الزاوية',
  'زليتن',
  'الخمس',
  'صبراتة',
  'غريان',
  'البيضاء',
  'درنة',
  'طبرق',
  'المرج',
  'أجدابيا',
  'سرت',
  'سبها',
  'الجفرة',
  'ترهونة',
  'بني وليد',
  'يفرن',
  'نالوت',
];

/** الأيقونات مفاتيح من `CATEGORY_ICONS` — انظر src/lib/constants.ts */
const CATEGORIES = [
  { name: 'عطور رجالية', slug: 'men', icon: 'wind' },
  { name: 'عطور نسائية', slug: 'women', icon: 'flower' },
  { name: 'عطور للجنسين', slug: 'unisex', icon: 'droplet' },
  { name: 'الأكثر مبيعًا', slug: 'best-sellers', icon: 'crown' },
  { name: 'وصل حديثًا', slug: 'new-arrivals', icon: 'sparkles' },
  { name: 'العروض', slug: 'offers', icon: 'gem' },
  { name: 'الباقات', slug: 'bundles', icon: 'package' },
  { name: 'عطور قوية وثابتة', slug: 'long-lasting', icon: 'flame' },
  { name: 'عطور صيفية', slug: 'summer', icon: 'sun' },
  { name: 'عطور شتوية', slug: 'winter', icon: 'snowflake' },
];

const CONTENT_PAGES = [
  {
    slug: 'about',
    title: 'من نحن',
    body:
      'Monebra Perfume علامة متخصصة في تركيب وبيع العطور المستوحاة من أشهر ' +
      'الروائح العالمية، بتركيز عالٍ وثبات طويل وبسعر في متناول الجميع.\n\n' +
      '⚠️ هذا نص افتراضي — عدّله من لوحة التحكم قبل الإطلاق.',
  },
  {
    slug: 'shipping-policy',
    title: 'سياسة التوصيل',
    body:
      'نوصّل إلى جميع المدن المتاحة في صفحة إتمام الطلب. تُحتسب رسوم التوصيل ' +
      'حسب المدينة والمنطقة وتظهر لك قبل تأكيد الطلب.\n\n' +
      '⚠️ هذا نص افتراضي — عدّله من لوحة التحكم قبل الإطلاق.',
  },
  {
    slug: 'return-policy',
    title: 'سياسة الاستبدال والاسترجاع',
    body:
      'يمكنك رفض الطلب عند الاستلام إذا كان المنتج مختلفًا عمّا طلبته أو تالفًا.\n\n' +
      '⚠️ هذا نص افتراضي — عدّله من لوحة التحكم قبل الإطلاق.',
  },
  {
    slug: 'privacy-policy',
    title: 'سياسة الخصوصية',
    body:
      'نستخدم بياناتك (الاسم ورقم الهاتف والعنوان) لتنفيذ طلبك وتوصيله فقط، ' +
      'ولا نشاركها مع أي جهة خارجية.\n\n' +
      '⚠️ هذا نص افتراضي — عدّله من لوحة التحكم قبل الإطلاق.',
  },
];

async function seedCore() {
  console.log('▸ الإعدادات...');
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value) },
      update: {}, // لا نكتب فوق ما عدّله المدير
    });
  }

  console.log('▸ عدّاد أرقام الطلبات...');
  await prisma.counter.upsert({
    where: { key: 'order_number' },
    create: { key: 'order_number', value: ORDER_NUMBER_START },
    update: {},
  });

  console.log('▸ المدن...');
  for (const [index, name] of CITIES.entries()) {
    await prisma.city.upsert({
      where: { name },
      create: { name, sortOrder: index, deliveryFee: 0, isActive: true },
      update: {},
    });
  }

  console.log('▸ التصنيفات...');
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, sortOrder: index, isActive: true },
      update: {},
    });
  }

  console.log('▸ صفحات المحتوى...');
  for (const [index, page] of CONTENT_PAGES.entries()) {
    await prisma.contentPage.upsert({
      where: { slug: page.slug },
      create: { ...page, sortOrder: index },
      update: {},
    });
  }
}

// ─────────────────────────── المحتوى التجريبي ───────────────────────────

/**
 * علامات عطور عالمية تُستخدم *للمقارنة النصية فقط*.
 * لا شعارات ولا صور ولا ادعاء بأي علاقة أو تمثيل. قابلة للحذف والتعديل
 * بالكامل من لوحة التحكم.
 */
const DEMO_BRANDS = [
  { name: 'Dior', slug: 'dior', aliases: 'ديور' },
  { name: 'Chanel', slug: 'chanel', aliases: 'شانيل' },
  { name: 'Creed', slug: 'creed', aliases: 'كريد' },
  { name: 'Tom Ford', slug: 'tom-ford', aliases: 'توم فورد' },
  { name: 'Yves Saint Laurent', slug: 'ysl', aliases: 'YSL,ايف سان لوران' },
  { name: 'Lattafa', slug: 'lattafa', aliases: 'لطافة' },
  { name: 'Giorgio Armani', slug: 'armani', aliases: 'ارماني' },
  { name: 'Paco Rabanne', slug: 'paco-rabanne', aliases: 'باكو رابان' },
];

type DemoProduct = {
  name: string;
  slug: string;
  category: string;
  brand: string;
  inspirationName: string;
  gender: 'men' | 'women' | 'unisex';
  family: string;
  longevity: number;
  sillage: number;
  season: string;
  occasion: string;
  timeOfDay: string;
  short: string;
  description: string;
  notes: { top: string[]; middle: string[]; base: string[] };
  variants: { label: string; ml: number; price: number; compare?: number; stock: number }[];
  flags?: Partial<{
    isFeatured: boolean;
    isNew: boolean;
    isBestSeller: boolean;
    isLimited: boolean;
  }>;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    name: 'مونيبرا نوار',
    slug: 'monebra-noir',
    category: 'men',
    brand: 'tom-ford',
    inspirationName: 'Tobacco Vanille',
    gender: 'men',
    family: 'شرقي خشبي',
    longevity: 5,
    sillage: 4,
    season: 'autumn,winter',
    occasion: 'events,night',
    timeOfDay: 'night',
    short: 'تبغ دافئ وفانيليا كريمية — حضور لا يُنسى في الأمسيات الباردة.',
    description:
      'عطر شرقي خشبي كثيف يفتح بحرارة التبغ والتوابل، ثم يهدأ على قلب من ' +
      'الفانيليا والكاكاو، ليستقر على قاعدة من خشب الصندل والتونكا. ' +
      'ثباته طويل جدًا وفوحانه قوي، ما يجعله مناسبًا للمناسبات المسائية ' +
      'وأجواء الشتاء.',
    notes: {
      top: ['التبغ', 'التوابل الحارة', 'القرفة'],
      middle: ['الفانيليا', 'الكاكاو', 'زهرة التبغ'],
      base: ['خشب الصندل', 'التونكا', 'العنبر'],
    },
    variants: [
      { label: '30 مل', ml: 30, price: 65, stock: 24 },
      { label: '50 مل', ml: 50, price: 95, compare: 120, stock: 18 },
      { label: '100 مل', ml: 100, price: 155, compare: 190, stock: 7 },
    ],
    flags: { isFeatured: true, isBestSeller: true },
  },
  {
    name: 'مونيبرا سوفاج',
    slug: 'monebra-sauvage',
    category: 'men',
    brand: 'dior',
    inspirationName: 'Sauvage',
    gender: 'men',
    family: 'عطري فوجير',
    longevity: 4,
    sillage: 5,
    season: 'spring,summer',
    occasion: 'daily,work',
    timeOfDay: 'both',
    short: 'برغموت منعش وعنبر جاف — انتعاش رجالي يصلح لكل يوم.',
    description:
      'افتتاحية حادة من البرغموت الكلابري والفلفل، تتحول إلى قلب من اللافندر ' +
      'وحبّ الجنة، وقاعدة من العنبر الجاف واللبدانوم. عطر متعدد الاستخدامات، ' +
      'فوحانه عالٍ في الساعات الأولى وثباته جيد جدًا.',
    notes: {
      top: ['البرغموت', 'الفلفل الأسود', 'الليمون'],
      middle: ['اللافندر', 'حب الجنة', 'إبرة الراعي'],
      base: ['العنبر الجاف', 'اللبدانوم', 'الباتشولي'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 85, stock: 30 },
      { label: '100 مل', ml: 100, price: 140, compare: 165, stock: 22 },
    ],
    flags: { isBestSeller: true, isFeatured: true },
  },
  {
    name: 'مونيبرا روز',
    slug: 'monebra-rose',
    category: 'women',
    brand: 'chanel',
    inspirationName: 'Coco Mademoiselle',
    gender: 'women',
    family: 'شرقي زهري',
    longevity: 4,
    sillage: 4,
    season: 'spring,autumn',
    occasion: 'daily,events',
    timeOfDay: 'both',
    short: 'برتقال وباتشولي وورد — أنوثة كلاسيكية بلمسة عصرية.',
    description:
      'يفتح على البرتقال والبرغموت، ثم قلب من الورد والياسمين واللیتشي، ' +
      'وقاعدة دافئة من الباتشولي والفيتيفر والمسك الأبيض. عطر متوازن يناسب ' +
      'النهار والمساء على حد سواء.',
    notes: {
      top: ['البرتقال', 'البرغموت', 'الليتشي'],
      middle: ['الورد', 'الياسمين', 'زهر البرتقال'],
      base: ['الباتشولي', 'الفيتيفر', 'المسك الأبيض'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 90, stock: 20 },
      { label: '100 مل', ml: 100, price: 145, compare: 175, stock: 12 },
    ],
    flags: { isFeatured: true, isNew: true },
  },
  {
    name: 'مونيبرا عود رويال',
    slug: 'monebra-oud-royal',
    category: 'unisex',
    brand: 'lattafa',
    inspirationName: 'Oud For Glory',
    gender: 'unisex',
    family: 'شرقي عودي',
    longevity: 5,
    sillage: 5,
    season: 'autumn,winter',
    occasion: 'events,night',
    timeOfDay: 'night',
    short: 'عود صافٍ وزعفران — فخامة خليجية بثبات استثنائي.',
    description:
      'عطر عودي غني يبدأ بالزعفران والتوابل، ويكشف قلبًا من العود وخشب ' +
      'الأرز، ليستقر على قاعدة من العنبر والمسك. ثباته من الأطول في مجموعتنا، ' +
      'وتكفي منه بختان.',
    notes: {
      top: ['الزعفران', 'الهيل', 'جوزة الطيب'],
      middle: ['العود', 'خشب الأرز', 'الورد الطائفي'],
      base: ['العنبر', 'المسك', 'خشب الصندل'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 110, stock: 15 },
      { label: '100 مل', ml: 100, price: 180, compare: 220, stock: 4 },
    ],
    flags: { isBestSeller: true, isLimited: true },
  },
  {
    name: 'مونيبرا أكوا',
    slug: 'monebra-aqua',
    category: 'men',
    brand: 'armani',
    inspirationName: 'Acqua di Giò Profumo',
    gender: 'men',
    family: 'مائي عطري',
    longevity: 3,
    sillage: 3,
    season: 'summer,spring',
    occasion: 'daily,work',
    timeOfDay: 'day',
    short: 'نسيم بحري وبخور خفيف — العطر المثالي لحرارة الصيف.',
    description:
      'نوتات مائية منعشة مع البرغموت وإكليل الجبل، تتطور إلى قلب من المريمية ' +
      'وإبرة الراعي، وقاعدة من البخور والباتشولي. خفيف ومنعش، مثالي لساعات ' +
      'النهار الطويلة.',
    notes: {
      top: ['النوتات المائية', 'البرغموت', 'إكليل الجبل'],
      middle: ['المريمية', 'إبرة الراعي', 'اللافندر'],
      base: ['البخور', 'الباتشولي', 'المسك'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 75, stock: 26 },
      { label: '100 مل', ml: 100, price: 125, stock: 19 },
    ],
    flags: { isNew: true },
  },
  {
    name: 'مونيبرا بلاك أوبيوم',
    slug: 'monebra-black-opium',
    category: 'women',
    brand: 'ysl',
    inspirationName: 'Black Opium',
    gender: 'women',
    family: 'شرقي فانيلي',
    longevity: 4,
    sillage: 4,
    season: 'autumn,winter',
    occasion: 'night,events',
    timeOfDay: 'night',
    short: 'قهوة وفانيليا وزهر البرتقال — إدمان ليلي بامتياز.',
    description:
      'يبدأ بحدّة القهوة والكمثرى، ثم قلب من الياسمين وزهر البرتقال، وقاعدة ' +
      'دافئة من الفانيليا والأرز والباتشولي. عطر شتوي مسائي بامتياز.',
    notes: {
      top: ['القهوة', 'الكمثرى', 'الفلفل الوردي'],
      middle: ['الياسمين', 'زهر البرتقال', 'اللوز'],
      base: ['الفانيليا', 'خشب الأرز', 'الباتشولي'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 95, compare: 115, stock: 14 },
      { label: '100 مل', ml: 100, price: 150, stock: 9 },
    ],
    flags: { isBestSeller: true },
  },
  {
    name: 'مونيبرا أفينتوس',
    slug: 'monebra-aventus',
    category: 'men',
    brand: 'creed',
    inspirationName: 'Aventus',
    gender: 'men',
    family: 'فواكه شيبر',
    longevity: 5,
    sillage: 5,
    season: 'spring,summer,autumn',
    occasion: 'work,events',
    timeOfDay: 'both',
    short: 'أناناس ومسك دخاني — أيقونة العطور الرجالية.',
    description:
      'افتتاحية مميزة من الأناناس والتفاح والبرغموت، تتطور إلى قلب من ' +
      'البتولا الدخانية والياسمين، وقاعدة من المسك والعنبر والفانيليا. ' +
      'الأكثر طلبًا في فئة العطور الرجالية.',
    notes: {
      top: ['الأناناس', 'التفاح', 'البرغموت'],
      middle: ['البتولا الدخانية', 'الياسمين', 'إبرة الراعي'],
      base: ['المسك', 'العنبر الرمادي', 'الفانيليا'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 105, stock: 21 },
      { label: '100 مل', ml: 100, price: 170, compare: 200, stock: 11 },
    ],
    flags: { isBestSeller: true, isFeatured: true },
  },
  {
    name: 'مونيبرا وان مليون',
    slug: 'monebra-one-million',
    category: 'men',
    brand: 'paco-rabanne',
    inspirationName: 'One Million',
    gender: 'men',
    family: 'حار جلدي',
    longevity: 4,
    sillage: 4,
    season: 'autumn,winter',
    occasion: 'night,events',
    timeOfDay: 'night',
    short: 'قرفة وجلد وعنبر — دفء جريء يلفت الانتباه.',
    description:
      'يفتح على الجريب فروت والنعناع، ثم قلب حار من القرفة والورد والتوابل، ' +
      'وقاعدة من الجلد والعنبر والباتشولي. عطر شبابي قوي الحضور.',
    notes: {
      top: ['الجريب فروت', 'النعناع', 'المندرين'],
      middle: ['القرفة', 'الورد', 'التوابل'],
      base: ['الجلد', 'العنبر', 'الباتشولي'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 80, stock: 0 },
      { label: '100 مل', ml: 100, price: 130, compare: 155, stock: 6 },
    ],
  },
  {
    name: 'مونيبرا مسك أبيض',
    slug: 'monebra-white-musk',
    category: 'unisex',
    brand: 'lattafa',
    inspirationName: 'White Musk',
    gender: 'unisex',
    family: 'مسكي نظيف',
    longevity: 3,
    sillage: 2,
    season: 'spring,summer',
    occasion: 'daily,work',
    timeOfDay: 'day',
    short: 'مسك نظيف وناعم — رائحة النظافة والهدوء.',
    description:
      'عطر بسيط وأنيق: مسك أبيض ناعم مع لمسة من الزهور البيضاء والقطن. ' +
      'فوحانه هادئ وقريب من الجسم، مثالي للعمل والاستخدام اليومي.',
    notes: {
      top: ['البرغموت', 'الليمون'],
      middle: ['الزهور البيضاء', 'القطن'],
      base: ['المسك الأبيض', 'خشب الصندل'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 55, stock: 40 },
      { label: '100 مل', ml: 100, price: 90, stock: 33 },
    ],
    flags: { isNew: true },
  },
  {
    name: 'مونيبرا شانس',
    slug: 'monebra-chance',
    category: 'women',
    brand: 'chanel',
    inspirationName: 'Chance Eau Tendre',
    gender: 'women',
    family: 'زهري فاكهي',
    longevity: 3,
    sillage: 3,
    season: 'spring,summer',
    occasion: 'daily,work',
    timeOfDay: 'day',
    short: 'سفرجل وياسمين ومسك — نعومة نهارية راقية.',
    description:
      'افتتاحية من السفرجل والجريب فروت، وقلب من الياسمين والياقوتية، ' +
      'وقاعدة من المسك الأبيض وخشب الأرز. عطر نهاري خفيف وأنيق.',
    notes: {
      top: ['السفرجل', 'الجريب فروت'],
      middle: ['الياسمين', 'الياقوتية', 'الورد'],
      base: ['المسك الأبيض', 'خشب الأرز'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 85, stock: 17 },
      { label: '100 مل', ml: 100, price: 138, stock: 10 },
    ],
  },
  {
    name: 'مونيبرا إنتنس',
    slug: 'monebra-intense',
    category: 'long-lasting',
    brand: 'tom-ford',
    inspirationName: 'Oud Wood',
    gender: 'unisex',
    family: 'خشبي دخاني',
    longevity: 5,
    sillage: 4,
    season: 'autumn,winter',
    occasion: 'events,night',
    timeOfDay: 'night',
    short: 'عود وخشب صندل ودخان — رقيّ هادئ وثبات لا ينتهي.',
    description:
      'مزيج ناعم من العود وخشب الصندل والفلفل الوردي، مع لمسة من الفانيليا ' +
      'والعنبر في القاعدة. أقل حدّة من العطور العودية التقليدية وأكثر أناقة.',
    notes: {
      top: ['الفلفل الوردي', 'الهيل'],
      middle: ['العود', 'خشب الصندل', 'الورد'],
      base: ['الفانيليا', 'العنبر', 'التونكا'],
    },
    variants: [
      { label: '50 مل', ml: 50, price: 120, stock: 8 },
      { label: '100 مل', ml: 100, price: 195, compare: 235, stock: 3 },
    ],
    flags: { isLimited: true, isFeatured: true },
  },
  {
    name: 'مونيبرا سمر بريز',
    slug: 'monebra-summer-breeze',
    category: 'summer',
    brand: 'dior',
    inspirationName: 'Homme Cologne',
    gender: 'unisex',
    family: 'حمضي منعش',
    longevity: 2,
    sillage: 2,
    season: 'summer',
    occasion: 'daily',
    timeOfDay: 'day',
    short: 'ليمون وبرغموت ومسك — انتعاش فوري في الحر.',
    description:
      'كولونيا خفيفة من الحمضيات والمسك الأبيض، منعشة جدًا لكن ثباتها قصير ' +
      'بطبيعتها. مثالية لأيام الصيف الحارة وللاستخدام المتكرر.',
    notes: {
      top: ['الليمون', 'البرغموت', 'الجريب فروت'],
      middle: ['زهر البرتقال', 'النعناع'],
      base: ['المسك الأبيض', 'خشب الأرز'],
    },
    variants: [
      { label: '100 مل', ml: 100, price: 70, stock: 28 },
    ],
    flags: { isNew: true },
  },
];

async function seedDemo() {
  console.log('▸ العلامات المستوحى منها (تجريبي)...');
  for (const brand of DEMO_BRANDS) {
    await prisma.inspirationBrand.upsert({
      where: { slug: brand.slug },
      create: brand,
      update: {},
    });
  }

  console.log('▸ المنتجات التجريبية...');
  const categories = await prisma.category.findMany();
  const brands = await prisma.inspirationBrand.findMany();

  const categoryBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const brandBySlug = new Map(brands.map((b) => [b.slug, b.id]));

  for (const [index, item] of DEMO_PRODUCTS.entries()) {
    const existing = await prisma.product.findUnique({
      where: { slug: item.slug },
    });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: item.name,
        slug: item.slug,
        type: 'simple',
        shortDescription: item.short,
        description: item.description,
        categoryId: categoryBySlug.get(item.category) ?? null,
        inspirationBrandId: brandBySlug.get(item.brand) ?? null,
        inspirationName: item.inspirationName,
        gender: item.gender,
        fragranceFamily: item.family,
        longevity: item.longevity,
        sillage: item.sillage,
        season: item.season,
        occasion: item.occasion,
        timeOfDay: item.timeOfDay,
        sortOrder: index,
        isActive: true,
        isFeatured: item.flags?.isFeatured ?? false,
        isNew: item.flags?.isNew ?? false,
        isBestSeller: item.flags?.isBestSeller ?? false,
        isLimited: item.flags?.isLimited ?? false,
        metaTitle: `${item.name} — عطر مستوحى من ${item.inspirationName}`,
        metaDescription: item.short,

        variants: {
          create: item.variants.map((variant, variantIndex) => ({
            label: variant.label,
            sizeMl: variant.ml,
            price: toMinor(variant.price),
            comparePrice: variant.compare ? toMinor(variant.compare) : null,
            stock: variant.stock,
            lowStockThreshold: 5,
            sortOrder: variantIndex,
          })),
        },

        notes: {
          create: [
            ...item.notes.top.map((name, i) => ({
              type: 'top',
              name,
              sortOrder: i,
            })),
            ...item.notes.middle.map((name, i) => ({
              type: 'middle',
              name,
              sortOrder: i,
            })),
            ...item.notes.base.map((name, i) => ({
              type: 'base',
              name,
              sortOrder: i,
            })),
          ],
        },
      },
    });
  }

  // نص البحث يُبنى بعد إنشاء المنتجات لأنه يحتاج النوتات والعلامة معًا
  console.log('▸ بناء نص البحث...');
  const created = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      inspirationName: true,
      fragranceFamily: true,
      keywords: true,
      shortDescription: true,
      inspirationBrand: { select: { name: true, aliases: true } },
      category: { select: { name: true } },
      notes: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      variants: { where: { isActive: true }, select: { price: true } },
    },
  });

  for (const product of created) {
    const prices = product.variants.map((v) => v.price);

    await prisma.product.update({
      where: { id: product.id },
      data: {
        searchText: buildSearchText(product),
        // أقل سعر بين الأحجام — عليه يعتمد الترتيب بالسعر
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      },
    });
  }

  console.log('▸ شرائح الواجهة الرئيسية...');
  const heroCount = await prisma.heroSlide.count();
  if (heroCount === 0) {
    await prisma.heroSlide.create({
      data: {
        title: 'Monebra Perfume',
        subtitle: 'عطور مستوحاة من أشهر الروائح العالمية',
        mediaType: 'image',
        mediaUrl: '',
        ctaText: 'تسوق الآن',
        ctaLink: '/products',
        ctaText2: 'الأكثر مبيعًا',
        ctaLink2: '/products?best=1',
        sortOrder: 0,
        isActive: true,
      },
    });
  }
}

// ─────────────────────────────── التشغيل ───────────────────────────────

async function main() {
  console.log('\n🌱 تعبئة قاعدة بيانات Monebra Perfume\n');

  await seedCore();

  if (includeDemo) {
    await seedDemo();
  } else {
    console.log('▸ تم تخطي المحتوى التجريبي (--no-demo)');
  }

  const [products, variants, cities, categories] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.city.count(),
    prisma.category.count(),
  ]);

  console.log('\n✓ اكتملت التعبئة');
  console.log(`  المنتجات: ${products}  |  الأحجام: ${variants}`);
  console.log(`  المدن: ${cities}  |  التصنيفات: ${categories}\n`);

  if (includeDemo) {
    console.log('⚠️  المحتوى التجريبي مُفعّل. قبل الإطلاق:');
    console.log('   احذف المنتجات التجريبية من لوحة التحكم،');
    console.log('   أو أعد التعبئة بـ: npm run db:seed -- --no-demo\n');
  }
}

main()
  .catch((error) => {
    console.error('\n✗ فشلت التعبئة:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
