// ===================== Grade Analytics =====================
// On course grades pages, adds an "Analytics" toggle on the left side (in the
// Better Sidebar when enabled, otherwise in the native course nav) that shows
// a panel with a score-distribution doughnut, an overall-grade-over-time
// line chart, a GitHub-style grade heatmap, and a final-grade calculator.
// Data comes from the Canvas API with the user's session, so it
// matches the numbers on the page. Charts are hand-drawn on <canvas> so the
// extension needs no CDN/library and no chart library dependency.

const GA_BUCKETS = [
    { label: "90+",   min: 90, max: Infinity, color: "#16a34a" },
    { label: "80-89", min: 80, max: 90,       color: "#4ade80" },
    { label: "70-79", min: 70, max: 80,       color: "#facc15" },
    { label: "60-69", min: 60, max: 70,       color: "#fb923c" },
    { label: "50-59", min: 50, max: 60,       color: "#f87171" },
    { label: "40-49", min: 40, max: 50,       color: "#ef4444" },
    { label: "30-39", min: 30, max: 40,       color: "#dc2626" },
    { label: "20-29", min: 20, max: 30,       color: "#b91c1c" },
    { label: "10-19", min: 10, max: 20,       color: "#991b1b" },
    { label: "0-9",   min: 0,  max: 10,       color: "#7f1d1d" },
];
const GA_UNGRADED_COLOR = "#6b7280";
// 5%-wide zone colors for the line chart background: the doughnut's bucket
// colors interpolated at 5% steps (dark red at 0 → green at 100), so every
// 5% band gets its own shade. Each band is sampled at its LOWER edge so
// every decade starts on its pure bucket color — a 70 is exactly yellow,
// not a yellow-green blend.
const GA_ZONE_COLORS = (() => {
    const stops = GA_BUCKETS.slice().reverse(); // 0-9 (dark red) → 90+ (green)
    const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    return Array.from({ length: 20 }, (_, i) => {
        const m = i * 5; // band's lower edge (70, 75, …) — see comment above
        const k = Math.min(stops.length - 1, Math.floor(m / 10));
        if (k >= stops.length - 1) return stops[stops.length - 1].color;
        const t = (m - k * 10) / 10;
        const c1 = rgb(stops[k].color), c2 = rgb(stops[k + 1].color);
        return `rgb(${lerp(c1[0], c2[0], t)},${lerp(c1[1], c2[1], t)},${lerp(c1[2], c2[2], t)})`;
    });
})();
const GA_OPEN_KEY = "grade_analytics_open";

async function getGradeAnalyticsOpenState() {
    const result = await chrome.storage.local.get(GA_OPEN_KEY);
    return result[GA_OPEN_KEY] ?? true;
}

function setGradeAnalyticsOpenState(open) {
    chrome.storage.local.set({ [GA_OPEN_KEY]: open });
}

const GA_FIT_Y_KEY = "grade_analytics_fit_y";

async function getGradeAnalyticsFitY() {
    const result = await chrome.storage.local.get(GA_FIT_Y_KEY);
    return result[GA_FIT_Y_KEY] ?? false;
}

function setGradeAnalyticsFitY(fit) {
    chrome.storage.local.set({ [GA_FIT_Y_KEY]: fit });
}

// Final-grade calculator settings, stored per course so each course's final
// weight and goal survive reloads: { weight, target, show }. The needed
// score itself is never stored — it's always recomputed against the live
// current grade.
const GA_CALC_PREFIX = "grade_analytics_final_";

function gaCalcStorageKey(courseId) {
    return GA_CALC_PREFIX + courseId;
}

async function getGaCalcSettings(courseId) {
    const empty = { weight: null, target: null, show: false };
    if (courseId == null) return empty;
    const key = gaCalcStorageKey(courseId);
    const result = await chrome.storage.local.get(key);
    const v = result[key];
    return v && typeof v === "object" ? v : empty;
}

function saveGaCalcSettings() {
    const courseId = getCurrentCourseId();
    if (courseId == null || !gaCalc) return;
    chrome.storage.local.set({ [gaCalcStorageKey(courseId)]: gaCalc });
}

let gaObserver = null;
let gaOpen = false;          // panel open on this page view
let gaFitY = false;         // scale the line chart Y axis to fit the data
let gaImagineIf = false;    // "Imagine-If mode" enabled on this page view (never persisted — always off on load)
let gaScenario = null;      // imagine-if working copy of groups + assignments
let gaIfCounter = 0;         // unique ids for user-added groups/assignments
let gaOriginalFinalHtml = null; // Total row's original grade span innerHTML, for restore
let gaTab = "overview";     // active panel tab: "overview" | "calc" | "heatmap"
let gaCalc = null;           // final-grade calculator settings for this course
let gaCourseId = null;       // course whose data is cached
let gaData = null;           // computed data for the current course
let gaLoading = false;
let gaChartObserver = null;  // ResizeObserver: redraws charts once their boxes gain a real size

function gradeAnalyticsActive() {
    return options.grade_analytics && isGradesPage() && !quizSafeModeActive();
}

// Grades data is read straight from the #grades_summary table the page
// already rendered — no API round trips, so even courses with hundreds of
// assignments populate instantly, and the numbers always match what the user
// sees (grading periods, unposted grades, etc.). Waits briefly for the table
// to appear on SPA navigations.
function gaWaitForGradesTable(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const ready = () => {
            const table = document.querySelector("#grades_summary");
            return table && table.querySelector("tr.student_assignment") ? table : null;
        };
        const found = ready();
        if (found) { resolve(found); return; }
        const started = Date.now();
        const timer = setInterval(() => {
            const table = ready();
            if (table) { clearInterval(timer); resolve(table); }
            else if (Date.now() - started > timeoutMs) {
                clearInterval(timer);
                reject(new Error("grades table not found on this page"));
            }
        }, 250);
    });
}

