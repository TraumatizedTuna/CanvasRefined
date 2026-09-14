// =============================================================================
// Global Canvas Search
// Search across all of the user's courses for modules, module items, and
// assignments, then jump straight to them. Triggered by a floating search
// button (bottom-right) or Ctrl/Cmd+K.
// =============================================================================

let globalSearchIndex = null;            // [{type,title,course,courseId,url}]
let globalSearchIndexPromise = null;     // in-flight build so concurrent opens share one fetch
let globalSearchIndexAt = 0;             // ms timestamp of last successful build
const GLOBAL_SEARCH_INDEX_TTL = 10 * 60 * 1000; // 10 minutes
const GLOBAL_SEARCH_STORAGE_KEY = "canvasrefined_global_search_index";
let _gsShortcutBound = false;

function setupGlobalSearch() {
    if (options.global_search !== true) return;
    // Rebuild the index fresh on every page load so newly-concluded/hidden
    // courses never linger from a previous session's cache.
    invalidateGlobalSearchIndex();
    ensureGlobalSearchButton();
    ensureGlobalSearchShortcut();
}

function removeGlobalSearch() {
    document.getElementById("canvasrefined-global-search-header-btn")?.remove();
    removeGlobalSearchBetterSidebarButton();
    removeGlobalSearchNativeSidebarButton();
    closeGlobalSearchModal();
    if (_gsPlacementObserver) { _gsPlacementObserver.disconnect(); _gsPlacementObserver = null; }
    if (_gsShortcutBound) {
        document.removeEventListener("keydown", onGlobalSearchShortcut, true);
        _gsShortcutBound = false;
    }
}

