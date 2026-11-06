/** TODO_tuna
 * Split this file into even smaller pieces.
 * Figure out if I accidentally included any unrelated functions.
 */

function convertToDueDate(dueAt) {
	final = "due ";
	let date = new Date(dueAt);
	final += date.toLocaleString("en-US", { month: "short", day: "numeric" });
	final += " at " + date.toLocaleString("en-US", { hour: "numeric", minute: "numeric", hour12: !options.todo_hr24 });
	return final;
}
function updateIndicator(element) {
	const indicator = document.getElementById("better-todo-indicator");
	indicator.style.width = `${element.offsetWidth*2}px`;
	indicator.style.left = `${element.offsetLeft - (element.offsetWidth * .5)}px`;

	const buttons = ["announcement", "assignments", "completed"];
	buttons.forEach(button => {
		const btn = document.getElementById(`better-todo-${button}`);
		if (btn == element) {
			btn.firstElementChild.style.opacity = "1";
			// btn.style.filter = "none";
		}
		else {
			btn.firstElementChild.style.opacity = ".5";
			// btn.style.filter = "grayscale(100%)";
		}
	})

}
// better todo html
betterTodoFilter = "tasks";
// Timeframe filter for the upcoming Tasks tab. "all" = no limit; otherwise
// items are limited to those due on/before now+range (which also keeps
// overdue items). Only affects the Tasks (upcoming) tab; announcements and
// completed are unaffected because their dates are in the past.
let betterTodoTimeframe = "all";
const BETTER_TODO_TIMEFRAME_DAYS = {
	"1week": 7,
	"2week": 14,
	"month": 30,
	"2month": 60,
};
// Look-ahead paging for the timeframe window (arrow buttons under the Tasks
// header). 0 = the current window (now through the timeframe cutoff, with
// overdue items kept). Each press of the right arrow advances one full
// window further out, e.g. a 1-week timeframe on offset 1 shows only items
// due in week 2 (the current week is skipped over).
let betterTodoTimeframeOffset = 0;
// null = show every class; a string courseId = only that class's tasks.
let betterTodoProgressFilter = null;
let domContainers = {};

// Resolve the persisted todo_timeframe option to a valid key ("all" when
// unset/unknown).
function getTodoTimeframeKey() {
    return (options.todo_timeframe && Object.prototype.hasOwnProperty.call(BETTER_TODO_TIMEFRAME_DAYS, options.todo_timeframe)) ? options.todo_timeframe : "all";
}

// Better Todo timeframe filter, shared by the task list and the progress
// display so their counts always agree: keeps items due inside the current
// window. Offset 0 keeps everything on/before now+range (overdue items are
// before now, so they are kept too); offset N>0 shows only the window
// (now+N*range, now+(N+1)*range] so the current timeframe can be paged
// through with the look-ahead arrows. "all" keeps everything.
function applyTodoTimeframe(items) {
    betterTodoTimeframe = getTodoTimeframeKey();
    if (betterTodoTimeframe === "all") return items;
    const days = BETTER_TODO_TIMEFRAME_DAYS[betterTodoTimeframe];
    const now = Date.now();
    const cutoff = now + ((betterTodoTimeframeOffset + 1) * days * 24 * 60 * 60 * 1000);
    if (betterTodoTimeframeOffset <= 0) {
        return items.filter(item => new Date(item.plannable_date).getTime() <= cutoff);
    }
    const windowStart = now + (betterTodoTimeframeOffset * days * 24 * 60 * 60 * 1000);
    return items.filter(item => {
        const t = new Date(item.plannable_date).getTime();
        return t > windowStart && t <= cutoff;
    });
}

// Date range for the timeframe pager under the Tasks header. The offset is
// measured in full windows from now, so the dates shown are the exact slice
// of items the list is currently filtered to.
function getTodoTimeframeWindow() {
    const tf = getTodoTimeframeKey();
    const days = tf === "all" ? 0 : BETTER_TODO_TIMEFRAME_DAYS[tf];
    const offset = (tf === "all") ? 0 : betterTodoTimeframeOffset;
    const now = Date.now();
    const start = new Date(now + (offset * days * 24 * 60 * 60 * 1000));
    const end = new Date(now + ((offset + 1) * days * 24 * 60 * 60 * 1000));
    const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return { tf, range: fmt(start) + " \u2013 " + fmt(end) };
}

// Refresh the timeframe pager (arrows under the Tasks header) after every
// render: update its label/date range, disable the back arrow on the
// current window, and hide it entirely when there is no window to page
// ("all") or when a non-Tasks tab is showing.
function updateTodoTimeframeNav() {
    const nav = document.getElementById("better-todo-timeframe-nav");
    if (!nav) return;
    const tfWindow = getTodoTimeframeWindow();
    const paged = tfWindow.tf !== "all" && betterTodoFilter === "tasks";
    nav.style.display = paged ? "flex" : "none";
    if (!paged) return;
    const label = nav.querySelector("#better-todo-timeframe-label");
    if (label) label.textContent = tfWindow.range;
    const prev = nav.querySelector("#better-todo-timeframe-prev");
    if (prev) {
        const canPrev = betterTodoTimeframeOffset > 0;
        prev.disabled = !canPrev;
        prev.style.opacity = canPrev ? "1" : ".3";
        prev.style.cursor = canPrev ? "pointer" : "default";
    }
}

// true when `courseId` is the dimmed-out class because another class is selected.
function progressFilterDim(courseId) {
    return betterTodoProgressFilter != null && String(courseId) !== String(betterTodoProgressFilter);
}
// Canvas serves gradable work as several plannable types: assignments, quizzes,
// and graded discussions (plus extension-created planner notes/custom tasks).
// All of these are "tasks" for the Better Todo list; announcements are
// handled separately.
function isTodoTaskType(item) {
    return item.plannable_type == "assignment"
        || item.plannable_type == "planner_note"
        || item.plannable_type == "quiz"
        || item.plannable_type == "discussion_topic";
}