// Entry point: called at init, on SPA navigation, and when the option changes.
function watchGradeAnalytics() {
    if (!gradeAnalyticsActive()) {
        removeGradeAnalyticsPanel();
        if (gaObserver) { gaObserver.disconnect(); gaObserver = null; }
        return;
    }
    // SPA navigation between courses: drop cached data so the panel never
    // shows the previous course's charts.
    const courseId = getCurrentCourseId();
    if (gaCourseId !== null && gaCourseId !== courseId) {
        gaData = null;
        gaCourseId = null;
        gaCalc = null; // per-course final-calculator settings
        removeGradeAnalyticsPanel();
    }
    if (!gaObserver) {
        // Canvas re-renders the left nav and content area during SPA
        // navigation; the observer keeps the panel placed.
        gaObserver = new MutationObserver(() => scheduleGradeAnalyticsSync());
        gaObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
    scheduleGradeAnalyticsSync();
    // Restore the open/closed state and Y-axis preference the user last
    // chose, then inject the panel below the Print Grades header.
    Promise.all([getGradeAnalyticsOpenState(), getGradeAnalyticsFitY(), getGaCalcSettings(courseId)]).then(([open, fit, calc]) => {
        gaOpen = open;
        gaFitY = fit;
        gaCalc = calc;
        const panel = ensureGradeAnalyticsPanel();
        if (panel) applyGaCalcState(panel);
        if (gaOpen && gaData) renderGradeAnalytics();
    });
    if (!gaData && !gaLoading) loadGradeAnalytics();
}

let gaSyncRaf = null;
function scheduleGradeAnalyticsSync() {
    if (gaSyncRaf) return;
    gaSyncRaf = requestAnimationFrame(() => {
        gaSyncRaf = null;
        syncGradeAnalyticsUI();
    });
}

function syncGradeAnalyticsUI() {
    if (!gradeAnalyticsActive()) return;
    const panel = ensureGradeAnalyticsPanel();
    if (!panel) return;
    // Imagine-If: Canvas re-renders can wipe the overwritten Total block or
    // swap in a new grades table (grading-period switch) — reapply, and
    // rebuild the scenario when the table's rows changed.
    if (gaImagineIf) {
        gaRenderImagineIf();
        gaApplyImagineTotal();
    }
    // Self-heal: the one-shot render after data loads can be a no-op when the
    // panel was created before Canvas finished laying out the page (zero-size
    // canvases) or while the body was still hidden. gaSetupCanvas leaves the
    // canvas backing store at width 0 in that case, so a 0-width canvas means
    // "never drawn" — redraw now that layout is real.
    if (gaOpen && gaData) {
        const pie = panel.querySelector("#canvasrefined-ga-pie");
        const line = panel.querySelector("#canvasrefined-ga-line");
        if ((pie && pie.width === 0) || (line && line.width === 0)) {
            renderGradeAnalytics();
        }
    }
}

function removeGradeAnalyticsPanel() {
    gaOpen = false;
    if (gaChartObserver) { gaChartObserver.disconnect(); gaChartObserver = null; }
    // Never leave a hypothetical Total or inline editors behind when the
    // panel goes away.
    gaClearImagineUI();
    gaRestoreImagineTotal();
    document.getElementById("canvasrefined-grade-analytics")?.remove();
}

// Applies the in-memory open/closed state (restored from storage) to the panel
// DOM. Called both at panel creation and whenever an already-attached panel
// is reused, so a stored preference is never lost to a creation race (the DOM
// observer can build the panel before the storage read resolves).
function applyGradeAnalyticsOpenState(panel) {
    const body = panel.querySelector("#canvasrefined-ga-body");
    const btn = panel.querySelector("#canvasrefined-ga-toggle");
    if (!body || !btn) return;
    body.style.display = gaOpen ? "" : "none";
    const svg = btn.querySelector("svg");
    if (svg) svg.style.transform = gaOpen ? "rotate(180deg)" : "rotate(0deg)";
    btn.setAttribute("aria-expanded", String(gaOpen));
}

// Syncs the "Imagine-If mode" button's DOM to the in-memory state.
// Called at panel creation and whenever an already-attached panel is
// reused, mirroring applyGradeAnalyticsOpenState.
function applyGradeAnalyticsImagineState(panel) {
    const btn = panel.querySelector("#canvasrefined-ga-imagine");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(gaImagineIf));
    btn.style.borderColor = gaImagineIf ? "#2563eb" : "var(--bcborders)";
    btn.style.color = gaImagineIf ? "#2563eb" : "var(--bctext-0)";
    btn.style.fontWeight = gaImagineIf ? "600" : "";
}

