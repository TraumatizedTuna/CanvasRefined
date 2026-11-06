// --- Imagine-If mode ---------------------------------------------------------
//
// A hypothetical-grade sandbox rendered directly on the grades table (never
// inside the Grade Analytics panel): each assignment row gets inline
// score / points-possible inputs plus a group selector and remove button,
// each group-total row gets a weight input and remove button, the "+ Add
// assignment" button sits at the top of the table (above the first
// assignment), and the "+ Add group" button sits above the Total row. The
// hypothetical total is computed here — Canvas's weighting algorithm
// (groups with counted work contribute pct × weight, scaled up to 100% when
// the used weights total less than 100; point-based totals when no group has
// weight) — and previewed by overwriting the table's Total row (the
// tr.final_grade percentage span) with an obvious Imagine-If badge. Nothing is ever sent to Canvas; the page is
// restored to the pixel the moment the mode is turned off.

// Standard grading scheme for the hypothetical letter grade (a course's
// actual scheme isn't exposed on this page). 80.5% → B− matches Canvas's
// default cutoffs.

const GA_LETTER_SCALE = [
    ["A", 93], ["A−", 90], ["B+", 87], ["B", 83], ["B−", 80],
    ["C+", 77], ["C", 73], ["C−", 70], ["D+", 67], ["D", 63], ["D−", 60],
];

function gaLetterFor(pct) {
    if (pct == null || !isFinite(pct)) return null;
    for (const [letter, min] of GA_LETTER_SCALE) if (pct >= min) return letter;
    return "F";
}

// The table's Total row (tr.final_grade) — the recalculated grade
// overwrites its percentage span while Imagine-If mode is on.
function gaFindTotalGradeSpan() {
    const row = document.querySelector("#grades_summary tr.final_grade");
    return row ? row.querySelector("td.assignment_score .tooltip .grade") : null;
}

function gaFindTotalTitleCell() {
    const row = document.querySelector("#grades_summary tr.final_grade");
    return row ? row.querySelector("th.title") : null;
}

// Signature of the page's grades table (row ids). When it changes (grading
// period switch, SPA navigation) the scenario is rebuilt from the new table.
function gaImagineTableSig() {
    const table = document.querySelector("#grades_summary");
    return table ? [...table.querySelectorAll("tr.student_assignment")].map(tr => tr.id).join(",") : "";
}

// Snapshot of the page's groups and assignments the scenario starts from.
// Scores come from the hidden "original_score" spans (immune to Canvas's own
// What-If edits); ungraded rows keep score: null so they only count once the
// user types a score for them.
function gaBuildImagineScenario() {
    const table = document.querySelector("#grades_summary");
    if (!table) return null;
    const groups = [];
    for (const tr of table.querySelectorAll("tr.group_total")) {
        const gid = (tr.querySelector(".assignment_group_id")?.textContent || "").trim();
        if (!gid) continue;
        const name = (tr.querySelector("th.title")?.textContent || "").trim() || ("Group " + gid);
        const w = parseFloat((tr.querySelector(".group_weight")?.textContent || "").trim());
        groups.push({ gid, name, weight: isFinite(w) ? w : 0 });
    }
    const assignments = [];
    for (const tr of table.querySelectorAll("tr.student_assignment")) {
        if (tr.classList.contains("group_total") || tr.classList.contains("final_grade")) continue;
        const a = gaParseAssignmentRow(tr);
        assignments.push({
            key: tr.id || ("row-" + assignments.length),
            title: (a.title || "Assignment").trim() || "Assignment",
            score: a.score,
            points: a.points,
            gid: (a.gid || "").trim(),
        });
    }
    return { groups, assignments };
}