// Make an element filter the todo list to one class on click. A no-op on
// course pages (where only one class is in scope anyway); toggles off when the
// active class is clicked again.
function attachProgressFilterClick(el, courseId) {
    if (getCurrentCourseId() != null) { el.style.cursor = ''; el.onclick = null; return; }
    el.style.cursor = 'pointer';
    el.onclick = () => {
        betterTodoProgressFilter = (String(betterTodoProgressFilter) === String(courseId)) ? null : String(courseId);
        const loc = document.querySelector("#canvasrefined-todo-list");
        if (loc) { clearTodoList(); createTodoSections(loc); }
    };
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatTimeForInput(date) {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
}

/* Progress display mode, stored in options.todo_progress_rings.
   Modes: "none", "rings", "rainbow", "lines", "line".
   Legacy booleans normalize: true/undefined -> rings, false -> none. */
function getProgressRingMode() {
    const v = options.todo_progress_rings;
    if (v === false) return "none";
    if (v === true || v === undefined || v === null) return "rings";
    const allowed = ["none", "rings", "rainbow", "lines", "line"];
    if (allowed.includes(v)) return v;
    // migrate unreleased string values from the prior experimental set
    if (v === "per_course") return "rings";
    if (v === "combined" || v === "segmented") return "line";
    return "rings";
}

function progressRingsEnabled() {
    return getProgressRingMode() !== "none";
}

function courseRingColor(courseId, idx) {
    return options.custom_cards_3?.[String(courseId)]?.color
        || options.custom_cards_3?.[courseId]?.color
        || `hsl(${(idx * 60) % 360} 70% 50%)`;
}

function courseRingLabel(courseId) {
    const card = options.custom_cards?.[String(courseId)] || options.custom_cards?.[courseId];
    return card?.default || `Course ${courseId}`;
}

// Planner items for courses the user has hidden from their dashboard should
// not appear in the Better Todo list or its progress display. Personal
// tasks (planner notes with no course) are always kept.
function isCourseHidden(courseId) {
    if (courseId === undefined || courseId === null) return false;
    const cards = options.custom_cards || {};
    const card = cards[String(courseId)] || cards[courseId];
    return !!card && card.hidden === true;
}

function filterHiddenCourses(data) {
    return data.filter(item => {
        const cid = item.course_id || item.context_id || item?.plannable?.course_id;
        return !isCourseHidden(cid);
    });
}

// Build scoped data for the Better Todo list: drop hidden courses, then (on
// a course page) restrict to the current course.
function getTodoScopedData(data, courseId) {
    const visible = filterHiddenCourses(data);
    if (!courseId) return visible;
    return visible.filter(item => {
        const itemCourseId = parseInt(item.course_id || item.context_id || item?.plannable?.course_id);
        return itemCourseId === courseId;
    });
}

// Returns a Map of courseId (string) -> dashboard position index, read from
// the live dashboard card DOM order. Empty when not on the dashboard. Used
// to order the progress display the same way the user ordered their cards.
function getDashboardCourseOrder() {
    const order = new Map();
    document.querySelectorAll('.ic-DashboardCard').forEach((card, idx) => {
        const id = getCardId(card);
        if (id && id !== -1 && !order.has(String(id))) order.set(String(id), idx);
    });
    return order;
}

// Keep the centered % / count text clear of the progress graphics (the rings'
// center hole and the rainbow's bowl). The text block is measured after each
// render; if it would cross into the strokes its fonts are scaled down, and
// when the hole is really tight the count line is dropped before the % is
// allowed to shrink below readable size. Font sizes reset to the defaults on
// every render so the text grows back when there is room again.
// `neededRadius(hw, hh)` returns the distance from the hole's center to the
// farthest text corner; the text fits when that is <= availableRadius.
function fitProgressOverlayText(overlay, neededRadius, availableRadius) {
    const textWrap = overlay?.firstElementChild;
    const pct = overlay?.querySelector('.canvasrefined-progress-percent');
    const cnt = overlay?.querySelector('.canvasrefined-progress-count');
    if (!textWrap || !pct || !cnt || textWrap === pct || textWrap === cnt) return;
    // Undo any shrink applied by a previous render before measuring (these
    // are the default sizes the overlays are created with).
    pct.style.fontSize = '20px';
    cnt.style.fontSize = '12px';
    cnt.style.display = '';
    if (!availableRadius || availableRadius <= 0) return;
    let w = textWrap.offsetWidth;
    let h = textWrap.offsetHeight;
    if (!w || !h) return;
    let needed = neededRadius(w / 2, h / 2);
    if (needed <= availableRadius) return;
    let scale = availableRadius / needed;
    if (20 * scale < 11) {
        // Too tight for both lines: drop the count and re-fit the % alone.
        cnt.style.display = 'none';
        w = textWrap.offsetWidth;
        h = textWrap.offsetHeight;
        needed = neededRadius(w / 2, h / 2);
        if (needed <= availableRadius) return;
        scale = availableRadius / needed;
    }
    pct.style.fontSize = `${Math.max(10, Math.round(20 * scale))}px`;
    if (cnt.style.display !== 'none') cnt.style.fontSize = `${Math.max(9, Math.round(12 * scale))}px`;
    // Final safety: if the readable-size floors above still don't fit, drop
    // the count line so the % is guaranteed to clear the strokes.
    if (neededRadius(textWrap.offsetWidth / 2, textWrap.offsetHeight / 2) > availableRadius) {
        cnt.style.display = 'none';
    }
}

// Mode "rings": concentric rings, one per course, each filled by completion.
function renderProgressRingsMode(wrapper, shown, totalAll, completedAll, percent) {
    const containerWidth = wrapper.clientWidth || 240;
    const size = Math.min(280, Math.floor(containerWidth * 0.99));
    const cx = size / 2;
    const cy = size / 2;
    const padding = 2;
    const outerRadius = Math.floor((size / 2) - padding);

    let svg = wrapper.querySelector('svg.canvasrefined-progress-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'canvasrefined-progress-svg');
        svg.style.display = 'block';
        wrapper.appendChild(svg);
    }
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

    let overlay = wrapper.querySelector('.canvasrefined-progress-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'canvasrefined-progress-overlay';
        overlay.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;pointer-events:none;';
        const textWrap = document.createElement('div');
        textWrap.style.cssText = 'text-align:center;color:var(--bctext-0);';
        textWrap.innerHTML = `<div class='canvasrefined-progress-percent' style='font-weight:700;font-size:20px;line-height:1;'></div><div class='canvasrefined-progress-count' style='font-size:12px;margin-top:4px;'></div>`;
        overlay.appendChild(textWrap);
        wrapper.appendChild(overlay);
    }
    overlay.querySelector('.canvasrefined-progress-percent').textContent = `${percent}%`;
    overlay.querySelector('.canvasrefined-progress-count').textContent = `${completedAll}/${totalAll} done`;

    const stroke = 8;
    const gap = 4;
    const decrement = stroke + gap;
    const ringCount = shown.length;
    const startRadius = outerRadius - stroke / 2;
    // Keep the center hole big enough for the % / count text so the numbers
    // never sit on top of the ring strokes (fitProgressOverlayText shrinks the
    // text as a safety net for unusually wide labels).
    const minCenterRadius = 44;
    const requiredSpace = (ringCount - 1) * decrement + stroke / 2 + minCenterRadius;
    let adjustFactor = 1;
    if (requiredSpace > startRadius) {
        adjustFactor = (startRadius - minCenterRadius - stroke / 2) / Math.max(1, (ringCount - 1) * decrement);
    }

    let innerEdge = startRadius - stroke / 2;
    shown.forEach((entry, idx) => {
        const radius = startRadius - idx * Math.max(1, Math.floor(decrement * adjustFactor));
        if (radius <= 0) return;
        innerEdge = Math.min(innerEdge, radius - stroke / 2);
        const circumference = 2 * Math.PI * radius;
        const prog = entry.total === 0 ? 0 : entry.completed / entry.total;
        const color = courseRingColor(entry.courseId, idx);

        let bg = svg.querySelector(`circle[data-idx='${idx}'][data-role='bg']`);
        if (!bg) {
            bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bg.setAttribute('data-idx', String(idx));
            bg.setAttribute('data-role', 'bg');
            bg.classList.add('canvasrefined-ring-bg');
            svg.appendChild(bg);
        }
        bg.setAttribute('cx', String(cx));
        bg.setAttribute('cy', String(cy));
        bg.setAttribute('r', String(radius));
        bg.setAttribute('stroke', color);
        bg.setAttribute('stroke-opacity', '0.25');
        bg.setAttribute('stroke-width', String(stroke));
        bg.setAttribute('fill', 'none');
        bg.removeAttribute('stroke-dasharray');
        bg.removeAttribute('stroke-dashoffset');
        bg.removeAttribute('transform');

        let fg = svg.querySelector(`circle[data-idx='${idx}'][data-role='fg']`);
        const dasharrayVal = circumference.toFixed(3);
        const target = (circumference * (1 - prog)).toFixed(3);
        if (!fg) {
            fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            fg.setAttribute('data-idx', String(idx));
            fg.setAttribute('data-role', 'fg');
            fg.classList.add('canvasrefined-progress-ring');
            fg.setAttribute('stroke-linecap', 'round');
            fg.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
            fg.setAttribute('stroke-dasharray', dasharrayVal);
            fg.setAttribute('stroke-dashoffset', dasharrayVal); // start empty
            fg.style.transition = 'stroke-dashoffset .8s cubic-bezier(.2,.9,.2,1), opacity .3s ease';
            svg.appendChild(fg);
        }
        fg.setAttribute('cx', String(cx));
        fg.setAttribute('cy', String(cy));
        fg.setAttribute('r', String(radius));
        fg.setAttribute('stroke', color);
        fg.setAttribute('stroke-width', String(stroke));
        fg.setAttribute('fill', 'none');
        fg.setAttribute('stroke-dasharray', dasharrayVal);
        const dim = progressFilterDim(entry.courseId);
        bg.style.transition = 'opacity .3s ease';
        bg.style.opacity = dim ? '0.25' : '';
        fg.style.opacity = dim ? '0.3' : '';
        requestAnimationFrame(() => requestAnimationFrame(() => fg.setAttribute('stroke-dashoffset', target)));
        // transparent hit band on top so the whole ring is easy to click;
        // width tracks the ring spacing so adjacent bands don't overlap.
        const step = Math.max(1, Math.floor(decrement * adjustFactor));
        let hit = svg.querySelector(`circle[data-idx='${idx}'][data-role='hit']`);
        if (!hit) {
            hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            hit.setAttribute('data-idx', String(idx));
            hit.setAttribute('data-role', 'hit');
            hit.setAttribute('fill', 'none');
            hit.setAttribute('stroke', 'transparent');
            hit.setAttribute('pointer-events', 'stroke');
            svg.appendChild(hit);
        }
        hit.setAttribute('cx', String(cx));
        hit.setAttribute('cy', String(cy));
        hit.setAttribute('r', String(radius));
        hit.setAttribute('stroke-width', String(Math.max(stroke, step)));
        attachProgressFilterClick(hit, entry.courseId);
        hit.onmouseenter = () => { bg.style.opacity = '0.8'; fg.style.opacity = '0.8'; };
        hit.onmouseleave = () => {
            const d = progressFilterDim(entry.courseId);
            bg.style.opacity = d ? '0.25' : '';
            fg.style.opacity = d ? '0.3' : '';
        };
    });

    // Shrink the % / count text if it would reach the innermost ring.
    fitProgressOverlayText(overlay, (hw, hh) => Math.hypot(hw, hh), Math.max(0, innerEdge - 2));

    const maxIdx = shown.length - 1;
    svg.querySelectorAll('circle').forEach(c => {
        const idx = parseInt(c.getAttribute('data-idx'));
        if (Number.isNaN(idx) || idx > maxIdx) c.remove();
    });
}

// Mode "rainbow": like "rings" (one arc per class) but condensed into a top
// half-circle and colored with a rainbow palette instead of course colors.
function renderProgressRainbow(wrapper, shown, totalAll, completedAll, percent) {
    const containerWidth = wrapper.clientWidth || 240;
    const size = Math.min(280, Math.floor(containerWidth * 0.99));
    const cx = size / 2;
    const stroke = 8;
    const gap = 4;
    const decrement = stroke + gap;
    const ringCount = shown.length;
    const pad = 2;
    const outerRadius = Math.max(20, Math.floor(size / 2) - stroke / 2 - pad);
    // diameter line; arcs bulge UPWARD from here (into y < baseY)
    const baseY = outerRadius + stroke / 2 + pad;
    const svgHeight = Math.ceil(baseY + stroke / 2 + 2);

    let svg = wrapper.querySelector('svg.canvasrefined-progress-svg');
    if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'canvasrefined-progress-svg');
        svg.style.display = 'block';
        wrapper.appendChild(svg);
    }
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(svgHeight));
    svg.setAttribute('viewBox', `0 0 ${size} ${svgHeight}`);

    // shrink spacing if too many classes would overflow the inner radius;
    // keep the inner bowl big enough for the % / count text so the numbers
    // never sit on top of the arcs (fitProgressOverlayText shrinks the text
    // as a safety net for unusually wide labels).
    const minInnerRadius = 56;
    const requiredSpace = (ringCount - 1) * decrement;
    let adjustFactor = 1;
    if (requiredSpace > outerRadius - minInnerRadius) {
        adjustFactor = (outerRadius - minInnerRadius) / Math.max(1, (ringCount - 1) * decrement);
    }

    shown.forEach((entry, idx) => {
        const radius = outerRadius - idx * Math.max(1, Math.floor(decrement * adjustFactor));
        if (radius <= 0) return;
        // sweep-flag 1 => arc bulges UPWARD (top semicircle), drawn left -> right
        const arcPath = `M ${cx - radius} ${baseY} A ${radius} ${radius} 0 0 1 ${cx + radius} ${baseY}`;
        const prog = entry.total === 0 ? 0 : entry.completed / entry.total;
        const color = courseRingColor(entry.courseId, idx);

        // track: full semicircle, faded class color
        let track = svg.querySelector(`path[data-idx='${idx}'][data-role='bg']`);
        if (!track) {
            track = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            track.setAttribute('data-idx', String(idx));
            track.setAttribute('data-role', 'bg');
            track.setAttribute('fill', 'none');
            track.setAttribute('stroke-linecap', 'round');
            svg.appendChild(track);
        }
        track.setAttribute('d', arcPath);
        track.setAttribute('stroke', color);
        track.setAttribute('stroke-opacity', '0.25');
        track.setAttribute('stroke-width', String(stroke));
        track.removeAttribute('stroke-dasharray');
        track.removeAttribute('stroke-dashoffset');

        // progress arc: completed portion drawn from the left, via pathLength=100
        let progArc = svg.querySelector(`path[data-idx='${idx}'][data-role='fg']`);
        const targetOff = (100 * (1 - prog)).toFixed(3);
        if (!progArc) {
            progArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            progArc.setAttribute('data-idx', String(idx));
            progArc.setAttribute('data-role', 'fg');
            progArc.setAttribute('fill', 'none');
            progArc.setAttribute('stroke-linecap', 'round');
            progArc.setAttribute('pathLength', '100');
            progArc.setAttribute('stroke-dasharray', '100 100');
            progArc.setAttribute('stroke-dashoffset', '100'); // start empty
            progArc.style.transition = 'stroke-dashoffset .8s cubic-bezier(.2,.9,.2,1), opacity .3s ease';
            svg.appendChild(progArc);
        }
        progArc.setAttribute('d', arcPath);
        progArc.setAttribute('stroke', color);
        progArc.setAttribute('stroke-width', String(stroke));
        progArc.setAttribute('stroke-dasharray', '100 100');
        const dim = progressFilterDim(entry.courseId);
        track.style.transition = 'opacity .3s ease';
        track.style.opacity = dim ? '0.25' : '';
        progArc.style.opacity = dim ? '0.3' : '';
        requestAnimationFrame(() => requestAnimationFrame(() => progArc.setAttribute('stroke-dashoffset', targetOff)));
        // transparent hit arc on top so the whole arc is easy to click.
        let hit = svg.querySelector(`path[data-idx='${idx}'][data-role='hit']`);
        if (!hit) {
            hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            hit.setAttribute('data-idx', String(idx));
            hit.setAttribute('data-role', 'hit');
            hit.setAttribute('fill', 'none');
            hit.setAttribute('stroke', 'transparent');
            hit.setAttribute('stroke-linecap', 'round');
            hit.setAttribute('pointer-events', 'stroke');
            svg.appendChild(hit);
        }
        hit.setAttribute('d', arcPath);
        hit.setAttribute('stroke-width', String(stroke + 6));
        attachProgressFilterClick(hit, entry.courseId);
        hit.onmouseenter = () => { track.style.opacity = '0.8'; progArc.style.opacity = '0.8'; };
        hit.onmouseleave = () => {
            const d = progressFilterDim(entry.courseId);
            track.style.opacity = d ? '0.25' : '';
            progArc.style.opacity = d ? '0.3' : '';
        };
    });

    // drop arcs for classes no longer shown
    const maxIdx = shown.length - 1;
    svg.querySelectorAll('path').forEach(p => {
        const idx = parseInt(p.getAttribute('data-idx'));
        if (Number.isNaN(idx) || idx > maxIdx) p.remove();
    });

    // Overlay the percent/count text INSIDE the rainbow's semicircle hole
    // (the empty bowl bounded by the INNERMOST arc) instead of beneath it or
    // up among the arcs. The SVG is centered in the wrapper, so an absolutely-
    // positioned overlay covering the wrapper with flex centering aligns the
    // text to the SVG's horizontal center. Vertically we target the centroid of
    // the innermost semicircle (a touch above the diameter line) so the text
    // sits in the arc-free pocket near the bottom rather than near the apexes
    // of the inner arcs, where it would overlap the rainbow strokes.
    const step = Math.max(1, Math.floor(decrement * adjustFactor));
    const innerRadius = ringCount > 0 ? Math.max(1, outerRadius - (ringCount - 1) * step) : outerRadius;
    const holeCenterY = baseY - (4 * innerRadius) / (3 * Math.PI) + 6;
    const nudge = Math.round(holeCenterY - svgHeight / 2);
    let overlay = wrapper.querySelector('.canvasrefined-progress-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'canvasrefined-progress-overlay';
        overlay.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;transform:translateY(${nudge}px);`;
        // Same textWrap structure as rings mode so fitProgressOverlayText
        // measures the whole percent+count block, not just one line.
        const textWrap = document.createElement('div');
        textWrap.style.cssText = 'text-align:center;color:var(--bctext-0);';
        textWrap.innerHTML = `<div class='canvasrefined-progress-percent' style='font-weight:700;font-size:20px;line-height:1;'></div><div class='canvasrefined-progress-count' style='font-size:12px;margin-top:3px;'></div>`;
        overlay.appendChild(textWrap);
        wrapper.appendChild(overlay);
    } else {
        overlay.style.transform = `translateY(${nudge}px)`;
    }
    overlay.querySelector('.canvasrefined-progress-percent').textContent = `${percent}%`;
    overlay.querySelector('.canvasrefined-progress-count').textContent = `${completedAll}/${totalAll} done`;

    // Shrink the % / count text if any corner would cross the innermost arc.
    // The text is centered at (cx, holeCenterY); the bowl is the semicircle
    // of innerRadius around (cx, baseY), so check the farthest text corner
    // against the bowl's inner edge.
    const bowlRadius = Math.max(0, innerRadius - stroke / 2 - 2);
    fitProgressOverlayText(overlay, (hw, hh) => {
        const dv = Math.max(
            Math.abs(baseY - holeCenterY + hh),
            Math.abs(baseY - holeCenterY - hh)
        );
        return Math.hypot(hw, dv);
    }, bowlRadius);
}

// Mode "lines": one horizontal bar per course, each with its own %.
function renderProgressLines(wrapper, shown) {
    let list = wrapper.querySelector('.canvasrefined-progress-lines');
    if (!list) {
        list = document.createElement('div');
        list.className = 'canvasrefined-progress-lines';
        list.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;box-sizing:border-box;';
        wrapper.appendChild(list);
    }
    while (list.children.length > shown.length) list.lastChild.remove();

    shown.forEach((entry, idx) => {
        const prog = entry.total === 0 ? 0 : entry.completed / entry.total;
        const pct = Math.round(prog * 100);
        const color = courseRingColor(entry.courseId, idx);

        let row = list.children[idx];
        if (!row) {
            row = document.createElement('div');
            row.className = 'canvasrefined-progress-line';
            row.style.cssText = 'display:flex;flex-direction:column;gap:3px;width:100%;';
            row.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;"><span class="cr-pl-label" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;"></span><span class="cr-pl-pct" style="flex-shrink:0;font-weight:600;color:var(--bctext-0);"></span></div><div style="position:relative;height:8px;border-radius:999px;overflow:hidden;"><div class="cr-pl-fill" style="height:100%;border-radius:999px;width:0%;transition:width .8s cubic-bezier(.2,.9,.2,1);"></div></div>`;
            list.appendChild(row);
        }
        const labelEl = row.querySelector('.cr-pl-label');
        labelEl.textContent = courseRingLabel(entry.courseId);
        labelEl.style.color = color;
        row.querySelector('.cr-pl-pct').textContent = `${pct}% (${entry.completed}/${entry.total})`;
        const track = row.children[1];
        track.style.background = `color-mix(in srgb, ${color} 25%, transparent)`;
        const fill = row.querySelector('.cr-pl-fill');
        fill.style.background = color;
        if (!fill.dataset.init) {
            fill.dataset.init = '1';
            requestAnimationFrame(() => requestAnimationFrame(() => fill.style.width = `${pct}%`));
        } else {
            fill.style.width = `${pct}%`;
        }
        row.style.transition = 'opacity .3s ease';
        row.style.opacity = progressFilterDim(entry.courseId) ? '0.4' : '';
        attachProgressFilterClick(row, entry.courseId);
        row.onmouseenter = () => { row.style.opacity = '0.8'; };
        row.onmouseleave = () => { row.style.opacity = progressFilterDim(entry.courseId) ? '0.4' : ''; };
    });
}

// Mode "line": one horizontal bar where each class's COMPLETED portion is packed
// to the left (full course color) and its UNCOMPLETED portion to the right
// (faded course color), with no gaps between segments. Overall % shown above.
function renderProgressOneLine(wrapper, shown, totalAll, completedAll, percent) {
    let box = wrapper.querySelector('.canvasrefined-progress-oneline');
    if (!box) {
        box = document.createElement('div');
        box.className = 'canvasrefined-progress-oneline';
        box.style.cssText = 'display:flex;flex-direction:column;gap:5px;width:100%;box-sizing:border-box;';
        wrapper.appendChild(box);
    }

    let head = box.querySelector('.cr-ol-head');
    if (!head) {
        head = document.createElement('div');
        head.className = 'cr-ol-head';
        head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--bctext-0);';
        head.innerHTML = `<span>Overall</span><span class="cr-ol-pct" style="font-weight:700;"></span>`;
        box.appendChild(head);
    }
    box.querySelector('.cr-ol-pct').textContent = `${percent}% (${completedAll}/${totalAll})`;
    // Clicking the "Overall" header clears the active class filter.
    if (getCurrentCourseId() == null) {
        head.style.cursor = betterTodoProgressFilter != null ? 'pointer' : '';
        head.onclick = () => {
            if (betterTodoProgressFilter == null) return;
            betterTodoProgressFilter = null;
            const loc = document.querySelector("#canvasrefined-todo-list");
            if (loc) { clearTodoList(); createTodoSections(loc); }
        };
    } else {
        head.style.cursor = '';
        head.onclick = null;
    }

    let bar = box.querySelector('.cr-ol-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'cr-ol-bar';
        // position:relative so absolutely-positioned segments anchor to it
        bar.style.cssText = 'position:relative;width:100%;height:14px;border-radius:999px;overflow:hidden;background:var(--bcbackground-1);';
        box.appendChild(bar);
    }

    // Build the segment list left -> right: ALL completed blocks first (each
    // class's full course color), then ALL remaining blocks (each class's faded
    // course color). This keeps every completed segment on the left and every
    // remaining segment on the right. Consecutive segments share edges, so
    // there are no gaps between them.
    const segs = [];
    let left = 0;
    // First pass: completed blocks for every class (left side).
    shown.forEach((entry, idx) => {
        const color = courseRingColor(entry.courseId, idx);
        const doneW = totalAll === 0 ? 0 : (entry.completed / totalAll) * 100;
        if (doneW > 0) { segs.push({ left, w: doneW, bg: color, courseId: entry.courseId }); left += doneW; }              // completed: full color
    });
    // Second pass: remaining blocks for every class (right side).
    shown.forEach((entry, idx) => {
        const color = courseRingColor(entry.courseId, idx);
        const remW = totalAll === 0 ? 0 : ((entry.total - entry.completed) / totalAll) * 100;
        if (remW > 0) { segs.push({ left, w: remW, bg: `color-mix(in srgb, ${color} 25%, transparent)`, courseId: entry.courseId }); left += remW; } // remaining: faded
    });

    while (bar.children.length > segs.length) bar.lastChild.remove();

    segs.forEach((seg, idx) => {
        let el = bar.children[idx];
        if (!el) {
            el = document.createElement('div');
            el.className = 'cr-ol-seg';
            el.style.cssText = 'position:absolute;top:0;height:100%;transition:left .6s ease,width .6s ease,background .3s ease,opacity .3s ease;';
            bar.appendChild(el);
        }
        el.style.left = `${seg.left}%`;
        el.style.width = `${seg.w}%`;
        el.style.background = seg.bg;
        el.style.opacity = progressFilterDim(seg.courseId) ? '0.35' : '';
        attachProgressFilterClick(el, seg.courseId);
        el.onmouseenter = () => { el.style.opacity = '0.8'; };
        el.onmouseleave = () => { el.style.opacity = progressFilterDim(seg.courseId) ? '0.35' : ''; };
    });
}