// Panel is injected directly below the "Print Grades" action header on the
// grades page. Returns null (and retries via the DOM observer) if the anchor
// hasn't rendered yet.
function ensureGradeAnalyticsPanel() {
    let panel = document.getElementById("canvasrefined-grade-analytics");
    const anchor = document.getElementById("print-grades-container");
    if (panel && panel.isConnected) {
        // Canvas re-renders can shift the anchor or our position; keep the
        // panel directly after #print-grades-container at all times.
        if (anchor && panel.previousElementSibling !== anchor) {
            anchor.insertAdjacentElement("afterend", panel);
        }
        // Re-apply the open/closed state in case it was restored from storage
        // after this panel was first created.
        applyGradeAnalyticsOpenState(panel);
        applyGradeAnalyticsImagineState(panel);
        return panel;
    }
    const container = anchor || findContentContainer();
    if (!container) return null;
    panel = document.createElement("div");
    panel.id = "canvasrefined-grade-analytics";
    if (anchor) {
        anchor.insertAdjacentElement("afterend", panel);
    } else {
        // Fallback: top of the content container until the anchor renders.
        container.insertBefore(panel, container.firstChild);
    }
    panel.style.cssText = `margin:18px 0;padding:16px;border:1px solid color-mix(in srgb, var(--bcborders) 75%, transparent);border-radius:10px;background-color:var(--bcbackground-0);color:var(--bctext-0);font-family:"Lato","Helvetica Neue",Helvetica,Arial,sans-serif;box-sizing:border-box;`;
    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            <h2 style="margin:0;font-size:18px;color:var(--bctext-0);">Grade Analytics</h2>
            <button id="canvasrefined-ga-imagine" type="button" aria-pressed="false" title="Toggle Imagine-If mode" style="margin-left:auto;background:var(--bcbackground-1);color:var(--bctext-0);border:1px solid var(--bcborders);border-radius:8px;padding:4px 12px;font-size:14px;line-height:1.4;cursor:pointer;">Imagine-If mode</button>
            <button id="canvasrefined-ga-toggle" type="button" aria-expanded="true" title="Toggle Grade Analytics" style="background:var(--bcbackground-1);color:var(--bctext-0);border:1px solid var(--bcborders);border-radius:8px;padding:4px 12px;font-size:14px;line-height:1.4;cursor:pointer;"><svg style="transform:rotate(180deg);display:block;" fill="currentColor" width="16px" height="16px" viewBox="-6.5 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="1.6"><g stroke-width="0"/><g stroke-linecap="round" stroke-linejoin="round"/><path d="M18.813 11.406l-7.906 9.906c-0.75 0.906-1.906 0.906-2.625 0l-7.906-9.906c-0.75-0.938-0.375-1.656 0.781-1.656h16.875c1.188 0 1.531 0.719 0.781 1.656z"/></svg></button>
        </div>
        <div id="canvasrefined-ga-body">
        <p id="canvasrefined-ga-status" style="margin:0 0 10px;color:var(--bctext-1);font-size:13px;">Loading grade data…</p>
        <div id="canvasrefined-ga-tabs" style="display:flex;gap:4px;border-bottom:1px solid color-mix(in srgb, var(--bcborders) 75%, transparent);margin-bottom:14px;">
            <button type="button" data-ga-tab="overview" style="${gaTabStyle(true)}">Overview</button>
            <button type="button" data-ga-tab="calc" style="${gaTabStyle(false)}">Final Calculator</button>
            <button type="button" data-ga-tab="heatmap" style="${gaTabStyle(false)}">Heatmap</button>
        </div>
        <div id="canvasrefined-ga-tab-overview">
        <div id="canvasrefined-ga-stats" style="display:none;flex-wrap:wrap;gap:10px;margin-bottom:14px;"></div>
        <div id="canvasrefined-ga-charts" style="display:none;gap:24px;flex-wrap:wrap;">
            <div id="canvasrefined-ga-box-pie" style="flex:1 1 calc(33.333% - 8px);min-width:0;">
                <h3 style="margin:0 0 8px;font-size:14px;color:var(--bctext-0);">Score distribution (graded assignments)</h3>
                <div style="position:relative;height:280px;"><canvas id="canvasrefined-ga-pie"></canvas><div id="canvasrefined-ga-pie-tip" style="position:absolute;display:none;pointer-events:none;background:var(--bcbackground-1);color:var(--bctext-0);border:1px solid var(--bcborders);border-radius:6px;padding:6px 10px;font-size:12px;z-index:10;white-space:nowrap;"></div></div>
            </div>
            <div id="canvasrefined-ga-box-line" style="flex:1 1 calc(66.666% - 16px);min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;margin:0 0 8px;">
                    <h3 style="margin:0;font-size:14px;color:var(--bctext-0);">Overall grade over time</h3>
                    <label for="canvasrefined-ga-fity" style="margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--bctext-1);cursor:pointer;user-select:none;"><input type="checkbox" id="canvasrefined-ga-fity"> Fit Y axis</label>
                </div>
                <div style="position:relative;height:280px;"><canvas id="canvasrefined-ga-line"></canvas><div id="canvasrefined-ga-line-tip" style="position:absolute;display:none;pointer-events:none;background:var(--bcbackground-1);color:var(--bctext-0);border:1px solid var(--bcborders);border-radius:6px;padding:8px 10px;font-size:12px;z-index:20;max-width:260px;box-shadow:0 4px 14px rgba(0,0,0,0.25);"></div></div>
            </div>
        </div>
        </div>
        <div id="canvasrefined-ga-tab-calc" style="display:none;">
            <div style="max-width:620px;">
                <p style="margin:0 0 14px;color:var(--bctext-1);font-size:13px;">Enter how much your final is worth and the overall grade you want to show see what grade you need on the final.</p>
                <div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px;">
                    <label style="flex:1 1 200px;font-size:12px;color:var(--bctext-1);">Final exam weight (% of grade)
                        <input id="canvasrefined-ga-calc-weight" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="20" style="display:block;width:100%;margin-top:4px;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--bcborders);background:var(--bcbackground-1);color:var(--bctext-0);font-size:15px;">
                    </label>
                    <label style="flex:1 1 200px;font-size:12px;color:var(--bctext-1);">Target overall grade (%)
                        <input id="canvasrefined-ga-calc-target" type="number" min="0" step="0.1" inputmode="decimal" placeholder="90" style="display:block;width:100%;margin-top:4px;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid var(--bcborders);background:var(--bcbackground-1);color:var(--bctext-0);font-size:15px;">
                    </label>
                </div>
                <label for="canvasrefined-ga-calc-show" style="display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--bctext-0);cursor:pointer;user-select:none;margin-bottom:14px;"><input type="checkbox" id="canvasrefined-ga-calc-show"> Show grade goal on the overview</label>
                <div id="canvasrefined-ga-calc-result" style="padding:12px 16px;border-radius:8px;background:var(--bcbackground-1);border:1px solid color-mix(in srgb, var(--bcborders) 75%, transparent);font-size:14px;"></div>
            </div>
        </div>
        <div id="canvasrefined-ga-tab-heatmap" style="display:none;position:relative;">
            <div style="overflow-x:auto;max-width:100%;padding:2px 2px 6px;">
                <div id="canvasrefined-ga-heatmap-grid" style="display:inline-flex;gap:4px;"></div>
            </div>
            <div id="canvasrefined-ga-heatmap-note" style="margin:0;color:var(--bctext-1);font-size:12px;"></div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:8px;font-size:11px;color:var(--bctext-1);">
                <span>0%</span>
                <span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:${GA_ZONE_COLORS[0]};"></span>
                <span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:${GA_ZONE_COLORS[5]};"></span>
                <span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:${GA_ZONE_COLORS[10]};"></span>
                <span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:${GA_ZONE_COLORS[15]};"></span>
                <span style="width:11px;height:11px;border-radius:3px;display:inline-block;background:${GA_ZONE_COLORS[19]};"></span>
                <span>100%</span>
                <span style="margin-left:12px;display:inline-flex;align-items:center;gap:4px;"><span style="width:12px;height:12px;border-radius:3px;display:inline-block;background:color-mix(in srgb, var(--bctext-1) 20%, transparent);"></span>No grade/assignment</span>
            </div>
            <style>#canvasrefined-grade-analytics .canvasrefined-ga-hcell:hover{outline:1px solid var(--bctext-0);outline-offset:1px;}</style>
            <div id="canvasrefined-ga-heatmap-tip" style="position:absolute;display:none;pointer-events:none;z-index:100;background:var(--bcbackground-1);color:var(--bctext-0);border:1px solid var(--bcborders);border-radius:6px;padding:6px 10px;font-size:12px;white-space:nowrap;box-shadow:0 4px 14px rgba(0,0,0,0.25);"></div>
        </div>
        </div>
    `;
    const toggleBtn = panel.querySelector("#canvasrefined-ga-toggle");
    const imagineBtn = panel.querySelector("#canvasrefined-ga-imagine");
    const fitYCheckbox = panel.querySelector("#canvasrefined-ga-fity");
    const applyOpenState = () => applyGradeAnalyticsOpenState(panel);
    toggleBtn.addEventListener("click", () => {
        gaOpen = !gaOpen;
        setGradeAnalyticsOpenState(gaOpen);
        applyOpenState();
        if (gaOpen && gaData) renderGradeAnalytics();
    });
    // "Imagine-If mode" button on the right side of the panel header. The
    // toggle is per-page-view only (always off on load); the active style
    // highlights the button while the mode is on.
    imagineBtn.addEventListener("click", () => {
        gaImagineIf = !gaImagineIf;
        applyGradeAnalyticsImagineState(panel);
        if (gaImagineIf) gaEnterImagineIf();
        else gaExitImagineIf();
    });
    // "Fit Y axis" scales the line chart's Y axis to the data instead of a
    // fixed 0-100; the choice is remembered across pages via chrome.storage.
    fitYCheckbox.checked = gaFitY;
    fitYCheckbox.addEventListener("change", () => {
        gaFitY = fitYCheckbox.checked;
        setGradeAnalyticsFitY(gaFitY);
        if (gaData) {
            gaDrawLine(panel.querySelector("#canvasrefined-ga-line"), panel.querySelector("#canvasrefined-ga-line-tip"));
        }
    });
    // Tab switching between the charts overview and the final calculator.
    panel.querySelectorAll("[data-ga-tab]").forEach(btn => {
        btn.addEventListener("click", () => gaSetTab(btn.dataset.gaTab));
    });
    // Final-grade calculator inputs persist per course; every change re-saves
    // and recomputes the result against the live current grade.
    const calcWeight = panel.querySelector("#canvasrefined-ga-calc-weight");
    const calcTarget = panel.querySelector("#canvasrefined-ga-calc-target");
    const calcShow = panel.querySelector("#canvasrefined-ga-calc-show");
    const onCalcInput = () => {
        gaCalc = gaCalc || { weight: null, target: null, show: false };
        const w = parseFloat(calcWeight.value);
        const t = parseFloat(calcTarget.value);
        gaCalc.weight = isFinite(w) ? Math.min(100, Math.max(0, w)) : null;
        gaCalc.target = isFinite(t) ? Math.max(0, t) : null;
        gaCalc.show = calcShow.checked;
        saveGaCalcSettings();
        renderGaCalculator();
        renderGaStats();
    };
    calcWeight.addEventListener("input", onCalcInput);
    calcTarget.addEventListener("input", onCalcInput);
    calcShow.addEventListener("change", onCalcInput);
    applyGaCalcState(panel);
    applyGradeAnalyticsImagineState(panel);
    applyOpenState();
    // If the data finished loading before this panel was created (or before
    // the stored open state was restored), the earlier render call found no
    // panel — draw the charts now that it exists.
    if (gaOpen && gaData) renderGradeAnalytics();
    // A chart skipped because its box had no size (page still laying out,
    // tab/panel hidden) is left at width 0; this observer redraws the moment
    // the boxes get real dimensions, even when no DOM mutation or window
    // resize follows.
    if (gaChartObserver) gaChartObserver.disconnect();
    gaChartObserver = new ResizeObserver(() => {
        if (!gaOpen || !gaData) return;
        const pie = panel.querySelector("#canvasrefined-ga-pie");
        const line = panel.querySelector("#canvasrefined-ga-line");
        if ((pie && pie.width === 0) || (line && line.width === 0)) renderGradeAnalytics();
    });
    gaChartObserver.observe(panel.querySelector("#canvasrefined-ga-pie").parentNode);
    gaChartObserver.observe(panel.querySelector("#canvasrefined-ga-line").parentNode);
    return panel;
}

async function loadGradeAnalytics() {
    const courseId = getCurrentCourseId();
    if (courseId == null) return;
    gaLoading = true;
    const status = document.getElementById("canvasrefined-ga-status");
    if (status) status.textContent = "Reading grade data…";
    try {
        // Parse the grades table the page already rendered instead of hitting
        // the paginated API — instant even for courses with hundreds of
        // assignments, and always in sync with what the page shows.
        const table = await gaWaitForGradesTable();
        gaCourseId = courseId;
        gaData = computeGradeAnalyticsFromPage(table);
        gaLoading = false;
        // renderGradeAnalytics self-guards on panel existence and canvas
        // size; if the panel isn't ready yet, the retry in
        // ensureGradeAnalyticsPanel / syncGradeAnalyticsUI draws once it is.
        renderGradeAnalytics();
    } catch (err) {
        logError(err);
        const s = document.getElementById("canvasrefined-ga-status");
        if (s) s.textContent = "Grade Analytics failed to load: " + (err && err.message ? err.message : err);
    } finally {
        gaLoading = false;
    }
}

// Parses one assignment row of #grades_summary into a plain record. The row
// stashes the original posted score in a hidden "original_score" span (the
// "original_points" span holds points EARNED, not possible), while points
// possible is only in the "/ 15" span displayed after the grade.
function gaParseNum(t) {
    if (!t) return null;
    let s = String(t).replace(/\s+/g, "");
    if (s === "" || !/\d/.test(s)) return null;
    // Normalize "1,234.5" (thousands grouping) and "9,5" (comma decimal).
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else if (/^-?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    const v = parseFloat(s);
    return isFinite(v) ? v : null;
}

function gaParseAssignmentRow(tr) {
    const q = (sel) => tr.querySelector(sel);
    const titleLink = q(".title a");
    const possibleText = q(".tooltip .grade + span")?.textContent || "";
    return {
        title: (titleLink ? titleLink.textContent : (q("th.title")?.textContent || "")).trim(),
        score: gaParseNum(q(".original_score")?.textContent),
        points: gaParseNum(possibleText.replace(/^.*\//, "")),
        // Rows the page lists as unsubmitted/unposted carry no score; only
        // "graded" rows have one.
        status: (q(".submission_status")?.textContent || "").trim(),
        gid: (q(".assignment_group_id")?.textContent || "").trim(),
        due: (q("td.due")?.textContent || "").replace(/\s+/g, " ").trim(),
    };
}

function computeGradeAnalyticsFromPage(table) {
    // Assignment group weights come from the "group total" summary rows
    // (e.g. "Summative Assessment — 86.67%, weight 85").
    const groupWeight = {};
    for (const tr of table.querySelectorAll("tr.group_total")) {
        const gid = tr.querySelector(".assignment_group_id")?.textContent.trim();
        const w = parseFloat((tr.querySelector(".group_weight")?.textContent || "").trim());
        if (gid) groupWeight[gid] = isFinite(w) ? w : 0;
    }
    const totalWeight = Object.values(groupWeight).reduce((s, w) => s + w, 0);

    // The page's own computed Total (e.g. "91.1%") — use it directly so the
    // "Overall grade" stat always matches the page.
    let pageTotal = null;
    const totalText = table.querySelector("tr.final_grade .grade")?.textContent || "";
    const totalMatch = totalText.match(/-?\d+(?:\.\d+)?/);
    if (totalMatch) pageTotal = parseFloat(totalMatch[0]);

    // Rows are already listed in due-date order; skip the summary rows (they
    // carry the student_assignment class too).
    const rows = [...table.querySelectorAll("tr.student_assignment")]
        .filter(tr => !tr.classList.contains("group_total") && !tr.classList.contains("final_grade"))
        .map(gaParseAssignmentRow);

    const counts = GA_BUCKETS.map(() => 0);
    let ungraded = 0;
    const graded = [];
    for (const a of rows) {
        if (a.points == null || a.points <= 0) continue; // no points possible
        if (a.score == null) { ungraded++; continue; }    // unposted / unsubmitted
        graded.push(a);
        const pct = (a.score / a.points) * 100;
        const idx = GA_BUCKETS.findIndex(b => pct >= b.min && pct < b.max);
        counts[idx >= 0 ? idx : GA_BUCKETS.length - 1]++;
    }

    // Running overall grade, in the page's row order, using Canvas's own
    // weighting algorithm (GradeCalculator): sum each group's pct × weight
    // over groups that have graded work, then scale up to 100% only when
    // those weights total less than 100 (weights over 100 are used raw and
    // can push the grade past 100). Verified to reproduce the Total shown
    // on the page. Point-based courses (no group weights) use points
    // earned / points possible.
    const running = {};
    const pointsGrade = () => {
        let s = 0, p = 0;
        for (const g of Object.values(running)) { s += g.score; p += g.pts; }
        return p > 0 ? (s / p) * 100 : null;
    };
    const points = graded.map(a => {
        const r = (running[a.gid] ||= { score: 0, pts: 0 });
        r.score += a.score;
        r.pts += a.points;
        let grade = null;
        if (totalWeight > 0) {
            let weighted = 0, fullWeight = 0;
            for (const gid of Object.keys(running)) {
                const g = running[gid];
                if (g.pts <= 0) continue;
                const w = groupWeight[gid] || 0;
                weighted += (g.score / g.pts) * w;
                fullWeight += w;
            }
            // Only zero-weighted groups have graded work — fall back to
            // points so the chart still has a line.
            grade = fullWeight > 0 ? (fullWeight < 100 ? (weighted / fullWeight) * 100 : weighted) : pointsGrade();
        } else {
            grade = pointsGrade();
        }
        return {
            title: a.title,
            score: a.score,
            points: a.points,
            pct: (a.score / a.points) * 100,
            grade,
            due: a.due,
        };
    });

    const pcts = graded.map(a => (a.score / a.points) * 100);
    // Trend: change in the running overall grade over the last 5 graded
    // assignments (or since the first, if fewer). Positive = climbing.
    let trend = null;
    if (points.length >= 2) {
        const from = points[Math.max(0, points.length - 1 - 5)].grade;
        const to = points[points.length - 1].grade;
        if (from != null && to != null) trend = to - from;
    }
    return {
        counts,
        ungraded,
        graded: graded.length,
        avg: pcts.length ? pcts.reduce((s, p) => s + p, 0) / pcts.length : null,
        current: pageTotal != null ? pageTotal : (points.length ? points[points.length - 1].grade : null),
        trend,
        points,
    };
}

// Stat cards row on the Overview tab. The optional "Grade goal" card appears
// when the final calculator's "show" checkbox is on; it recomputes against
// the live current grade so it stays accurate as new grades come in.
function renderGaStats() {
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (!panel || !gaData) return;
    const stats = panel.querySelector("#canvasrefined-ga-stats");
    if (!stats) return;
    stats.style.display = "flex";
    const stat = (cap, val, color) =>
        `<div style="padding:8px 14px;border-radius:8px;background:var(--bcbackground-1);"><div style="font-size:18px;font-weight:700;color:${color || "var(--bctext-0)"};">${val}</div><div style="font-size:11px;text-transform:uppercase;color:var(--bctext-1);">${cap}</div></div>`;
    // Trend card: arrow + colored delta of the overall grade over the last 5
    // graded assignments (green climbing, red falling, grey steady).
    let trendVal = "-", trendColor = "var(--bctext-0)";
    if (gaData.trend != null) {
        if (gaData.trend > 0.05) { trendVal = "\u25B2 +" + gaData.trend.toFixed(1) + "%"; trendColor = "#16a34a"; }
        else if (gaData.trend < -0.05) { trendVal = "\u25BC " + gaData.trend.toFixed(1) + "%"; trendColor = "#dc2626"; }
        else { trendVal = "\u25BA " + gaData.trend.toFixed(1) + "%"; trendColor = "var(--bctext-1)"; }
    }
    // Grade goal card from the Final Calculator tab: the score needed on the
    // final to hit the stored target grade.
    let goalStat = "";
    if (gaCalc && gaCalc.show && gaCalc.weight > 0 && gaCalc.target != null && gaData.current != null) {
        const w = gaCalc.weight / 100;
        const needed = (gaCalc.target - gaData.current * (1 - w)) / w;
        let val, color;
        if (needed <= 0) { val = "\u2713 Secured"; color = "#16a34a"; }
        else if (needed > 100) { val = "Out of reach"; color = "#dc2626"; }
        else { val = "\u2265 " + needed.toFixed(1) + "%"; color = gaNeededColor(needed); }
        goalStat = stat("Final Exam", val, color);
    }
    stats.innerHTML =
        stat("Overall grade", gaData.current == null ? "-" : gaData.current.toFixed(1) + "%") +
        stat("Grade trend (last 5)", trendVal, trendColor) +
        stat("Graded", gaData.graded) +
        stat("Ungraded", gaData.ungraded) +
        goalStat;
}

function renderGradeAnalytics() {
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (!panel || !gaData) return;
    const status = panel.querySelector("#canvasrefined-ga-status");
    if (status) status.style.display = "none";

    renderGaStats();

    const charts = panel.querySelector("#canvasrefined-ga-charts");
    charts.style.display = "flex";
    const fitYBox = panel.querySelector("#canvasrefined-ga-fity");
    if (fitYBox) fitYBox.checked = gaFitY;

    gaDrawPie(panel.querySelector("#canvasrefined-ga-pie"), panel.querySelector("#canvasrefined-ga-pie-tip"));
    gaDrawLine(panel.querySelector("#canvasrefined-ga-line"), panel.querySelector("#canvasrefined-ga-line-tip"));
    renderGaHeatmap();
    renderGaCalculator();
}

// --- Final Calculator tab --------------------------------------------------

// Inline style for one panel tab button; the active tab gets the accent
// underline, matching how the rest of the panel is styled inline.
function gaTabStyle(active) {
    return `background:transparent;border:none;padding:6px 14px;font-size:14px;font-weight:600;cursor:pointer;color:${active ? "var(--bctext-0)" : "var(--bctext-1)"};border-bottom:2px solid ${active ? "#2563eb" : "transparent"};`;
}

function gaSetTab(tab) {
    gaTab = tab;
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (!panel) return;
    for (const name of ["overview", "calc", "heatmap"]) {
        const el = panel.querySelector(`#canvasrefined-ga-tab-${name}`);
        if (el) el.style.display = name === tab ? "" : "none";
    }
    panel.querySelectorAll("[data-ga-tab]").forEach(btn => {
        const active = btn.dataset.gaTab === tab;
        btn.style.color = active ? "var(--bctext-0)" : "var(--bctext-1)";
        btn.style.borderBottomColor = active ? "#2563eb" : "transparent";
    });
    if (tab === "overview") {
        // The canvases were zero-size while the tab was hidden; redraw now
        // that it's visible again.
        if (gaOpen && gaData) renderGradeAnalytics();
    } else if (tab === "heatmap") {
        renderGaHeatmap();
    } else {
        renderGaCalculator();
    }
}

