export const PHP_RATE = 57.2;

// ── Set rarity tier defaults ───────────────────────────────────────────────────
// Keys are internal tier IDs. Values are arrays of title-case keywords.
// computeSetRarity() in api.js matches these case-insensitively against listing titles.
// Tiers are checked in priority order: caseHits → premium → highEnd → midTier → massBase (+ parallels).
export const SET_TIER_KEYS = ['premium', 'highEnd', 'midTier', 'massBase', 'caseHits', 'parallels'];

export const SET_TIER_LABEL = {
  premium:   'Ultra Premium',
  highEnd:   'High End',
  midTier:   'Mid Tier',
  massBase:  'Mass Produced',
  caseHits:  'Case Hits',
  parallels: 'Mass Parallels',
};

export const SET_TIER_BADGE = {
  premium:   'badge-buy',
  highEnd:   'badge-purple',
  midTier:   'badge-consider',
  massBase:  'badge-gray',
  caseHits:  'badge-pink',
  parallels: 'badge-blue',
};

export const SET_TIER_SCORE = {
  premium:   '0.92',
  highEnd:   '0.78',
  midTier:   '0.55',
  massBase:  '0.12 base · 0.28 parallel · 0.58 numbered',
  caseHits:  '0.88',
  parallels: '0.28',
};

export const SET_TIER_DESC = {
  premium:   'Box $900–$40,000+. Even plain base cards carry value from the set name alone. NT is the #1 ranked Panini set; Flawless/Eminence are all-numbered; One and One has every parallel /35 or less. Topps Three ($999 MSRP / ~$2k secondary) is the Topps ultra-premium flagship — 4 cards/box, all 3 are autos or auto-relics /49 or less.',
  highEnd:   'Box $450–$1,500. Strong value on autos, relics, and graded cards. Base still needs a hook (numbered, graded, premium player) but the ceiling is very high. Obsidian SSP inserts (Volcanix, Color Blast) are case-hit level. Topps Finest ($480–$500/box, 2 autos, SSP case hits: The Man / Headliners / Pulse / Aura). Topps Cosmic Chrome ($580 hobby / $1,550+ FDI, SSP case hits: Hypernova / Cosmic Dust / Planetary Pursuit).',
  midTier:   'Box $150–$700. Above mass-produced; chrome stock or constrained print run. Parallels and grades move well. Select has internal rarity tiers: Concourse → Premier Level → Courtside SSP. Topps Chrome ($370 hobby, Prizm equivalent) — full refractor parallel rainbow; case-hit SSPs include Rock Stars, LETS GO!, Ultra Violet All-Stars, Radiating Rookies, Helix.',
  massBase:  'High print runs; widely available at retail. Plain base rarely sells for average players. Numbered copies and PSA 9/10 slabs are the sell-through sweet spot. Contenders base = worthless; Contenders auto = another story.',
  caseHits:  'Rare named inserts packed inside products at ~1/case or rarer. Rarity comes from the insert itself. PANINI: Kaboom (Crown Royale, $500–$225k record), Prizmania (Prizm, stars $500–$5k+), Dreamcatcher (Hoops), Night Moves / Animation / Alter Ego / Downtown (Donruss/Optic), Stained Glass / Micro Mosaic (Mosaic), Volcanix (Obsidian). TOPPS: Rock Stars / LETS GO! / Radiating Rookies / Helix (Chrome), The Man / Headliners / Pulse / Aura (Finest), Hypernova / Cosmic Dust / Planetary Pursuit (Cosmic Chrome).',
  parallels: 'Parallel finishes from mass-produced sets. Elevate a base card above the floor but still high print run. Numbered parallels (Mojo /10, Tie Dye /49) are handled separately by the numbered card check. TOPPS Chrome refractor ladder: base → Refractor → color-numbered (/399 down to /5) → Silver /12 (FDI-only) → FrozenFractor (/-5) → SuperFractor (1/1).',
};