function renderProgressRings(container, scopedData) {
    const mode = getProgressRingMode();
    if (mode === "none") { container.innerHTML = ""; return; }

    // Apply the same timeframe filter the list uses so the counts in the
    // display match what's shown below it.
    const allAssignments = applyTodoTimeframe(scopedData.filter(item => isTodoTaskType(item)));

    const groups = {};
    allAssignments.forEach(item => {
        const cid = String(item.course_id || item.context_id || item.plannable?.course_id || "personal");
        groups[cid] = groups[cid] || [];
        groups[cid].push(item);
    });

    const entries = Object.keys(groups).map(cid => {
        const arr = groups[cid];
        const completed = arr.filter(it => (it.submissions?.submitted || it.planner_override?.marked_complete) && !isPinnedIncomplete(it)).length;
        return { courseId: cid, total: arr.length, completed };
    }).filter(e => e.total > 0);

    if (!entries.length) { container.innerHTML = ""; return; }

    // Order courses to match the user's dashboard card order. Courses that
    // aren't on the dashboard (personal tasks, dropped courses) sort after
    // dashboard courses, keeping their relative order; ties fall back to
    // most assignments first so the display stays stable.
    const dashboardOrder = getDashboardCourseOrder();
    entries.sort((a, b) => {
        const ai = dashboardOrder.has(a.courseId) ? dashboardOrder.get(a.courseId) : Infinity;
        const bi = dashboardOrder.has(b.courseId) ? dashboardOrder.get(b.courseId) : Infinity;
        if (ai !== bi) return ai - bi;
        return b.total - a.total;
    });
    const shown = entries.slice(0, 6);

    const totalAll = shown.reduce((s, e) => s + e.total, 0);
    const completedAll = shown.reduce((s, e) => s + e.completed, 0);
    const percent = totalAll === 0 ? 0 : Math.round((completedAll / totalAll) * 100);

    // wrapper reused across renders; clear on mode switch so each mode rebuilds fresh DOM
    let wrapper = container.querySelector('.canvasrefined-progress-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'canvasrefined-progress-wrapper';
        wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;position:relative;width:100%;box-sizing:border-box;';
        container.appendChild(wrapper);
    }
    if (wrapper.dataset.mode !== mode) {
        wrapper.innerHTML = '';
        wrapper.dataset.mode = mode;
    }

    if (mode === "rings") {
        renderProgressRingsMode(wrapper, shown, totalAll, completedAll, percent);
    } else if (mode === "rainbow") {
        renderProgressRainbow(wrapper, shown, totalAll, completedAll, percent);
    } else if (mode === "lines") {
        renderProgressLines(wrapper, shown);
    } else if (mode === "line") {
        renderProgressOneLine(wrapper, shown, totalAll, completedAll, percent);
    }
}

function buildPlannerNotePayload(form) {
    const title = form.querySelector("#better-todo-new-task-title")?.value?.trim();
    const details = form.querySelector("#better-todo-new-task-details")?.value?.trim();
    const courseIdRaw = form.querySelector("#better-todo-new-task-course")?.value;
    const dateValue = form.querySelector("#better-todo-new-task-date")?.value;
    const timeValue = form.querySelector("#better-todo-new-task-time")?.value;
    const link = form.querySelector("#better-todo-new-task-link")?.value?.trim() || "";

    if (!title) {
        throw new Error("Task title is required.");
    }

    if (!dateValue || !timeValue) {
        throw new Error("Please choose both a date and time.");
    }

    const localDateTime = new Date(`${dateValue}T${timeValue}:00`);
    if (Number.isNaN(localDateTime.getTime())) {
        throw new Error("Invalid task date.");
    }

    return {
        title,
        details,
        link,
        courseId: courseIdRaw ? parseInt(courseIdRaw) : null,
        // Canvas accepts local timestamp strings more reliably than UTC ISO strings for planner notes.
        todoDate: `${dateValue}T${timeValue}:00`,
    };
}

async function createCanvasPlannerNote(payload) {
    const csrfToken = CSRFtoken();
    const plannerNote = {
        title: payload.title,
        todo_date: payload.todoDate,
    };
    if (payload.details) plannerNote.details = payload.details;
    if (payload.courseId) plannerNote.course_id = payload.courseId;

    const attempts = [
        {
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify({ planner_note: plannerNote }),
        },
        {
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(plannerNote),
        },
        {
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "accept": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: (() => {
                const formBody = new URLSearchParams();
                formBody.set("planner_note[title]", plannerNote.title);
                formBody.set("planner_note[todo_date]", plannerNote.todo_date);
                if (plannerNote.details) formBody.set("planner_note[details]", plannerNote.details);
                if (plannerNote.course_id) formBody.set("planner_note[course_id]", plannerNote.course_id);
                return formBody.toString();
            })(),
        },
    ];

    let lastError = "Canvas rejected task creation.";
    for (const attempt of attempts) {
        const response = await fetch(domain + "/api/v1/planner_notes", {
            method: "POST",
            headers: attempt.headers,
            body: attempt.body,
        });

        if (response.status === 200 || response.status === 201) {
            return response.json();
        }

        try {
            const errData = await response.json();
            if (errData?.errors?.length) {
                lastError = errData.errors.join(" ");
            } else if (errData?.message) {
                lastError = errData.message;
            }
        } catch (_) {
            // Keep prior error text when body is not JSON.
        }
    }

    throw new Error(lastError || "Canvas rejected task creation.");
}

/* Custom task links: Canvas planner notes have no link field, so store a
   user link in sync storage keyed by the note id. */
function getCustomTaskLinks() {
    return (options && options.custom_task_links) || {};
}

function getCustomTaskLinkId(item) {
    return item?.plannable_id ?? item?.plannable?.id ?? null;
}