// Hypothetical total for the scenario, computed from scratch (never read
// from the page's Total). Only assignments with a score, a positive
// denominator, and a group that still exists count. Weighted when any
// group has weight (Canvas's GradeCalculator: sum pct × weight over groups
// with counted work, scale up to 100% when the used weights total < 100,
// use raw when ≥ 100), otherwise points earned / points possible.
function gaComputeImagineTotal() {
    if (!gaScenario) return null;
    const groups = new Map();
    let totalWeightAll = 0;
    for (const g of gaScenario.groups) {
        if (g.deleted) continue;
        const w = isFinite(g.weight) ? g.weight : 0;
        groups.set(String(g.gid), w);
        totalWeightAll += w;
    }
    // With every group removed the total falls back to plain points, so all
    // assignments count regardless of their (dangling) group id.
    const noGroups = groups.size === 0;
    const stats = new Map(); // gid -> {score, pts}
    for (const a of gaScenario.assignments) {
        if (a.deleted || a.score == null || !(a.points > 0)) continue;
        const gid = String(a.gid ?? "");
        if (!noGroups && !groups.has(gid)) continue; // group deleted / unassigned
        const s = stats.get(gid) || { score: 0, pts: 0 };
        s.score += a.score;
        s.pts += a.points;
        stats.set(gid, s);
    }
    if (!stats.size) return null;
    if (totalWeightAll > 0) {
        let weighted = 0, used = 0;
        for (const [gid, s] of stats) {
            const w = groups.get(gid) || 0;
            weighted += (s.score / s.pts) * w;
            used += w;
        }
        if (used > 0) return used < 100 ? (weighted / used) * 100 : weighted;
        // Only zero-weighted groups have counted work — fall back to points.
    }
    let score = 0, pts = 0;
    for (const s of stats.values()) { score += s.score; pts += s.pts; }
    return pts > 0 ? (score / pts) * 100 : null;
}

// Total-row content for the hypothetical grade — clearly not the real
// grade: a purple Imagine-If badge and the hypothetical total (with letter)
// replace the percentage span, and an italic note under the "Total" label
// restates the real grade.
function gaImagineTotalHtml(pct) {
    const letter = gaLetterFor(pct);
    const pctText = pct == null || !isFinite(pct) ? "—" : pct.toFixed(1) + "%";
    // The wrapper is an inline-flex row with align-items:center so the
    // badge pill sits vertically centered with the grade text. No
    // flex-wrap: the narrow score cell would stack the items instead.
    return `<span style="display:inline-flex;align-items:center;gap:6px;">`
        + `<span style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:1px 6px;border-radius:999px;text-transform:uppercase;white-space:nowrap;">Imagine-If</span>`
        + `<span style="font-weight:700;color:#7c3aed;">${pctText}</span>`
        + (letter ? `<span style="color:#7c3aed;">(${letter})</span>` : "")
        + `</span>`;
}


// Overwrites (or restores) the table's Total row. Writes are guarded so the
// GA DOM observer never loops: the last written HTML is cached on the
// element and identical writes are skipped.
function gaApplyImagineTotal() {
    if (!gaImagineIf) { gaRestoreImagineTotal(); return; }
    gaIfUpdateGroupPcts();
    const span = gaFindTotalGradeSpan();
    if (!span) return;
    const html = gaImagineTotalHtml(gaComputeImagineTotal());
    if (!(span.dataset.gaImagine && span._gaImagineHtml === html)) {
        if (!span.dataset.gaImagine) gaOriginalFinalHtml = span.innerHTML;
        span.dataset.gaImagine = "1";
        span._gaImagineHtml = html;
        span.innerHTML = html;
    }
    // Italic note under the "Total" label restating the real grade.
    const th = gaFindTotalTitleCell();
    if (th) {
        let note = th.querySelector(".canvasrefined-ga-if-note");
        if (!note) {
            note = document.createElement("div");
            note.className = "canvasrefined-ga-if-note";
            note.style.cssText = "font-size:11px;font-style:italic;color:var(--bctext-1);margin-top:2px;";
            th.appendChild(note);
        }
        if (note.dataset.gaIfHtml !== "Imagine-If scenario; not your actual grade.") {
            note.dataset.gaIfHtml = "Imagine-If scenario; not your actual grade.";
            note.textContent = "Imagine-If scenario; not your actual grade.";
        }
    }
}

function gaRestoreImagineTotal() {
    const span = gaFindTotalGradeSpan();
    if (span && span.dataset.gaImagine) {
        delete span.dataset.gaImagine;
        delete span._gaImagineHtml;
        if (gaOriginalFinalHtml != null) span.innerHTML = gaOriginalFinalHtml;
    }
    document.querySelectorAll("#grades_summary tr.final_grade .canvasrefined-ga-if-note").forEach(n => n.remove());
}