// Shared search icon used by the sidebar + header triggers.
const GLOBAL_SEARCH_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20px" height="20px"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><circle cx="11" cy="11" r="7" stroke="var(--bcsidebar-text)" stroke-width="2" fill="none"/><path d="m20 20-3.2-3.2" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round"/></g></svg>`;

// Placement: a search trigger is injected into whichever left sidebar is
// active — the Better Sidebar (when enabled) or Canvas' native global nav —
// and, on the dashboard, a button is also placed in the header actions row.
// There is no floating button. A rAF-debounced MutationObserver re-evaluates
// placement as Canvas renders/SPA-navigates/rebuilds the sidebar.
let _gsPlacementObserver = null;
let _gsPlacementScheduled = false;
function ensureGlobalSearchButton() {
    placeGlobalSearchTrigger();
    if (_gsPlacementObserver) return;
    _gsPlacementObserver = new MutationObserver(() => {
        if (_gsPlacementScheduled) return;
        _gsPlacementScheduled = true;
        requestAnimationFrame(() => {
            _gsPlacementScheduled = false;
            placeGlobalSearchTrigger();
        });
    });
    _gsPlacementObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function placeGlobalSearchTrigger() {
    if (options.global_search !== true) return;

    // Native global nav (the slim icon bar) — always present, so always add.
    ensureGlobalSearchNativeSidebarButton();

    // Better Sidebar (extra column when the option is enabled) — add when present.
    const betterSidebar = document.getElementById("better-sidebar-container");
    if (betterSidebar) {
        ensureGlobalSearchBetterSidebarButton(betterSidebar);
    } else {
        removeGlobalSearchBetterSidebarButton();
    }

    // Dashboard header button (in addition to the sidebar triggers).
    const headerActions = document.querySelector(".ic-Dashboard-header__actions");
    if (isDashboardPage() && headerActions) {
        ensureGlobalSearchHeaderButton(headerActions);
    } else {
        document.getElementById("canvasrefined-global-search-header-btn")?.remove();
    }
}


// --- Better Sidebar trigger --------------------------------------------------

function ensureGlobalSearchBetterSidebarButton(betterSidebar) {
    // The first child of #better-sidebar-container is the button list.
    const sidebarContent = betterSidebar.querySelector("div");
    if (!sidebarContent) return;
    if (sidebarContent.querySelector("#canvasrefined-gs-sidebar-btn")) return;
    const btn = document.createElement("a");
    btn.id = "canvasrefined-gs-sidebar-btn";
    btn.className = "canvasrefined-custom-btn better-sidebar-btn canvasrefined-gs-sidebar-btn";
    btn.href = "#";
    btn.title = "Search Canvas (Ctrl+K)";
    btn.setAttribute("role", "button");
    btn.setAttribute("aria-label", "Search Canvas");
    btn.style.cssText = "width:40%;height:var(--bc-sidebar-btn-height,30px);cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;justify-content:center;align-items:center;gap:var(--bc-sidebar-btn-gap,8px);color:var(--bcsidebar-text) !important;font-weight:bold;position:relative;";
    btn.innerHTML = `${GLOBAL_SEARCH_ICON_SVG}<span class="better-sidebar-label" style="font-size:var(--bc-sidebar-label-size,14px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">Search</span>`;
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openGlobalSearchModal(); });
    // Append so it sits at the bottom of the sidebar item list.
    sidebarContent.appendChild(btn);
    // Match the sidebar's current expanded/collapsed mode immediately so the
    // button doesn't briefly render in the wrong state (e.g. label visible while
    // collapsed) until the next toggle calls updateSidebar().
    applyGlobalSearchSidebarButtonMode(btn, betterSidebar.dataset.expanded === "true");
}

function removeGlobalSearchBetterSidebarButton() {
    document.getElementById("canvasrefined-gs-sidebar-btn")?.remove();
}

// Apply the Better Sidebar's current expanded/collapsed styling to the search
// button, mirroring updateSidebar()'s button/label/svg rules so the button is
// correct the moment it's inserted (and whenever the sidebar re-renders).
function applyGlobalSearchSidebarButtonMode(btn, expanded) {
    if (!btn) return;
    btn.style.width = expanded ? "80%" : "40%";
    const label = btn.querySelector(".better-sidebar-label");
    if (label) label.style.display = expanded ? "block" : "none";
    btn.querySelectorAll("svg").forEach(svg => {
        svg.style.width = "var(--bc-sidebar-icon-size,20px)";
        svg.style.height = "var(--bc-sidebar-icon-size,20px)";
    });
}



// --- Native global-nav trigger ----------------------------------------------

function ensureGlobalSearchNativeSidebarButton() {
    const navMenu = document.getElementById("menu");
    if (!navMenu) return;
    if (navMenu.querySelector("#canvasrefined-gs-nav-item")) return;
    const li = document.createElement("li");
    li.id = "canvasrefined-gs-nav-item";
    li.className = "ic-app-header__menu-list-item canvasrefined-gs-nav-item";
    const link = document.createElement("a");
    link.className = "ic-app-header__menu-list-link";
    link.href = "#";
    link.setAttribute("role", "button");
    link.title = "Search Canvas (Ctrl+K)";
    link.setAttribute("aria-label", "Search Canvas");
    link.innerHTML = `<span class="menu-item-icon-container" aria-hidden="true">${GLOBAL_SEARCH_ICON_SVG}</span><span class="menu-item__text">Search</span>`;
    link.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); openGlobalSearchModal(); });
    li.appendChild(link);
    // Append so the search item appears at the bottom of the global nav.
    navMenu.appendChild(li);
}

function removeGlobalSearchNativeSidebarButton() {
    document.getElementById("canvasrefined-gs-nav-item")?.remove();
}

// --- Dashboard header trigger -----------------------------------------------

function ensureGlobalSearchHeaderButton(headerActions) {
    if (headerActions.querySelector("#canvasrefined-global-search-header-btn")) return;
    const btn = document.createElement("button");
    btn.id = "canvasrefined-global-search-header-btn";
    btn.type = "button";
    btn.className = "canvasrefined-gs-header-btn";
    btn.title = "Search Canvas (Ctrl+K)";
    btn.setAttribute("aria-label", "Search Canvas");
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.2-3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="canvasrefined-gs-header-btn-label">Search</span>`;
    btn.addEventListener("click", openGlobalSearchModal);
    // Insert as the first child of the actions row so it sits just to the left
    // of the "Dashboard Options" (⋯) button, right-aligned with it.
    headerActions.insertBefore(btn, headerActions.firstChild);
}

function ensureGlobalSearchShortcut() {
    if (_gsShortcutBound) return;
    document.addEventListener("keydown", onGlobalSearchShortcut, true);
    _gsShortcutBound = true;
}

function onGlobalSearchShortcut(e) {
    // Ctrl/Cmd+K toggles the search modal. Ignore when a modal is already open
    // and the user is typing in its input (handled by the modal's own listener).
    if (!(e.ctrlKey || e.metaKey) || !(e.key === "k" || e.key === "K")) return;

    // Never activate on quiz pages (intro or take) so we don't interfere with
    // the quiz experience or the browser's native Ctrl+K. Read the URL live
    // because current_page can be stale after Canvas' client-side navigation.
    if (/^\/courses\/\d+\/quizzes\/\d+(?:\/|$)/.test(window.location.pathname)) return;

    const modal = document.getElementById("canvasrefined-global-search-modal");
    if (modal && modal.dataset.open === "true") {
        closeGlobalSearchModal();
    } else {
        e.preventDefault();
        openGlobalSearchModal();
    }
}