function normalizeTaskLink(link) {
    if (!link) return "";
    link = String(link).trim();
    if (!link) return "";
    if (/^https?:\/\//i.test(link)) return link;
    if (link.startsWith("//")) return "https:" + link;
    return domain + (link.startsWith("/") ? link : "/" + link);
}

function customTaskHref(item) {
    const id = getCustomTaskLinkId(item);
    const links = getCustomTaskLinks();
    if (id != null && links[String(id)]) {
        return normalizeTaskLink(links[String(id)]);
    }
    const courseId = item?.course_id || item?.plannable?.course_id || item?.context_id;
    if (courseId) return `${domain}/courses/${courseId}`;
    return `${domain}/`;
}

function saveCustomTaskLink(noteId, link) {
    if (noteId == null) return;
    const links = { ...getCustomTaskLinks() };
    const key = String(noteId);
    if (link && String(link).trim()) {
        links[key] = String(link).trim();
    } else {
        delete links[key];
    }
    options = { ...options, custom_task_links: links };
    chrome.storage.sync.set({ custom_task_links: links });
}

function deleteCustomTaskLink(noteId) {
    if (noteId == null) return;
    const links = { ...getCustomTaskLinks() };
    delete links[String(noteId)];
    options = { ...options, custom_task_links: links };
    chrome.storage.sync.set({ custom_task_links: links });
}

async function updateCanvasPlannerNote(id, payload) {
    if (!id) throw new Error("Missing task id.");
    const csrfToken = CSRFtoken();
    // Canvas's planner_notes update endpoint permits FLAT parameters
    // (title, details, course_id, todo_date) — NOT nested under planner_note.
    // Sending nested params is silently ignored, so note.update({}) runs and
    // returns 200 with the unchanged note, making edits appear to "not save".
    // Always include details (even empty) so the field can be cleared.
    const plannerNote = {
        title: payload.title,
        todo_date: payload.todoDate,
        details: payload.details || "",
        // Sending course_id as empty string disassociates the note from its course.
        course_id: payload.courseId || "",
    };

    const attempts = [
        {
            headers: {
                "content-type": "application/json",
                "accept": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: JSON.stringify(plannerNote),
        },
        {
            headers: {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "accept": "application/json",
                "X-CSRF-Token": csrfToken,
            },
            body: (() => {
                const formBody = new URLSearchParams();
                formBody.set("title", plannerNote.title);
                formBody.set("todo_date", plannerNote.todo_date);
                formBody.set("details", plannerNote.details);
                formBody.set("course_id", plannerNote.course_id);
                return formBody.toString();
            })(),
        },
    ];

    let lastError = "Canvas rejected task update.";
    for (const attempt of attempts) {
        const response = await fetch(`${domain}/api/v1/planner_notes/${id}`, {
            method: "PUT",
            headers: attempt.headers,
            body: attempt.body,
        });

        if (response.status === 200 || response.status === 201) {
            return response.json();
        }

        try {
            const errData = await response.json();
            if (errData?.errors?.length) {
                lastError = errData.errors.join(" ");
            } else if (errData?.message) {
                lastError = errData.message;
            }
        } catch (_) {
            // Keep prior error text when body is not JSON.
        }
    }

    throw new Error(lastError || "Canvas rejected task update.");
}

async function deleteCanvasPlannerNote(id) {
    if (!id) throw new Error("Missing task id.");
    const csrfToken = CSRFtoken();
    const response = await fetch(`${domain}/api/v1/planner_notes/${id}`, {
        method: "DELETE",
        headers: {
            "content-type": "application/json",
            "accept": "application/json",
            "X-CSRF-Token": csrfToken,
        },
    });

    if (response.status === 200 || response.status === 201 || response.status === 204) {
        return true;
    }

    let lastError = "Canvas rejected task deletion.";
    try {
        const errData = await response.json();
        if (errData?.errors?.length) lastError = errData.errors.join(" ");
        else if (errData?.message) lastError = errData.message;
    } catch (_) { /* ignore */ }
    throw new Error(lastError);
}

/* Scroll a task form field into view, leaving room below for the native date/time picker. */
function scrollTodoIntoView(el, smooth = true) {
    if (!el) return;
    const sidebar = document.getElementById("right-side-wrapper");
    const style = sidebar ? getComputedStyle(sidebar) : null;
    const scrollsSidebar = sidebar &&
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        sidebar.scrollHeight > sidebar.clientHeight;
    const behavior = smooth ? "smooth" : "auto";
    if (scrollsSidebar) {
        const rect = el.getBoundingClientRect();
        const sRect = sidebar.getBoundingClientRect();
        const elTop = rect.top - sRect.top + sidebar.scrollTop;
        // Keep the element near the top so the picker below it stays on screen.
        const target = elTop - (sidebar.clientHeight - rect.height) * 0.3;
        sidebar.scrollTo({ top: Math.max(0, target), behavior });
    } else {
        el.scrollIntoView({ block: "center", behavior });
    }
}

function fillTaskCourseOptions(courseSelect) {
    const cards = options.custom_cards || {};
    const courseColors = options.custom_cards_3 || {};
    const currentCourseId = getCurrentCourseId();
    // Hidden courses should not be offered as a target for custom tasks.
    const entries = Object.entries(cards)
        .filter(([, card]) => card?.hidden !== true)
        .map(([id, card]) => ({
            id,
            label: card?.default || `Course ${id}`,
            color:
                courseColors?.[String(id)]?.color ??
                courseColors?.[id]?.color ??
                "#c7cdd1",
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    courseSelect.innerHTML = '<option value="">Personal task</option>';
    courseSelect.options[0].dataset.color = "#c7cdd1";
    entries.forEach(entry => {
        const option = makeElement("option", courseSelect, {
            value: entry.id,
            textContent: entry.label,
        });
        option.dataset.color = entry.color;
        option.style.color = entry.color;
        if (currentCourseId && String(currentCourseId) === String(entry.id)) {
            option.selected = true;
        }
    });
}

function updateTaskCourseSelectColor(courseSelect) {
    const selectedOption = courseSelect?.options?.[courseSelect.selectedIndex];
    const color = selectedOption?.dataset?.color || "#c7cdd1";
    courseSelect.style.borderLeft = `4px solid ${color}`;
    courseSelect.style.paddingLeft = "8px";
}

function ensureTodoTaskMenu(location, feedbackElement) {
    let actionsRow = location.querySelector("#better-todo-actions-row");

    if (!actionsRow) {
        actionsRow = makeElement("div", location, {
            id: "better-todo-actions-row",
            style: "display:flex;flex-direction:column;gap:8px;margin-top:14px;",
        });

        const addTaskButton = makeElement("button", actionsRow, {
            id: "better-todo-add-task-btn",
            className: "canvasrefined-custom-btn",
            textContent: "+ Add Task",
            style: "width:100%;padding:6px 8px;cursor:pointer;",
        });

        const menu = makeElement("div", actionsRow, {
            id: "better-todo-add-task-menu",
            className: "canvasrefined-add-assignment",
        });

        menu.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;padding:8px;border:1px solid #c7cdd1;border-radius:6px;background:var(--bcbackground-2);position:relative;">
                <button id="better-todo-add-task-close" type="button" class="canvasrefined-custom-btn" title="Close" style="position:absolute;top:4px;right:6px;padding:0 6px;cursor:pointer;line-height:18px;font-size:14px;color:var(--bctext-1);">\u00d7</button>
                <input type="text" id="better-todo-new-task-title" class="canvasrefined-custom-input" placeholder="Task title" maxlength="255">
                <textarea id="better-todo-new-task-details" class="canvasrefined-custom-input" placeholder="Details (optional)" style="min-height:70px;resize:vertical;padding-top:6px;padding-bottom:6px;"></textarea>
                <select id="better-todo-new-task-course" class="canvasrefined-custom-input"></select>
                <div style="display:flex;gap:6px;">
                    <input type="date" id="better-todo-new-task-date" class="canvasrefined-custom-input">
                    <input type="time" id="better-todo-new-task-time" class="canvasrefined-custom-input">
                </div>
                <input type="text" id="better-todo-new-task-link" class="canvasrefined-custom-input" placeholder="Link (optional)" maxlength="2048">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                    <span id="better-todo-add-task-status" style="font-size:12px;color:var(--bctext-0);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button id="better-todo-add-task-delete" class="canvasrefined-custom-btn" style="padding:4px 10px;cursor:pointer;display:none;color:#db3754;" type="button" title="Delete this custom task">Delete</button>
                        <button id="better-todo-add-task-submit" class="canvasrefined-custom-btn" style="padding:4px 10px;cursor:pointer;" type="button">Create</button>
                    </div>
                </div>
            </div>
        `;

        const today = new Date();
        menu.querySelector("#better-todo-new-task-date").value = formatDateForInput(today);
        menu.querySelector("#better-todo-new-task-time").value = formatTimeForInput(today);
        const courseSelect = menu.querySelector("#better-todo-new-task-course");
        fillTaskCourseOptions(courseSelect);
        updateTaskCourseSelectColor(courseSelect);
        courseSelect.addEventListener("change", () => updateTaskCourseSelectColor(courseSelect));

        addTaskButton.addEventListener("click", () => {
            const willOpen = !menu.classList.contains("canvasrefined-custom-open");
            menu.classList.toggle("canvasrefined-custom-open");
            if (willOpen) {
                resetTaskFormToCreate(menu);
                // Scroll the form up so the picker stays on screen.
                scrollTodoIntoView(menu, true);
            }
        });

        const submitTask = async () => {
            const status = menu.querySelector("#better-todo-add-task-status");
            const submitButton = menu.querySelector("#better-todo-add-task-submit");
            const deleteButton = menu.querySelector("#better-todo-add-task-delete");
            status.textContent = "";
            submitButton.disabled = true;
            if (deleteButton) deleteButton.disabled = true;

            try {
                const payload = buildPlannerNotePayload(menu);
                const editingId = menu.dataset.editingId || null;
                if (editingId) {
                    await updateCanvasPlannerNote(editingId, payload);
                    saveCustomTaskLink(editingId, payload.link);
                    status.textContent = "Task updated.";
                } else {
                    const created = await createCanvasPlannerNote(payload);
                    const newId = created?.id;
                    if (newId != null) saveCustomTaskLink(newId, payload.link);
                    status.textContent = "Task created.";
                }
                status.style.color = "#198754";
                resetTaskFormToCreate(menu);
                menu.classList.remove("canvasrefined-custom-open");

                getAssignments();
                clearTodoList();
                createTodoSections(location);
            } catch (e) {
                status.textContent = e?.message || "Could not save task.";
                status.style.color = "#db3754";
            } finally {
                submitButton.disabled = false;
                if (deleteButton) deleteButton.disabled = false;
            }
        };

        menu.querySelector("#better-todo-add-task-submit").addEventListener("click", submitTask);

        // Close (×) button: dismiss the form without creating/editing a task.
        menu.querySelector("#better-todo-add-task-close")?.addEventListener("click", () => {
            resetTaskFormToCreate(menu);
            menu.classList.remove("canvasrefined-custom-open");
        });

        // Reposition the field on focus so the picker opens on screen.
        ["#better-todo-new-task-date", "#better-todo-new-task-time"].forEach((sel) => {
            const input = menu.querySelector(sel);
            input?.addEventListener("focus", () => scrollTodoIntoView(input, false));
        });

        menu.querySelector("#better-todo-add-task-delete").addEventListener("click", async () => {
            const editingId = menu.dataset.editingId || null;
            if (!editingId) return;
            if (!confirm("Delete this custom task? This cannot be undone.")) return;
            const status = menu.querySelector("#better-todo-add-task-status");
            const submitButton = menu.querySelector("#better-todo-add-task-submit");
            const deleteButton = menu.querySelector("#better-todo-add-task-delete");
            status.textContent = "";
            submitButton.disabled = true;
            deleteButton.disabled = true;
            try {
                await deleteCanvasPlannerNote(editingId);
                deleteCustomTaskLink(editingId);
                resetTaskFormToCreate(menu);
                menu.classList.remove("canvasrefined-custom-open");
                getAssignments();
                clearTodoList();
                createTodoSections(location);
            } catch (e) {
                status.textContent = e?.message || "Could not delete task.";
                status.style.color = "#db3754";
            } finally {
                submitButton.disabled = false;
                deleteButton.disabled = false;
            }
        });
    }

    if (feedbackElement) {
        if (actionsRow.nextSibling !== feedbackElement) {
            location.insertBefore(actionsRow, feedbackElement);
        }
    } else if (actionsRow.parentElement !== location) {
        location.append(actionsRow);
    }
}

// Reset the shared add/edit task form back to a blank "create" state.
function resetTaskFormToCreate(menu) {
    if (!menu) return;
    menu.querySelector("#better-todo-new-task-title").value = "";
    menu.querySelector("#better-todo-new-task-details").value = "";
    menu.querySelector("#better-todo-new-task-link").value = "";
    const courseSelect = menu.querySelector("#better-todo-new-task-course");
    if (courseSelect) {
        fillTaskCourseOptions(courseSelect);
        updateTaskCourseSelectColor(courseSelect);
    }
    const now = new Date();
    menu.querySelector("#better-todo-new-task-date").value = formatDateForInput(now);
    menu.querySelector("#better-todo-new-task-time").value = formatTimeForInput(now);
    const status = menu.querySelector("#better-todo-add-task-status");
    if (status) { status.textContent = ""; status.style.color = ""; }
    const del = menu.querySelector("#better-todo-add-task-delete");
    if (del) del.style.display = "none";
    const submit = menu.querySelector("#better-todo-add-task-submit");
    if (submit) submit.textContent = "Create";
    delete menu.dataset.editingId;
}

// Open the shared form pre-filled with a custom task for editing or deletion.
function openTaskForEdit(item) {
    const location = document.getElementById("canvasrefined-todo-list");
    if (!location) return;
    const feedbackElement = location.querySelector(".recent_feedback");
    ensureTodoTaskMenu(location, feedbackElement);
    const menu = document.getElementById("better-todo-add-task-menu");
    if (!menu) return;

    const noteId = getCustomTaskLinkId(item);
    menu.querySelector("#better-todo-new-task-title").value = item?.plannable?.title || "";
    menu.querySelector("#better-todo-new-task-details").value = item?.plannable?.details || "";
    const courseSelect = menu.querySelector("#better-todo-new-task-course");
    const cid = item?.course_id || item?.plannable?.course_id || "";
    if (courseSelect) courseSelect.value = cid ? String(cid) : "";
    updateTaskCourseSelectColor(courseSelect);

    const dateObj = new Date(item?.plannable_date || item?.plannable?.todo_date || Date.now());
    if (!Number.isNaN(dateObj.getTime())) {
        menu.querySelector("#better-todo-new-task-date").value = formatDateForInput(dateObj);
        menu.querySelector("#better-todo-new-task-time").value = formatTimeForInput(dateObj);
    }
    const links = getCustomTaskLinks();
    menu.querySelector("#better-todo-new-task-link").value = (noteId != null && links[String(noteId)]) || "";

    menu.dataset.editingId = noteId != null ? String(noteId) : "";
    const del = menu.querySelector("#better-todo-add-task-delete");
    if (del) del.style.display = "";
    menu.querySelector("#better-todo-add-task-submit").textContent = "Save";
    const status = menu.querySelector("#better-todo-add-task-status");
    if (status) { status.textContent = ""; status.style.color = ""; }
    menu.classList.add("canvasrefined-custom-open");
    scrollTodoIntoView(menu, true);
}

async function createTodoSections(location) {
	if (!location.querySelector("#better-todo-header")) {
		let header = makeElement("div", location, { id: "better-todo-header" });
		header.style = "display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--bcbackground-1);padding-bottom:-2px;";
		let today = new Date();
		today.setHours(0,0,0,0);
		const todayString = today.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
        header.innerHTML = `
                <h2 style="border:none !important;padding: 0">Tasks</h2>
                <h2 style="border:none !important;padding: 0">${todayString}</h2>
            `;

        // Timeframe pager below the header: arrows page through the timeframe
        // window (e.g. a 1-week timeframe pages this week -> week 2 -> week 3,
        // skipping over everything before the window being shown). The left
        // arrow is disabled on the current window. Arrow keys also work while
        // hovering the pager.
        const timeframeNav = makeElement("div", location, { id: "better-todo-timeframe-nav" });
        timeframeNav.style = "display:none;align-items:center;justify-content:center;width:100%;margin-top:8px;user-select:none;";
        timeframeNav.innerHTML = `
            <button id="better-todo-timeframe-prev" type="button" title="Previous timeframe" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:50%;background:transparent;cursor:pointer;transition:all .2s ease;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 6L9 12L15 18" stroke="var(--bctext-0)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <span id="better-todo-timeframe-label" style="font-size:12px;color:var(--bctext-0);white-space:nowrap;"></span>
            <button id="better-todo-timeframe-next" type="button" title="Look ahead to the next timeframe" style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;padding:0;border:none;border-radius:50%;background:transparent;cursor:pointer;transition:all .2s ease;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 6L15 12L9 18" stroke="var(--bctext-0)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        `;
        const changeTimeframeOffset = (delta) => {
            const tf = getTodoTimeframeKey();
            if (tf === "all" || betterTodoFilter !== "tasks") return;
            const nextOffset = Math.max(0, betterTodoTimeframeOffset + delta);
            if (nextOffset === betterTodoTimeframeOffset) return;
            betterTodoTimeframeOffset = nextOffset;
            moreAssignmentCount = 0;
            clearTodoList();
            createTodoSections(location);
        };
        timeframeNav.querySelector("#better-todo-timeframe-prev").addEventListener("click", () => changeTimeframeOffset(-1));
        timeframeNav.querySelector("#better-todo-timeframe-next").addEventListener("click", () => changeTimeframeOffset(1));
        // Keyboard arrows page the timeframe while hovering the pager (and
        // only then, so normal arrow-key use elsewhere is untouched).
        const timeframeKeyHandler = (e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); changeTimeframeOffset(1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); changeTimeframeOffset(-1); }
        };
        timeframeNav.addEventListener("mouseenter", () => document.addEventListener("keydown", timeframeKeyHandler));
        timeframeNav.addEventListener("mouseleave", () => document.removeEventListener("keydown", timeframeKeyHandler));

        // placeholder for progress rings above the tab/filter control
        makeElement("div", location, { id: "better-todo-progress-placeholder", style: "display:flex;justify-content:center;margin-top:8px;" });

		let filterControl = makeElement("div", location, { "id": "better-todo-filter" });
		filterControl.innerHTML = `
		<div style="display:flex;justify-content:center;margin-top:20px;">
			<div id="better-todo-filterbuttongroup" style="display:flex;gap:50px;justify-content:space-between;position:relative;padding-bottom:5px;width:70%;height:30px;">
				<div id="better-todo-announcement" style="color:black !important;width:25px;cursor:pointer;">
					<svg fill="var(--bctext-0)" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" style="transition:all .3s ease;">
						<g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
						<g id="SVGRepo_iconCarrier">
							<path d="M1587.162 31.278c11.52-23.491 37.27-35.689 63.473-29.816 25.525 6.099 43.483 28.8 43.483 55.002V570.46C1822.87 596.662 1920 710.733 1920 847.053c0 136.32-97.13 250.503-225.882 276.705v513.883c0 26.202-17.958 49.016-43.483 55.002a57.279 57.279 0 0 1-12.988 1.468c-21.12 0-40.772-11.745-50.485-31.171C1379.238 1247.203 964.18 1242.347 960 1242.347H564.706v564.706h87.755c-11.859-90.127-17.506-247.003 63.473-350.683 52.405-67.087 129.657-101.082 229.948-101.082v112.941c-64.49 0-110.57 18.861-140.837 57.487-68.781 87.868-45.064 263.83-30.269 324.254 4.18 16.828.34 34.673-10.277 48.34-10.73 13.665-27.219 21.684-44.499 21.684H508.235c-31.171 0-56.47-25.186-56.47-56.47v-621.177h-56.47c-155.747 0-282.354-126.607-282.354-282.353v-56.47h-56.47C25.299 903.523 0 878.336 0 847.052c0-31.172 25.299-56.471 56.47-56.471h56.471v-56.47c0-155.634 126.607-282.354 282.353-282.354h564.593c16.941-.112 420.48-7.002 627.275-420.48Zm-5.986 218.429c-194.71 242.371-452.216 298.164-564.705 311.04v572.724c112.489 12.876 369.995 68.556 564.705 311.04ZM903.53 564.7H395.294c-93.402 0-169.412 76.01-169.412 169.411v225.883c0 93.402 76.01 169.412 169.412 169.412H903.53V564.7Zm790.589 123.444v317.93c65.618-23.379 112.94-85.497 112.94-159.021 0-73.525-47.322-135.53-112.94-158.909Z" fill-rule="evenodd"></path>
						</g>
					</svg>
				</div>
				<div id="better-todo-assignments" style="color:black !important;width:25px;cursor:pointer;">
					<svg fill="var(--bctext-0)" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff" style="transition:all .3s ease;">
						<g id="SVGRepo_bgCarrier" stroke-width="1"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
						<g id="SVGRepo_iconCarrier">
							<path d="M1468.214 0v551.145L840.27 1179.089c-31.623 31.623-49.693 74.54-49.693 119.715v395.289h395.288c45.176 0 88.093-18.07 119.716-49.694l162.633-162.633v438.206H0V0h1468.214Zm129.428 581.3c22.137-22.136 57.825-22.136 79.962 0l225.879 225.879c22.023 22.023 22.023 57.712 0 79.848l-677.638 677.637c-10.616 10.503-24.96 16.49-39.98 16.49H903.516v-282.35c0-15.02 5.986-29.364 16.49-39.867Zm-920.005 548.095H338.82v112.94h338.818v-112.94Zm225.88-225.879H338.818v112.94h564.697v-112.94Zm734.106-202.5-89.561 89.56 146.03 146.031 89.562-89.56-146.031-146.031Zm-508.228-362.197H338.82v338.818h790.576V338.82Z" fill-rule="evenodd"></path>
						</g>
					</svg>
				</div>
				<div id="better-todo-completed" style="color:black !important;width:25px;cursor:pointer;">
					<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="transition:all .3s ease;">
						<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
						<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
						<g id="SVGRepo_iconCarrier"> <g id="Interface / Checkbox_Check">
							<path id="Vector" d="M8 12L11 15L16 9M4 16.8002V7.2002C4 6.08009 4 5.51962 4.21799 5.0918C4.40973 4.71547 4.71547 4.40973 5.0918 4.21799C5.51962 4 6.08009 4 7.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H7.19691C6.07899 20 5.5192 20 5.0918 19.7822C4.71547 19.5905 4.40973 19.2842 4.21799 18.9079C4 18.4801 4 17.9203 4 16.8002Z" stroke="var(--bctext-0)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
						</g></g>
					</svg>
				</div>
				<div id="better-todo-indicator" style="position:absolute;bottom:4px;left:0;height:3px;background-color:var(--bctext-0);border-radius:3px 3px 0 0;transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);"></div>
			</div>
		</div>
		`;
		setTimeout(() => updateIndicator(document.getElementById("better-todo-assignments")), 10);

		document.getElementById("better-todo-announcement").addEventListener("click", (e) => {
			betterTodoFilter = "announcements";
			moreAnnouncementCount = 0;
			updateIndicator(e.currentTarget);
			clearTodoList();
			createTodoSections(location);
		});
		document.getElementById("better-todo-assignments").addEventListener("click", (e) => {
			betterTodoFilter = "tasks";
			moreAssignmentCount = 0;
			updateIndicator(e.currentTarget);
			clearTodoList();
			createTodoSections(location);
		});
		document.getElementById("better-todo-completed").addEventListener("click", (e) => {
			betterTodoFilter = "completed";
			moreCompletedCount = 0;
			updateIndicator(e.currentTarget);
			clearTodoList();
			createTodoSections(location);
		});

		let mainSection = makeElement("div", location, {
			id: "better-todo-main",
		});
		mainSection.style = "display:flex;flex-direction:column;";
	}
	let mainSection = location.querySelector("#better-todo-main");
	// Refresh the timeframe pager's label/arrows on every render (visibility
	// depends on the current tab and the todo_timeframe option).
	updateTodoTimeframeNav();
	assignments.then(data => {
        const courseId = getCurrentCourseId();
        const scopedData = getTodoScopedData(data, courseId);

        // Clicking a color in the progress display filters the list to that
        // one class. The filter only makes sense where multiple classes show
        // (dashboard/profile), so it is cleared on course pages.
        if (courseId) betterTodoProgressFilter = null;
        const displayData = (betterTodoProgressFilter == null)
            ? scopedData
            : scopedData.filter(item => {
                const cid = String(item.course_id || item.context_id || item.plannable?.course_id || "personal");
                return cid === String(betterTodoProgressFilter);
            });

        announcements = displayData.filter(item => item.plannable_type == "announcement");
        // Pinned items (locally forced incomplete, e.g. a submitted assignment
        // the user sent back to Tasks) always count as due; everything else is
        // due only when neither submitted nor marked complete.
        assignmentsDue = displayData.filter(item => isTodoTaskType(item) && ((!item.submissions?.submitted && !item.planner_override?.marked_complete) || isPinnedIncomplete(item)));
        completed = displayData.filter(item => isTodoTaskType(item) && (item.submissions?.submitted || item.planner_override?.marked_complete) && !isPinnedIncomplete(item));
        // The timeframe is a persisted Better Todo List sub-option set in the
        // popup. Read the current value each render so popup changes apply on
        // the next render. Only the Tasks tab is affected (announcements and
        // the completed tab always show everything).
        // The timeframe filter only applies to the Tasks tab, but a pinned item
        // must never be dropped from both tabs: exclude pins from the cutoff
        // filter so a "sent back" old item still shows up under Tasks.
        const pinnedItems = assignmentsDue.filter(item => isPinnedIncomplete(item));
        assignmentsDue = applyTodoTimeframe(assignmentsDue.filter(item => !isPinnedIncomplete(item))).concat(pinnedItems);
		// console.log("assignments", assignmentsDue);
		// console.log("announcements", announcements);
		// console.log("completed", completed);

        if (document.getElementById("better-todo-announcement-badge")) {
            document.getElementById("better-todo-announcement-badge").remove();
        }
        let isAnnoucementBadge = 0;
        announcements.forEach(item => {
            if (item.plannable.read_state == "unread") {
                isAnnoucementBadge++;
                return;
            }
        })
        if (isAnnoucementBadge > 0) {
            makeElement("div", document.getElementById("better-todo-announcement"), {
                id: "better-todo-announcement-badge",
                style: "background-color:#ff0000;width:15px;height:15px;border-radius:50%;font-size:12px;position:absolute;top:-7px;left:16px;display:flex;justify-content:center;align-items:center;", // TODO: theme compatibility
                innerHTML: `<span style="color:white;">${isAnnoucementBadge}</span>`
            })
		}

		domContainers = {};
		const groupKeys = ["-1", "0", "1", "2", "3", "4", "5", "6", "7", "14", "21", "30", "Later", "New", "Seen", "Ungraded", "Graded"];
        for (const key of groupKeys) {
            let wrapper = makeElement("div", mainSection, {
                style: "display:none;margin-top:10px;",
                className: "better-todo-dueheader",
            });
            let label = "";
            if (key == "Later") label = "Due <strong>Later</strong>";
            if (key == "-1") label = "<strong>Overdue</strong>";
            else if (key == "0") label = "Due <strong>Today</strong>";
            else if (key == "1") label = "Due <strong>Tomorrow</strong>";
            else if (key >= 2 && key < 7) label = "Due <strong>" + key + " days</strong>";
            else if (key >= 7 && key < 30) label = "Due <strong>" + key/7 + " weeks</strong>";
            else if (key == "30") label = "Due <strong>1 month</strong>";
            else label = "<strong>" + key + "</strong>";
            makeElement("div", wrapper, {
                innerHTML: "<span>" + label + "</span>",
                style: "display:flex;flex-direction:column;gap:10px;font-size:12px;color:var(--bctext-0);"
            })

            let listContainer = makeElement("div", wrapper, { className: "todo-group-list" });
            listContainer.style = "display:flex;flex-direction:column;gap:10px;";

            domContainers[key] = { wrapper, listContainer };
        }


        if (betterTodoFilter == "tasks") {
            populateAssignments();
        }
        if (betterTodoFilter == "announcements") {
            populateAnnouncements();
        }
        if (betterTodoFilter == "completed") {
            populateAssignments(true);
        }

        const feedbackElement = location.querySelector(".recent_feedback");

        // populate progress rings placeholder (respect user toggle)
        const progressPlaceholder = document.getElementById("better-todo-progress-placeholder");
        if (progressPlaceholder) {
            if (progressRingsEnabled()) {
                renderProgressRings(progressPlaceholder, scopedData);
            } else {
                progressPlaceholder.innerHTML = "";
            }
        }

        // Only show the Add Task control on the Assignments (tasks) tab.
        if (betterTodoFilter === "tasks") {
            ensureTodoTaskMenu(location, feedbackElement);
        } else {
            const existing = location.querySelector("#better-todo-actions-row");
            if (existing) existing.remove();
        }

        if (feedbackElement) {
            if (options.todo_hide_feedback == true) {
                feedbackElement.style.display = "none";
            } else {
                feedbackElement.style.display = "block";
            }
        }

        const sidebar = document.getElementById("right-side-wrapper");
        ensureRightSideWrapperScrollbarHidden();
        sidebar.style.setProperty("scrollbar-width", "none");
        sidebar.style.setProperty("-ms-overflow-style", "none");
		if (options.todo_full_height) {
			sidebar.style.minHeight = "100vh";
		} else {
			sidebar.style.minHeight = "";
		}
		if (options.todo_separate_scrollbar) {
			sidebar.style.position = "sticky";
			sidebar.style.top = "0";
			sidebar.style.height = "100vh";
			sidebar.style.overflowY = "auto";
		} else {
			sidebar.style.position = "";
			sidebar.style.top = "";
			sidebar.style.height = "";
			sidebar.style.overflowY = "";
			// maybe invisible scrollbar?
		}
	});
}

function ensureRightSideWrapperScrollbarHidden() {
    let style = document.getElementById("canvasrefined-hide-right-sidebar-scrollbar") || document.createElement("style");
    style.id = "canvasrefined-hide-right-sidebar-scrollbar";
    style.textContent = `
        #right-side-wrapper {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        #right-side-wrapper::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
            display: none !important;
        }
    `;
    document.head.append(style);
}

function clearTodoList() {
    const seeMoreBtn = document.getElementById("better-todo-see-more");
    if (seeMoreBtn) {
        seeMoreBtn.remove();
    }

	document.getElementById("better-todo-main").querySelectorAll(".todo-group-list").forEach(list => {
		list.innerHTML = "";
	});
	document.querySelectorAll(".better-todo-dueheader").forEach(header => {
		header.remove();
	});
}

// "Alternate colors" (Better Todo List, light mode only): recolors the main
// todo-list icon fill to white instead of the default --bctext-0, so icons
// stay visible on lighter course-color strips. Implemented through a CSS
// variable so toggling the option or dark mode recolors existing icons live
// without a re-render.
const TODO_ALT_ICON_COLOR = "#ffffff";
let todoAltStyleEl = null;
function applyTodoAlternateColors() {
    const altOn = options.todo_alternate_colors === true && options.dark_mode !== true;
    const color = altOn ? TODO_ALT_ICON_COLOR : "var(--bctext-0)";
    if (!todoAltStyleEl) {
        todoAltStyleEl = document.createElement("style");
        todoAltStyleEl.id = "crtodoaltcss";
        document.documentElement.append(todoAltStyleEl);
    }
    todoAltStyleEl.textContent = `:root{--cr-todo-icon:${color};}`;
}

// --- Hover preview (Better Todo List: "Previews on hover") ---
// The todo list is rendered by createTodoSections -> populateAssignments /
// populateAnnouncements (the old loadBetterTodo renderer is no longer called).
// A single shared, body-level tooltip is reused across items so it is never
// clipped by the sidebar's scroll/overflow containers. It reuses the
// .canvasrefined-hover-preview class so existing light/dark styling applies.
let todoPreviewDelay = null;
let todoPreviewToken = 0;
const todoPreviewCache = new Map();

function stripHtmlPreview(html) {
    if (!html) return "";
    return String(html).replace(/<\/?[^>]+(>|$)/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function getTodoPreviewEl() {
    let el = document.getElementById("canvasrefined-todo-preview");
    if (el) return el;
    el = document.createElement("div");
    el.id = "canvasrefined-todo-preview";
    el.className = "canvasrefined-hover-preview";
    el.innerHTML = '<p class="canvasrefined-preview-title"></p><p class="canvasrefined-preview-text"></p>';
    el.style.position = "fixed";
    el.style.zIndex = "100001";
    el.style.width = "300px";
    el.style.maxWidth = "90vw";
    el.style.maxHeight = "260px";
    document.body.append(el);
    return el;
}

function positionTodoPreview(el, anchor) {
    const r = anchor.getBoundingClientRect();
    const gap = 10;
    const pw = el.offsetWidth || 300;
    const ph = el.offsetHeight || 160;
    let left = r.left - pw - gap;
    let top = r.top;
    if (left < gap) {
        left = r.right + gap;
        if (left + pw > window.innerWidth - gap) left = Math.max(gap, window.innerWidth - pw - gap);
    }
    if (top + ph > window.innerHeight - gap) top = Math.max(gap, window.innerHeight - ph - gap);
    el.style.left = left + "px";
    el.style.top = top + "px";
}

async function getTodoPreviewText(item) {
    const type = item.plannable_type;
    const id = item.plannable_id;
    const key = type + ":" + id;
    if (todoPreviewCache.has(key)) return todoPreviewCache.get(key);
    // Custom task (planner note): the description is already on the planner
    // item as item.plannable.details, so no API call is needed.
    if (type === "planner_note" || (item.planner_override && item.planner_override.custom === true)) {
        const raw = item.plannable && item.plannable.details ? item.plannable.details : "";
        const text = stripHtmlPreview(raw) || "No details given";
        todoPreviewCache.set(key, text);
        return text;
    }
    let url = null;
    let field = "description";
    if (type === "assignment") {
        url = `${domain}/api/v1/courses/${item.course_id}/assignments/${id}`;
    } else if (type === "quiz") {
        url = `${domain}/api/v1/courses/${item.course_id}/quizzes/${id}`;
    } else if (type === "discussion_topic" || type === "announcement") {
        url = `${domain}/api/v1/courses/${item.course_id}/discussion_topics/${id}`;
        field = "message";
    }
    if (!url) {
        const text = "No preview available";
        todoPreviewCache.set(key, text);
        return text;
    }
    try {
        const data = await getData(url);
        const raw = data && data[field] ? data[field] : "";
        const text = stripHtmlPreview(raw) || "No details given";
        todoPreviewCache.set(key, text);
        return text;
    } catch (e) {
        return "Couldn't load preview";
    }
}

function hideTodoPreview() {
    todoPreviewToken++; // cancel any pending async text update
    const el = document.getElementById("canvasrefined-todo-preview");
    if (el) el.style.display = "none";
}

async function showTodoPreview(anchor, item) {
    const token = ++todoPreviewToken;
    const el = getTodoPreviewEl();
    const title = el.querySelector(".canvasrefined-preview-title");
    const text = el.querySelector(".canvasrefined-preview-text");
    title.textContent = item.plannable && item.plannable.title ? item.plannable.title : "";
    text.textContent = "Loading…";
    el.style.display = "block";
    positionTodoPreview(el, anchor);
    const content = await getTodoPreviewText(item);
    if (token !== todoPreviewToken) return; // a newer hover (or hide) superseded this one
    if (el.style.display !== "block") return; // user already moved away
    text.textContent = content;
    positionTodoPreview(el, anchor); // reposition now that the height is known
}

function attachTodoHoverPreview(anchor, item) {
    if (options.hover_preview !== true) return;
    anchor.addEventListener("mouseenter", () => {
        clearTimeout(todoPreviewDelay);
        todoPreviewDelay = setTimeout(() => {
            if (anchor.matches(":hover")) showTodoPreview(anchor, item);
        }, 250);
    });
    anchor.addEventListener("mouseleave", () => {
        clearTimeout(todoPreviewDelay);
        hideTodoPreview();
    });
}


// TODO_tuna - Move svgs to separate file... Maybe even put all svgs in a common folder, as actual svg files?

// Task-type icons for the Better Todo task rows (quiz / graded discussion),
// adapted from the legacy todo renderer so quizzes and discussions get a
// recognizable icon instead of the generic assignment one. Same fill
// variable as the assignment icon so "Remove icons"/theme tweaks apply.
const TODO_QUIZ_ICON_SVG = '<svg fill="var(--cr-todo-icon)" label="Quiz" name="IconQuiz" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false"  ><g role="presentation"><g fill-rule="evenodd" stroke="none" stroke-width="1"><path d="M746.255375,1466.76417 L826.739372,1547.47616 L577.99138,1796.11015 L497.507383,1715.51216 L746.255375,1466.76417 Z M580.35118,1300.92837 L660.949178,1381.52637 L329.323189,1713.15236 L248.725192,1632.55436 L580.35118,1300.92837 Z M414.503986,1135.20658 L495.101983,1215.80457 L80.5979973,1630.30856 L0,1549.71056 L414.503986,1135.20658 Z M1119.32036,264.600006 C1475.79835,-91.8779816 1844.58834,86.3040124 1848.35034,88.1280123 L1848.35034,88.1280123 L1865.45034,96.564012 L1873.88634,113.664011 C1875.71034,117.312011 2053.89233,486.101999 1697.30034,842.693987 L1697.30034,842.693987 L1550.69635,989.297982 L1548.07435,1655.17196 L1325.43235,1877.81395 L993.806366,1546.30196 L415.712386,968.207982 L84.0863971,636.467994 L306.72839,413.826001 L972.602367,411.318001 Z M1436.24035,1103.75398 L1074.40436,1465.70397 L1325.43235,1716.61796 L1434.30235,1607.74796 L1436.24035,1103.75398 Z M1779.26634,182.406009 C1710.18234,156.41401 1457.90035,87.1020124 1199.91836,345.198004 L1199.91836,345.198004 L576.90838,968.207982 L993.806366,1385.10597 L1616.70235,762.095989 C1873.65834,505.139998 1804.68834,250.920007 1779.26634,182.406009 Z M858.146371,525.773997 L354.152388,527.597997 L245.282392,636.467994 L496.310383,887.609985 L858.146371,525.773997 Z"></path><path d="M1534.98715,372.558003 C1483.91515,371.190003 1403.31715,385.326002 1321.69316,466.949999 L1281.22316,507.305998 L1454.61715,680.585992 L1494.97315,640.343994 C1577.16715,558.035996 1591.87315,479.033999 1589.82115,427.164001 L1587.65515,374.610003 L1534.98715,372.558003 Z"></path></g></g></svg>';
const TODO_DISCUSSION_ICON_SVG = '<svg fill="var(--cr-todo-icon)" name="IconDiscussion" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false"  ><g role="presentation"><path d="M677.647059,16 L677.647059,354.936471 L790.588235,354.936471 L790.588235,129.054118 L1807.05882,129.054118 L1807.05882,919.529412 L1581.06353,919.529412 L1581.06353,1179.29412 L1321.41176,919.529412 L1242.24,919.529412 L1242.24,467.877647 L677.647059,467.877647 L0,467.877647 L0,1484.34824 L338.710588,1484.34824 L338.710588,1903.24706 L756.705882,1484.34824 L1242.24,1484.34824 L1242.24,1032.47059 L1274.99294,1032.47059 L1694.11765,1451.59529 L1694.11765,1032.47059 L1920,1032.47059 L1920,16 L677.647059,16 Z M338.789647,919.563294 L903.495529,919.563294 L903.495529,806.622118 L338.789647,806.622118 L338.789647,919.563294 Z M338.789647,1145.44565 L677.726118,1145.44565 L677.726118,1032.39153 L338.789647,1032.39153 L338.789647,1145.44565 Z M112.941176,580.705882 L1129.41176,580.705882 L1129.41176,1371.40706 L710.4,1371.40706 L451.651765,1631.05882 L451.651765,1371.40706 L112.941176,1371.40706 L112.941176,580.705882 Z" fill-rule="evenodd" stroke="none" stroke-width="1"></path></g></svg>';

function populateAssignments(iscompleted = false) {
	const today = new Date();
	today.setHours(0,0,0,0);
    let assignments = (iscompleted ? completed : assignmentsDue).slice();
    if (iscompleted) {
        assignments.sort((a, b) => {
            const aIsGraded = Boolean(a.submissions?.graded);
            const bIsGraded = Boolean(b.submissions?.graded);
            if (aIsGraded !== bIsGraded) {
                return aIsGraded - bIsGraded;
            }
            return new Date(b.plannable_date) - new Date(a.plannable_date);
        });
    } else {
        // Keep a stable chronological order (overdue first) so the visible
        // item budget below counts from due today onward. The planner API
        // normally returns ascending order already; this makes it guaranteed.
        assignments.sort((a, b) => new Date(a.plannable_date) - new Date(b.plannable_date));
    }

	let assignmentCount = 0;
	const maxElements = options.num_todo_items;

	assignments.forEach((item) => {
		let dueGroup = -1;
		if (!iscompleted) {
			let dueDate = new Date(item.plannable_date);
			dueDate.setHours(0,0,0,0);
			const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
			if (diffDays < 0) {dueGroup = -1;}
			else if (diffDays <= 1) { dueGroup = diffDays.toString(); }
			else if (diffDays <= 7) { dueGroup = diffDays.toString(); }
			else if (diffDays <= 14) {dueGroup = 14;}
			else if (diffDays <= 21) {dueGroup = 21;}
			else if (diffDays <= 30) {dueGroup = 30;}
			else {dueGroup = "Later"};
		} else {
			dueGroup = item.submissions?.graded ? "Graded" : "Ungraded";
		}

		let assignment
		const targetContainer = domContainers[dueGroup];
		// Overdue items are always shown and don't consume the visible-item
		// budget: the count starts at items due today. (On the Completed tab,
		// whose groups are Graded/Ungraded, every item still counts.)
		const isOverdue = !iscompleted && dueGroup === -1;
		if (!isOverdue) assignmentCount++;
		let isHidden = !isOverdue && assignmentCount > maxElements;

		if (targetContainer) {
			if (!isHidden) {
				targetContainer.wrapper.style.display = "block";
				targetContainer.wrapper.setAttribute("data-has-visible", "true");
			}
			else {
				if (!targetContainer.wrapper.hasAttribute("data-has-visible")) {
					targetContainer.wrapper.classList.add(
						"better-todo-hidden-wrapper",
					);
				}
			}

			// targetContainer.wrapper.style.display = "block";
			assignment = makeElement("div", targetContainer.listContainer, {
				class: "better-todo-assignment",
			});
			if (isHidden) {
				assignment.style.display = "none";
				assignment.classList.add("better-todo-hidden-assignment");
			}
		}

		const courseColor =
			options.custom_cards_3?.[String(item.course_id)]?.color ??
			options.custom_cards_3?.[item.course_id]?.color ??
			options.custom_cards_3?.[item.plannable.course_id]?.color ??
			"#cccccc";

        // "Ignore card colors" (Better Todo List): when on, the class name is
        // rendered black in light mode or the theme text color in dark mode
        // instead of the course's card color.
        const classNameColor = options.todo_ignore_card_colors
            ? (options.dark_mode === true ? "var(--bctext-0)" : "#000000")
            : courseColor;
        // "Remove icons" (Better Todo List): when on, the task-type icon is
        // omitted from the colored strip on the left of each task.
        const removeIcons = options.todo_remove_icons === true;

        const isCustomTask = item.plannable_type == "planner_note" || item.planner_override?.custom === true;
        // True when Canvas has a real submission for this item: the Completed
        // list shows it regardless of the checkmark state, so the toggle is
        // disabled for it (see the checkmark listener below).
        const wasSubmitted = item.submissions?.submitted === true;
        const taskHref = isCustomTask ? customTaskHref(item) : (domain + item.html_url);
        const editButtonSvg = isCustomTask
            ? `<svg class="better-todo-assignment-edit" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:15px;height:15px;position:absolute;top:18px;right:5px;opacity:0.3;transition:all .3s ease;cursor:pointer;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.3'" title="Edit this custom task"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" stroke="var(--bctext-0)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
            : "";
        const iconSize = isCustomTask ? 26 : 20;
        // Optical centering inside the colored strip: the assignment icon's
        // glyph hugs its viewBox's left edge, so it gets a 5px nudge right.
        // The quiz glyph's visual weight already sits right of center (its
        // thin "motion lines" occupy the left edge), so it needs less of a
        // nudge — otherwise it reads as off-center next to the others.
        const iconLeftOffset = isCustomTask ? 2 : item.plannable_type == "quiz" ? 2 : 5;
        const taskIcon = removeIcons ? "" : isCustomTask
            ? `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
                <path d="M19.8201 14H15.6001C15.04 14 14.76 14 14.5461 14.109C14.3579 14.2049 14.2049 14.3578 14.1091 14.546C14.0001 14.7599 14.0001 15.0399 14.0001 15.6V19.82M20 12.7269V7.2C20 6.0799 20 5.51984 19.782 5.09202C19.5903 4.71569 19.2843 4.40973 18.908 4.21799C18.4802 4 17.9201 4 16.8 4H7.2C6.0799 4 5.51984 4 5.09202 4.21799C4.71569 4.40973 4.40973 4.71569 4.21799 5.09202C4 5.51984 4 6.0799 4 7.2V16.8C4 17.9201 4 18.4802 4.21799 18.908C4.40973 19.2843 4.71569 19.5903 5.09202 19.782C5.51984 20 6.0799 20 7.2 20H12.9496C13.4578 20 13.7118 20 13.9498 19.9407C14.1608 19.8882 14.3618 19.8016 14.5449 19.6844C14.7515 19.5522 14.926 19.3675 15.2751 18.9983L19.1254 14.9252C19.4486 14.5833 19.6101 14.4124 19.7255 14.2156C19.8278 14.041 19.903 13.8519 19.9486 13.6548C20 13.4325 20 13.1973 20 12.7269Z" stroke="var(--cr-todo-icon)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`
            : (item.plannable_type == "quiz" ? TODO_QUIZ_ICON_SVG : item.plannable_type == "discussion_topic" ? TODO_DISCUSSION_ICON_SVG : `<svg fill="var(--cr-todo-icon)" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
                <g id="SVGRepo_bgCarrier" stroke-width="1"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                    <path d="M1468.214 0v551.145L840.27 1179.089c-31.623 31.623-49.693 74.54-49.693 119.715v395.289h395.288c45.176 0 88.093-18.07 119.716-49.694l162.633-162.633v438.206H0V0h1468.214Zm129.428 581.3c22.137-22.136 57.825-22.136 79.962 0l225.879 225.879c22.023 22.023 22.023 57.712 0 79.848l-677.638 677.637c-10.616 10.503-24.96 16.49-39.98 16.49H903.516v-282.35c0-15.02 5.986-29.364 16.49-39.867Zm-920.005 548.095H338.82v112.94h338.818v-112.94Zm225.88-225.879H338.818v112.94h564.697v-112.94Zm734.106-202.5-89.561 89.56 146.03 146.031 89.562-89.56-146.031-146.031Zm-508.228-362.197H338.82v338.818h790.576V338.82Z" fill-rule="evenodd"></path>
                </g>
            </svg>`);

		assignment.style.overflowX = "hidden";
		assignment.innerHTML = `
		<div style="display:flex;align-items:center;gap:5px;width:100%;height:60px;background:var(--bcbackground-2);border-radius:5px;transition:all .4s ease;overflow:hidden;">
			<div style="width:40px;display:flex;align-items:center;justify-content:center;background-color:${courseColor};height:100%;border-radius:5px 0 0 5px;">
                <div style="width:${iconSize}px;height:${iconSize}px;display:flex;margin-left:${iconLeftOffset}px;">
                    ${taskIcon}
				</div>
			</div>
			<div style="width:calc(100% - 40px);height:80%;display:flex;flex-direction:column;gap:5px;padding-left:2px;box-sizing:border-box;overflow:hidden;position:relative;">
				<div style="display:flex;flex-direction:column;gap:3px;">
					<span style="color:${classNameColor};font-size:12px;margin-top:-2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;box-sizing:border-box;padding-right:22px;">${item.context_name}</span>
					<a href="${taskHref}" style="color:inherit;text-decoration:none;font-weight:bold;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box;padding-right:28px;margin-top:-5px;">${item.plannable.title}</a>
					<span style="color:var(--bctext-0);font-size:12px;margin-top:-5px;">${convertToDueDate(item.plannable_date)}</span>
				</div>
				${editButtonSvg}
				<svg class="better-todo-assignment-checkmark" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:15px;height:15px;position:absolute;top:0px;right:5px;opacity:0.3;transition:all .3s ease;cursor:pointer;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.3'"${(iscompleted && wasSubmitted) ? " title=\"Submitted to Canvas — clicking sends it back to Tasks (locally)\"" : ""}>
					<g id="SVGRepo_bgCarrier" stroke-width="0"></g>
					<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
					<g id="SVGRepo_iconCarrier"> <g id="Interface / Checkbox_Check">
						<path id="Vector" d="M8 12L11 15L16 9M4 16.8002V7.2002C4 6.08009 4 5.51962 4.21799 5.0918C4.40973 4.71547 4.71547 4.40973 5.0918 4.21799C5.51962 4 6.08009 4 7.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H7.19691C6.07899 20 5.5192 20 5.0918 19.7822C4.71547 19.5905 4.40973 19.2842 4.21799 18.9079C4 18.4801 4 17.9203 4 16.8002Z" stroke="var(--bctext-0)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
					</g></g>
				</svg>
			</div>
		</div>
		`;
		// The checkmark reflects the tab it is rendered in: on the Tasks tab it
		// marks the item complete; on the Completed tab it makes it incomplete
		// again (for genuinely submitted items this sets a local pin, since
		// Canvas has no way to un-submit).
		assignment.querySelector(".better-todo-assignment-checkmark").addEventListener("click", () => {
			console.log("marking ", item.plannable.title, iscompleted ? "as incomplete" : "as complete");
			markAs(item, assignment.firstElementChild, !iscompleted);
		});
		const editBtn = assignment.querySelector(".better-todo-assignment-edit");
		if (editBtn) {
			editBtn.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				openTaskForEdit(item);
			});
		}
		attachTodoHoverPreview(assignment, item);
	});

	if (document.getElementById("better-todo-see-more")) {
		document.getElementById("better-todo-see-more").remove();
	}

	if (assignmentCount > maxElements) {
		let isExpanded = false;

		let seeMoreButton = makeElement("button", document.getElementById("better-todo-main"), {
			textContent: `View More (${assignmentCount - maxElements})`,
			className: "canvasrefined-custom-btn",
			id: "better-todo-see-more",
			style: "width:100%;margin-top:15px;cursor:pointer;"
		})
		seeMoreButton.addEventListener("click", () => {
			if (!isExpanded) {
				document.querySelectorAll(".better-todo-hidden-assignment").forEach(element => element.style.display = "block");
				document.querySelectorAll(".better-todo-hidden-wrapper").forEach(element => element.style.display = "block");
				seeMoreButton.textContent = "View Less";
			} else {
				document.querySelectorAll(".better-todo-hidden-assignment").forEach(element => element.style.display = "none");
				document.querySelectorAll(".better-todo-hidden-wrapper").forEach(element => element.style.display = "none");
				seeMoreButton.textContent = `View More (${assignmentCount - maxElements})`;
			}
			isExpanded = !isExpanded;
		})
	}
}

function populateAnnouncements() {
	const today = new Date();
	today.setHours(0,0,0,0);

	announcements.forEach((item) => {
		let dueGroup = item.plannable.read_state == "read" ? "Seen" : "New";

		let announcement;
		// console.log(domContainers)
		const targetContainer = domContainers[dueGroup];
		if (targetContainer) {
			targetContainer.wrapper.style.display = "block";
			announcement = makeElement("div", targetContainer.listContainer, {
				class: "better-todo-announcement",
			});
		}

		const courseColor =
			options.custom_cards_3?.[String(item.course_id)]?.color ??
			options.custom_cards_3?.[item.course_id]?.color ??
			options.custom_cards_3?.[item.plannable.course_id]?.color ??
			"#cccccc";

		// "Ignore card colors": black in light mode, theme text color in dark.
		const classNameColor = options.todo_ignore_card_colors
			? (options.dark_mode === true ? "var(--bctext-0)" : "#000000")
			: courseColor;
		// "Remove icons": drop the announcement icon from the colored strip.
		const removeIcons = options.todo_remove_icons === true;

		let filter = "";
		if (item.plannable.read_state == "read") {
			filter = "filter: grayscale(40%);"
		}

		announcement.innerHTML = `
		<div style="display:flex;align-items:center;gap:5px;width:100%;height:60px;background:var(--bcbackground-2);border-radius:5px;${filter}">
			<div style="width:40px;display:flex;align-items:center;justify-content:center;background-color:${courseColor};height:100%;border-radius:5px 0 0 5px;">
				<div style="width:23px;height:23px;display:flex;margin-left:0px;">
					${removeIcons ? "" : `<svg fill="var(--cr-todo-icon)" viewBox="0 0 1920 1920" xmlns="http://www.w3.org/2000/svg" style="transition:all .3s ease;">
						<g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
						<g id="SVGRepo_iconCarrier">
							<path d="M1587.162 31.278c11.52-23.491 37.27-35.689 63.473-29.816 25.525 6.099 43.483 28.8 43.483 55.002V570.46C1822.87 596.662 1920 710.733 1920 847.053c0 136.32-97.13 250.503-225.882 276.705v513.883c0 26.202-17.958 49.016-43.483 55.002a57.279 57.279 0 0 1-12.988 1.468c-21.12 0-40.772-11.745-50.485-31.171C1379.238 1247.203 964.18 1242.347 960 1242.347H564.706v564.706h87.755c-11.859-90.127-17.506-247.003 63.473-350.683 52.405-67.087 129.657-101.082 229.948-101.082v112.941c-64.49 0-110.57 18.861-140.837 57.487-68.781 87.868-45.064 263.83-30.269 324.254 4.18 16.828.34 34.673-10.277 48.34-10.73 13.665-27.219 21.684-44.499 21.684H508.235c-31.171 0-56.47-25.186-56.47-56.47v-621.177h-56.47c-155.747 0-282.354-126.607-282.354-282.353v-56.47h-56.47C25.299 903.523 0 878.336 0 847.052c0-31.172 25.299-56.471 56.47-56.471h56.471v-56.47c0-155.634 126.607-282.354 282.353-282.354h564.593c16.941-.112 420.48-7.002 627.275-420.48Zm-5.986 218.429c-194.71 242.371-452.216 298.164-564.705 311.04v572.724c112.489 12.876 369.995 68.556 564.705 311.04ZM903.53 564.7H395.294c-93.402 0-169.412 76.01-169.412 169.411v225.883c0 93.402 76.01 169.412 169.412 169.412H903.53V564.7Zm790.589 123.444v317.93c65.618-23.379 112.94-85.497 112.94-159.021 0-73.525-47.322-135.53-112.94-158.909Z" fill-rule="evenodd"></path>
						</g>
					</svg>`}
				</div>
			</div>
			<div style="width:calc(100% - 40px);height:80%;display:flex;flex-direction:column;gap:5px;padding-left:2px;box-sizing:border-box;overflow:hidden;">
				<div style="display:flex;flex-direction:column;gap:3px;">
					<span style="color:${classNameColor};font-size:12px;margin-top:-2px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;box-sizing:border-box;padding-right:22px;">${item.context_name}</span>
					<a href="${domain + item.html_url}" style="color:inherit;text-decoration:none;font-weight:bold;text-overflow:ellipsis;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-5px;">${item.plannable.title}</a>
					<span style="color:var(--bctext-0);font-size:12px;margin-top:-5px;">${convertToDueDate(item.plannable_date)}</span>
				</div>
			</div>
		</div>
		`;
		attachTodoHoverPreview(announcement, item);
	});
}

function createConfettiBurst(targetElement, opts = {}) {
    try {
        if (options.todo_confetti === false) return;

        const count = opts.count || 48;
        const colors = opts.colors || ['#ff4d4f', '#ffc107', '#28a745', '#17a2b8', '#6f42c1', '#ff6b6b', '#ff8a65', '#ffd54f'];
        const rect = targetElement.getBoundingClientRect();
        const container = document.createElement('div');
        container.className = 'canvasrefined-confetti-container';
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.pointerEvents = 'none';
        container.style.overflow = 'visible';
        container.style.zIndex = '2147483647';
        document.body.appendChild(container);

        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height * 0.35;
        const particles = [];

        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'canvasrefined-confetti';
            const w = 4 + Math.floor(Math.random() * 7); // smaller pieces
            const h = Math.max(3, Math.floor(w * (0.4 + Math.random() * 0.8)));
            el.style.position = 'absolute';
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.background = colors[Math.floor(Math.random() * colors.length)];
            el.style.left = (originX - w / 2) + 'px';
            el.style.top = (originY - h / 2) + 'px';
            el.style.opacity = '1';
            el.style.borderRadius = Math.random() > 0.75 ? '50%' : '2px';
            el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.18)';
            el.style.transformOrigin = 'center center';
            el.style.willChange = 'transform, opacity';
            container.appendChild(el);

            const duration = 850 + Math.floor(Math.random() * 500);
            const delay = Math.floor(Math.random() * 90);
            const spread = opts.spread || 110;
            const horizontalBias = (Math.random() - 0.5) * 2;

            // Arc stays lower and wider than the old cone-shaped burst.
            const endX = originX + horizontalBias * (spread * (0.7 + Math.random() * 0.6));
            const endY = originY - (16 + Math.random() * 34);
            const ctrlX = originX + horizontalBias * (spread * 0.25) + (Math.random() - 0.5) * 14;
            const ctrlY = originY - (30 + Math.random() * 55);

            particles.push({
                el,
                delay,
                duration,
                originX,
                originY,
                ctrlX,
                ctrlY,
                endX,
                endY,
                rotate: (Math.random() * 260) - 130,
                scale: 0.8 + Math.random() * 0.5,
            });
        }

        const startTime = performance.now();
        let rafId = null;

        const animate = now => {
            let active = false;

            for (let i = particles.length - 1; i >= 0; i--) {
                const particle = particles[i];
                const elapsed = now - startTime - particle.delay;
                if (elapsed < 0) {
                    active = true;
                    continue;
                }

                const progress = Math.min(1, elapsed / particle.duration);
                const eased = 1 - Math.pow(1 - progress, 3);

                const x = (1 - eased) * (1 - eased) * particle.originX + 2 * (1 - eased) * eased * particle.ctrlX + eased * eased * particle.endX;
                const y = (1 - eased) * (1 - eased) * particle.originY + 2 * (1 - eased) * eased * particle.ctrlY + eased * eased * particle.endY;

                particle.el.style.transform = `translate(${Math.round(x - particle.originX)}px, ${Math.round(y - particle.originY)}px) rotate(${particle.rotate * eased}deg) scale(${particle.scale * (1 - eased * 0.15)})`;
                particle.el.style.opacity = String(1 - progress);

                if (progress < 1) {
                    active = true;
                } else {
                    particle.el.remove();
                    particles.splice(i, 1);
                }
            }

            if (active) {
                rafId = requestAnimationFrame(animate);
            } else {
                try { container.remove(); } catch (e) { /* ignore */ }
                if (rafId) cancelAnimationFrame(rafId);
            }
        };

        rafId = requestAnimationFrame(animate);

        // cleanup container after animations
        setTimeout(() => {
            try { container.remove(); } catch (e) { /* ignore */ }
        }, 2400);
    } catch (e) {
        console.error('confetti error', e);
    }
}