// Severity color for an arbitrary score percentage — the same palette the
// doughnut / zone charts use, so a 70 renders yellow, an 85 green, etc.
function gaSeverityColor(pct) {
    if (pct == null || !isFinite(pct)) return "var(--bctext-0)";
    const b = GA_BUCKETS.find(b => pct >= b.min && pct < b.max);
    return (b || GA_BUCKETS[GA_BUCKETS.length - 1]).color;
}

// Inverted severity for the final calculator: a LOW required score is good
// (needing only 10% on the final is comfortably green), a high one is bad.
// Own scale, independent of the grade chart palette: needing ≥95% on the
// final is red, 75–94% yellow, and ≤74% green.
const GA_NEEDED_COLORS = [
    { min: 95, color: "#dc2626" },
    { min: 75, color: "#facc15" },
    { min: 0,  color: "#16a34a" },
];

function gaNeededColor(needed) {
    if (needed == null || !isFinite(needed)) return "var(--bctext-0)";
    const b = GA_NEEDED_COLORS.find(b => needed >= b.min);
    return (b || GA_NEEDED_COLORS[GA_NEEDED_COLORS.length - 1]).color;
}

// Pushes the stored calculator settings into the tab's inputs without
// clobbering a field the user is actively typing in.
function applyGaCalcState(panel) {
    const w = panel.querySelector("#canvasrefined-ga-calc-weight");
    const t = panel.querySelector("#canvasrefined-ga-calc-target");
    const s = panel.querySelector("#canvasrefined-ga-calc-show");
    if (!w || !t || !s) return;
    if (document.activeElement !== w) w.value = gaCalc && gaCalc.weight != null ? gaCalc.weight : "";
    if (document.activeElement !== t) t.value = gaCalc && gaCalc.target != null ? gaCalc.target : "";
    s.checked = !!(gaCalc && gaCalc.show);
    renderGaCalculator();
}

