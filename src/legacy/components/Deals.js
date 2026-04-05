import { state, persistDeals, persistSettings, emptyDeal, dealStats } from '../utils/state.js';
import { CATEGORIES, CAT_LABEL, GRADES, CAT_BADGE_CLASS } from '../utils/constants.js';
import { getPlayerCategory } from '../utils/api.js';
import { extractFeatures, learnFromDeal } from '../utils/ml.js';
import { trainOnDeals, saveModel } from '../utils/tfModel.js';
import { buildEmbeddingModel } from '../utils/embedding.js';
import { startEnrichment } from '../utils/enrichment.js';

// Deal fields that can be mapped from xlsx columns
const DEAL_FIELDS = [
  { key: 'player',    label: 'Player name',   required: true  },
  { key: 'buyPrice',  label: 'Buy price (₱)', required: true  },
  { key: 'sellPrice', label: 'Sell price (₱)',required: true  },
  { key: 'grade',     label: 'Grade',         required: false },
  { key: 'set',       label: 'Set / product', required: false },
  { key: 'year',      label: 'Year',          required: false },
  { key: 'variant',   label: 'Variant',       required: false },
  { key: 'days',      label: 'Days to flip',  required: false },
  { key: 'category',  label: 'Category',      required: false },
  { key: 'notes',     label: 'Notes',         required: false },
];