// --- Local "incomplete" pins -----------------------------------------------
// Canvas records real submissions server-side and offers no API to un-submit,
// so an assignment the user actually handed in can never leave the Completed
// list via the planner override. For those items the checkmark instead sets a
// local pin that forces the item back into the Tasks list. The pin lives in
// chrome.storage.sync and clears when the item is checked off again.
function todoPinKey(item) {
    return item.plannable_type + "_" + item.plannable_id;
}
function isPinnedIncomplete(item) {
    return options.todo_force_incomplete?.[todoPinKey(item)] === true;
}
function setPinnedIncomplete(item, pinned) {
    const pins = Object.assign({}, options.todo_force_incomplete || {});
    if (pinned) pins[todoPinKey(item)] = true;
    else delete pins[todoPinKey(item)];
    options.todo_force_incomplete = pins;
    chrome.storage.sync.set({ todo_force_incomplete: pins });
}

function markAs(item, element, makeComplete) {
	const csrfToken = CSRFtoken();
	const completeState = makeComplete;

    // Checking an item off clears any local incomplete pin; unchecking a
    // genuinely submitted item sets one, since the submission itself can't
    // be undone server-side.
    if (completeState) {
        if (isPinnedIncomplete(item)) setPinnedIncomplete(item, false);
    } else if (item.submissions?.submitted) {
        setPinnedIncomplete(item, true);
    }

    // --- Optimistic UI ---
    // Canvas's /planner/overrides endpoint occasionally returns 400 (Bad
    // Request) for both custom tasks and normal tasks, even though the action
    // is actually applied server-side shortly after. When that happens the
    // item would neither visually mark nor animate, and would later appear
    // "secretly complete" on reload. To avoid that confusing UX, we update the
    // UI as if the request succeeded immediately, and fire the actual API
    // call in the background for persistence.
    item.planner_override = item.planner_override || {};
    item.planner_override.marked_complete = completeState;
    element.style.transform = "translate(100%)";
    element.style.opacity = "0";

    // fire confetti only when marking complete (not when unmarking)
    if (completeState) {
        try { createConfettiBurst(element); } catch (e) { console.error('confetti trigger error', e); }
    }

    // update progress rings immediately so they animate while the item slides/fades
    const progressPlaceholder = document.getElementById("better-todo-progress-placeholder");
    if (progressPlaceholder && typeof assignments?.then === 'function' && progressRingsEnabled()) {
        assignments.then(data => {
            const courseId = getCurrentCourseId();
            const scopedData = getTodoScopedData(data.map(d => Object.assign({}, d)), courseId);

            // reflect the updated state for this item in the snapshot
            for (let i = 0; i < scopedData.length; i++) {
                if (scopedData[i].plannable_id === item.plannable_id && scopedData[i].plannable_type === item.plannable_type) {
                    scopedData[i].planner_override = scopedData[i].planner_override || {};
                    scopedData[i].planner_override.marked_complete = item.planner_override.marked_complete;
                    break;
                }
            }

            renderProgressRings(progressPlaceholder, scopedData);
        });
    }

    setTimeout(() => {
        clearTodoList();
        createTodoSections(document.querySelector("#canvasrefined-todo-list"));
    }, 400);

    // --- Persistence (background, best-effort) ---
    // Toggle the planner override server-side. The override id returned by a
    // successful POST/PUT is stored on the in-memory item so subsequent
    // toggles PUT (update) instead of POSTing a duplicate. If a POST still
    // collides with an existing override (400 "already exists"), we look up
    // the real id and retry with a PUT. Only if all of that fails is the
    // response treated as a soft success: the UI already reflects the
    // intended state, so we just log it.
    const sendOverride = (override) => fetch(domain + "/api/v1/planner/overrides" + (override && override.id ? "/" + override.id : ""), {
        method: override && override.id ? "PUT" : "POST",
        headers: {
            "content-type": "application/json",
            "accept": "application/json",
            "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
            id: override && override.id ? override.id : null,
            marked_complete: completeState,
            plannable_id: item.plannable_id,
            plannable_type: item.plannable_type
        })
    });

    sendOverride(item.planner_override)
    .then(async resp => {
        if (resp.ok) {
            // Capture the override id from the response. A POST creates the
            // override server-side with an id we don't know yet; without
            // storing it, every later toggle on this item would POST again and
            // collide with the existing override (400 "already exists"), so
            // unchecking would never actually persist.
            try {
                const saved = await resp.json();
                if (saved && saved.id) {
                    item.planner_override = item.planner_override || {};
                    item.planner_override.id = saved.id;
                }
            } catch (e) { /* no JSON body; id stays unknown */ }
            console.log("marked as complete");
            return;
        }
        // A POST can return 400 because an override already exists server-side
        // under an id we never learned (e.g. it was created earlier without the
        // response being captured). Look up the user's overrides, find the one
        // for this item, and retry with a PUT so the toggle actually persists.
        if (!(item.planner_override && item.planner_override.id)) {
            try {
                const listResp = await fetch(domain + "/api/v1/planner/overrides", {
                    headers: { "accept": "application/json" }
                });
                if (listResp.ok) {
                    const overrides = await listResp.json();
                    const match = (Array.isArray(overrides) ? overrides : []).find(o =>
                        o &&
                        String(o.plannable_id) === String(item.plannable_id) &&
                        String(o.plannable_type).toLowerCase() === String(item.plannable_type).toLowerCase());
                    if (match && match.id) {
                        item.planner_override = item.planner_override || {};
                        item.planner_override.id = match.id;
                        const retry = await sendOverride(item.planner_override);
                        if (!retry.ok) {
                            console.warn("planner override PUT retry returned", retry.status);
                        }
                        return;
                    }
                }
            } catch (e) {
                console.error("error recovering planner override id", e);
            }
        }
        // Still non-OK with nothing to recover: logged but not surfaced, the
        // UI already reflects the intended state.
        console.warn("planner override request returned", resp.status, "— UI already updated optimistically");
    })
    .catch(err => console.error("error marking as complete", err));

}