// Compact inline styles for controls injected into the grades table.
// Canvas's table CSS gives selects/inputs an 11px bottom margin and a tall
// native select box, which made our rows taller than the page's own —
// margin:0 and a fixed select height keep the rows even.
const GA_IF_TD_INPUT = "box-sizing:border-box;padding:3px 6px;border-radius:5px;border:1px solid var(--bcborders);background:var(--bcbackground-1);color:var(--bctext-0);font-size:12px;margin:0;";
const GA_IF_TD_NUM = GA_IF_TD_INPUT + "width:58px;";
const GA_IF_TD_SEL = GA_IF_TD_INPUT + "max-width:170px;height:26px;padding:2px 4px;";
const GA_IF_TD_BTN = GA_IF_TD_INPUT + "cursor:pointer;white-space:nowrap;";

// <select> of the scenario's live groups for one assignment row. A group
// that was removed leaves its assignments on "— not counted —" until the
// user reassigns them.
function gaIfSelectHtml(gid) {
    const groups = gaScenario ? gaScenario.groups.filter(g => !g.deleted) : [];
    return `<select data-ga-if-groupsel title="Imagine-If assignment group" style="${GA_IF_TD_SEL}">`
        + `<option value="">— not counted —</option>`
        + groups.map(g => `<option value="${gaEscHtml(g.gid)}"${String(gid) === String(g.gid) ? " selected" : ""}>${gaEscHtml(g.name)}</option>`).join("")
        + `</select>`;
}

// Re-renders every group <select>'s options (e.g. after a group was added or
// removed), preserving the current selection when it still exists. Skips the
// select the user is interacting with.
function gaIfRefreshSelects(table) {
    for (const sel of table.querySelectorAll("select[data-ga-if-groupsel]")) {
        if (document.activeElement === sel) continue;
        const cur = sel.value;
        const groups = gaScenario ? gaScenario.groups.filter(g => !g.deleted) : [];
        sel.innerHTML = `<option value="">— not counted —</option>`
            + groups.map(g => `<option value="${gaEscHtml(g.gid)}"${String(cur) === String(g.gid) ? " selected" : ""}>${gaEscHtml(g.name)}</option>`).join("");
        sel.value = groups.some(g => String(g.gid) === cur) ? cur : "";
    }
}

// Icon-only remove button (✕) for a row's last cell.
function gaIfDelButton(attr, title) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute(attr, "");
    btn.title = title;
    btn.textContent = "✕";
    btn.style.cssText = GA_IF_TD_BTN + "padding:3px 8px;";
    return btn;
}

// Injects the scenario controls into one assignment row: score (numerator)
// and points possible (denominator) inputs replace the read-only "5 / 5"
// display in the score cell, a group <select> replaces the group-name
// context line under the title, and an icon-only remove button goes in the
// row's last cell.
function gaIfBuildAssignmentControls(tr, a) {
    if (tr.querySelector(".canvasrefined-ga-if-edit")) return;
    const scoreTd = tr.querySelector("td.assignment_score");
    if (!scoreTd) return;
    const tooltip = scoreTd.querySelector("span.tooltip");
    if (tooltip) { tooltip.style.display = "none"; tooltip.dataset.gaIfHidden = "1"; }
    const edit = document.createElement("span");
    edit.className = "canvasrefined-ga-if-edit";
    edit.style.cssText = "display:inline-flex;align-items:center;gap:4px;";
    edit.innerHTML = `<input data-ga-if-score type="number" step="any" placeholder="—" value="${a.score == null ? "" : a.score}" title="Imagine-If score (numerator); blank = not counted" style="${GA_IF_TD_NUM}">`
        + ` <span style="color:var(--bctext-1);">/</span> `
        + `<input data-ga-if-pts type="number" step="any" min="0" placeholder="—" value="${a.points == null ? "" : a.points}" title="Imagine-If points possible (denominator)" style="${GA_IF_TD_NUM}">`;
    (scoreTd.querySelector(".score_holder") || scoreTd).appendChild(edit);
    const th = tr.querySelector("th.title");
    const ctx = th?.querySelector("div.context");
    if (ctx) { ctx.style.display = "none"; ctx.dataset.gaIfHidden = "1"; }
    const ctl = document.createElement("div");
    ctl.className = "canvasrefined-ga-if-ctl";
    ctl.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;";
    ctl.innerHTML = gaIfSelectHtml(a.gid);
    (th || tr).appendChild(ctl);
    // Icon-only remove button in the row's last cell.
    const lastTd = tr.cells[tr.cells.length - 1];
    if (lastTd && !lastTd.querySelector("[data-ga-if-adel]")) {
        lastTd.appendChild(gaIfDelButton("data-ga-if-adel", "Remove this assignment from the scenario"));
    }
}

