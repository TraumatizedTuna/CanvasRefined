// TODO_tuna - Most (if not all) functions should probably move to more specific places.

function combineAssignments(data) {
    let combined = data;
    try {
        options.custom_assignments_overflow.forEach(overflow => {
            combined = combined.concat(options[overflow]);
        });
    } catch (e) {
        logError(e);
    }
    return combined.sort((a, b) => new Date(a.plannable_date).getTime() - new Date(b.plannable_date).getTime());
}

function cleanCustomAssignments() {
    chrome.storage.sync.get("custom_assignments_overflow", overflows => {
        chrome.storage.sync.get(overflows["custom_assignments_overflow"], storage => {
            const now = new Date();

            overflows["custom_assignments_overflow"].forEach(overflow => {
                let changed = false;
                for (let i = 0; i < storage[overflow].length; i++) {
                    let assignmentDate = new Date(storage[overflow][i].plannable_date);
                    if (!assignmentDate.getTime() || assignmentDate < now) {
                        storage[overflow].splice(i, 1);
                        changed = true;
                    }
                }
                if (changed) chrome.storage.sync.set({ [overflow]: storage[overflow] });
            });

        });
    });
}

function setupCustomURL() {
    //let test = getData(`${domain}/api/v1/dashboard/dashboard_cards?include[]=concluded&include[]=term`);
    let test = getData(`${domain}/api/v1/courses?${/*enrollment_state=active&*/""}per_page=100`);
    test.then(res => {
        if (res.length) {
            getCards(res).then(() => {
                setTimeout(() => {
                    console.log("Canvas Refined - setting custom domain to " + domain);
                    chrome.storage.sync.set({ custom_domain: [domain] }).then(location.reload());
                }, 100);
            });
        } else {
            console.log("Canvas Refined - this url doesn't seem to be a canvas url (1)");
        }
    }).catch(err => {
        console.log("Canvas Refined - this url doesn't seem to be a canvas url (2)");
    });
}

function getGrades() {
    if (options.gpa_calc === true || options.dashboard_grades === true) {
        grades = getData(`${domain}/api/v1/courses?${/*enrollment_state=active&*/""}include[]=concluded&include[]=total_scores&include[]=computed_current_score&include[]=current_grading_period_scores&per_page=100`);
    }
}

function getColors() {
    if (options.tab_icons || options.better_todo || options.better_sidebar) {
        return getData(`${domain}/api/v1/users/self/colors`).then(data => {
            let cards = options.custom_cards_3;
            Object.keys(cards).forEach(key => {
                cards[key] = { ...cards[key], "color": data["custom_colors"]["course_" + key] ? data["custom_colors"]["course_" + key] : null };
            });
            chrome.storage.sync.set({ "custom_cards_3": cards });
            return cards;
        });
    }
}

