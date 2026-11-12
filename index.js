import { extension_settings } from '../../../extensions.js';
import { saveSettingsDebounced } from '../../../../script.js';
import { oai_settings, chat_completion_sources } from '../../../openai.js';

const extensionName = 'lighthouse';
const VERSION = '0.3.0';

// ---------------- 状态 ----------------
// 中转站数据结构（后续「读密钥 / 代发余额 / 验真」会在这里按需加字段）：
//   id       唯一标识
//   name     显示名
//   baseUrl  中转站 Base URL
//   category 分类（如 公益站 / 付费）
//   note     备注
function freshSettings() {
    return { stations: [], activeId: '' };
}
let settings = freshSettings();

function loadSettings() {
    const s = extension_settings[extensionName];
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
        extension_settings[extensionName] = freshSettings();
        settings = extension_settings[extensionName];
        return;
    }
    if (!Array.isArray(s.stations)) s.stations = [];
    s.stations = s.stations
        .filter(st => st && typeof st === 'object' && !Array.isArray(st))
        .map(st => ({
            id: typeof st.id === 'string' ? st.id : uid(),
            name: typeof st.name === 'string' ? st.name : '',
            baseUrl: typeof st.baseUrl === 'string' ? st.baseUrl : '',
            category: typeof st.category === 'string' ? st.category : '',
            note: typeof st.note === 'string' ? st.note : '',
        }));
    if (typeof s.activeId !== 'string') s.activeId = '';
    settings = s;
}

function saveSettings() { saveSettingsDebounced(); }
function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- 面板 ----------------
// 入口挂到酒馆「扩展」菜单（#extensionsMenu，即魔杖菜单），与 Serendipity 同位置
function buildMenuButton() {
    if ($('#st-lighthouse-menu-button').length) return;
    const btn = $(`
        <div id="st-lighthouse-menu-button" class="list-group-item flex-container flexGap5 interactable"
             title="灯塔：API 中转站管理" tabindex="0" role="listitem">
            <div class="fa-fw fa-solid fa-tower-observation extensionsMenuExtensionButton"></div>
            <span>灯塔</span>
        </div>`);
    btn.on('click', () => togglePanel());
    $('#extensionsMenu').append(btn);
}

function togglePanel(show) {
    const panel = $('#st-lighthouse');
    if (show == null) show = !panel.is(':visible');
    if (show) { renderPanel(); panel.show(); } else { panel.hide(); }
    document.body.classList.toggle('lighthouse-open', show);
}

// 切换：把酒馆 API 连接指到指定中转站（OpenAI 兼容的 Custom 端点），不动其它设置
function applyStation(st) {
    if (!st.baseUrl) { toastr.warning('这个中转站还没填 Base URL'); return; }
    const src = $('#chat_completion_source');
    const url = $('#custom_api_url_text');
    if (src.length && url.length) {
        // 走 ST 自己的处理器：先填自定义 URL，再切到 Custom 源触发重连 + 刷新模型列表
        url.val(st.baseUrl).trigger('input');
        src.val(chat_completion_sources.CUSTOM).trigger('change');
    } else {
        // 兜底：直接写 oai_settings
        oai_settings.custom_url = st.baseUrl;
        oai_settings.chat_completion_source = chat_completion_sources.CUSTOM;
        saveSettingsDebounced();
    }
    settings.activeId = st.id;
    saveSettings();
    renderPanel();
    toastr.success(`已切换到「${st.name || st.baseUrl}」`);
}

function buildPanel() {
    if ($('#st-lighthouse').length) return;
    const html = `
    <div id="st-lighthouse" class="lh__panel" style="display:none">
      <div class="lh__head">
        <div class="lh__head-titles">
          <span class="lh__title">灯塔</span>
          <span class="lh__subtitle">API 中转站管理</span>
          <span class="lh__version">v${VERSION}</span>
        </div>
        <button type="button" class="lh__close" title="关闭">×</button>
      </div>
      <div class="lh__body">
        <div class="lh__section">
          <div class="lh__label">中转站列表</div>
          <div class="lh__hint">在这里维护你用的中转站。之后「读密钥 / 代发余额 / 验真」都会挂在每个中转站下面。</div>
          <div class="lh__list"></div>
        </div>
        <div class="lh__section">
          <div class="lh__label">添加中转站</div>
          <div class="lh__add">
            <input type="text" class="lh__add-name" placeholder="名称，如 某某中转" autocomplete="off">
            <input type="text" class="lh__add-url" placeholder="Base URL，如 https://api.xxx.com" autocomplete="off">
            <input type="text" class="lh__add-cat" placeholder="分类（可选），如 公益站 / 付费" autocomplete="off" list="lh__cat-list">
            <input type="text" class="lh__add-note" placeholder="备注（可选）" autocomplete="off">
            <div class="lh__add-btns">
              <button type="button" class="lh__btn lh__btn--primary lh__add-save">添加</button>
              <button type="button" class="lh__btn lh__add-cancel" style="display:none">取消编辑</button>
            </div>
          </div>
          <datalist id="lh__cat-list"></datalist>
        </div>
      </div>
    </div>`;
    $('body').append(html);
    bindPanelEvents();
}