// Renders the calculator result: needed = (target − current·(1−w)) / w, where
// w is the final's weight. Always recomputed from the live current grade so
// stored goals stay accurate after reloads and as new grades post.
function renderGaCalculator() {
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (!panel) return;
    const box = panel.querySelector("#canvasrefined-ga-calc-result");
    if (!box) return;
    if (!gaCalc || gaCalc.weight == null || !(gaCalc.weight > 0) || gaCalc.target == null) {
        box.innerHTML = `<span style="color:var(--bctext-1);">Enter your final's weight and your target grade to see what you need on the final.</span>`;
        return;
    }
    const w = gaCalc.weight / 100;
    const target = gaCalc.target;
    const current = gaData ? gaData.current : null;
    if (current == null) {
        box.innerHTML = `<span style="color:var(--bctext-1);">Waiting for grade data…</span>`;
        return;
    }
    const needed = (target - current * (1 - w)) / w;
    const withZero = current * (1 - w);
    const withPerfect = withZero + 100 * w;
    let head, sub;
    if (needed <= 0) {
        head = `<span style="font-size:20px;font-weight:700;color:#16a34a;">You're already there!</span>`;
        sub = `Even a 0 on the final leaves you at <b>${withZero.toFixed(1)}%</b>, which is above your <b>${target}%</b> goal.`;
    } else if (needed > 100) {
        head = `<span style="font-size:20px;font-weight:700;color:#dc2626;">Out of reach</span>`;
        sub = `Even a perfect final only gets you to <b>${withPerfect.toFixed(1)}%</b>, which is below your <b>${target}%</b> goal.`;
    } else {
        head = `<span style="font-size:20px;font-weight:700;color:${gaNeededColor(needed)};">You need ≥ ${needed.toFixed(1)}% on the final</span>`;
        sub = `You got this!`;
    }
    box.innerHTML = head + `<div style="margin-top:6px;color:var(--bctext-1);font-size:13px;">${sub}</div>`;
}

// --- Heatmap tab ----------------------------------------------------------