function changeFavicon() {
    if (options.tab_icons !== true) return;
    let match = current_page.match(/courses\/(?<id>\d*)/);
    if (match && match.groups.id && options.custom_cards_3[match.groups.id]?.color) {
        document.querySelector('link[rel="icon"').href = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" fill="white" width="128px" height="128px" viewBox="-192 -192 2304.00 2304.00" stroke="white"><g stroke-width="0"><rect x="-192" y="-192" width="2304.00" height="2304.00" rx="0" fill="${options.custom_cards_3[match.groups.id].color.replace("#", "%23")}" strokewidth="0"/></g><g stroke-linecap="round" stroke-linejoin="round"/><g> <path d="M958.568 277.97C1100.42 277.97 1216.48 171.94 1233.67 34.3881 1146.27 12.8955 1054.57 0 958.568 0 864.001 0 770.867 12.8955 683.464 34.3881 700.658 171.94 816.718 277.97 958.568 277.97ZM35.8207 682.031C173.373 699.225 279.403 815.285 279.403 957.136 279.403 1098.99 173.373 1215.05 35.8207 1232.24 12.8953 1144.84 1.43262 1051.7 1.43262 957.136 1.43262 862.569 12.8953 769.434 35.8207 682.031ZM528.713 957.142C528.713 1005.41 489.581 1044.55 441.31 1044.55 393.038 1044.55 353.907 1005.41 353.907 957.142 353.907 908.871 393.038 869.74 441.31 869.74 489.581 869.74 528.713 908.871 528.713 957.142ZM1642.03 957.136C1642.03 1098.99 1748.06 1215.05 1885.61 1232.24 1908.54 1144.84 1920 1051.7 1920 957.136 1920 862.569 1908.54 769.434 1885.61 682.031 1748.06 699.225 1642.03 815.285 1642.03 957.136ZM1567.51 957.142C1567.51 1005.41 1528.38 1044.55 1480.11 1044.55 1431.84 1044.55 1392.71 1005.41 1392.71 957.142 1392.71 908.871 1431.84 869.74 1480.11 869.74 1528.38 869.74 1567.51 908.871 1567.51 957.142ZM958.568 1640.6C816.718 1640.6 700.658 1746.63 683.464 1884.18 770.867 1907.11 864.001 1918.57 958.568 1918.57 1053.14 1918.57 1146.27 1907.11 1233.67 1884.18 1216.48 1746.63 1100.42 1640.6 958.568 1640.6ZM1045.98 1480.11C1045.98 1528.38 1006.85 1567.51 958.575 1567.51 910.304 1567.51 871.172 1528.38 871.172 1480.11 871.172 1431.84 910.304 1392.71 958.575 1392.71 1006.85 1392.71 1045.98 1431.84 1045.98 1480.11ZM1045.98 439.877C1045.98 488.148 1006.85 527.28 958.575 527.28 910.304 527.28 871.172 488.148 871.172 439.877 871.172 391.606 910.304 352.474 958.575 352.474 1006.85 352.474 1045.98 391.606 1045.98 439.877ZM1441.44 1439.99C1341.15 1540.29 1333.98 1697.91 1418.52 1806.8 1579 1712.23 1713.68 1577.55 1806.82 1418.5 1699.35 1332.53 1541.74 1339.7 1441.44 1439.99ZM1414.21 1325.37C1414.21 1373.64 1375.08 1412.77 1326.8 1412.77 1278.53 1412.77 1239.4 1373.64 1239.4 1325.37 1239.4 1277.1 1278.53 1237.97 1326.8 1237.97 1375.08 1237.97 1414.21 1277.1 1414.21 1325.37ZM478.577 477.145C578.875 376.846 586.039 219.234 501.502 110.339 341.024 204.906 206.338 339.592 113.203 498.637 220.666 584.607 378.278 576.01 478.577 477.145ZM679.155 590.32C679.155 638.591 640.024 677.723 591.752 677.723 543.481 677.723 504.349 638.591 504.349 590.32 504.349 542.048 543.481 502.917 591.752 502.917 640.024 502.917 679.155 542.048 679.155 590.32ZM1440 475.712C1540.3 576.01 1697.91 583.174 1806.8 498.637 1712.24 338.159 1577.55 203.473 1418.51 110.339 1332.54 217.801 1341.13 375.413 1440 475.712ZM1414.21 590.32C1414.21 638.591 1375.08 677.723 1326.8 677.723 1278.53 677.723 1239.4 638.591 1239.4 590.32 1239.4 542.048 1278.53 502.917 1326.8 502.917 1375.08 502.917 1414.21 542.048 1414.21 590.32ZM477.145 1438.58C376.846 1338.28 219.234 1331.12 110.339 1415.65 204.906 1576.13 339.593 1710.82 498.637 1805.39 584.607 1696.49 577.443 1538.88 477.145 1438.58ZM679.155 1325.37C679.155 1373.64 640.024 1412.77 591.752 1412.77 543.481 1412.77 504.349 1373.64 504.349 1325.37 504.349 1277.1 543.481 1237.97 591.752 1237.97 640.024 1237.97 679.155 1277.1 679.155 1325.37Z"/></g></svg>`;
    }
}


function getAssignments() {
    if (options.assignments_due === true || options.better_todo === true) {
        // Fetch planner items from as far back as possible so overdue tasks
        // always appear, no matter how long ago they were due. The planner
        // API defaults start_date to "now" (which would hide every overdue
        // item), so a far-past start date is required. Canvas returns planner
        // items oldest-first in pages, so every page must be followed — a
        // single request would only return the oldest page and silently drop
        // all recent items.
        assignments = getAllPlannerItems();
        cardAssignments = preloadAssignmentEls();
    }
}

// Far-past start date for the planner items fetch. Concluded courses are
// excluded by the API by default, so this only pulls history from the user's
// currently active courses, which keeps the payload bounded.
const PLANNER_START_DATE = "2000-01-01";
// Hard cap on pages fetched (50 pages * 100 items = 5000 items) as a safety
// net against a malformed/misbehaving next link.
const PLANNER_MAX_PAGES = 50;

