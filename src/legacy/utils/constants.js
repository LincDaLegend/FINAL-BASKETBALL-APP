export const PHP_RATE = 57.2;

export const CATEGORIES = ['low end', 'mid end', 'high end', 'quick sell', 'margin bet'];

export const CAT_BADGE_CLASS = {
  'low end':    'badge-cat-low',
  'mid end':    'badge-cat-mid',
  'high end':   'badge-cat-high',
  'quick sell': 'badge-cat-quick',
  'margin bet': 'badge-cat-margin',
};

export const DEFAULT_RULES = {
  'low end': {
    maxPrice: 10,
    minROI: 30,
    preferredGrades: ['raw', 'PSA 7', 'PSA 8'],
    desc: 'High-volume cheap raw cards',
  },
  'mid end': {
    maxPrice: 50,
    minROI: 35,
    preferredGrades: ['PSA 8', 'PSA 9'],
    desc: 'Graded PSA 8–9 steady margin',
  },
  'high end': {
    maxPrice: 500,
    minROI: 45,
    preferredGrades: ['PSA 9', 'PSA 10', 'BGS 9', 'BGS 9.5'],
    desc: 'Premium slabs PSA 10 / BGS',
  },
  'quick sell': {
    maxPrice: 20,
    minROI: 20,
    preferredGrades: ['raw', 'PSA 7', 'PSA 8', 'PSA 9'],
    desc: 'Fast flip any grade',
  },
  'margin bet': {
    maxPrice: 80,
    minROI: 55,
    preferredGrades: ['raw', 'PSA 8', 'PSA 9'],
    desc: 'Undervalued cards with big upside',
  },
};

export const SAMPLE_DEALS = [
  {
    id: 1, player: 'LeBron James', year: '2020', set: 'Prizm', variant: 'Silver',
    grade: 'PSA 9', buyPrice: 42, sellPrice: 65, days: 4,
    category: 'mid end', roi: 55, aesthetic: 'clean silver holo, great centering', notes: '',
  },
  {
    id: 2, player: 'Stephen Curry', year: '2021', set: 'Mosaic', variant: 'Base',
    grade: 'PSA 8', buyPrice: 18, sellPrice: 26, days: 6,
    category: 'low end', roi: 44, aesthetic: 'sharp corners', notes: 'lot of 3',
  },
  {
    id: 3, player: 'Ja Morant', year: '2019', set: 'Prizm', variant: 'Silver RC',
    grade: 'PSA 9', buyPrice: 75, sellPrice: 120, days: 3,
    category: 'high end', roi: 60, aesthetic: 'pristine silver RC, eye appeal 9/10', notes: '',
  },
  {
    id: 4, player: 'Nikola Jokic', year: '2021', set: 'Select', variant: 'Concourse',
    grade: 'PSA 8', buyPrice: 28, sellPrice: 40, days: 7,
    category: 'margin bet', roi: 43, aesthetic: 'good colors, minor centering', notes: 'MVP season',
  },
];

export const GRADES = ['raw', 'PSA 7', 'PSA 8', 'PSA 9', 'PSA 10', 'BGS 9', 'BGS 9.5', 'SGC 8', 'SGC 9'];

export const EBAY_FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1';