// One week cell in the heatmap strip: one square per Sunday–Saturday week,
// laid out left to right — 16px squares with 4px gaps. Weekly (not daily)
// buckets keep a whole semester compact instead of a sparse daily grid.
// One day cell in the calendar heatmap: 13px squares with 3px gaps,
// GitHub-style columns of Sunday–Saturday weeks.
const GA_HM_CELL = 13;
const GA_HM_GAP = 3;
const GA_HM_MONTH_H = 16; // vertical room for the month labels above the grid
let gaHeatmapToken = null; // identifies the data the grid was last built from

// Color for a day's average score — the same 5%-banded red→green palette
// the line chart's zones use, so an 84% day matches an 84% zone.
function gaHeatmapColor(avg) {
    return GA_ZONE_COLORS[Math.max(0, Math.min(GA_ZONE_COLORS.length - 1, Math.floor(avg / 5)))];
}

// Minimal HTML escaping for assignment titles that go into tooltips.
function gaEscHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Groups the graded assignments by due DATE. The grades table only renders
// "Sep 23"-style due dates (no year), so years are reconstructed: the table
// rows are in chronological order, so a month that steps backwards means the
// calendar wrapped into a new year; the base year is then chosen so the last
// due date isn't more than ~6 weeks in the future. Returns null when no
// graded assignment has a parseable due date.
function gaBuildHeatmapData() {
    if (!gaData || !Array.isArray(gaData.points) || !gaData.points.length) return null;
    const parsed = [];
    for (const p of gaData.points) {
        const m = /^([A-Za-z]{3})\s+(\d{1,2})/.exec((p.due || "").trim());
        if (!m) continue;
        const mo = months.findIndex(x => x.toLowerCase() === m[1].toLowerCase());
        const day = parseInt(m[2], 10);
        if (mo < 0 || day < 1 || day > 31) continue;
        parsed.push({ p, mo, day });
    }
    if (!parsed.length) return null;
    // Reconstruct years WITHOUT assuming the rows are in due-date order —
    // the table isn't sorted by date when Canvas arranges it by assignment
    // group, and the old "month stepped backwards ⇒ new year" detection
    // snowballed on that, landing dates decades off. A course spans at most
    // ~12 months, so instead: find the month rotation that packs every due
    // month into the shortest window (months before the rotation wrap into
    // the following year), then pick the base year whose window actually
    // contains today — or, failing that, the latest window entirely in the
    // past.
    const present = [...new Set(parsed.map(e => e.mo))];
    let rho = 0, bestSpan = 12;
    for (let r = 0; r < 12; r++) {
        let lo = 12, hi = -1;
        for (const m of present) {
            const u = (m - r + 12) % 12;
            if (u < lo) lo = u;
            if (u > hi) hi = u;
        }
        if (hi - lo < bestSpan) { bestSpan = hi - lo; rho = r; }
    }
    const thisYear = new Date().getFullYear();
    const now = Date.now(), grace = 45 * 86400000;
    const mkDate = (e, y) => new Date(y + (e.mo < rho ? 1 : 0), e.mo, e.day);
    let base = null;
    for (let y = thisYear + 1; y >= thisYear - 2 && base == null; y--) {
        const ds = parsed.map(e => mkDate(e, y).getTime());
        if (Math.min(...ds) <= now && now <= Math.max(...ds) + grace) base = y;
    }
    if (base == null) {
        for (let y = thisYear; y >= thisYear - 3 && base == null; y--) {
            if (parsed.every(e => mkDate(e, y).getTime() <= now + grace)) base = y;
        }
    }
    if (base == null) base = thisYear;
    const abs = (e) => mkDate(e, base);
    // Bucket by calendar day; multiple assignments due the same day pool into
    // one cell colored by their average score.
    const byDay = new Map();
    let min = null, max = null;
    for (const e of parsed) {
        const d = abs(e);
        const key = d.getTime();
        let cell = byDay.get(key);
        if (!cell) {
            cell = { date: d, sum: 0, items: [] };
            byDay.set(key, cell);
            if (min == null || d.getTime() < min.getTime()) min = d;
            if (max == null || d.getTime() > max.getTime()) max = d;
        }
        cell.sum += e.p.pct;
        cell.items.push(e.p);
    }
    return { byDay, min, max, undated: gaData.points.length - parsed.length };
}

// Tooltip anchored beside the hovered day cell. Positioning is relative to
// the heatmap tab (the tip's offsetParent), NOT the viewport: position:fixed
// is unreliable here because ancestors with transforms/backdrop-filters
// (Better Sidebar's glass panels, Canvas layout) redefine the containing
// block, which sent a fixed-position tooltip to the wrong part of the page.
function gaHeatmapShowTip(tip, e, cell, avg) {
    const d = cell.date;
    const rows = cell.items.map(p =>
        `<div style="margin-top:2px;color:var(--bctext-1);">${gaEscHtml(p.title)} — <b style="color:${gaHeatmapColor(p.pct)};">${p.pct.toFixed(1)}%</b></div>`).join("");
    tip.innerHTML = `<b>${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</b> — avg <b style="color:${gaHeatmapColor(avg)};">${avg.toFixed(1)}%</b><div style="margin-top:4px;font-size:11px;color:var(--bctext-1);">${cell.items.length} assignment${cell.items.length === 1 ? "" : "s"}:</div>${rows}`;
    tip.style.display = "block";
    const host = tip.offsetParent || tip.parentNode;
    const hostRect = host.getBoundingClientRect();
    const cellRect = e.target.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    // Beside the cell, vertically centered on it; flip to the left when the
    // right edge is tight, and clamp inside the tab's box.
    let left = cellRect.right - hostRect.left + 6;
    if (left + tw > host.clientWidth - 4) left = Math.max(4, cellRect.left - hostRect.left - tw - 6);
    let top = cellRect.top - hostRect.top + (cellRect.height - th) / 2;
    top = Math.min(Math.max(4, top), Math.max(4, host.clientHeight - th - 4));
    tip.style.left = left + "px";
    tip.style.top = top + "px";
}