export const DEFAULT_SET_RARITY_TIERS = {
  // ─── ULTRA-PREMIUM ────────────────────────────────────────────────────────────
  // Even plain base cards have intrinsic value from the set name alone.
  // PANINI box prices $900–$40,000+. National Treasures is the #1 ranked Panini set.
  // TOPPS Three ($999 MSRP / ~$2k secondary) is the Topps ultra-premium flagship.
  premium:   [
    // Panini ultra-premium
    'Flawless', 'Eminence', 'National Treasures', 'Nat Treasures',
    'One and One', 'One & One', 'One&One',
    // Topps ultra-premium (2025-26 NBA license era)
    'Topps Three', 'Three Basketball',
  ],

  // ─── HIGH-END ─────────────────────────────────────────────────────────────────
  // Strong value on autos/relics; base still needs a hook but numbered/graded move.
  // PANINI box prices $450–$1,500.
  // TOPPS: Topps Finest ($480–$500/box, 2 autos), Topps Cosmic Chrome ($580–$1,600/FDI box).
  highEnd:   [
    // Panini high-end
    'Obsidian', 'Immaculate', 'Spectra', 'Impeccable', 'Noir',
    // Topps high-end (2025-26 era)
    'Topps Finest', 'Finest Basketball', 'Topps Cosmic Chrome', 'Cosmic Chrome',
  ],

  // ─── MID-TIER ─────────────────────────────────────────────────────────────────
  // Above mass-produced; chrome stock or constrained print run; parallels and grades perform.
  // PANINI box prices $150–$700.
  // TOPPS Chrome ($370/hobby box, Prizm equivalent) sits here; flagship Topps Basketball (~$100-150) is low mid-tier.
  midTier:   [
    // Panini mid-tier
    'Select', 'Crown Royale', 'Revolution', 'Illusions', 'Status',
    'Contenders Optic', 'Dominance',
    // Topps mid-tier (2025-26 era) — Topps Chrome is the Prizm equivalent (~$370/box hobby)
    'Topps Chrome', 'Chrome Basketball',
    // Note: bare 'Chrome' intentionally omitted — too generic, matches Prizm Chrome /xx parallels
    // Note: legacy "Finest" (pre-2025) was Panini mid-tier — now Topps highEnd above
  ],

  // ─── MASS-PRODUCED ────────────────────────────────────────────────────────────
  // High print runs; plain base cards rarely sell for most players.
  massBase:  [
    // Panini mass
    'Prizm', 'Optic', 'Donruss', 'Hoops', 'Mosaic', 'Contenders', 'Chronicles',
    // Topps mass (flagship base product — same tier as Donruss/Hoops)
    'Topps Basketball',
  ],

  // ─── CASE HITS ────────────────────────────────────────────────────────────────
  // Named inserts packed inside products at ~1-per-case or rarer.
  // Rarity comes from the insert itself — these override the host set tier.
  //
  // ── PANINI CASE HITS (by host set) ──────────────────────────────────────────
  //
  // HOOPS (mass, 24 boxes/case)
  //   Dreamcatcher / Dream Catcher  — illustrated player art, ~1-2/case; stars $200–$800+
  //   Winter Is Coming              — foil winter-theme hobby exclusive SSP; ~1-2/case
  //
  // DONRUSS (mass, 10 boxes/case)
  //   Night Moves         — neon silhouette illustrated, SSP hobby-only; ~1-2/case; stars $150–$600
  //   Animation           — cel-shaded cartoon art, SSP hobby-only; ~1-2/case; stars $100–$400
  //   Next Day Auto       — redemption-style auto SSP; ~1/case
  //   Playmaker           — illustrated action art SSP; ~1-2/case; stars $80–$300
  //
  // DONRUSS OPTIC (mass, 12 boxes/case)
  //   Alter Ego           — player nickname illustrated SSP, hobby-only; ~1-2/case; stars $200–$800
  //   Downtown            — debut SSP in 2024-25 Optic; ~1-2/case; stars $150–$500
  //   Slammy!             — slam dunk art SSP, hobby-only; ~1-2/case
  //
  // PRIZM (mass, 12 boxes/case)
  //   Prizmania           — illustrated fantasy art SSP; ~1/case; stars $500–$5,000+
  //   Groovy              — retro wave art SSP, debut 2024-25; ~1-2/case; stars $100–$500
  //
  // MOSAIC (mass, 12 hobby / 20 choice boxes/case)
  //   Stained Glass       — stained glass window art SSP; ~1-2/case; stars $300–$2,000
  //   Micro Mosaic        — miniature mosaic tile art SSP; ~1-2/case; stars $200–$800
  //   Color Blast (Mosaic)— bold paint-splash illustrated, SSP; ~1-2/case (also in Obsidian)
  //
  // CROWN ROYALE (mid-tier, 16 boxes/case)
  //   Kaboom              — explosive foil illustrated, most iconic Panini case hit; stars $500–$225,000
  //   Kaboom Horizontal   — horizontal layout variant (also in Revolution Megas/Blasters)
  //   Rookie Silhouette   — die-cut silhouette relic, hobby-only; ~1/case; stars $100–$400
  //   Sno Globe           — snow globe die-cut illustrated; ~1-2/case; stars $100–$500
  //   Hand Crafted        — painted/illustrated art card; ~1-2/case; stars $80–$300
  //
  // OBSIDIAN (high-end, 12 boxes/case)
  //   Volcanix            — volcanic eruption die-cut art, SP hobby-only; stars $150–$600
  //   Color Blast (Black) — black-background paint-splash SSP; stars $200–$1,000
  //   Vitreous            — glass-panel illustrated SSP; ~1-2/case; stars $100–$400
  //
  // SELECT (mid-tier, 12 hobby / 20 H2 boxes/case)
  //   Color Wheel         — illustrated SP; hobby-only; ~1-2/case
  //   Starcade            — new debut SSP 2023-24; ~1-2/case
  //   Artistic Selections — SP exclusive to H2 boxes; ~1-2/case
  //
  // PANINI BLACK (premium, numbered set)
  //   White Night         — SSP insert; ~1-2/case
  //   Vanta               — SSP insert, debut in NBA Black 2023-24; ~1-2/case
  //
  // CROSS-BRAND / SIGNATURE SERIES
  //   Logoman             — actual NBA logoman patch, often 1/1 or extremely short; $500–$50,000+
  //   RPA                 — Rookie Patch Auto, case-hit level in most premium sets
  //   Ballin              — illustrated dunk art; appears across several products
  //
  // ── TOPPS CASE HITS (2025-26 NBA era) ───────────────────────────────────────
  //
  // TOPPS CHROME (mass equivalent to Prizm, 12 hobby / 12 jumbo boxes/case)
  //   Rock Stars          — SSP case hit, hobby-only; ~1/case
  //   LETS GO!            — SSP case hit; ~1/case
  //   Ultra Violet All-Stars — SSP case hit; ~1-2/case
  //   Radiating Rookies   — SSP case hit; ~1-2/case
  //   Helix               — SSP case hit; ~1-2/case
  //   Gold Logoman Relic  — #/4, ultra-rare relic; 1/2-3 cases; stars $1,000–$10,000+
  //
  // TOPPS FINEST (high-end, 8 boxes/case)
  //   The Man             — SSP case hit, ~1/case (1:161 boxes); stars $200–$1,500
  //   Headliners          — SSP case hit, ~1-2/case (1:79 boxes); stars $150–$800
  //   Pulse               — neon-style SSP case hit, ~1/case (1:10 cases); stars $200–$1,000
  //   Aura                — ethereal-style SSP case hit, ~1/case (1:161 boxes); stars $200–$1,000
  //
  // TOPPS COSMIC CHROME (high-end, 12 hobby boxes/case; FDI case = premium)
  //   Hypernova           — SSP case hit; ~1/case
  //   Cosmic Dust         — SSP case hit; ~1/case
  //   Planetary Pursuit   — SSP case hit, 10 variations per player (sun + 9 planets); ~1/case
  //
  caseHits:  [
    // ── Panini (existing + expanded) ──
    'Dreamcatcher', 'Dream Catcher',
    'Night Moves',
    'Animation',
    'Next Day Auto',
    'Playmaker',
    'Alter Ego',
    'Downtown',
    'Slammy',
    'Prizmania',
    'Groovy',
    'Stained Glass',
    'Micro Mosaic',
    'Color Blast',
    'Kaboom',
    'Kaboom Horizontal',
    'Rookie Silhouette',
    'Sno Globe',
    'Hand Crafted',
    'Volcanix',
    'Vitreous',
    'Color Wheel',
    'Starcade',
    'Artistic Selections',
    'White Night',
    'Vanta',
    'Winter Is Coming',
    'Logoman',
    'Ballin',
    'RPA',
    // Ultra-rare Topps Chrome pulls (case-hit territory by rarity)
    'SuperFractor', 'FrozenFractor',
    // ── Topps (2025-26 NBA era) ──
    'Rock Stars',
    'LETS GO',
    'Ultra Violet All-Stars',
    'Radiating Rookies',
    'Helix',
    'Gold Logoman Relic',
    'The Man',
    'Headliners',
    'Pulse',
    'Aura',
    'Hypernova',
    'Cosmic Dust',
    'Planetary Pursuit',
  ],

  // ─── PARALLELS ────────────────────────────────────────────────────────────────
  // Parallel finishes from mass sets — elevate a base card but still mass-produced.
  // Numbered parallels (Mojo /10, Tie Dye /49, SuperFractor 1/1) handled by numbered card check.
  //
  // TOPPS CHROME refractor hierarchy (low → high rarity):
  //   base Chrome → Refractor (no print run) → Magenta (/399) → Teal (/299) → Yellow (/275)
  //   → Aqua (/199) → Blue (/150) → Green (/99) → Purple (/75) → Gold (/50) → Orange (/25)
  //   → Black (/10) → Red (/5) → Silver (/12, FDI-only) → FrozenFractor (/-5)
  //   → SuperFractor (1/1)
  //   Wave variants: Blue Wave /150, Green Wave /99, Purple Wave /75, Gold Wave /50 …
  //   Speckle variants: Green /99, Gold /50, Orange /25, Black /10, Red /5
  //
  parallels: [
    // Panini parallels
    'Holo', 'Holographic', 'Hyper', 'Pulsar', 'Mojo', 'Tie Dye', 'Tiedye', 'Snakeskin', 'Silver Prizm', 'Prizm Silver',
    // Topps Chrome refractor parallels (SuperFractor/FrozenFractor moved to caseHits above)
    'Refractor', 'X-Fractor', 'XFractor', 'Atomic',
    'Prism Refractor', 'Wave Refractor', 'Speckle Refractor', 'Negative Refractor',
  ],
};