function openGlobalSearchModal() {
    if (document.getElementById("canvasrefined-global-search-modal")) return;

    // Show the platform-appropriate modifier in keybind hints (⌘ on Mac).
    const modKey = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318" : "Ctrl";
    const modal = document.createElement("div");
    modal.id = "canvasrefined-global-search-modal";
    modal.className = "canvasrefined-gs-modal";
    modal.dataset.open = "true";
    modal.innerHTML = `
        <div class="canvasrefined-gs-card" role="dialog" aria-modal="true" aria-label="Search Canvas">
            <div class="canvasrefined-gs-input-row">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="20" height="20" class="canvasrefined-gs-input-icon"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.2-3.2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <input id="canvasrefined-gs-input" class="canvasrefined-gs-input" type="text" placeholder="Search modules & assignments\u2026" autocomplete="off" spellcheck="false" />
                <button id="canvasrefined-gs-close" class="canvasrefined-gs-close" type="button" title="Close (Esc)">Esc</button>
            </div>
            <div id="canvasrefined-gs-results" class="canvasrefined-gs-results"></div>
            <div class="canvasrefined-gs-footer">
                <span><kbd>\u2191</kbd><kbd>\u2193</kbd> navigate</span>
                <span><kbd>Enter</kbd> open</span>
                <span><kbd>${modKey}</kbd>+<kbd>Enter</kbd> new tab</span>
                <span><kbd>${modKey}</kbd>+<kbd>K</kbd> toggle search</span>
                <span><kbd>Esc</kbd> close</span>
            </div>
        </div>`;
    document.body.appendChild(modal);

    const input = modal.querySelector("#canvasrefined-gs-input");
    const resultsEl = modal.querySelector("#canvasrefined-gs-results");
    const closeBtn = modal.querySelector("#canvasrefined-gs-close");
    let selected = -1;
    let currentResults = [];

    closeBtn.addEventListener("click", closeGlobalSearchModal);
    modal.addEventListener("mousedown", (e) => { if (e.target === modal) closeGlobalSearchModal(); });

    // Escape closes; arrows + enter navigate. Bound on capture so we win over
    // the global Ctrl+K toggle.
    modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeGlobalSearchModal(); return; }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selected = Math.min(selected + 1, currentResults.length - 1);
            renderGlobalSearchSelection(resultsEl, selected);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selected = Math.max(selected - 1, 0);
            renderGlobalSearchSelection(resultsEl, selected);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const item = currentResults[selected];
            if (item) openGlobalSearchResult(item, e.ctrlKey || e.metaKey);
        }
    });
    // Stop the global Ctrl+K handler from closing the modal while typing.
    input.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) e.stopPropagation();
    });

    let debounce = null;
    input.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => runGlobalSearch(input.value.trim(), resultsEl).then(res => {
            currentResults = res;
            selected = res.length ? 0 : -1;
            renderGlobalSearchSelection(resultsEl, selected);
        }), 120);
    });

    requestAnimationFrame(() => input.focus());
    // Kick off indexing immediately so the first keystroke is fast.
    ensureGlobalSearchIndex();
    // Render an initial hint.
    resultsEl.innerHTML = `<div class="canvasrefined-gs-hint">Start typing to search your modules and assignments.</div>`;
}

function closeGlobalSearchModal() {
    const modal = document.getElementById("canvasrefined-global-search-modal");
    if (!modal) return;
    modal.remove();
}

function openGlobalSearchResult(item, newTab) {
    if (!item || !item.url) return;
    if (newTab) {
        // Opening in a new tab keeps the search menu open so the user can keep
        // searching. Refocus the input for the next keystroke.
        window.open(item.url, "_blank", "noopener");
        const input = document.getElementById("canvasrefined-gs-input");
        if (input) input.focus();
    } else {
        closeGlobalSearchModal();
        window.location.href = item.url;
    }
}

function renderGlobalSearchSelection(resultsEl, selected) {
    const rows = resultsEl.querySelectorAll(".canvasrefined-gs-row");
    rows.forEach((row, i) => {
        if (i === selected) { row.classList.add("canvasrefined-gs-selected"); row.scrollIntoView({ block: "nearest" }); }
        else row.classList.remove("canvasrefined-gs-selected");
    });
}
