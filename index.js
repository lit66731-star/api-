import { extension_settings, saveSettingsDebounced } from '../../../extensions.js';

const extensionName = 'lighthouse';
const VERSION = '0.1.0';

// ---------------- 状态 ----------------
// 中转站数据结构（后续「读密钥 / 代发余额 / 验真」会在这里按需加字段）：
//   id      唯一标识
//   name    显示名
//   baseUrl 中转站 Base URL
//   note    备注
function freshSettings() {
    return { stations: [] };
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
            note: typeof st.note === 'string' ? st.note : '',
        }));
    settings = s;
}

function saveSettings() { saveSettingsDebounced(); }
function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------- 面板 ----------------
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
            <input type="text" class="lh__add-note" placeholder="备注（可选）" autocomplete="off">
            <div class="lh__add-btns">
              <button type="button" class="lh__btn lh__btn--primary lh__add-save">添加</button>
              <button type="button" class="lh__btn lh__add-cancel" style="display:none">取消编辑</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    $('body').append(html);
    bindPanelEvents();
}

function renderPanel() {
    const panel = $('#st-lighthouse');
    if (!panel.length) return;
    const list = panel.find('.lh__list').empty();
    if (!settings.stations.length) {
        list.append(`<div class="lh__empty">还没有中转站，先在上面添加一个。</div>`);
        return;
    }
    settings.stations.forEach(st => {
        const row = $(`
          <div class="lh__row" data-id="${escapeHtml(st.id)}">
            <div class="lh__row-main">
              <div class="lh__row-name">${escapeHtml(st.name || '（未命名）')}</div>
              <div class="lh__row-url">${escapeHtml(st.baseUrl || '—')}</div>
              ${st.note ? `<div class="lh__row-note">${escapeHtml(st.note)}</div>` : ''}
            </div>
            <div class="lh__row-actions">
              <button type="button" class="lh__btn lh__row-edit" title="编辑">编辑</button>
              <button type="button" class="lh__btn lh__row-del" title="删除">删除</button>
            </div>
          </div>`);
        list.append(row);
    });
}

let editingId = null;

function resetAddForm() {
    editingId = null;
    const panel = $('#st-lighthouse');
    panel.find('.lh__add-name').val('');
    panel.find('.lh__add-url').val('');
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
        const note = String(panel.find('.lh__add-note').val() ?? '').trim();
        if (!name && !baseUrl) { toastr.warning('名称和 Base URL 至少填一个'); return; }
        if (editingId) {
            const st = settings.stations.find(x => x.id === editingId);
            if (st) { st.name = name; st.baseUrl = baseUrl; st.note = note; }
        } else {
            settings.stations.push({ id: uid(), name, baseUrl, note });
        }
        saveSettings();
        resetAddForm();
        renderPanel();
    });

    panel.find('.lh__add-cancel').on('click', resetAddForm);

    // 回车提交
    for (const cls of ['.lh__add-name', '.lh__add-url', '.lh__add-note']) {
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