function createTodoViewMore(location, type) {
    let viewMoreButton = makeElement("button", location, { "className": "canvasrefined-custom-btn canvasrefined-viewmore-btn", "textContent": "View More" });
    //viewMoreButton.classList.add("canvasrefined-viewmore-btn");
    const showMoreCount = 3;
    viewMoreButton.addEventListener("click", function (e) {
        if (type === "announcement") {
            moreAnnouncementCount += showMoreCount;
        } else {
            moreAssignmentCount += showMoreCount;
        }
        loadBetterTodo();
    });
}

// better todo init
function setupBetterTodo() {
    // Better Todo list is removed from quizzes (it interferes with the quiz page).
    if (isQuizPage()) return;
    if (options.better_todo !== true || isGradesPage()) return;
    if (document.querySelector('#canvasrefined-todo-list')) return;
    let list = document.querySelector("#right-side");
    if (!list) return;
    //if (!list || list.childElementCount === 0 || list.children[0].id === "canvasrefined-todo-list") return;
    try {
        /* save the feedback to append it later */
        const feedback = list.querySelector(".events_list.recent_feedback");

        list.textContent = "";
        list = makeElement("div", list, { "className": "canvasrefined-todosidebar","id": "canvasrefined-todo-list"});
        createTodoSections(list);

        if (feedback) list.append(feedback);

    } catch (e) {
        logError(e);
    }
}