function stationRow(st) {
    const active = st.id === settings.activeId;
    return $(`
      <div class="lh__row${active ? ' is-active' : ''}" data-id="${escapeHtml(st.id)}">
        <div class="lh__row-main">
          <div class="lh__row-name">${escapeHtml(st.name || '（未命名）')}</div>
          <div class="lh__row-url">${escapeHtml(st.baseUrl || '—')}</div>
          ${st.note ? `<div class="lh__row-note">${escapeHtml(st.note)}</div>` : ''}
        </div>
        <div class="lh__row-actions">
          <button type="button" class="lh__btn lh__btn--primary lh__row-switch" title="切换酒馆连接到这个中转站">${active ? '使用中' : '切换'}</button>
          <button type="button" class="lh__btn lh__row-edit" title="编辑">编辑</button>
          <button type="button" class="lh__btn lh__row-del" title="删除">删除</button>
        </div>
      </div>`);
}

function syncCatDatalist() {
    const dl = $('#lh__cat-list');
    if (!dl.length) return;
    const cats = [];
    for (const st of settings.stations) {
        const c = String(st.category || '').trim();
        if (c && !cats.includes(c)) cats.push(c);
    }
    dl.empty();
    cats.forEach(c => dl.append(`<option value="${escapeHtml(c)}"></option>`));
}

function renderPanel() {
    const panel = $('#st-lighthouse');
    if (!panel.length) return;
    const list = panel.find('.lh__list').empty();
    syncCatDatalist();
    if (!settings.stations.length) {
        list.append(`<div class="lh__empty">还没有中转站，先在上面添加一个。</div>`);
        return;
    }
    // 按分类分组，保持分类首次出现的顺序；未分类（空分类）放最后
    const groups = [];
    for (const st of settings.stations) {
        const cat = String(st.category || '').trim();
        let g = groups.find(x => x.name === cat);
        if (!g) { g = { name: cat, items: [] }; groups.push(g); }
        g.items.push(st);
    }
    const emptyIdx = groups.findIndex(g => g.name === '');
    if (emptyIdx > -1) groups.push(groups.splice(emptyIdx, 1)[0]);
    for (const g of groups) {
        if (g.name) list.append(`<div class="lh__group-head">${escapeHtml(g.name)}</div>`);
        g.items.forEach(st => list.append(stationRow(st)));
    }
}

let editingId = null;

function resetAddForm() {
    editingId = null;
    const panel = $('#st-lighthouse');
    panel.find('.lh__add-name').val('');
    panel.find('.lh__add-url').val('');
    panel.find('.lh__add-cat').val('');
    panel.find('.lh__add-note').val('');
    panel.find('.lh__add-save').text('添加');
    panel.find('.lh__add-cancel').hide();
}

function bindPanelEvents() {
    const panel = $('#st-lighthouse');

    panel.find('.lh__close').on('click', () => togglePanel(false));

    panel.find('.lh__add-save').on('click', () => {
        const name = String(panel.find('.lh__add-name').val() ?? '').trim();
        const baseUrl = String(panel.find('.lh__add-url').val() ?? '').trim();
        const category = String(panel.find('.lh__add-cat').val() ?? '').trim();
        const note = String(panel.find('.lh__add-note').val() ?? '').trim();
        if (!name && !baseUrl) { toastr.warning('名称和 Base URL 至少填一个'); return; }
        if (editingId) {
            const st = settings.stations.find(x => x.id === editingId);
            if (st) { st.name = name; st.baseUrl = baseUrl; st.category = category; st.note = note; }
        } else {
            settings.stations.push({ id: uid(), name, baseUrl, category, note });
        }
        saveSettings();
        resetAddForm();
        renderPanel();
    });

    panel.find('.lh__add-cancel').on('click', resetAddForm);

    // 回车提交
    for (const cls of ['.lh__add-name', '.lh__add-url', '.lh__add-cat', '.lh__add-note']) {
        panel.find(cls).on('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); panel.find('.lh__add-save').trigger('click'); } });
    }

    // 编辑 / 删除（事件委托，重渲染后仍有效）
    panel.find('.lh__list').on('click', '.lh__row-edit', function () {
        const id = $(this).closest('.lh__row').attr('data-id');
        const st = settings.stations.find(x => x.id === id);
        if (!st) return;
        editingId = id;
        panel.find('.lh__add-name').val(st.name);
        panel.find('.lh__add-url').val(st.baseUrl);
        panel.find('.lh__add-cat').val(st.category || '');
        panel.find('.lh__add-note').val(st.note);
        panel.find('.lh__add-save').text('保存');
        panel.find('.lh__add-cancel').show();
        panel.find('.lh__add-name').trigger('focus');
    });

    panel.find('.lh__list').on('click', '.lh__row-del', function () {
        const id = $(this).closest('.lh__row').attr('data-id');
        const st = settings.stations.find(x => x.id === id);
        if (!st) return;
        if (!confirm(`删除中转站「${st.name || '（未命名）'}」？`)) return;
        settings.stations = settings.stations.filter(x => x.id !== id);
        if (editingId === id) resetAddForm();
        saveSettings();
        renderPanel();
    });

    panel.find('.lh__list').on('click', '.lh__row-switch', function () {
        const id = $(this).closest('.lh__row').attr('data-id');
        const st = settings.stations.find(x => x.id === id);
        if (!st) return;
        applyStation(st);
    });
}

// ---------------- 挂载 ----------------
jQuery(async () => {
    loadSettings();
    buildMenuButton();
    buildPanel();
});

// ST 自动更新扩展后会调用 manifest.hooks.update 指向的这个函数（此时新代码已 git pull 到磁盘），刷新页面以应用新版本。
export function reloadOnUpdate() {
    toastr.info('灯塔已更新，正在刷新页面以应用新版本...', undefined, { timeOut: 1500 });
    setTimeout(() => location.reload(), 1500);
}