export const CATEGORIES = ['strong', 'middle', 'volatile', 'ph-specific'];

export const CAT_LABEL = {
  'strong':      'Strong',
  'middle':      'Middle',
  'volatile':    'Volatile',
  'ph-specific': 'PH-Specific',
};

export const CAT_BADGE_CLASS = {
  'strong':      'badge-buy',
  'middle':      'badge-consider',
  'volatile':    'badge-gray',
  'ph-specific': 'badge-pink',
};

export const CAT_HINT = {
  'strong':
    'Big names — Luka, MJ, Curry, Kobe, Wemby, LeBron. All price ranges sell locally. Even plain base cards have demand.',
  'middle':
    'Frail stars — Edwards, LaMelo, Banchero. Plain low end barely moves. Needs a hook: grade (PSA 9+), auto, or numbered to sell at decent prices.',
  'volatile':
    'Low PH demand — KD, Jokic, Brunson. Only autos, game-used, or rare PSA 9s/10s can move. Plain cards are a trap.',
  'ph-specific':
    'Filipino blood — Clarkson, Dylan Harper, Jalen Green, Kai Sotto. Mid-range autos and GUs profit best. Plain low end is almost unsellable (exception: Dylan Harper rookies, who get a rookie buff).',
};

export const DEFAULT_RULES = {
  'strong':      { minROI: 20, desc: CAT_HINT['strong'] },
  'middle':      { minROI: 30, desc: CAT_HINT['middle'] },
  'volatile':    { minROI: 45, desc: CAT_HINT['volatile'] },
  'ph-specific': { minROI: 25, desc: CAT_HINT['ph-specific'] },
};