let delay;
let moreAssignmentCount = 0;
let moreAnnouncementCount = 0;
let filter = "todo";
async function loadBetterTodo() {
    if (options.better_todo !== true || isGradesPage()) return;
    try {
        await getColors();
        const discussion_svg = '<svg class="canvasrefined-todo-svg" name="IconDiscussion" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false"  ><g role="presentation"><path d="M677.647059,16 L677.647059,354.936471 L790.588235,354.936471 L790.588235,129.054118 L1807.05882,129.054118 L1807.05882,919.529412 L1581.06353,919.529412 L1581.06353,1179.29412 L1321.41176,919.529412 L1242.24,919.529412 L1242.24,467.877647 L677.647059,467.877647 L0,467.877647 L0,1484.34824 L338.710588,1484.34824 L338.710588,1903.24706 L756.705882,1484.34824 L1242.24,1484.34824 L1242.24,1032.47059 L1274.99294,1032.47059 L1694.11765,1451.59529 L1694.11765,1032.47059 L1920,1032.47059 L1920,16 L677.647059,16 Z M338.789647,919.563294 L903.495529,919.563294 L903.495529,806.622118 L338.789647,806.622118 L338.789647,919.563294 Z M338.789647,1145.44565 L677.726118,1145.44565 L677.726118,1032.39153 L338.789647,1032.39153 L338.789647,1145.44565 Z M112.941176,580.705882 L1129.41176,580.705882 L1129.41176,1371.40706 L710.4,1371.40706 L451.651765,1631.05882 L451.651765,1371.40706 L112.941176,1371.40706 L112.941176,580.705882 Z" fill-rule="evenodd" stroke="none" stroke-width="1"></path></g></svg>';
        const quiz_svg = '<svg class="canvasrefined-todo-svg" label="Quiz" name="IconQuiz" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false"  ><g role="presentation"><g fill-rule="evenodd" stroke="none" stroke-width="1"><path d="M746.255375,1466.76417 L826.739372,1547.47616 L577.99138,1796.11015 L497.507383,1715.51216 L746.255375,1466.76417 Z M580.35118,1300.92837 L660.949178,1381.52637 L329.323189,1713.15236 L248.725192,1632.55436 L580.35118,1300.92837 Z M414.503986,1135.20658 L495.101983,1215.80457 L80.5979973,1630.30856 L0,1549.71056 L414.503986,1135.20658 Z M1119.32036,264.600006 C1475.79835,-91.8779816 1844.58834,86.3040124 1848.35034,88.1280123 L1848.35034,88.1280123 L1865.45034,96.564012 L1873.88634,113.664011 C1875.71034,117.312011 2053.89233,486.101999 1697.30034,842.693987 L1697.30034,842.693987 L1550.69635,989.297982 L1548.07435,1655.17196 L1325.43235,1877.81395 L993.806366,1546.30196 L415.712386,968.207982 L84.0863971,636.467994 L306.72839,413.826001 L972.602367,411.318001 Z M1436.24035,1103.75398 L1074.40436,1465.70397 L1325.43235,1716.61796 L1434.30235,1607.74796 L1436.24035,1103.75398 Z M1779.26634,182.406009 C1710.18234,156.41401 1457.90035,87.1020124 1199.91836,345.198004 L1199.91836,345.198004 L576.90838,968.207982 L993.806366,1385.10597 L1616.70235,762.095989 C1873.65834,505.139998 1804.68834,250.920007 1779.26634,182.406009 Z M858.146371,525.773997 L354.152388,527.597997 L245.282392,636.467994 L496.310383,887.609985 L858.146371,525.773997 Z"></path><path d="M1534.98715,372.558003 C1483.91515,371.190003 1403.31715,385.326002 1321.69316,466.949999 L1281.22316,507.305998 L1454.61715,680.585992 L1494.97315,640.343994 C1577.16715,558.035996 1591.87315,479.033999 1589.82115,427.164001 L1587.65515,374.610003 L1534.98715,372.558003 Z"></path></g></g></svg>';
        const announcement_svg = '<svg class="canvasrefined-todo-svg" label="Announcement" name="IconAnnouncement" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false" ><g role="presentation"><path d="M1587.16235,31.2784941 C1598.68235,7.78672942 1624.43294,-4.41091764 1650.63529,1.46202354 C1676.16,7.56084707 1694.11765,30.2620235 1694.11765,56.4643765 L1694.11765,56.4643765 L1694.11765,570.459671 C1822.87059,596.662024 1920,710.732612 1920,847.052612 C1920,983.372612 1822.87059,1097.55614 1694.11765,1123.75849 L1694.11765,1123.75849 L1694.11765,1637.64085 C1694.11765,1663.8432 1676.16,1686.65732 1650.63529,1692.6432 C1646.23059,1693.65967 1641.93882,1694.11144 1637.64706,1694.11144 C1616.52706,1694.11144 1596.87529,1682.36555 1587.16235,1662.93967 C1379.23765,1247.2032 964.178824,1242.34673 960,1242.34673 L960,1242.34673 L564.705882,1242.34673 L564.705882,1807.05261 L652.461176,1807.05261 C640.602353,1716.92555 634.955294,1560.05026 715.934118,1456.37026 C768.338824,1389.2832 845.590588,1355.28791 945.882353,1355.28791 L945.882353,1355.28791 L945.882353,1468.22908 C881.392941,1468.22908 835.312941,1487.09026 805.044706,1525.71614 C736.263529,1613.58438 759.981176,1789.54673 774.776471,1849.97026 C778.955294,1866.79849 775.115294,1884.6432 764.498824,1898.30908 C753.769412,1911.97496 737.28,1919.99379 720,1919.99379 L720,1919.99379 L508.235294,1919.99379 C477.063529,1919.99379 451.764706,1894.80791 451.764706,1863.5232 L451.764706,1863.5232 L451.764706,1242.34673 L395.294118,1242.34673 C239.548235,1242.34673 112.941176,1115.73967 112.941176,959.993788 L112.941176,959.993788 L112.941176,903.5232 L56.4705882,903.5232 C25.2988235,903.5232 0,878.337318 0,847.052612 C0,815.880847 25.2988235,790.582024 56.4705882,790.582024 L56.4705882,790.582024 L112.941176,790.582024 L112.941176,734.111435 C112.941176,578.478494 239.548235,451.758494 395.294118,451.758494 L395.294118,451.758494 L959.887059,451.758494 C976.828235,451.645553 1380.36706,444.756141 1587.16235,31.2784941 Z M1581.17647,249.706729 C1386.46588,492.078494 1128.96,547.871435 1016.47059,560.746729 L1016.47059,560.746729 L1016.47059,1133.47144 C1128.96,1146.34673 1386.46588,1202.02673 1581.17647,1444.51144 L1581.17647,1444.51144 Z M903.529412,564.699671 L395.294118,564.699671 C301.891765,564.699671 225.882353,640.709082 225.882353,734.111435 L225.882353,734.111435 L225.882353,959.993788 C225.882353,1053.39614 301.891765,1129.40555 395.294118,1129.40555 L395.294118,1129.40555 L903.529412,1129.40555 L903.529412,564.699671 Z M1694.11765,688.144376 L1694.11765,1006.07379 C1759.73647,982.694965 1807.05882,920.577318 1807.05882,847.052612 C1807.05882,773.527906 1759.73647,711.5232 1694.11765,688.144376 L1694.11765,688.144376 Z" fill-rule="evenodd" stroke="none" stroke-width="1"></path></g></svg>';
        const assignment_svg = '<svg class="canvasrefined-todo-svg" label="Assignment" name="IconAssignment" viewBox="0 0 1920 1920" rotate="0" aria-hidden="true" role="presentation" focusable="false"><g role="presentation"><path d="M1468.2137,0 L1468.2137,564.697578 L1355.27419,564.697578 L1355.27419,112.939516 L112.939516,112.939516 L112.939516,1807.03225 L1355.27419,1807.03225 L1355.27419,1581.15322 L1468.2137,1581.15322 L1468.2137,1919.97177 L2.5243549e-29,1919.97177 L2.5243549e-29,0 L1468.2137,0 Z M1597.64239,581.310981 C1619.77853,559.174836 1655.46742,559.174836 1677.60356,581.310981 L1677.60356,581.310981 L1903.4826,807.190012 C1925.5058,829.213217 1925.5058,864.902104 1903.4826,887.038249 L1903.4826,887.038249 L1225.8455,1564.67534 C1215.22919,1575.17872 1200.88587,1581.16451 1185.86491,1581.16451 L1185.86491,1581.16451 L959.985883,1581.16451 C928.814576,1581.16451 903.516125,1555.86606 903.516125,1524.69475 L903.516125,1524.69475 L903.516125,1298.81572 C903.516125,1283.79477 909.501919,1269.45145 920.005294,1258.94807 L920.005294,1258.94807 Z M1442.35055,896.29929 L1016.45564,1322.1942 L1016.45564,1468.225 L1162.48643,1468.225 L1588.38135,1042.33008 L1442.35055,896.29929 Z M677.637094,1242.34597 L677.637094,1355.28548 L338.818547,1355.28548 L338.818547,1242.34597 L677.637094,1242.34597 Z M903.516125,1016.46693 L903.516125,1129.40645 L338.818547,1129.40645 L338.818547,1016.46693 L903.516125,1016.46693 Z M1637.62298,701.026867 L1522.19879,816.451052 L1668.22958,962.481846 L1783.65377,847.057661 L1637.62298,701.026867 Z M1129.39516,338.829841 L1129.39516,790.587903 L338.818547,790.587903 L338.818547,338.829841 L1129.39516,338.829841 Z M1016.45564,451.769356 L451.758062,451.769356 L451.758062,677.648388 L1016.45564,677.648388 L1016.45564,451.769356 Z" fill-rule="evenodd" stroke="none" stroke-width="1"></path></g></svg>';
        const x_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M18 6l-12 12"></path><path d="M6 6l12 12"></path></svg>';
        const check_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M5 12l5 5l10 -10"></path></svg>';
        const tag_svg = '<svg  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" /><path d="M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z" /></svg>';
        // end of SVGs

        const maxAssignmentCount = parseInt(options.num_todo_items) + moreAssignmentCount;
        const maxAnnouncementCount = parseInt(options.num_todo_items) + moreAnnouncementCount;
        const hr24 = options.todo_hr24;
        const now = new Date();
        //const csrfToken = CSRFtoken();
        let todoAnnouncements = document.querySelector("#canvasrefined-announcement-list");
        let todoAssignments = document.querySelector("#canvasrefined-todo-list");
        let assignmentsToInsert = [];
        let announcementsToInsert = [];

        assignments.then(data => {
            chrome.storage.sync.get(options.custom_assignments_overflow, storage => {
                //assignmentData = assignmentData === null ? data : assignmentData;
                let items = combineAssignments(data);
                items.forEach((item, index) => {
                    let date = new Date(item.plannable_date);
                    let itemState = options.assignment_states[item.plannable_id];

                    let svg;
                    switch (item.plannable_type) {
                        case "assignment": svg = assignment_svg; break;
                        case "discussion_topic": svg = discussion_svg; break;
                        case "quiz": svg = quiz_svg; break;
                        case "announcement": svg = announcement_svg; break;
                        default: return;
                    }

                    // if (item.plannable_type === "announcement") {
                    //if (announcementsToInsert.length >= maxAnnouncementCount + 1) return;
                    if (item.plannable_type !== "announcement") {
                        // leaving one extra assignment in the array to indicate there are more and the "view more" button should be created
                        if (assignmentsToInsert.length >= maxAssignmentCount + 1) return;
                        if (filter === "todo" && options.hide_completed === true && item.submissions.submitted === true) return;
                        if (filter === "todo" && ((options.todo_overdues !== true && now >= date) || (options.todo_overdues === true && item.submissions.submitted === true))) return;
                        if (filter === "done" && now <= date && !(itemState?.["rem"] === true || item?.submissions?.submitted === true)) return;
                        //if (item.plannable_type !== "assignment" && item.plannable_type !== "quiz" && item.plannable_type !== "discussion_topic") return;
                    }
                    if (filter === "todo" && ((itemState && itemState["rem"] === true) || (item.planner_override && item.planner_override.marked_complete === true))) return;

                    let listItemContainer = document.createElement("div");
                    listItemContainer.classList.add("canvasrefined-todo-container");
                    listItemContainer.innerHTML = '<div class="canvasrefined-hover-preview"><p class="canvasrefined-preview-title"></p><p class="canvasrefined-preview-text"></p></div><div class="canvasrefined-todo-actions"></div><div class="canvasrefined-todo-icon"></div><a class="canvasrefined-todo-item"><div class="canvasrefined-todo-item-header"></div></a><button class="canvasrefined-todo-actions-btn"><i class="icon-more canvasrefined-dots-icon" aria-hidden="true"></i></button>';
                    listItemContainer.querySelector(".canvasrefined-todo-item").href = item.html_url;
                    listItemContainer.dataset.id = item.plannable_id;
                    listItemContainer.querySelector('.canvasrefined-todo-icon').innerHTML += svg;

                    let listItem = listItemContainer.querySelector(".canvasrefined-todo-item");
                    const courseColor =
                        options.custom_cards_3?.[String(item.course_id)]?.color ??
                        options.custom_cards_3?.[item.course_id]?.color ??
                        options.custom_cards_3?.[item.plannable?.course_id]?.color ??
                        "#cccccc";
                    if (itemState?.["lbl"] && itemState["lbl"] !== "") {
                        makeElement("span", listItem.querySelector(".canvasrefined-todo-item-header"), { "className": "canvasrefined-todo-label", "textContent": itemState["lbl"] });
                    }
                    if (itemState?.["crs"] === true) {
                        listItemContainer.querySelector(".canvasrefined-todo-item").style.textDecoration = "line-through";
                    }
                    let title = makeElement("a", listItem.querySelector(".canvasrefined-todo-item-header"), { "className": "canvasrefined-todoitem-title", "textContent": item.plannable.title });
                    if (options.todo_hide_feedback === true) title.style = "color:" + courseColor + "!important;";
                    let course = makeElement("p", listItem, { "className": "canvasrefined-todoitem-course", "textContent": item.context_name });
                    course.style.color = courseColor;
                    let format = formatTodoDate(date, item.submissions, hr24);
                    let todoDate = makeElement("p", listItem, { "className": "canvasrefined-todoitem-date", "textContent": format.date });
                    if (format.dueSoon) todoDate.classList.add("canvasrefined-due-soon");

                    if (options.hover_preview === true) {
                        const customItem = item.planner_override && item.planner_override.custom && item.planner_override.custom === true;
                        listItem.addEventListener("mouseover", () => {
                            listItem.classList.add("canvasrefined-todo-hover");
                            let preview = listItemContainer.querySelector(".canvasrefined-hover-preview");
                            let previewTitle = preview.querySelector(".canvasrefined-preview-title");
                            let previewText = preview.querySelector(".canvasrefined-preview-text");
                            clearTimeout(delay);
                            delay = setTimeout(async () => {
                                if (listItem.classList.contains("canvasrefined-todo-hover")) {
                                    previewTitle.textContent = item.plannable.title;
                                    // custom assignment (planner note): preview its description/details
                                    if (customItem) {
                                        const details = item.plannable && item.plannable.details ? item.plannable.details : "";
                                        previewText.textContent = details === "" ? "No details given" : details.replace(/<\/?[^>]+(>|$)/g, " ");
                                    } else {
                                        console.log(item);
                                        let found = false;
                                        let searchCount = 1;
                                        while (searchCount < 5 && found === false) {
                                            for (let i = 0; i < announcements.length; i++) {
                                                if (announcements[i].id === item.plannable_id) {
                                                    found = true;
                                                    if (previewText.textContent === "") {
                                                        let description = item.plannable_type === "announcement" ? announcements[i].message : announcements[i].description;
                                                        previewText.textContent = description === "" ? "No details given" : description.replace(/<\/?[^>]+(>|$)/g, " ");
                                                    }
                                                    break;
                                                }
                                            }
                                            if (found === false) {
                                                let apiLink = domain + "/api/v1/";
                                                if (item.plannable_type === "assignment") {
                                                    apiLink += `courses/${item.course_id}/assignments/${item.plannable_id}`;
                                                } else if (item.plannable_type === "announcement") {
                                                    apiLink += `announcements?context_codes[]=course_${item.course_id}&per_page=3&page=${searchCount}`;
                                                }
                                                let data = await getData(apiLink);
                                                item.plannable_type === "announcement" ? announcements.push(...data) : announcements.push(data);
                                                searchCount++;
                                            }
                                        }
                                        if (found === false) {
                                            previewText.textContent = "Couldn't load preview";
                                        }
                                    }
                                    preview.style.display = "block";
                                }
                            }, 250);
                        });

                        listItem.addEventListener("mouseleave", () => {
                            listItem.classList.remove("canvasrefined-todo-hover");
                            listItemContainer.querySelector(".canvasrefined-hover-preview").style.display = "none";
                        });
                    }

                    const actions = listItemContainer.querySelector(".canvasrefined-todo-actions");

                    let clickOutActions = (e) => {
                        if (e.target.className.includes("canvasrefined")) return;
                        document.body.removeEventListener("click", clickOutActions);
                        actions.style.display = "none";
                    }

                    listItemContainer.querySelector(".canvasrefined-todo-actions-btn").addEventListener("click", () => {
                        actions.style.display = "block";
                        setTimeout(() => {
                            document.body.addEventListener("click", clickOutActions);
                        }, 100);
                    });

                    let removeBtn = makeElement("div", actions, { "className": "canvasrefined-todo-action", "textContent": "Remove" });
                    removeBtn.innerHTML += x_svg;
                    const dueAt = new Date(item.plannable_date).getTime();

                    let crossOffBtn = makeElement("div", actions, { "className": "canvasrefined-todo-action", "textContent": "Cross off" });
                    crossOffBtn.innerHTML += check_svg;
                    crossOffBtn.addEventListener("click", () => {
                        setAssignmentState(item.plannable_id, { "crs": listItemContainer.querySelector(".canvasrefined-todo-item").style.textDecoration === "line-through" ? false : true, "expire": dueAt });
                    });
                    let label = makeElement("span", actions, { "className": "canvasrefined-todo-action-tag", "textContent": "Label:" });
                    label.innerHTML += tag_svg;
                    let labelInput = makeElement("input", actions, { "className": "canvasrefined-todo-input", "type": "text", "placeholder": "Label", "value": itemState && itemState["lbl"] ? itemState["lbl"] : "" });
                    labelInput.addEventListener("change", (e) => {
                        setAssignmentState(item.plannable_id, { "lbl": e.target.value, "expire": dueAt });
                    });

                    removeBtn.addEventListener('click', function () {
                        setAssignmentState(item.plannable_id, { "rem": filter === "todo", "expire": dueAt });
                        if (item.planner_override && item.planner_override.custom && item.planner_override.custom === true) {
                            // set item as complete locally
                            chrome.storage.sync.get("custom_assignments_overflow", overflow => {
                                chrome.storage.sync.get(overflow["custom_assignments_overflow"], storage => {
                                    overflow["custom_assignments_overflow"].forEach(overflow => {
                                        for (let i = 0; i < storage[overflow].length; i++) {
                                            if (storage[overflow][i].plannable_id === item.plannable_id) {
                                                storage[overflow].splice(i, 1);
                                                chrome.storage.sync.set({ [overflow]: storage[overflow] }).then(() => {
                                                });
                                                break;
                                            }
                                        }
                                    });
                                });
                            });
                        }
                    });

                    if (item.plannable_type === "announcement") {
                        announcementsToInsert.push(listItemContainer);
                    } else {
                        assignmentsToInsert.push(listItemContainer);
                        if (item.submissions && item.submissions.submitted) {
                            listItemContainer.classList.add("canvasrefined-todo-item-completed");
                        }
                    }


                });

                // appending assignments all at once
                todoAssignments.textContent = "";
                if (assignmentsToInsert.length > 0) {
                    let i;
                    for (i = 0; i < (assignmentsToInsert.length > maxAssignmentCount ? maxAssignmentCount : assignmentsToInsert.length); i++) {
                        todoAssignments.append(assignmentsToInsert[i]);
                    }
                    if (i !== assignmentsToInsert.length) createTodoViewMore(todoAssignments, "assignment");
                } else {
                    makeElement("p", todoAssignments, { "className": "canvasrefined-none-due", "textContent": "None" });
                }

                // appending announcements all at once
                todoAnnouncements.textContent = "";
                if (announcementsToInsert.length > 0) {
                    let i;
                    for (i = announcementsToInsert.length - 1; i >= (announcementsToInsert.length - maxAnnouncementCount < 0 ? 0 : announcementsToInsert.length - maxAnnouncementCount); i--) {
                        todoAnnouncements.append(announcementsToInsert[i]);
                    }
                    if (i !== -1) createTodoViewMore(todoAnnouncements, "announcement");
                } else {
                    makeElement("p", todoAnnouncements, { "className": "canvasrefined-none-due", "textContent": "None" });
                }

                cleanCustomAssignments();
            });
        });

    } catch (e) {
        logError(e);
    }
}