// Injects the scenario controls into one group-total row: a weight input in
// the score cell (next to the group percentage, which shows the hypothetical
// value — see gaIfUpdateGroupPcts) and an icon-only remove button in the
// row's last cell.
function gaIfBuildGroupControls(tr, g) {
    if (tr.querySelector(".canvasrefined-ga-if-edit")) return;
    const scoreTd = tr.querySelector("td.assignment_score");
    if (!scoreTd) return;
    const edit = document.createElement("span");
    edit.className = "canvasrefined-ga-if-edit";
    edit.style.cssText = "display:inline-flex;align-items:center;gap:4px;margin-left:8px;";
    edit.innerHTML = `<input data-ga-if-gweight type="number" min="0" max="100" step="0.1" value="${g.weight}" title="Imagine-If group weight (% of grade)" style="${GA_IF_TD_NUM}">`
        + ` <span style="color:var(--bctext-1);">%</span>`;
    (scoreTd.querySelector(".score_holder") || scoreTd).appendChild(edit);
    // Icon-only remove button in the row's last cell.
    const lastTd = tr.cells[tr.cells.length - 1];
    if (lastTd && !lastTd.querySelector("[data-ga-if-gdel]")) {
        lastTd.appendChild(gaIfDelButton("data-ga-if-gdel", "Remove this group from the scenario (its assignments stop counting until reassigned)"));
    }
}

// A brand-new assignment row (user-added): same 8-cell shape as the page's
// own rows, with an editable title. Custom class only — never
// "student_assignment", so the table signature and the page parsers ignore
// our rows.
function gaIfMakeAssignmentRow(a) {
    const tr = document.createElement("tr");
    tr.className = "canvasrefined-ga-if-newrow";
    tr.innerHTML = `
        <th class="title" scope="row"><input data-ga-if-title type="text" value="${gaEscHtml(a.title)}" title="Assignment name" style="${GA_IF_TD_INPUT}width:100%;max-width:260px;"></th>
        <td class="due"></td><td class="submitted"></td><td class="status"></td>
        <td class="assignment_score"><div class="score_holder" style="position:relative;"></div></td>
        <td class="asset_processors_cell"></td><td class="details"></td><td></td>`;
    // Row separators matching the page's own rows. Two things make this
    // subtle: the dark-mode CSS paints every .ic-Table td border dark with
    // !important (which beats a normal inline style), and in the
    // collapsed-borders model CELL borders beat ROW borders — so the
    // separator must be set on the cells, with !important (an inline
    // !important beats the stylesheet's), to win the edge conflicts and
    // paint the white line the custom background shows on real rows.
    for (const cell of tr.cells) {
        cell.style.setProperty("border-top", "1px solid var(--bctext-1,#e2e2e2)", "important");
        cell.style.setProperty("border-bottom", "1px solid var(--bctext-1,#e2e2e2)", "important");
    }
    return tr;
}

// A brand-new group-total row (user-added), with an editable name.
function gaIfMakeGroupRow(g) {
    const tr = document.createElement("tr");
    tr.className = "canvasrefined-ga-if-newrow";
    tr.innerHTML = `
        <th class="title" scope="row"><input data-ga-if-gname type="text" value="${gaEscHtml(g.name)}" title="Group name" style="${GA_IF_TD_INPUT}width:100%;max-width:260px;"></th>
        <td class="due"></td><td class="submitted"></td><td class="status"></td>
        <td class="assignment_score"><div class="score_holder" style="position:relative;"><span class="tooltip"><span class="grade">—</span></span></div></td>
        <td class="asset_processors_cell"></td><td class="details"></td><td></td>`;
    // Same cell-level separators as gaIfMakeAssignmentRow.
    for (const cell of tr.cells) {
        cell.style.setProperty("border-top", "1px solid var(--bctext-1,#e2e2e2)", "important");
        cell.style.setProperty("border-bottom", "1px solid var(--bctext-1,#e2e2e2)", "important");
    }
    return tr;
}

