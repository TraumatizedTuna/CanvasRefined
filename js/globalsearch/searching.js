// --- Searching --------------------------------------------------------------

async function runGlobalSearch(query, resultsEl) {
    if (!globalSearchIndex && globalSearchIndexPromise) {
        resultsEl.innerHTML = `<div class="canvasrefined-gs-loading">Building search index\u2026</div>`;
    }
    const index = await ensureGlobalSearchIndex();
    if (!query) {
        resultsEl.innerHTML = `<div class="canvasrefined-gs-hint">Start typing to search your modules and assignments.</div>`;
        return [];
    }
    if (!index || !index.length) {
        resultsEl.innerHTML = `<div class="canvasrefined-gs-hint">No modules or assignments found. Open the search again later if your courses are still loading.</div>`;
        return [];
    }

    const q = query.toLowerCase();
    const matches = [];
    for (const item of index) {
        // Re-check hidden status at search time so a card hidden after the index
        // was cached (10-min TTL) never surfaces in results.
        if (isCourseHidden(item.courseId)) continue;
        const t = (item.title || "").toLowerCase();
        const c = (item.course || "").toLowerCase();
        let score = -1;
        if (t.startsWith(q)) score = 100 - t.indexOf(q);
        else if (t.includes(q)) score = 60 - t.indexOf(q);
        else if (c.includes(q)) score = 20;
        if (score >= 0) { item._score = score + (t === q ? 50 : 0); matches.push(item); }
    }
    matches.sort((a, b) => b._score - a._score);
    const top = matches.slice(0, 50);

    if (!top.length) {
        resultsEl.innerHTML = `<div class="canvasrefined-gs-hint">No results for \u201c${escapeGlobalSearchHtml(query)}\u201d.</div>`;
        return [];
    }

    resultsEl.innerHTML = top.map((item, i) => `
        <div class="canvasrefined-gs-row" data-i="${i}" data-url="${escapeGlobalSearchAttr(item.url)}">
            <div class="canvasrefined-gs-row-main">
                <span class="canvasrefined-gs-type canvasrefined-gs-type-${escapeGlobalSearchAttr((item.type || "").toLowerCase().replace(/\s+/g, "-"))}">${escapeGlobalSearchHtml(item.type || "")}</span>
                <span class="canvasrefined-gs-title">${escapeGlobalSearchHtml(item.title || "")}</span>
            </div>
            <span class="canvasrefined-gs-course">${escapeGlobalSearchHtml(item.course || "")}</span>
        </div>`).join("");

    resultsEl.querySelectorAll(".canvasrefined-gs-row").forEach((row) => {
        // Plain click / Ctrl+click: honor modifier for new-tab behavior.
        row.addEventListener("click", (e) => {
            const url = row.getAttribute("data-url");
            const item = top.find(x => x.url === url);
            if (item) openGlobalSearchResult(item, e.ctrlKey || e.metaKey || (e.button === 1));
        });
        // Middle-click opens in a new tab without closing the search.
        row.addEventListener("auxclick", (e) => {
            if (e.button !== 1) return;
            e.preventDefault();
            const url = row.getAttribute("data-url");
            const item = top.find(x => x.url === url);
            if (item) openGlobalSearchResult(item, true);
        });
    });
    return top;
}

function escapeGlobalSearchHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function escapeGlobalSearchAttr(s) {
    return escapeGlobalSearchHtml(s).replace(/`/g, "&#96;");
}

function changeGradientCards() {
    if (options.gradient_cards === true) {
        let cardheads = document.querySelectorAll('.ic-DashboardCard__header_hero');

        // Create the style once; re-appending triggers the MutationObserver and re-runs this function.
        let cardcss = document.querySelector("#gradientcss");
        if (!cardcss) {
            cardcss = document.createElement('style');
            cardcss.id = "gradientcss";
            document.documentElement.appendChild(cardcss);
        }

        // Build CSS into a string and only touch the DOM if it changed.
        let css = "";
        for (let i = 0; i < cardheads.length; i++) {
            let colorone = cardheads[i].style.backgroundColor.split(',');
            let [r, g, b] = [parseInt(colorone[0].split('(')[1]), parseInt(colorone[1]), parseInt(colorone[2])];
            let [h, s, l] = [rgbToHsl(r, g, b)[0], rgbToHsl(r, g, b)[1], rgbToHsl(r, g, b)[2]];
            let degree = ((h % 60) / 60) >= .66 ? 30 : ((h % 60) / 60) <= .33 ? -30 : 15;
            let newh = h > 300 ? (360 - (h + 65)) + (65 + degree) : h + 65 + degree;
            css += ".ic-DashboardCard:nth-of-type(" + (i + 1) + ") .ic-DashboardCard__header_hero{background: linear-gradient(115deg, hsl(" + h + "deg," + s + "%," + l + "%) 5%, hsl(" + newh + "deg," + s + "%," + l + "%) 100%)!important}";
        }

        if (cardcss.textContent !== css) {
            cardcss.textContent = css;
        }

    } else {
        let cardcss = document.querySelector("#gradientcss");
        if (cardcss && cardcss.textContent !== "") {
            cardcss.textContent = "";
        }
    }
}

function showUpdateMsg() {
    // dont run if not on dashboard
    const el = document.getElementById("announcementWrapper");
    if (!el) return;

    // option off or div already created
    let div = document.getElementById("canvasrefined-update-msg");
    if (options.show_updates !== true || options.update_msg === "") {
        if (div) div.style.display = "none";
        return;
    } else if (div) {
        div.style.display = "flex";
        return;
    }

    // first creation
    div = makeElement("div", el, { "id": "canvasrefined-update-msg" });
    makeElement("p", div, { "textContent": options.update_msg });
    const close = makeElement("button", div, { "id": "canvasrefined-update-close", "textContent": "Close" });
    close.addEventListener("click", () => {
        readUpdate();
        div.remove();
    });
}

function readUpdate() {
    chrome.storage.sync.set({ "update_msg": "" });
}