// Fetches every page of /api/v1/planner/items since PLANNER_START_DATE.
// Uses the same session/headers as getData but follows the Link "next"
// headers until exhausted.
async function getAllPlannerItems() {
    const allItems = [];
    let url = `${domain}/api/v1/planner/items?start_date=${PLANNER_START_DATE}&per_page=100`;
    for (let page = 0; page < PLANNER_MAX_PAGES && url; page++) {
        let response;
        let data;
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            data = await response.json();
        } catch (e) {
            break;
        }
        if (!response.ok || !Array.isArray(data)) break;
        // Deep-clone via JSON to unwrap Firefox Xray objects so nested props
        // are mutable (same as getData).
        try {
            data = JSON.parse(JSON.stringify(data));
        } catch (_) { /* keep original */ }
        allItems.push(...data);
        url = getNextPageUrl(response.headers.get("Link"));
    }
    return allItems;
}

// Extracts the rel="next" URL from a Canvas pagination Link header, or
// returns null when on the last page.
function getNextPageUrl(linkHeader) {
    if (!linkHeader) return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
}



/*
Smaller features
*/
// Debounced wrapper around applyAestheticChanges for card-style options that
// can fire many storage onChanged events in quick succession (number inputs).
// See the "cardPadding"/"imageSize"/etc. cases in applyOptionsChanges.
let aestheticDebounceTimer = null;
function debouncedApplyAestheticChanges(delay = 150) {
    if (aestheticDebounceTimer) clearTimeout(aestheticDebounceTimer);
    aestheticDebounceTimer = setTimeout(() => {
        aestheticDebounceTimer = null;
        applyAestheticChanges();
    }, delay);
}



/*
Quiz safe mode banner (pre-quiz pages only).
Shows an info box explaining the extension hasn't been approved by all teachers,
with a toggle for Quiz Safe Mode and a "Don't show again" button.
*/
function setupQuizSafeModeBanner() {
    if (!isQuizPreTakePage()) return;
    if (document.getElementById("canvasrefined-quiz-safe-banner")) return;

    chrome.storage.local.get("quiz_safe_mode_reminder_dismissed", local => {
        if (local && local.quiz_safe_mode_reminder_dismissed === true) return;
        chrome.storage.sync.get("quiz_safe_mode", sync => {
            const safeModeOn = sync && sync.quiz_safe_mode === true;
            injectQuizSafeModeBanner(safeModeOn);
        });
    });
}

function injectQuizSafeModeBanner(safeModeOn) {
    // Only inject into a real Canvas content container — never <body>, which
    // would place the banner outside the content area if it renders too early.
    const findContainer = () =>
        document.querySelector(".ic-Layout-contentMain") ||
        document.querySelector("#content") ||
        document.querySelector("#main");

    const insertInto = (container) => {
        if (!container) return false;
        if (document.getElementById("canvasrefined-quiz-safe-banner")) return true;

        const banner = makeElement("div", container, {
            id: "canvasrefined-quiz-safe-banner",
            className: "canvasrefined-quiz-safe-banner",
        }, true);

        makeElement("div", banner, {
            className: "canvasrefined-quiz-safe-title",
            textContent: "Canvas Refined — Quiz Safe Mode",
        });

        makeElement("p", banner, {
            className: "canvasrefined-quiz-safe-info",
            textContent: "This extension hasn't been 100% approved by all teachers. Quiz Safe Mode turns off most Canvas Refined features that could interfere with this quiz page, giving you the default Canvas quiz experience.",
        });

        const toggleRow = makeElement("div", banner, { className: "canvasrefined-quiz-safe-row" });
        const toggleWrap = makeElement("label", toggleRow, { className: "canvasrefined-quiz-safe-toggle" });
        const checkbox = makeElement("input", toggleWrap, { type: "checkbox" });
        checkbox.checked = !!safeModeOn;
        checkbox.addEventListener("change", () => {
            chrome.storage.sync.set({ quiz_safe_mode: checkbox.checked });
            // The storage.onChanged listener (applyOptionsChanges) reloads quiz pages.
        });
        makeElement("span", toggleWrap, {
            className: "canvasrefined-quiz-safe-toggle-label",
            textContent: "Enable Quiz Safe Mode",
        });

        const dismissBtn = makeElement("button", toggleRow, {
            className: "canvasrefined-quiz-safe-dismiss",
 type: "button",
            textContent: "Don't show again",
            title: "Hides this reminder permanently. You can still toggle Quiz Safe Mode in the extension popup.",
        });
        dismissBtn.addEventListener("click", () => {
            chrome.storage.local.set({ quiz_safe_mode_reminder_dismissed: true });
            banner.remove();
        });

        return true;
    };

    if (insertInto(findContainer())) return;

    // Content container not ready yet; wait for it (never fall back to <body>).
    const obs = new MutationObserver(() => {
        if (insertInto(findContainer())) obs.disconnect();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
}