// New assignments go right below the table header, above the first real
// assignment (stacking in add order).
function gaIfInsertAssignmentRow(table, tr) {
    const lastNew = [...table.querySelectorAll("tr.canvasrefined-ga-if-newrow[data-ga-if-key]")].pop();
    if (lastNew) { lastNew.after(tr); return; }
    const firstReal = [...table.querySelectorAll("tr.student_assignment")]
        .find(r => !r.classList.contains("group_total") && !r.classList.contains("final_grade"));
    if (firstReal) { firstReal.before(tr); return; }
    (table.querySelector("tr.group_total") || table.querySelector("tr.final_grade") || table.lastElementChild).before(tr);
}

function gaIfInsertGroupRow(table, tr) {
    const lastNew = [...table.querySelectorAll("tr.canvasrefined-ga-if-newrow[data-ga-if-gid]")].pop();
    const lastReal = [...table.querySelectorAll("tr.group_total")].pop();
    (lastNew || lastReal || table.querySelector("tr.final_grade") || table.lastElementChild).after(tr);
}

// The "+ Add assignment" button sits on its own row at the top of the
// table — right below the header, above the first (or first user-added)
// assignment — so new assignments are created right where they appear.
function gaIfEnsureAddAssignmentRow(table) {
    if (table.querySelector("#canvasrefined-ga-if-add-asg")) return;
    const tr = document.createElement("tr");
    tr.className = "canvasrefined-ga-if-addrow";
    tr.innerHTML = `<td colspan="8" style="border:none!important;padding:6px 8px;">`
        + `<button type="button" id="canvasrefined-ga-if-add-asg" style="${GA_IF_TD_BTN}padding:4px 10px;">+ Add assignment</button>`
        + `</td>`;
    const firstNew = table.querySelector("tr.canvasrefined-ga-if-newrow[data-ga-if-key]");
    const firstReal = [...table.querySelectorAll("tr.student_assignment")]
        .find(r => !r.classList.contains("group_total") && !r.classList.contains("final_grade"));
    const anchor = firstNew || firstReal;
    if (anchor) anchor.before(tr);
    else (table.querySelector("tr.group_total") || table.querySelector("tr.final_grade") || table.lastElementChild).before(tr);
}

// The "+ Add group" button sits on its own row right above the table's
// Total row, where the group totals live.
function gaIfEnsureAddGroupRow(table) {
    if (table.querySelector("#canvasrefined-ga-if-add-group")) return;
    const tr = document.createElement("tr");
    tr.className = "canvasrefined-ga-if-addrow";
    tr.innerHTML = `<td colspan="8" style="border:none!important;padding:10px 8px;">`
        + `<button type="button" id="canvasrefined-ga-if-add-group" style="${GA_IF_TD_BTN}padding:6px 12px;">+ Add group</button>`
        + `</td>`;
    (table.querySelector("tr.final_grade") || table.lastElementChild).before(tr);
}