export function renderDeals() {
  const stats = dealStats();

  return `
    <div class="page-title">Deal Log</div>
    <div class="page-subtitle">Every deal you log becomes ML training data for scoring</div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Past deals</div>
        <div class="stat-value">${stats.count}</div>
        <div class="stat-sub">logged</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg ROI</div>
        <div class="stat-value">${stats.count ? stats.avgROI : '—'}${stats.count ? '%' : ''}</div>
        <div class="stat-sub">return on investment</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg flip</div>
        <div class="stat-value">${stats.count ? stats.avgDays : '—'}${stats.count ? 'd' : ''}</div>
        <div class="stat-sub">days to sell</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total profit</div>
        <div class="stat-value">$${stats.count ? stats.totalProfit.toFixed(0) : '0'}</div>
        <div class="stat-sub">USD gross profit</div>
      </div>
    </div>

    ${state.notify ? renderNotify(state.notify) : ''}

    ${renderEnrichmentSection()}
    ${renderSegmentsSection()}

    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Log a completed deal</div>
          <div class="section-subtitle">Your past deals are used as scoring context</div>
        </div>
      </div>

      <div class="form-grid-3" style="margin-bottom:10px">
        <div class="form-group">
          <label class="form-label">Player *</label>
          <input id="nd-player" type="text" placeholder="LeBron James" value="${escHtml(state.newDeal.player)}" oninput="window.ndSet('player',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Grade</label>
          <select id="nd-grade" onchange="window.ndSet('grade',this.value)">
            ${GRADES.map(g => `<option value="${g}" ${state.newDeal.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="nd-category" onchange="window.ndSet('category',this.value)">
            ${CATEGORIES.map(c => `<option value="${c}" ${state.newDeal.category === c ? 'selected' : ''}>${CAT_LABEL[c] || c}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-grid-3" style="margin-bottom:10px">
        <div class="form-group">
          <label class="form-label">Buy price ($) *</label>
          <input id="nd-buy" type="number" min="0" step="0.01" placeholder="42.00" value="${escHtml(String(state.newDeal.buyPrice))}" oninput="window.ndSet('buyPrice',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Sell price ($) *</label>
          <input id="nd-sell" type="number" min="0" step="0.01" placeholder="65.00" value="${escHtml(String(state.newDeal.sellPrice))}" oninput="window.ndSet('sellPrice',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input id="nd-notes" type="text" placeholder="Silver RC, lot deal, undergraded…" value="${escHtml(state.newDeal.notes)}" oninput="window.ndSet('notes',this.value)" />
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
        <div style="font-size:14px;font-family:var(--mono);color:var(--green);font-weight:600">${calcROIPreview() !== '—' ? 'ROI ' + calcROIPreview() : ''}</div>
        <div style="display:flex;gap:10px">
          <button class="btn-ghost btn-sm" onclick="window.clearNewDeal()">Clear</button>
          <button class="btn-primary" onclick="window.logDeal()">Log deal</button>
        </div>
      </div>
    </div>

    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Import from spreadsheet</div>
          <div class="section-subtitle">Upload an .xlsx file of your past sales</div>
        </div>
      </div>
      <div class="import-drop-area" id="import-drop" onclick="document.getElementById('xlsx-file-input').click()" ondragover="event.preventDefault()" ondrop="window.handleXlsxDrop(event)">
        <div class="import-drop-icon">↑</div>
        <div class="import-drop-label">Click to upload or drag &amp; drop</div>
        <div class="import-drop-sub">.xlsx files only — PHP prices (₱) are auto-converted to USD using your current exchange rate</div>
        <input id="xlsx-file-input" type="file" accept=".xlsx,.xls" style="display:none" onchange="window.handleXlsxFile(this.files[0])" />
      </div>
      ${state.xlsxImport ? renderColumnMapper() : ''}
    </div>

    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Deal history</div>
          <div class="section-subtitle">Training data — ${state.deals.length} deals</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-ghost btn-sm" onclick="window.exportDeals()">Export CSV</button>
          <button class="btn-danger btn-sm" onclick="window.clearAllDeals()">Clear all</button>
        </div>
      </div>

      ${state.deals.length === 0 ? `
        <div class="empty-state" style="padding:2rem">
          <p>No deals logged yet. Log your first deal above to start training the model.</p>
        </div>
      ` : state.deals.slice().reverse().map(d => renderDealRow(d)).join('')}
    </div>
  `;
}

// ─── Enrichment section ────────────────────────────────────────────────────────
function renderEnrichmentSection() {
  const prog = state.enrichmentProgress;
  const hasDeals = state.deals.length > 0;
  const hasSegments = state.segments?.length > 0;
  if (!hasDeals) return '';

  // Running
  if (prog && !prog.done) {
    const phaseLabel = {
      details:  'Extracting card details',
      images:   'Finding card photos on eBay',
      segments: 'Identifying your buying segments',
    }[prog.phase] || 'Processing';
    const pct = Math.round((prog.current / Math.max(prog.total, 1)) * 100);
    return `
      <div class="card-section enrich-section">
        <div class="enrich-header">
          <div class="section-title">AI Enrichment</div>
          <span class="badge badge-blue">running</span>
        </div>
        <div class="enrich-phase">${phaseLabel}…</div>
        <div class="enrich-bar-wrap">
          <div class="enrich-bar" style="width:${pct}%"></div>
        </div>
        <div class="enrich-count">${prog.current} / ${prog.total} deals</div>
      </div>`;
  }

  // Done or not yet run — show button if unenriched deals exist
  const unenriched = state.deals.filter(d => !d._enriched).length;
  if (!unenriched && hasSegments) return ''; // fully done, segments shown separately

  return `
    <div class="card-section enrich-section">
      <div class="enrich-header">
        <div>
          <div class="section-title">Enrich deals with AI</div>
          <div class="section-subtitle">
            ${unenriched > 0
              ? `${unenriched} deal${unenriched > 1 ? 's' : ''} not yet enriched — Claude will auto-extract set, year, grade, variant, and aesthetic score, then find card photos on eBay.`
              : 'Re-run to refresh card details, photos, and segment analysis.'}
          </div>
        </div>
        <button class="btn-primary" onclick="window.startEnrichment()">
          ${prog?.done ? 'Re-enrich' : 'Enrich deals'}
        </button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:6px">
        Claude will also identify your buying segments — used to focus the Diagnostic and search suggestions on how you actually buy.
      </div>
    </div>`;
}

// ─── Segments section ──────────────────────────────────────────────────────────
function renderSegmentsSection() {
  const segs = state.segments;
  if (!segs?.length && state.editingSegmentIdx !== 'new') return '';

  return `
    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Your buying segments</div>
          <div class="section-subtitle">Price ranges show typical <strong>sold</strong> prices · ${segs.length} segment${segs.length !== 1 ? 's' : ''}</div>
        </div>
        <button class="btn-ghost btn-sm" onclick="window.segmentAddNew()">+ Add segment</button>
      </div>
      <div class="segment-grid">
        ${(segs || []).map((s, i) =>
          state.editingSegmentIdx === i ? renderSegmentEditForm(s, i) : renderSegmentCard(s, i)
        ).join('')}
        ${state.editingSegmentIdx === 'new' ? renderSegmentEditForm(null, 'new') : ''}
      </div>
    </div>`;
}

function renderSegmentCard(s, i) {
  const isStrong = (s.avgROI || 0) >= 30;
  return `
    <div class="segment-card ${isStrong ? 'segment-strong' : ''}">
      <div class="segment-card-header">
        <span class="segment-name">${escHtml(s.name)}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${isStrong ? '<span class="badge badge-buy" style="font-size:9px">strong</span>' : ''}
          <button class="btn-ghost btn-sm" style="padding:2px 7px;font-size:11px" onclick="window.segmentEdit(${i})">Edit</button>
          <button class="btn-ghost btn-sm" style="padding:2px 7px;font-size:11px;color:var(--red)" onclick="window.segmentDelete(${i})">×</button>
        </div>
      </div>
      <div class="segment-desc">${escHtml(s.description)}</div>
      <div class="segment-stats">
        <div class="segment-stat">
          <div class="segment-stat-val">$${s.priceRange?.min || 0}–$${s.priceRange?.max || 0}</div>
          <div class="segment-stat-label">sold range</div>
        </div>
        <div class="segment-stat">
          <div class="segment-stat-val" style="color:var(--green)">+${s.avgROI || 0}%</div>
          <div class="segment-stat-label">avg ROI</div>
        </div>
        <div class="segment-stat">
          <div class="segment-stat-val">${s.dealCount || 0}</div>
          <div class="segment-stat-label">deals</div>
        </div>
        ${s.avgDaysToFlip ? `
        <div class="segment-stat">
          <div class="segment-stat-val">${s.avgDaysToFlip}d</div>
          <div class="segment-stat-label">avg flip</div>
        </div>` : ''}
      </div>
      <div class="segment-tags">
        ${(s.typicalGrades || []).map(g => `<span class="badge badge-gray">${escHtml(g)}</span>`).join('')}
        ${(s.typicalSets   || []).slice(0,3).map(t => `<span class="badge badge-blue">${escHtml(t)}</span>`).join('')}
      </div>
    </div>`;
}

function renderSegmentEditForm(s, idx) {
  const isNew = idx === 'new';
  return `
    <div class="segment-card segment-edit-form">
      <div class="segment-card-header">
        <span class="segment-name" style="color:var(--accent)">${isNew ? 'New segment' : 'Editing'}</span>
      </div>

      <div class="seg-form-row">
        <label class="seg-form-label">Name</label>
        <input class="seg-form-input" id="seg-name-${idx}" type="text" value="${escHtml(s?.name || '')}" placeholder="e.g. PSA 9 Prizm Rookies" />
      </div>
      <div class="seg-form-row">
        <label class="seg-form-label">Description</label>
        <input class="seg-form-input" id="seg-desc-${idx}" type="text" value="${escHtml(s?.description || '')}" placeholder="1-2 sentence description" />
      </div>
      <div class="seg-form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="seg-form-label">Sold min ($)</label>
          <input class="seg-form-input" id="seg-pmin-${idx}" type="number" min="0" value="${s?.priceRange?.min || ''}" placeholder="20" />
        </div>
        <div>
          <label class="seg-form-label">Sold max ($)</label>
          <input class="seg-form-input" id="seg-pmax-${idx}" type="number" min="0" value="${s?.priceRange?.max || ''}" placeholder="80" />
        </div>
      </div>
      <div class="seg-form-row">
        <label class="seg-form-label">Typical grades <span style="font-weight:400;color:var(--text-muted)">(comma-separated)</span></label>
        <input class="seg-form-input" id="seg-grades-${idx}" type="text" value="${escHtml((s?.typicalGrades || []).join(', '))}" placeholder="PSA 9, PSA 10" />
      </div>
      <div class="seg-form-row">
        <label class="seg-form-label">Typical sets <span style="font-weight:400;color:var(--text-muted)">(comma-separated)</span></label>
        <input class="seg-form-input" id="seg-sets-${idx}" type="text" value="${escHtml((s?.typicalSets || []).join(', '))}" placeholder="Prizm, Chrome, Optic" />
      </div>
      <div class="seg-form-row">
        <label class="seg-form-label">Avg ROI (%)</label>
        <input class="seg-form-input" id="seg-roi-${idx}" type="number" value="${s?.avgROI || ''}" placeholder="35" />
      </div>

      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-primary btn-sm" onclick="window.segmentSave('${idx}')">Save</button>
        <button class="btn-ghost btn-sm" onclick="window.segmentCancelEdit()">Cancel</button>
      </div>
    </div>`;
}

export function segmentEdit(idx) {
  state.editingSegmentIdx = idx;
  window.renderApp();
}

export function segmentAddNew() {
  state.editingSegmentIdx = 'new';
  window.renderApp();
}

export function segmentCancelEdit() {
  state.editingSegmentIdx = null;
  window.renderApp();
}

export function segmentSave(idx) {
  const read = (id) => document.getElementById(id)?.value?.trim() || '';
  const splitTags = (str) => str.split(',').map(s => s.trim()).filter(Boolean);

  const updated = {
    name:          read(`seg-name-${idx}`),
    description:   read(`seg-desc-${idx}`),
    priceRange: {
      min: parseFloat(read(`seg-pmin-${idx}`)) || 0,
      max: parseFloat(read(`seg-pmax-${idx}`)) || 0,
    },
    typicalGrades: splitTags(read(`seg-grades-${idx}`)),
    typicalSets:   splitTags(read(`seg-sets-${idx}`)),
    avgROI:        parseFloat(read(`seg-roi-${idx}`)) || 0,
    dealCount:     idx === 'new' ? 0 : (state.segments[idx]?.dealCount || 0),
    avgDaysToFlip: idx === 'new' ? 0 : (state.segments[idx]?.avgDaysToFlip || 0),
    typicalPlayers:idx === 'new' ? [] : (state.segments[idx]?.typicalPlayers || []),
  };

  if (!updated.name) return; // require a name

  if (idx === 'new') {
    state.segments.push(updated);
  } else {
    state.segments[idx] = updated;
  }

  state.editingSegmentIdx = null;
  persistSettings();
  window.renderApp();
}

export function segmentDelete(idx) {
  if (!confirm(`Delete segment "${state.segments[idx]?.name}"?`)) return;
  state.segments.splice(idx, 1);
  state.editingSegmentIdx = null;
  persistSettings();
  window.renderApp();
}

function renderDealRow(d) {
  const roiColor = d.roi >= 50 ? 'var(--green)' : d.roi >= 25 ? 'var(--amber)' : 'var(--red)';
  const catCls   = CAT_BADGE_CLASS[d.category] || 'badge-gray';
  const subtitle = [d.set, d.year, d.variant].filter(Boolean).join(' · ');

  return `
    <div class="deal-row">
      ${d.imgUrl ? `<img class="deal-row-img" src="${escHtml(d.imgUrl)}" alt="card" loading="lazy" onerror="this.style.display='none'" />` : ''}
      <div class="deal-main">
        <div class="deal-title">
          ${escHtml(d.player)}
          <span style="color:var(--text-muted);font-weight:400;font-size:12px">${d.grade}</span>
          ${d._enriched ? `<span class="enrich-dot" title="AI enriched (${d._confidence || ''} confidence)"></span>` : ''}
        </div>
        <div class="deal-meta">
          <span class="badge ${catCls}" style="margin-right:6px">${d.category}</span>
          ${subtitle ? `<span style="color:var(--text-muted);font-size:11px;margin-right:6px">${escHtml(subtitle)}</span>` : ''}
          $${d.buyPrice} → $${d.sellPrice}${d.notes ? ' · ' + escHtml(d.notes) : ''}
        </div>
      </div>
      <div class="deal-roi" style="color:${roiColor}">+${d.roi}%</div>
      <button class="btn-ghost btn-sm" onclick="window.removeDeal(${d.id})" style="color:var(--text-muted);padding:4px 8px">×</button>
    </div>
  `;
}

function calcROIPreview() {
  const buy  = parseFloat(state.newDeal.buyPrice);
  const sell = parseFloat(state.newDeal.sellPrice);
  if (!buy || !sell || buy <= 0) return '—';
  return '+' + Math.round(((sell - buy) / buy) * 100) + '%';
}

export function logDeal() {
  const d = state.newDeal;
  if (!d.player || !d.buyPrice || !d.sellPrice) {
    state.notify = { type: 'err', msg: 'Player name, buy price, and sell price are required.' };
    window.renderApp();
    return;
  }
  const roi = Math.round(((+d.sellPrice - +d.buyPrice) / +d.buyPrice) * 100);
  state.deals.push({
    id:         Date.now(),
    player:     d.player,
    year:       d.year,
    set:        d.set,
    variant:    d.variant,
    grade:      d.grade,
    buyPrice:   +d.buyPrice,
    sellPrice:  +d.sellPrice,
    days:       +d.days || 0,
    category:   d.category,
    roi,
    aesthetic:  d.aesthetic,
    notes:      d.notes,
  });
  persistDeals();

  // Update per-player pairwise-learned feature weights from this deal
  {
    const pseudoTitle = [d.player, d.set, d.variant, d.grade].filter(Boolean).join(' ');
    const features = extractFeatures({ title: pseudoTitle, grade: d.grade || 'raw' });
    state.mlFeatureWeights = learnFromDeal(state.mlFeatureWeights || null, features, d.player);
    persistSettings();
  }

  // Rebuild semantic embedding model (synchronous, fast)
  state.embModel = buildEmbeddingModel(state.deals);

  // Retrain TF neural network on full deal history (async, non-blocking)
  if (state.tfModel && state.deals.length >= 3) {
    trainOnDeals(state.tfModel, state.deals)
      .then(() => saveModel(state.tfModel))
      .then(() => { state.tfModelReady = true; })
      .catch(e => console.warn('[TF retrain]', e));
  }

  state.newDeal = emptyDeal();
  state.notify  = { type: 'ok', msg: `Deal logged — +${roi}% ROI · ${state.deals.length} total deals · ML updating…` };
  window.renderApp();
}

export function removeDeal(id) {
  state.deals = state.deals.filter(d => d.id !== id);
  persistDeals();
  window.renderApp();
}

export function clearAllDeals() {
  if (!confirm('Clear all deal history? This resets the training data.')) return;
  state.deals = [];
  persistDeals();
  state.notify = { type: 'ok', msg: 'Deal history cleared.' };
  window.renderApp();
}

export function exportDeals() {
  const header = 'player,year,set,variant,grade,buyPrice,sellPrice,days,roi,category,aesthetic,notes';
  const rows   = state.deals.map(d =>
    [d.player, d.year, d.set, d.variant, d.grade, d.buyPrice, d.sellPrice, d.days, d.roi, d.category, d.aesthetic, d.notes]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'card-arb-deals.csv';
  a.click();
}

// ─── Column mapper UI ─────────────────────────────────────────────────────────
function renderColumnMapper() {
  const { headers, preview, mapping } = state.xlsxImport;

  return `
    <div class="import-mapper">
      <div class="import-mapper-title">Map your columns</div>
      <div class="import-mapper-sub">Match each field to a column in your spreadsheet. Required fields are marked ✱</div>

      <div class="import-map-grid">
        ${DEAL_FIELDS.map(f => `
          <div class="import-map-row">
            <label class="import-map-label">${f.label}${f.required ? ' <span class="import-req">✱</span>' : ''}</label>
            <select class="import-map-select" onchange="window.xlsxSetMapping('${f.key}', this.value)">
              <option value="">— skip —</option>
              ${headers.map(h => `<option value="${escHtml(h)}" ${(mapping[f.key] === h) ? 'selected' : ''}>${escHtml(h)}</option>`).join('')}
            </select>
          </div>
        `).join('')}
      </div>

      <div class="import-preview">
        <div class="import-preview-title">Preview (first 3 rows)</div>
        <div style="overflow-x:auto">
          <table class="import-table">
            <thead>
              <tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${preview.map(row => `<tr>${headers.map(h => `<td>${escHtml(String(row[h] ?? ''))}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn-primary" onclick="window.processXlsxImport()">Import deals</button>
        <button class="btn-ghost btn-sm" onclick="window.cancelXlsxImport()">Cancel</button>
      </div>
    </div>
  `;
}

// ─── Import logic ─────────────────────────────────────────────────────────────
export async function handleXlsxFile(file) {
  if (!file) return;
  try {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) {
      state.notify = { type: 'err', msg: 'Spreadsheet appears to be empty.' };
      window.renderApp();
      return;
    }

    const headers = Object.keys(rows[0]);

    // Auto-detect column mapping by fuzzy matching header names
    const mapping = {};
    const autoMap = {
      player:    ['player','name','title','card','item','description'],
      buyPrice:  ['buy','bought','cost','purchase','paid','buy price','buy_price'],
      sellPrice: ['sell','sold','sale','revenue','sell price','sell_price','sold price'],
      grade:     ['grade','graded','condition'],
      set:       ['set','product','brand','series'],
      year:      ['year','season'],
      variant:   ['variant','parallel','finish','version'],
      days:      ['days','flip','held','duration','time'],
      category:  ['category','cat','type','tier'],
      notes:     ['notes','note','comments','memo'],
    };
    for (const [field, candidates] of Object.entries(autoMap)) {
      const match = headers.find(h => candidates.some(c => h.toLowerCase().includes(c)));
      if (match) mapping[field] = match;
    }

    state.xlsxImport = {
      headers,
      preview: rows.slice(0, 3),
      rows,
      mapping,
    };
    window.renderApp();
  } catch (e) {
    state.notify = { type: 'err', msg: `Could not read file: ${e.message}` };
    window.renderApp();
  }
}

export function handleXlsxDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (file) handleXlsxFile(file);
}

export function xlsxSetMapping(field, column) {
  if (state.xlsxImport) {
    state.xlsxImport.mapping[field] = column || undefined;
  }
}

export function cancelXlsxImport() {
  state.xlsxImport = null;
  window.renderApp();
}

export function processXlsxImport() {
  const { rows, mapping } = state.xlsxImport;

  if (!mapping.player || !mapping.buyPrice || !mapping.sellPrice) {
    state.notify = { type: 'err', msg: 'Map Player, Buy price, and Sell price before importing.' };
    window.renderApp();
    return;
  }

  let imported = 0;
  let skipped  = 0;

  for (const row of rows) {
    const player      = String(row[mapping.player]  || '').trim();
    const buyPricePhp = parseFloat(String(row[mapping.buyPrice]  || '').replace(/[^0-9.]/g, ''));
    const sellPricePhp= parseFloat(String(row[mapping.sellPrice] || '').replace(/[^0-9.]/g, ''));

    if (!player || isNaN(buyPricePhp) || isNaN(sellPricePhp) || buyPricePhp <= 0 || sellPricePhp <= 0) {
      skipped++;
      continue;
    }

    // Convert PHP → USD using current exchange rate
    const phpRate  = state.phpRate || 57.2;
    const buyPrice = Math.round((buyPricePhp  / phpRate) * 100) / 100;
    const sellPrice= Math.round((sellPricePhp / phpRate) * 100) / 100;

    const roi = Math.round(((sellPrice - buyPrice) / buyPrice) * 100);

    // Map grade — try to recognise known grade strings
    let grade = mapping.grade ? String(row[mapping.grade] || '').trim() : 'raw';
    if (!GRADES.includes(grade)) grade = 'raw';

    // Map category — try to recognise known categories, otherwise auto-detect from player name
    let category = mapping.category ? String(row[mapping.category] || '').trim().toLowerCase() : '';
    if (!CATEGORIES.includes(category)) {
      category = getPlayerCategory(player, state.playerCategories) || 'volatile';
    }

    state.deals.push({
      id:        Date.now() + imported,
      player,
      year:      mapping.year      ? String(row[mapping.year]      || '').trim() : '',
      set:       mapping.set       ? String(row[mapping.set]       || '').trim() : '',
      variant:   mapping.variant   ? String(row[mapping.variant]   || '').trim() : '',
      grade,
      buyPrice,
      sellPrice,
      days:      mapping.days      ? parseFloat(row[mapping.days])  || 0 : 0,
      category,
      roi,
      aesthetic: '',
      notes:     mapping.notes     ? String(row[mapping.notes]     || '').trim() : '',
    });
    imported++;
  }

  persistDeals();

  // Rebuild semantic embedding model from updated deals (synchronous, fast)
  state.embModel = buildEmbeddingModel(state.deals);

  // Retrain TF model with new data (async, non-blocking)
  if (state.tfModel && state.deals.length >= 3) {
    trainOnDeals(state.tfModel, state.deals)
      .then(() => saveModel(state.tfModel))
      .then(() => { state.tfModelReady = true; })
      .catch(e => console.warn('[TF retrain after import]', e));
  }

  state.xlsxImport = null;
  const phpRate = state.phpRate || 57.2;
  state.notify = {
    type: 'ok',
    msg: `Imported ${imported} deals${skipped ? ` · ${skipped} rows skipped (missing required fields)` : ''} · PHP prices converted at ₱${phpRate}/$ · ML retraining…`,
  };
  window.renderApp();
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}

