/** TODO_tuna
 * I just threw a bunch of stuff in here to get it out of the way.
 * These features deserve their own files but I'm not doing that right now.
 */


function setupAssignmentsSlider(initial) {
    let el = document.querySelector('#numAssignmentsSlider');
    el.value = initial;
    document.querySelector('#numAssignments').textContent = initial;
    el.addEventListener('input', function () {
        document.querySelector('#numAssignments').textContent = this.value;
        chrome.storage.sync.set({ "num_assignments": this.value });
    });
}

function setupTodoSlider(initial) {
    let el = document.querySelector('#numTodoItemsSlider');
    el.value = initial;
    document.querySelector('#numTodoItems').textContent = initial;
    document.querySelector('#numTodoItemsSlider').addEventListener('input', function () {
        document.querySelector('#numTodoItems').textContent = this.value;
        chrome.storage.sync.set({ "num_todo_items": this.value });
    });
}

function setupSidebarScaleSlider(initial) {
    let el = document.querySelector("#sidebarScaleSlider");
    if (!el) return;
    el.value = initial;
    document.querySelector("#sidebarScaleValue").textContent = initial;
    el.addEventListener("input", function () {
        document.querySelector("#sidebarScaleValue").textContent = this.value;
        chrome.storage.sync.set({ "sidebar_scale": parseInt(this.value) });
    });
}



// Progress display dropdown. Normalizes legacy boolean values:
// true -> rings, false/undefined -> none.
function setupProgressRingsSelect(initial) {
    const el = document.querySelector("#todo_progress_rings");
    if (!el) return;
    let value = initial;
    if (value === true) value = "rings";
    else if (value === false || value === undefined || value === null) value = "none";
    const allowed = ["none", "rings", "rainbow", "lines", "line"];
    if (!allowed.includes(value)) value = "rings";
    el.value = value;
    el.addEventListener("change", function () {
        chrome.storage.sync.set({ "todo_progress_rings": this.value });
    });
}

// Timeframe dropdown for the upcoming Tasks tab. Persisted so the Better Todo
// List remembers the selected range across sessions.
function setupTimeframeSelect(initial) {
    const el = document.querySelector("#todo_timeframe");
    if (!el) return;
    const allowed = ["all", "1week", "2week", "month", "2month"];
    let value = allowed.includes(initial) ? initial : "all";
    el.value = value;
    el.addEventListener("change", function () {
        chrome.storage.sync.set({ "todo_timeframe": this.value });
    });
}





function setupCustomBackgroundLink(initial) {
    let el = document.querySelector("#customBackgroundLink");
    el.value = initial || "";
    toggleOpacityOptions();
    el.addEventListener("input", (e) => {
        chrome.storage.sync.set({ "customBackgroundLink": e.target.value });
        renderBackgroundPresetSelection();
        toggleOpacityOptions();
    });
}

function setupCustomBackgroundScale(initial) {
    const el = document.querySelector("#customBackgroundScale");
    const output = document.querySelector("#customBackgroundScaleValue");
    if (!el || !output) return;
    const value = Number(initial) || 100;
    el.value = value;
    output.textContent = `${value}%`;
    el.addEventListener("input", (e) => {
        const nextValue = parseInt(e.target.value);
        output.textContent = `${nextValue}%`;
        chrome.storage.sync.set({ "customBackgroundScale": nextValue });
        renderBackgroundPresetSelection();
    });
}

function getDailyBackgroundPreset() {
    if (typeof backgroundPresets === "undefined" || !Array.isArray(backgroundPresets) || backgroundPresets.length === 0) {
        return null;
    }

    const today = new Date();
    const dayNumber = Math.floor(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
    return backgroundPresets[Math.abs(dayNumber) % backgroundPresets.length];
}

function syncCustomBackgroundDailyState(isDaily) {
    const manualControls = document.getElementById("customBackgroundManualControls");
    if (manualControls) {
        manualControls.style.opacity = isDaily ? "0.45" : "1";
        manualControls.style.pointerEvents = isDaily ? "none" : "auto";
        manualControls.style.filter = isDaily ? "grayscale(1)" : "none";
    }

    ["customBackgroundLink", "customBackgroundScale", "clearCustomBackground"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isDaily;
    });

    document.querySelectorAll(".background-preset-card").forEach(button => {
        button.disabled = isDaily;
    });

    renderBackgroundPresetSelection();
}