// Builds the GitHub-style calendar: weekday labels down the left (Mon/Wed/
// Fri only), one column per Sunday–Saturday week, month labels across the
// top, one colored square per day (that day's average score). Pure DOM (no
// canvas) so it needs no redraw on resize; a token guards against rebuilds
// when renderGradeAnalytics re-fires for the same data.
function renderGaHeatmap() {
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (!panel) return;
    const grid = panel.querySelector("#canvasrefined-ga-heatmap-grid");
    const note = panel.querySelector("#canvasrefined-ga-heatmap-note");
    const tip = panel.querySelector("#canvasrefined-ga-heatmap-tip");
    if (!grid || !note || !tip) return;
    const data = gaBuildHeatmapData();
    const token = data ? `${gaCourseId}:${data.min.getTime()}:${data.max.getTime()}:${gaData.points.length}` : "none";
    if (grid.childElementCount && gaHeatmapToken === token) return; // already built
    gaHeatmapToken = token;
    grid.textContent = "";
    if (!data) {
        note.textContent = "No graded assignments with due dates yet.";
        return;
    }
    note.textContent = data.undated > 0
        ? `${data.undated} graded assignment${data.undated === 1 ? "" : "s"} without a due date not shown.`
        : "";
    // Align the range out to full Sunday–Saturday weeks so columns never
    // start mid-week.
    const start = new Date(data.min);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(data.max);
    end.setDate(end.getDate() + (6 - end.getDay()));
    // Left weekday labels — sparse like GitHub's (Mon/Wed/Fri).
    const labels = document.createElement("div");
    labels.style.cssText = `display:flex;flex-direction:column;gap:${GA_HM_GAP}px;padding-top:${GA_HM_MONTH_H}px;`;
    ["", "Mon", "", "Wed", "", "Fri", ""].forEach(t => {
        const l = document.createElement("div");
        l.style.cssText = `height:${GA_HM_CELL}px;font-size:9px;line-height:${GA_HM_CELL}px;color:var(--bctext-1);white-space:nowrap;`;
        l.textContent = t;
        labels.appendChild(l);
    });
    grid.appendChild(labels);
    const wrap = document.createElement("div");
    wrap.style.cssText = `position:relative;padding-top:${GA_HM_MONTH_H}px;`;
    const cols = document.createElement("div");
    cols.style.cssText = `display:flex;gap:${GA_HM_GAP}px;`;
    wrap.appendChild(cols);
    grid.appendChild(wrap);
    const cursor = new Date(start);
    let wk = 0, prevMonth = null;
    while (cursor.getTime() <= end.getTime()) {
        const col = document.createElement("div");
        col.style.cssText = `display:flex;flex-direction:column;gap:${GA_HM_GAP}px;`;
        // Month label across the top when this week's Thursday enters a new
        // month (every month owns at least one Thursday, so none are
        // skipped).
        const thursday = new Date(cursor);
        thursday.setDate(thursday.getDate() + 4);
        if (prevMonth == null || thursday.getMonth() !== prevMonth) {
            prevMonth = thursday.getMonth();
            const lab = document.createElement("div");
            lab.textContent = months[prevMonth];
            lab.style.cssText = `position:absolute;top:0;left:${wk * (GA_HM_CELL + GA_HM_GAP)}px;font-size:10px;line-height:1;color:var(--bctext-1);white-space:nowrap;`;
            wrap.appendChild(lab);
        }
        for (let d = 0; d < 7; d++) {
            const cell = data.byDay.get(cursor.getTime());
            const div = document.createElement("div");
            div.className = "canvasrefined-ga-hcell";
            div.style.cssText = `width:${GA_HM_CELL}px;height:${GA_HM_CELL}px;border-radius:3px;background:${cell ? gaHeatmapColor(cell.sum / cell.items.length) : "color-mix(in srgb, var(--bctext-1) 20%, transparent)"};`;
            if (cell) {
                const avg = cell.sum / cell.items.length;
                div.addEventListener("mousemove", (e) => gaHeatmapShowTip(tip, e, cell, avg));
                div.addEventListener("mouseleave", () => { tip.style.display = "none"; });
            }
            col.appendChild(div);
            cursor.setDate(cursor.getDate() + 1);
        }
        cols.appendChild(col);
        wk++;
    }
}

// --- Canvas-drawn charts --------------------------------------------------

function gaSetupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentNode.clientWidth, h = canvas.parentNode.clientHeight;
    // Zero size means the panel isn't visible/attached yet, so skip drawing —
    // but mark the canvas "never drawn" (width 0) so the self-heal paths
    // (syncGradeAnalyticsUI and the chart ResizeObserver) know to retry once
    // it has real dimensions. A canvas that was never drawn defaults to
    // width 300, so without this the zero-width "never drawn" check never
    // matches and charts stay blank until a tab switch or panel toggle.
    if (w <= 0 || h <= 0) {
        canvas.width = 0;
        canvas.height = 0;
        return null;
    }
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
}

function gaShowTooltip(el, x, y, html) {
    el.innerHTML = html;
    el.style.display = "block";
    const parent = el.parentNode;
    const tw = el.offsetWidth, th = el.offsetHeight;
    // Place the tooltip beside the cursor/point so it never covers the chart
    // underneath; flip to the left side when the right edge is tight.
    let left = x + 14;
    if (left + tw > parent.clientWidth) left = Math.max(0, x - tw - 14);
    let top = y - th / 2;
    top = Math.min(Math.max(0, top), Math.max(0, parent.clientHeight - th));
    el.style.left = left + "px";
    el.style.top = top + "px";
}