export const DEFAULT_PLAYER_CATEGORIES = {
  'strong':      ['Luka Doncic', 'Michael Jordan', 'Stephen Curry', 'Kobe Bryant', 'Victor Wembanyama', 'Cooper Flagg', 'LeBron James'],
  'middle':      ['Anthony Edwards', 'LaMelo Ball', 'Paolo Banchero', 'Ja Morant'],
  'volatile':    ['Kevin Durant', 'Nikola Jokic', 'Jalen Brunson', 'Jayson Tatum', 'Zion Williamson'],
  'ph-specific': ['Jordan Clarkson', 'Dylan Harper', 'Jalen Green', 'Kai Sotto', 'Jared McCain'],
};

export const SAMPLE_DEALS = [
  {
    id: 1, player: 'LeBron James', year: '2020', set: 'Prizm', variant: 'Silver',
    grade: 'PSA 9', buyPrice: 42, sellPrice: 65, days: 4,
    category: 'strong', roi: 55, aesthetic: 'clean silver holo, great centering', notes: '',
  },
  {
    id: 2, player: 'Stephen Curry', year: '2021', set: 'Mosaic', variant: 'Base',
    grade: 'PSA 8', buyPrice: 18, sellPrice: 26, days: 6,
    category: 'strong', roi: 44, aesthetic: 'sharp corners', notes: 'lot of 3',
  },
  {
    id: 3, player: 'Ja Morant', year: '2019', set: 'Prizm', variant: 'Silver RC',
    grade: 'PSA 9', buyPrice: 75, sellPrice: 120, days: 3,
    category: 'middle', roi: 60, aesthetic: 'pristine silver RC, eye appeal 9/10', notes: '',
  },
  {
    id: 4, player: 'Nikola Jokic', year: '2021', set: 'Select', variant: 'Concourse',
    grade: 'PSA 8', buyPrice: 28, sellPrice: 40, days: 7,
    category: 'volatile', roi: 43, aesthetic: 'good colors, minor centering', notes: 'MVP season',
  },
];

export const GRADES = [
  'raw',
  'PSA 7', 'PSA 8', 'PSA 9', 'PSA 10',
  'BGS 9', 'BGS 9.5', 'BGS 10',
  'SGC 8', 'SGC 9', 'SGC 9.5', 'SGC 10',
  'CGC 8', 'CGC 9', 'CGC 9.5', 'CGC 10',
];

export const EBAY_FINDING_API = 'https://svcs.ebay.com/services/search/FindingService/v1';