function renderBackgroundPresetSelection() {
    const isDaily = document.querySelector("#customBackgroundDaily")?.checked === true || document.querySelector("#customBackgroundNasaDaily")?.checked === true;
    const dailyPreset = isDaily ? getDailyBackgroundPreset() : null;
    const currentLink = isDaily ? (dailyPreset?.url || "") : (document.querySelector("#customBackgroundLink")?.value || "");
    const currentScale = isDaily ? String(dailyPreset?.scale || "100") : String(document.querySelector("#customBackgroundScale")?.value || "100");
    document.querySelectorAll(".background-preset-card").forEach(button => {
        const matchesLink = button.dataset.backgroundUrl === currentLink;
        const matchesScale = button.dataset.backgroundScale === currentScale;
        button.classList.toggle("selected", matchesLink && matchesScale);
    });
}

function displayBackgroundPresets() {
    const container = document.querySelector("#background-presets");
    if (!container || container.dataset.rendered === "true" || typeof backgroundPresets === "undefined") return;
    container.dataset.rendered = "true";
    container.innerHTML = backgroundPresets.map(preset => `
        <button type="button" class="theme-button customization-button background-preset-card" data-background-url="${preset.url}" data-background-scale="${preset.scale}" style="background-image: linear-gradient(rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0.42)), url('${preset.url}');">
            <p class="theme-button-title">${preset.title}</p>
            <p class="theme-button-creator">${preset.credit}</p>
            <p class="background-preset-scale">Scale ${preset.scale}%</p>
        </button>
    `).join("");

    container.querySelectorAll(".background-preset-card").forEach(button => {
        button.addEventListener("click", () => {
            const backgroundUrl = button.dataset.backgroundUrl;
            const backgroundScale = parseInt(button.dataset.backgroundScale);
            document.querySelector("#customBackgroundLink").value = backgroundUrl;
            document.querySelector("#customBackgroundScale").value = backgroundScale;
            document.querySelector("#customBackgroundScaleValue").textContent = `${backgroundScale}%`;
            chrome.storage.sync.set({ "customBackgroundLink": backgroundUrl, "customBackgroundScale": backgroundScale });
            renderBackgroundPresetSelection();
            toggleOpacityOptions();
        });
    });
    renderBackgroundPresetSelection();
    syncCustomBackgroundDailyState(document.querySelector("#customBackgroundDaily")?.checked === true || document.querySelector("#customBackgroundNasaDaily")?.checked === true);
}

function toggleBetterSidebarSubOptions(betterSidebarOn) {
    const remlogoEl = document.getElementById("remlogo");
    if (remlogoEl) {
        remlogoEl.style.display = betterSidebarOn ? "none" : "flex";
    }
    const sidebarScaleEl = document.getElementById("sidebarScaleSub");
    if (sidebarScaleEl) {
        sidebarScaleEl.style.display = betterSidebarOn ? "block" : "none";
    }
}




// "Alternate colors" (Better Todo List sub-option) only makes sense in light
// mode, so hide its checkbox whenever dark mode is on.
function toggleAlternateColorsVisibility(darkModeOn) {
    const wrap = document.getElementById("todo_alternate_colors_wrap");
    if (wrap) wrap.style.display = darkModeOn ? "none" : "";
}