function gaDrawPie(canvas, tooltip) {
    const size = gaSetupCanvas(canvas);
    if (!size || !gaData) return;
    const { ctx, w, h } = size;
    const cx = w / 2, cy = h / 2;
    const r = Math.max(10, Math.min(w, h) / 2 - 10);
    const slices = GA_BUCKETS.map((b, i) => ({ label: b.label, value: gaData.counts[i], color: b.color }))
        .concat([{ label: "Ungraded", value: gaData.ungraded, color: GA_UNGRADED_COLOR }]);
    const total = slices.reduce((s, x) => s + x.value, 0);
    const arcs = [];
    if (total === 0) {
        ctx.strokeStyle = "#888";
        ctx.lineWidth = r - r * 0.55;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(cx, cy, (r + r * 0.55) / 2, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#888"; ctx.textAlign = "center";
        ctx.font = "13px Lato, sans-serif";
        ctx.fillText("No graded assignments yet", cx, cy);
    }
    let start = -Math.PI / 2;
    for (const s of slices) {
        if (!s.value) continue;
        const ang = (s.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, start, start + ang);
        ctx.arc(cx, cy, r * 0.55, start + ang, start, true);
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
        arcs.push({ ...s, start, end: start + ang });
        start += ang;
    }
    canvas._gaArcs = arcs;
    canvas._gaCenter = { cx, cy, r };
    if (canvas._gaHover) { canvas.removeEventListener("mousemove", canvas._gaHover); canvas.removeEventListener("mouseleave", canvas._gaLeave); }
    canvas._gaHover = (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left - canvas._gaCenter.cx;
        const y = e.clientY - rect.top - canvas._gaCenter.cy;
        const dist = Math.hypot(x, y);
        const hit = canvas._gaArcs.find(a => {
            let d = Math.atan2(y, x);
            if (d < a.start) d += Math.PI * 2;
            return dist <= canvas._gaCenter.r && dist >= canvas._gaCenter.r * 0.55 && d >= a.start && d <= a.end;
        });
        if (hit) gaShowTooltip(tooltip, e.clientX - rect.left, e.clientY - rect.top, `<b>${hit.label}</b>: ${hit.value} assignment${hit.value === 1 ? "" : "s"}`);
        else tooltip.style.display = "none";
    };
    canvas._gaLeave = () => { tooltip.style.display = "none"; };
    canvas.addEventListener("mousemove", canvas._gaHover);
    canvas.addEventListener("mouseleave", canvas._gaLeave);
}

function gaDrawLine(canvas, tooltip) {
    const size = gaSetupCanvas(canvas);
    if (!size || !gaData) return;
    const pts = gaData.points;
    const { ctx, w, h } = size;
    const pad = { l: 38, r: 12, t: 12, b: 26 };
    const text = getComputedStyle(document.body).color || "#666";
    ctx.font = "11px Lato, sans-serif";
    // Y axis: fixed 0-100 by default, or scaled to fit the data when the user
    // toggled "Fit Y axis" (persisted in chrome.storage.local).
    let yMin = 0, yMax = 100;
    if (gaFitY) {
        const vals = pts.map(p => p.grade).filter(v => v != null);
        if (vals.length) {
            const lo = Math.min(...vals), hi = Math.max(...vals);
            if (hi - lo < 1e-9) {
                yMin = Math.max(0, lo - 5);
                yMax = hi + 5;
            } else {
                const margin = (hi - lo) * 0.1;
                yMin = Math.max(0, lo - margin);
                yMax = hi + margin;
            }
            if (yMax - yMin < 1) yMax = yMin + 1;
        }
    }
    // Y grid: 5 evenly spaced lines across the current range.
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const decimals = (yMax - yMin) <= 10 ? 1 : 0;
    for (let i = 0; i <= 5; i++) {
        const v = yMin + (yMax - yMin) * (i / 5);
        const y = pad.t + (1 - (v - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);
        ctx.strokeStyle = "rgba(128,128,128,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillStyle = text;
        ctx.fillText(v.toFixed(decimals) + "%", pad.l - 6, y);
    }
    if (pts.length === 0) {
        ctx.fillStyle = text; ctx.textAlign = "center";
        ctx.fillText("No graded assignments yet", w / 2, h / 2);
        return;
    }
    const X = (i) => pad.l + (pts.length === 1 ? (w - pad.l - pad.r) / 2 : (i / (pts.length - 1)) * (w - pad.l - pad.r));
    const Y = (v) => pad.t + (1 - (Math.max(yMin, Math.min(yMax, v)) - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);
    // Full chart draw, parameterized by the hovered point index so mousemove
    // can cheaply redraw with a highlight on the active dot.
    const draw = (hover) => {
        ctx.clearRect(0, 0, w, h);
        // Optional colored 5% zones behind the plot ("Colored grade zones"
        // popup option), tinted red→green. With Fit Y axis on, bands are
        // clipped to the visible range.
        if (options.grade_analytics_zones) {
            GA_ZONE_COLORS.forEach((color, i) => {
                const top = Math.min(yMax, (i + 1) * 5);
                const bottom = Math.max(yMin, i * 5);
                if (top <= bottom) return;
                const y1 = pad.t + (1 - (top - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);
                const y2 = pad.t + (1 - (bottom - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = color;
                ctx.fillRect(pad.l, y1, w - pad.l - pad.r, y2 - y1);
                ctx.globalAlpha = 1;
            });
        }
        // Y grid: 5 evenly spaced lines across the current range.
        ctx.font = "11px Lato, sans-serif";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        for (let i = 0; i <= 5; i++) {
            const v = yMin + (yMax - yMin) * (i / 5);
            const y = pad.t + (1 - (v - yMin) / (yMax - yMin)) * (h - pad.t - pad.b);
            ctx.strokeStyle = "rgba(128,128,128,0.25)";
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
            ctx.fillStyle = text;
            ctx.fillText(v.toFixed(decimals) + "%", pad.l - 6, y);
        }
        // Line + area fill.
        ctx.beginPath();
        pts.forEach((p, i) => { const x = X(i), y = Y(p.grade); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.strokeStyle = "#2563eb"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke();
        ctx.lineTo(X(pts.length - 1), h - pad.b); ctx.lineTo(X(0), h - pad.b); ctx.closePath();
        ctx.fillStyle = "rgba(37,99,235,0.12)"; ctx.fill();
        // Points.
        pts.forEach((p, i) => {
            ctx.beginPath(); ctx.arc(X(i), Y(p.grade), 3, 0, Math.PI * 2);
            ctx.fillStyle = "#2563eb"; ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.stroke();
        });
        // X axis: tick marks plus one label per calendar month. Points are
        // already in chronological order, so a walking month counter (wrapping
        // across Dec -> Jan) maps each point to an absolute month; the first
        // point of each month gets the tick + label.
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.strokeStyle = "rgba(128,128,128,0.55)";
        ctx.lineWidth = 1;
        const tick = (x) => {
            ctx.beginPath(); ctx.moveTo(x, h - pad.b); ctx.lineTo(x, h - pad.b + 4); ctx.stroke();
        };
        // Subtle tick under every data point on sparse charts.
        if (pts.length <= 25) pts.forEach((_, i) => tick(X(i)));
        // Month boundaries: the first point of each calendar month. Points are
        // already in chronological order, so a walking month counter (wrapping
        // across Dec → Jan) maps each point to an absolute month.
        const boundaries = [];
        let prevM = null, absM = null;
        pts.forEach((p, i) => {
            const m = months.indexOf((p.due || "").trim().slice(0, 3));
            if (m < 0) return; // no due date on this point
            if (absM == null) absM = m;
            else if (m >= prevM) absM += m - prevM;
            else absM += 12 - prevM + m; // wrapped to a new year
            prevM = m;
            const last = boundaries[boundaries.length - 1];
            if (!last || last.absM !== absM) {
                boundaries.push({ i, absM, label: (p.due || "").trim().slice(0, 3) });
            }
        });
        boundaries.forEach(b => tick(X(b.i)));
        // Collision-aware labels: greedily keep a month label only if it fits
        // after the previous kept one (labels are centered, so compare against
        // half-widths plus a 6px gap). The first boundary always gets a label;
        // so does the last — if it doesn't fit, earlier labels are dropped to
        // make room, so the axis ends on a real month instead of mid-run.
        const GAP = 6;
        const kept = [];
        boundaries.forEach((b, idx) => {
            const x = X(b.i);
            const w = ctx.measureText(b.label).width;
            if (idx === 0 || x - w / 2 > kept[kept.length - 1].right + GAP) {
                kept.push({ ...b, x, right: x + w / 2 });
            }
        });
        const lastB = boundaries[boundaries.length - 1];
        if (lastB && kept[kept.length - 1].i !== lastB.i) {
            const x = X(lastB.i);
            const w = ctx.measureText(lastB.label).width;
            while (kept.length && kept[kept.length - 1].right + GAP > x - w / 2) kept.pop();
            kept.push({ ...lastB, x, right: x + w / 2 });
        }
        kept.forEach((b, k) => {
            // Anchor the edge labels inward so they don't clip.
            ctx.textAlign = k === 0 ? "left" : (b.i === pts.length - 1 ? "right" : "center");
            ctx.fillStyle = text;
            ctx.fillText(b.label, b.x, h - pad.b + 6);
        });
        // Hover indicator: dashed vertical guide plus a halo ring around the
        // hovered dot so it's obvious which point the tooltip describes.
        if (hover != null && pts[hover]) {
            const hx = X(hover), hy = Y(pts[hover].grade);
            ctx.save();
            ctx.strokeStyle = "rgba(37,99,235,0.55)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(hx, pad.t); ctx.lineTo(hx, h - pad.b); ctx.stroke();
            ctx.restore();
            ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(37,99,235,0.25)"; ctx.fill();
            ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
            ctx.fillStyle = "#2563eb"; ctx.fill();
            ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
        }
    };
    draw(null);
    canvas._gaHoverIdx = null; // stale hover index from a previous draw
    canvas._gaPts = pts;
    canvas._gaX = X; canvas._gaY = Y; canvas._gaPad = pad;
    if (canvas._gaHover) { canvas.removeEventListener("mousemove", canvas._gaHover); canvas.removeEventListener("mouseleave", canvas._gaLeave); }
    canvas._gaHover = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        let best = 0, bestD = Infinity;
        pts.forEach((_, i) => { const d = Math.abs(X(i) - mx); if (d < bestD) { bestD = d; best = i; } });
        if (best !== canvas._gaHoverIdx) {
            canvas._gaHoverIdx = best;
            draw(best);
        }
        const p = pts[best];
        gaShowTooltip(tooltip, X(best), Y(p.grade),
            `<b>${p.title}</b><br>Overall: ${p.grade == null ? "-" : p.grade.toFixed(1) + "%"}<br>This: ${p.score}/${p.points} (${p.pct.toFixed(1)}%)${p.due ? `<br>Due: ${p.due}` : ""}`);
    };
    canvas._gaLeave = () => {
        tooltip.style.display = "none";
        if (canvas._gaHoverIdx != null) {
            canvas._gaHoverIdx = null;
            draw(null);
        }
    };
    canvas.addEventListener("mousemove", canvas._gaHover);
    canvas.addEventListener("mouseleave", canvas._gaLeave);
}

// Redraw open charts when the window is resized.
window.addEventListener("resize", () => {
    const panel = document.getElementById("canvasrefined-grade-analytics");
    if (panel && gaOpen && gaData) renderGradeAnalytics();
});