// Rewrites each group row's percentage to the hypothetical value for the
// current scenario (original text is stashed for restore). A dash means the
// group has no counted work.
function gaIfUpdateGroupPcts() {
    const table = document.querySelector("#grades_summary");
    if (!table || !gaScenario) return;
    const stats = new Map();
    for (const a of gaScenario.assignments) {
        if (a.deleted || a.score == null || !(a.points > 0)) continue;
        if (!gaScenario.groups.some(g => !g.deleted && String(g.gid) === String(a.gid))) continue;
        const s = stats.get(String(a.gid)) || { score: 0, pts: 0 };
        s.score += a.score;
        s.pts += a.points;
        stats.set(String(a.gid), s);
    }
    for (const tr of table.querySelectorAll("tr[data-ga-if-gid]")) {
        const gradeEl = tr.querySelector("td.assignment_score .tooltip .grade");
        if (!gradeEl) continue;
        if (gradeEl.dataset.gaIfOrig == null) gradeEl.dataset.gaIfOrig = gradeEl.textContent;
        const s = stats.get(String(tr.dataset.gaIfGid));
        const txt = s && s.pts > 0 ? ((s.score / s.pts) * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : "—";
        if (gradeEl.textContent !== txt) gradeEl.textContent = txt;
    }
}

// Removes every trace of the inline UI: injected controls and rows, hidden
// originals, hidden deleted rows, and the rewritten group percentages.
function gaClearImagineUI(table) {
    table = table || document.querySelector("#grades_summary");
    if (!table) return;
    delete table.dataset.gaIfUi;
    delete table.dataset.gaIfBuilt;
    table.querySelectorAll(".canvasrefined-ga-if-edit, .canvasrefined-ga-if-ctl, tr.canvasrefined-ga-if-newrow, tr.canvasrefined-ga-if-addrow").forEach(el => el.remove());
    table.querySelectorAll("[data-ga-if-hidden]").forEach(el => { el.style.display = ""; delete el.dataset.gaIfHidden; });
    table.querySelectorAll(".grade[data-ga-if-orig]").forEach(el => { el.textContent = el.dataset.gaIfOrig; delete el.dataset.gaIfOrig; });
    table.querySelectorAll("tr[data-ga-if-deleted]").forEach(tr => { tr.style.display = ""; delete tr.dataset.gaIfDeleted; });
    table.querySelectorAll("tr[data-ga-if-key], tr[data-ga-if-gid]").forEach(tr => { delete tr.dataset.gaIfKey; delete tr.dataset.gaIfGid; });
}

// One delegated listener set on the grades table handles every scenario
// edit, so rows can be injected/rebuilt freely without detaching handlers.
function gaIfBindTable(table) {
    if (table.dataset.gaIfBound) return;
    table.dataset.gaIfBound = "1";
    table.addEventListener("input", e => {
        if (!gaScenario || !gaImagineIf) return;
        const t = e.target;
        const tr = t.closest("tr");
        if (!tr) return;
        if (t.matches("[data-ga-if-score],[data-ga-if-pts],[data-ga-if-title]")) {
            const a = gaScenario.assignments.find(x => String(x.key) === String(tr.dataset.gaIfKey));
            if (!a) return;
            if (t.matches("[data-ga-if-title]")) a.title = t.value;
            else if (t.matches("[data-ga-if-score]")) { const v = parseFloat(t.value); a.score = t.value.trim() !== "" && isFinite(v) ? v : null; }
            else { const v = parseFloat(t.value); a.points = t.value.trim() !== "" && isFinite(v) ? v : null; }
            gaApplyImagineTotal();
        } else if (t.matches("[data-ga-if-gname],[data-ga-if-gweight]")) {
            const g = gaScenario.groups.find(x => String(x.gid) === String(tr.dataset.gaIfGid));
            if (!g) return;
            if (t.matches("[data-ga-if-gname]")) g.name = t.value;
            else { const w = parseFloat(t.value); g.weight = isFinite(w) ? w : 0; }
            gaApplyImagineTotal();
        }
    });
    table.addEventListener("change", e => {
        if (!gaScenario || !gaImagineIf) return;
        const t = e.target;
        if (!t.matches("select[data-ga-if-groupsel]")) return;
        const tr = t.closest("tr");
        const a = gaScenario.assignments.find(x => String(x.key) === String(tr?.dataset.gaIfKey));
        if (a) { a.gid = t.value; gaApplyImagineTotal(); }
    });
    table.addEventListener("click", e => {
        if (!gaScenario || !gaImagineIf) return;
        const btn = e.target.closest("button");
        if (!btn) return;
        const table = btn.closest("table") || document.querySelector("#grades_summary");
        if (btn.matches("[data-ga-if-adel]")) {
            const tr = btn.closest("tr");
            const a = gaScenario.assignments.find(x => String(x.key) === String(tr.dataset.gaIfKey));
            if (!a) return;
            a.deleted = true;
            if (a._new) tr.remove();
            else { tr.style.display = "none"; tr.dataset.gaIfDeleted = "1"; }
            gaApplyImagineTotal();
        } else if (btn.matches("[data-ga-if-gdel]")) {
            const tr = btn.closest("tr");
            const g = gaScenario.groups.find(x => String(x.gid) === String(tr.dataset.gaIfGid));
            if (!g) return;
            g.deleted = true;
            if (g._new) tr.remove();
            else { tr.style.display = "none"; tr.dataset.gaIfDeleted = "1"; }
            gaIfRefreshSelects(table);
            gaApplyImagineTotal();
        } else if (btn.id === "canvasrefined-ga-if-add-asg") {
            const groups = gaScenario.groups.filter(g => !g.deleted);
            const a = { key: "new-asg-" + (++gaIfCounter), title: "New assignment", score: null, points: 100, gid: groups[0] ? String(groups[0].gid) : "", _new: true };
            gaScenario.assignments.push(a);
            const tr = gaIfMakeAssignmentRow(a);
            gaIfInsertAssignmentRow(table, tr);
            tr.dataset.gaIfKey = a.key;
            gaIfBuildAssignmentControls(tr, a);
            tr.scrollIntoView({ block: "nearest" });
            tr.querySelector("[data-ga-if-title]")?.focus();
            gaApplyImagineTotal();
        } else if (btn.id === "canvasrefined-ga-if-add-group") {
            const g = { gid: "new-group-" + (++gaIfCounter), name: "New group", weight: 0, _new: true };
            gaScenario.groups.push(g);
            const tr = gaIfMakeGroupRow(g);
            gaIfInsertGroupRow(table, tr);
            tr.dataset.gaIfGid = g.gid;
            gaIfBuildGroupControls(tr, g);
            gaIfRefreshSelects(table);
            tr.scrollIntoView({ block: "nearest" });
            tr.querySelector("[data-ga-if-gname]")?.focus();
            gaApplyImagineTotal();
        }
    });
}

// Builds the inline UI on the grades table itself. The scenario is rebuilt
// from the page when the table's rows change (grading-period switch, SPA
// navigation); otherwise the already-built UI is left alone so typing is
// never clobbered. If Canvas wiped our controls (row re-render), the built
// count no longer matches and the UI is rebuilt from the scenario.
function gaRenderImagineIf(force) {
    if (!gaImagineIf) return;
    const table = document.querySelector("#grades_summary");
    if (!table) return;
    const sig = gaImagineTableSig();
    if (!gaScenario || gaScenario.sig !== sig) {
        const sc = gaBuildImagineScenario();
        if (!sc) return; // table hasn't rendered yet; the DOM observer retries
        gaScenario = { sig, groups: sc.groups, assignments: sc.assignments };
        force = true;
    }
    if (!force
        && table.dataset.gaIfUi === sig
        && Number(table.dataset.gaIfBuilt || 0) === table.querySelectorAll("tr[data-ga-if-key]").length) return;
    gaClearImagineUI(table);
    table.dataset.gaIfUi = sig;
    gaIfBindTable(table);

    const rowById = new Map();
    for (const tr of table.querySelectorAll("tr.student_assignment")) {
        if (tr.classList.contains("group_total") || tr.classList.contains("final_grade")) continue;
        if (tr.id) rowById.set(tr.id, tr);
    }
    const groupRowByGid = new Map();
    for (const tr of table.querySelectorAll("tr.group_total")) {
        const gid = (tr.querySelector(".assignment_group_id")?.textContent || "").trim();
        if (gid) groupRowByGid.set(gid, tr);
    }

    let built = 0;
    for (const a of gaScenario.assignments) {
        let tr = a._new ? table.querySelector(`tr[data-ga-if-key="${CSS.escape(a.key)}"]`) : rowById.get(a.key);
        if (a.deleted) {
            if (tr) { tr.style.display = "none"; tr.dataset.gaIfDeleted = "1"; }
            continue;
        }
        if (!tr) {
            if (!a._new) continue; // the page row vanished — nothing to edit
            tr = gaIfMakeAssignmentRow(a);
            gaIfInsertAssignmentRow(table, tr);
        }
        tr.dataset.gaIfKey = a.key;
        gaIfBuildAssignmentControls(tr, a);
        built++;
    }
    for (const g of gaScenario.groups) {
        let tr = g._new ? table.querySelector(`tr[data-ga-if-gid="${CSS.escape(g.gid)}"]`) : groupRowByGid.get(g.gid);
        if (g.deleted) {
            if (tr) { tr.style.display = "none"; tr.dataset.gaIfDeleted = "1"; }
            continue;
        }
        if (!tr) {
            if (!g._new) continue;
            tr = gaIfMakeGroupRow(g);
            gaIfInsertGroupRow(table, tr);
        }
        tr.dataset.gaIfGid = g.gid;
        gaIfBuildGroupControls(tr, g);
    }
    gaIfEnsureAddAssignmentRow(table);
    gaIfEnsureAddGroupRow(table);
    table.dataset.gaIfBuilt = String(built);
    gaApplyImagineTotal();
}

// Enters/leaves the mode: builds/removes the inline table UI and
// overwrites/restores the sidebar Total block.
function gaEnterImagineIf() {
    gaRenderImagineIf();
    gaApplyImagineTotal();
}

function gaExitImagineIf() {
    gaClearImagineUI();
    gaRestoreImagineTotal();
}