function setupFeatureSearch(menu) {
    const searchInput = document.querySelector("#feature-search");
    const resultsEl = document.querySelector("#feature-search-results");
    const headerSearch = document.querySelector("#header-search");
    if (!searchInput || !resultsEl || !headerSearch) return;

    // Map (reference-keyed) each .tab element -> the button id that opens it.
    // A plain object won't work: DOM elements stringify to the same key.
    const tabElToBtnId = new Map();
    Object.entries(menu.tabs).forEach(([btnId, info]) => {
        const tabEl = document.querySelector(info.tab);
        if (tabEl) tabElToBtnId.set(tabEl, btnId);
    });

    function shouldSkip(el) {
        // Skip overlays / scrapped containers that aren't real features
        if (el.closest('#submit-popup, #browser-settings-popup, #opt-in, #card-edit-menu')) return true;
        // Skip statically-hidden containers but keep dynamically-hidden sub-options.
        let node = el;
        while (node && node !== document.body) {
            if (node.classList && node.classList.contains('option-container') && node.style.display === 'none') return true;
            node = node.parentElement;
        }
        return false;
    }

    function labelOf(sub) {
        const label = sub.querySelector("label");
        if (label) return label.textContent.trim();
        const st = sub.querySelector(".sub-text");
        if (st) return st.textContent.trim();
        // Bare <span> label (e.g. Export Settings checkboxes have no label/.sub-text).
        const span = sub.querySelector("span");
        if (span) return span.textContent.trim();
        return "";
    }

    function keyIdOf(sub) {
        const label = sub.querySelector("label");
        if (label && label.getAttribute("for")) return label.getAttribute("for");
        const input = sub.querySelector("input");
        if (input && input.id) return input.id;
        return labelOf(sub);
    }

    function categoryFor(el) {
        const tabEl = el.closest(".tab");
        if (tabEl) {
            const btnId = tabElToBtnId.get(tabEl);
            if (btnId) {
                const btn = document.getElementById(btnId);
                const span = btn && btn.querySelector("span");
                if (span) return span.textContent.trim();
            }
            return "Section";
        }
        if (el.classList && el.classList.contains("tab-btn")) return "Section";
        if (el.classList && el.classList.contains("option")) return "Settings";
        const owner = el.closest(".option");
        if (owner) {
            const name = owner.querySelector(".option-name");
            if (name) return name.textContent.trim();
        }
        return "Settings";
    }

    function openTab(btnId) {
        const btn = document.getElementById(btnId);
        if (btn) btn.click();
    }

    function showMain() {
        const back = document.querySelector(".back-btn");
        if (back) back.click();
    }

    // Reveal any hidden sub-option blocks between el and .main so the target
    // is visible (purely visual; doesn't change stored settings).
    function revealAncestors(el) {
        const main = document.querySelector(".main");
        let node = el;
        while (node && node !== main && node !== document.body) {
            if (node.style && node.style.display === "none") node.style.display = "";
            node = node.parentElement;
        }
    }

    function highlight(el) {
        el.classList.add("search-highlight");
        setTimeout(() => el.classList.remove("search-highlight"), 2000);
    }

    function goToMainElement(el) {
        showMain();
        revealAncestors(el);
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            highlight(el);
        });
    }

    function goToTabElement(el) {
        const tabEl = el.closest(".tab");
        const btnId = tabElToBtnId.get(tabEl);
        if (btnId) openTab(btnId);
        requestAnimationFrame(() => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            highlight(el);
        });
    }

    let featureIndex = null;
    let currentMatches = [];
    let activeIndex = -1;

    function buildIndex() {
        const index = [];
        const seen = new Set();
        function add(entry) {
            if (!entry.text || seen.has(entry.key)) return;
            seen.add(entry.key);
            index.push(entry);
        }

        // Big section buttons (Edit Dark Mode, Cards, Themes, Styles, GPA Settings, Report issue)
        document.querySelectorAll(".more-options-container .tab-btn").forEach(btn => {
            const span = btn.querySelector("span");
            add({ key: "tab:" + btn.id, text: span ? span.textContent.trim() : "", el: btn, action: () => openTab(btn.id) });
        });

        // Home: option toggles
        document.querySelectorAll(".options .option").forEach(opt => {
            if (!opt.id) return;
            const name = opt.querySelector(".option-name");
            if (!name) return;
            if (shouldSkip(opt)) return;
            add({ key: "option:" + opt.id, text: name.textContent.trim(), el: opt, action: () => goToMainElement(opt) });
        });

        // Home: sub-options / timesets / labelled rows (e.g. "Use dd/mm", "Start time", max-items)
        document.querySelectorAll(".options .sub-option, .options .timeset, .options .sub-options > div").forEach(sub => {
            if (shouldSkip(sub)) return;
            // Skip statically-hidden sub-options; dynamically-hidden ones stay indexed.
            if (sub.classList.contains("sub-option") && sub.style.display === "none") return;
            const text = labelOf(sub);
            if (!text) return;
            add({ key: "sub:" + keyIdOf(sub), text, el: sub, action: () => goToMainElement(sub) });
        });

        // Home: custom Canvas URL
        const customDomain = document.querySelector("#customDomain");
        if (customDomain && !shouldSkip(customDomain)) {
            const wrap = customDomain.closest(".customDomain");
            const label = wrap ? wrap.querySelector("[data-i18n='enter_url']") : null;
            add({ key: "custom:customDomain", text: label ? label.textContent.trim() : "Canvas URL", el: wrap || customDomain, action: () => goToMainElement(wrap || customDomain) });
        }

        // Tabs: section headings (e.g. "Presets", "Custom styles", "Popular Palettes", "Custom Background")
        document.querySelectorAll(".tab .header-small").forEach(h => {
            if (shouldSkip(h)) return;
            const text = h.textContent.trim();
            if (!text) return;
            const btnId = tabElToBtnId.get(h.closest(".tab"));
            add({ key: "heading:" + (btnId || "?") + ":" + text, text, el: h, action: () => goToTabElement(h) });
        });

        // Tabs: checkbox sub-options (e.g. "Daily Random Image", "Custom Card Styles")
        document.querySelectorAll(".tab .sub-option").forEach(sub => {
            if (shouldSkip(sub)) return;
            const text = labelOf(sub);
            if (!text) return;
            const btnId = tabElToBtnId.get(sub.closest(".tab"));
            add({ key: "tabsub:" + (btnId || "?") + ":" + keyIdOf(sub), text, el: sub, action: () => goToTabElement(sub) });
        });

        // Dark mode color fields (e.g. "Sidebar Text", "Background Main")
        document.querySelectorAll(".tab .color-type-header").forEach(h => {
            if (shouldSkip(h)) return;
            const text = h.textContent.trim();
            if (!text) return;
            const btnId = tabElToBtnId.get(h.closest(".tab"));
            add({ key: "color:" + (btnId || "?") + ":" + text, text, el: h, action: () => goToTabElement(h) });
        });

        // Tab: range sliders that live in dedicated rows (Opacity & Blur, Image scale).
        // These aren't .sub-option, so the generic blocks above miss them.
        document.querySelectorAll(".tab .opacity-slider-row, .tab .background-scale-row").forEach(row => {
            if (shouldSkip(row)) return;
            const label = row.querySelector(".sub-text");
            const input = row.querySelector("input[type='range']");
            if (!label || !input) return;
            const text = label.textContent.trim();
            if (!text) return;
            const btnId = tabElToBtnId.get(row.closest(".tab"));
            add({ key: "slider:" + (btnId || "?") + ":" + (input.id || text), text, el: row, action: () => goToTabElement(row) });
        });

        // Tab: preset buttons (dark mode presets + popular color palettes).
        document.querySelectorAll(".tab .preset-button").forEach(btn => {
            if (shouldSkip(btn)) return;
            const text = btn.textContent.trim().replace(/\s+/g, " ");
            if (!text || text === "placeholder") return;
            const btnId = tabElToBtnId.get(btn.closest(".tab"));
            add({ key: "preset:" + (btnId || "?") + ":" + (btn.id || text), text, el: btn, action: () => goToTabElement(btn) });
        });

        // Tab: standalone action buttons with distinct labels (GPA scale presets, revert colors).
        ["gpa-plus-minus", "gpa-by-letter", "revert-colors", "clearCustomBackground"].forEach(id => {
            const btn = document.getElementById(id);
            if (!btn || shouldSkip(btn)) return;
            const text = btn.textContent.trim();
            if (!text) return;
            add({ key: "action:" + id, text, el: btn, action: () => goToTabElement(btn) });
        });

        // Tab: checkbox/radio controls whose label is a bare sibling span and that
        // aren't wrapped in .sub-option (e.g. "Get Active Cards From Dashboard",
        // sidebar background "Solid/Gradient/Image").
        document.querySelectorAll(".tab input[type='checkbox'], .tab input[type='radio']").forEach(input => {
            if (!input.id) return;
            if (input.closest(".sub-option") || input.closest(".option")) return;
            if (shouldSkip(input)) return;
            const text = (input.parentElement && input.parentElement.textContent.trim()) || "";
            if (!text) return;
            const btnId = tabElToBtnId.get(input.closest(".tab"));
            add({ key: "control:" + (btnId || "?") + ":" + input.id, text, el: input, action: () => goToTabElement(input) });
        });

        return index;
    }

    function filterFeatures(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        if (!featureIndex) featureIndex = buildIndex();
        const scored = [];
        for (const entry of featureIndex) {
            const t = entry.text.toLowerCase();
            let score = -1;
            if (t === q) score = 1000;
            else if (t.startsWith(q)) score = 500 - t.length;
            else {
                const idx = t.indexOf(q);
                if (idx !== -1) score = 200 - idx;
                else if (t.split(/\s+/).some(w => w.toLowerCase().startsWith(q))) score = 50;
            }
            if (score >= 0) scored.push({ entry, score });
        }
        scored.sort((a, b) => b.score - a.score || a.entry.text.length - b.entry.text.length);
        return scored.slice(0, 12).map(s => s.entry);
    }

    function renderResults(matches) {
        currentMatches = matches;
        activeIndex = matches.length ? 0 : -1;
        resultsEl.innerHTML = "";
        if (!matches.length) {
            const empty = document.createElement("div");
            empty.className = "search-result empty";
            empty.textContent = "No features found";
            resultsEl.appendChild(empty);
            resultsEl.classList.add("open");
            return;
        }
        matches.forEach((entry, i) => {
            const item = document.createElement("div");
            item.className = "search-result" + (i === activeIndex ? " active" : "");
            item.setAttribute("role", "option");
            const title = document.createElement("span");
            title.className = "search-result-title";
            title.textContent = entry.text;
            const cat = document.createElement("span");
            cat.className = "search-result-category";
            cat.textContent = categoryFor(entry.el);
            item.appendChild(title);
            item.appendChild(cat);
            item.addEventListener("mousedown", (e) => {
                e.preventDefault();
                selectResult(i);
            });
            resultsEl.appendChild(item);
        });
        resultsEl.classList.add("open");
    }

    function setActive(i) {
        activeIndex = i;
        const items = resultsEl.querySelectorAll(".search-result");
        items.forEach((el, idx) => el.classList.toggle("active", idx === i));
        const active = resultsEl.querySelector(".search-result.active");
        if (active) active.scrollIntoView({ block: "nearest" });
    }

    function closeResults() {
        resultsEl.classList.remove("open");
        resultsEl.innerHTML = "";
        currentMatches = [];
        activeIndex = -1;
    }

    function selectResult(i) {
        const entry = currentMatches[i];
        if (!entry) return;
        closeResults();
        searchInput.value = "";
        searchInput.blur();
        entry.action();
    }

    searchInput.addEventListener("input", () => {
        if (!searchInput.value.trim()) { closeResults(); return; }
        renderResults(filterFeatures(searchInput.value));
    });
    searchInput.addEventListener("focus", () => {
        if (searchInput.value.trim()) renderResults(filterFeatures(searchInput.value));
    });
    searchInput.addEventListener("keydown", (e) => {
        if (!currentMatches.length) {
            if (e.key === "Escape") searchInput.blur();
            return;
        }
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((activeIndex + 1) % currentMatches.length); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((activeIndex - 1 + currentMatches.length) % currentMatches.length); }
        else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0) selectResult(activeIndex); }
        else if (e.key === "Escape") { e.preventDefault(); closeResults(); searchInput.blur(); }
    });
    searchInput.addEventListener("blur", () => setTimeout(closeResults, 150));

    const icon = headerSearch.querySelector(".header-search-icon");
    if (icon) icon.addEventListener("click", () => searchInput.focus());

    document.addEventListener("click", (e) => {
        if (!e.target.closest("#header-search")) closeResults();
    });
}


function displayCustomFont() {
    chrome.storage.sync.get(["custom_font"], storage => {
        let el = document.querySelector(".custom-font");
        let linkContainer = document.querySelector(".custom-font-flex") || makeElement("div", el, {"className": "custom-font-flex" });
        linkContainer.innerHTML = '<span>https://fonts.googleapis.com/css2?family=</span><input class="card-input" id="custom-font-link"></input>';
        let link = linkContainer.querySelector("#custom-font-link");
        link.value = storage.custom_font.link;

        link.addEventListener("change", function (e) {
            let linkVal = e.target.value.split(":")[0];
            let familyVal = linkVal.replace("+", " ");
            linkVal += linkVal === "" ? "" : ":wght@400;700";
            familyVal = linkVal === "" ? "" : "'" + familyVal + "'";
            chrome.storage.sync.set({ "custom_font": { "link": linkVal, "family": familyVal } });
            link.value = linkVal;
        });

        const popularFonts = ["Arimo", "Barriecito", "Barlow", "Caveat", "Cinzel", "Comfortaa", "Corben", "DM Sans", "Expletus Sans", "Gluten", "Happy Monkey", "Inconsolata", "Inria Sans", "Jost", "Kanit", "Karla", "Kode Mono", "Lobster", "Lora", "Madimi One", "Mali", "Montserrat", "Nanum Myeongjo", "Open Sans", "Oswald", "Permanent Marker", "Playfair Display", "Poetsen One", "Poppins", "Quicksand", "Rakkas", "Redacted Script", "Roboto Mono", "Rubik", "Silkscreen", "Sixtyfour", "Syne Mono", "Tektur", "Texturina", "Ysabeau Infant", "Yuji Syuku"];
        let quickFonts = document.querySelector("#quick-fonts");
        quickFonts.textContent = "";
        let noFont = makeElement("button", quickFonts, { "className": "customization-button", "textContent": "None" });
        noFont.addEventListener("click", () => {
            chrome.storage.sync.set({ "custom_font": { "link": "", "family": "" } });
            link.value = "";
        })
        popularFonts.forEach(font => {
            let btn = makeElement("button", quickFonts, { "className":"customization-button", "textContent": font });
            btn.addEventListener("click", () => {
                let linkVal = font.replace(" ", "+") + ":wght@400;700";
                chrome.storage.sync.set({ "custom_font": { "link": linkVal, "family": "'" + font + "'" } });
                link.value = linkVal;
            });
        });
    });
}

function displayGPABounds() {
    chrome.storage.sync.get(["gpa_calc_bounds"], storage => {
        const order = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"];
        const el = document.querySelector(".gpa-bounds");
        el.textContent = "";
        order.forEach(key => {
            let inputs = makeElement("div", el, { "className": "gpa-bounds-item" });
            inputs.innerHTML += '<div><span class="gpa-bounds-grade"></span><input class="gpa-bounds-input gpa-bounds-cutoff" type="text"></input><span style="margin-left:6px;margin-right:6px;">%</span><input class="gpa-bounds-input gpa-bounds-gpa" type="text" value=></input><span style="margin-left:6px">GPA</span></div>';
            inputs.querySelector(".gpa-bounds-grade").textContent = key;
            inputs.querySelector(".gpa-bounds-cutoff").value = storage["gpa_calc_bounds"][key].cutoff;
            inputs.querySelector(".gpa-bounds-gpa").value = storage["gpa_calc_bounds"][key].gpa;

            inputs.querySelector(".gpa-bounds-cutoff").addEventListener("change", function (e) {
                chrome.storage.sync.get(["gpa_calc_bounds"], existing => {
                    chrome.storage.sync.set({ "gpa_calc_bounds": { ...existing["gpa_calc_bounds"], [key]: { ...existing["gpa_calc_bounds"][key], "cutoff": parseFloat(e.target.value) } } });
                });
            });

            inputs.querySelector(".gpa-bounds-gpa").addEventListener("change", function (e) {
                chrome.storage.sync.get(["gpa_calc_bounds"], existing => {
                    chrome.storage.sync.set({ "gpa_calc_bounds": { ...existing["gpa_calc_bounds"], [key]: { ...existing["gpa_calc_bounds"][key], "gpa": parseFloat(e.target.value) } } });
                });
            });
        });
    });
}