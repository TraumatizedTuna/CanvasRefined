// TODO_tuna - Should the NASA stuff really be in this file?

const domain = window.location.origin;
let current_page = window.location.pathname;

// Canvas' "New Canvas" UI navigates client-side via history.pushState/
// replaceState without a full page reload. current_page is captured once at
// document_start, so without this hook it goes stale and page-specific features
// (Back to Assignment button, sequence-footer removal, profile logout button)
// never activate when the user clicks into a page instead of loading it directly.
function setupNavigationListener() {
    const update = () => {
        const next = window.location.pathname;
        if (next === current_page) return;
        current_page = next;
        // Re-run the page-scoped watchers so they evaluate against the new URL.
        watchSequenceFooter();
        watchSubmissionPageButton();
        watchProfileLogoutPageButton();
        watchGradeAnalytics();
    };
    for (const method of ["pushState", "replaceState"]) {
        const orig = history[method];
        history[method] = function (...args) {
            const ret = orig.apply(this, args);
            update();
            return ret;
        };
    }
    window.addEventListener("popstate", update);
}

function getCurrentCourseId() {
    const match = current_page.match(/^\/courses\/(\d+)(?:\/|$)/);
    // TODO_tuna - Why not match[0]? If [1] is correct, the condition should be match.length >= 2, right?
    return match ? parseInt(match[1]) : null;
}

function getSidebarLayoutMode() {
    if (current_page.match(/^\/courses\/(\d+)(?:\/|$)/)) return "course";
    if (isProfilePage()) return "course";
    if (current_page === "/courses" || current_page === "/courses/") return "dash";
    if (current_page === "/" || current_page === "") return "dash";
    return "dash";
}

function isGradesPage() {
    return /^\/courses\/\d+\/grades(?:\/|$)/.test(current_page);
}

function isCoursesIndexPage() {
    return /^\/courses\/?$/.test(current_page);
}

function isGroupsIndexPage() {
    return /^\/groups\/?$/.test(current_page);
}

function isConversationsPage() {
    return /^\/conversations(?:\/|$)/.test(current_page);
}

function isAccountsPage() {
    return /^\/accounts(?:\/|$)/.test(current_page);
}

function isProfilePage() {
    return /^\/profile(?:\/|$)/.test(current_page);
}

function isAssignmentPage() {
    return /^\/courses\/\d+\/assignments(?:\/\d+)?(?:\/|$)/.test(current_page);
}

// Quiz pages: /courses/123/quizzes/456 (pre-take/intro) and
// /courses/123/quizzes/456/take (the actual quiz).
function isQuizPage() {
    return /^\/courses\/\d+\/quizzes\/\d+(?:\/|$)/.test(current_page);
}
function isQuizTakePage() {
    return /^\/courses\/\d+\/quizzes\/\d+\/take(?:\/|$)/.test(current_page);
}
function isQuizPreTakePage() {
    return isQuizPage() && !isQuizTakePage();
}
// "Quiz safe mode" disables features that interfere with the default Canvas
// quiz experience. Only active on quiz pages when the user has opted in.
function quizSafeModeActive() {
    return isQuizPage() && options.quiz_safe_mode === true;
}

// Read the URL live: Canvas' "New Canvas" UI navigates client-side via
// history.pushState/replaceState, and current_page (captured at document_start)
// can be stale when the user clicks into a submission page. Reading
// window.location.pathname at check time makes this correct regardless.
function getSubmissionAssignmentLink() {
    const match = window.location.pathname.match(/^\/courses\/(\d+)\/assignments\/(\d+)\/submissions\/(\d+)(?:\/|$)/);
    if (!match) return null;
    return `${domain}/courses/${match[1]}/assignments/${match[2]}/`;
}

// The content container isn't always #content on every Canvas layout (submission
// pages in particular may render into .ic-Layout-contentMain or #main). Match the
// quiz-safe-mode banner's container finder so the button lands in the visible
// content area; fall back to <body> so injection never silently no-ops.
function findContentContainer() {
    return document.querySelector(".ic-Layout-contentMain")
        || document.getElementById("content")
        || document.querySelector("#main")
        || document.body;
}

let submissionPageButtonObserver = null;
let submissionButtonScheduled = false;
let assignmentButtonScheduled = false;
let profileLogoutButtonObserver = null;
let newCanvasButtonObserver = null;
let sequenceFooterObserver = null;

// Current user id, needed to build "Go to Grades" links on assignment pages.
// The page's ENV global isn't visible to content scripts (isolated world), so
// ask the Canvas API once and cache the result.
// undefined = not fetched yet, null = fetch failed, number = ok.
let currentUserIdCache;
let currentUserIdPromise = null;
function ensureCurrentUserId() {
    if (currentUserIdCache !== undefined) return Promise.resolve(currentUserIdCache);
    if (!currentUserIdPromise) {
        currentUserIdPromise = getData(`${domain}/api/v1/users/self`)
            .then(user => {
                currentUserIdCache = (user && user.id) || null;
            })
            .catch(() => {
                currentUserIdCache = null;
            })
            .then(() => {
                currentUserIdPromise = null;
                return currentUserIdCache;
            });
    }
    return currentUserIdPromise;
}

// Assignment pages (/courses/123/assignments/456) link to the current user's
// submission ("grades") page for that assignment. The lookahead keeps this
// from matching the submission pages themselves (/.../submissions/678).
function getAssignmentGradesLink() {
    const match = window.location.pathname.match(/^\/courses\/(\d+)\/assignments\/(\d+)(?!\/submissions)(?:\/|$)/);
    if (!match || currentUserIdCache == null) return null;
    return `${domain}/courses/${match[1]}/assignments/${match[2]}/submissions/${currentUserIdCache}`;
}

function addSubmissionPageButton() {
    const assignmentLink = getSubmissionAssignmentLink();
    if (!assignmentLink) return;
    // Place the button inline with the "Submission Details" heading and the
    // grade-values table, inside the .submission-details-header__heading-and-grades
    // flex row (appended so it sits to the right of the grade summary). Only inject
    // once that row exists; if it's not there yet the persistent MutationObserver
    // re-tries on the next DOM change so we never fall back to body/#content
    // (which would put the button at the bottom of the page).
    const row = document.querySelector(".submission-details-header__heading-and-grades")
        || document.querySelector(".submission-details-header")
        || document.querySelector(".submission_details");
    if (!row || row.querySelector("#canvasrefined-assignment-return")) return;

    // Insert between the h1 heading and the grade-summary div so it reads
    // [Heading] [Back to Assignment] [Grade]. Falls back to appending if the
    // grade-summary div isn't found for some reason.
    const gradeSummary = row.querySelector(".submission-details-header__grade-summary");
    const btn = makeElement("a", row, {
        id: "canvasrefined-assignment-return",
        className: "canvasrefined-custom-btn",
        href: assignmentLink,
        textContent: "Back to Assignment",
        style: "display:inline-flex;align-items:center;justify-content:center;align-self:center;margin-left:auto;margin-right:12px;padding:6px 12px;text-decoration:none;font-weight:700;color:inherit!important;",
    });
    if (gradeSummary && gradeSummary.parentNode === row) {
        row.insertBefore(btn, gradeSummary);
    }
}

// Assignment pages: /courses/123/assignments/456 — add a "Go to Grades" button
// to the right edge of the title row.
function addAssignmentPageButton() {
    const link = getAssignmentGradesLink();
    if (!link) return;
    // Place the button inside the assignment header's .title-content block,
    // pinned to its right edge on the title's line. .title-content is a plain
    // block wrapping the <h1>, so switch it to a flex row (h1 left, button
    // right); the h1 still wraps its text when long.
    const titleContent = document.querySelector(".assignment-title .title-content")
        || document.querySelector(".title-content");
    if (!titleContent || titleContent.querySelector("#canvasrefined-assignment-grades")) return;

    titleContent.style.display = "flex";
    titleContent.style.alignItems = "center";
    titleContent.style.gap = "12px";
    makeElement("a", titleContent, {
        id: "canvasrefined-assignment-grades",
        className: "canvasrefined-custom-btn",
        href: link,
        textContent: "Go to Grades",
        style: "display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-left:auto;padding:6px 12px;text-decoration:none;font-weight:700;font-size:16px;color:inherit!important;white-space:nowrap;",
    });
}

function addProfileLogoutPageButton() {
    if (!isProfilePage()) return;
    const content = document.getElementById("content");
    if (!content || content.querySelector("#canvasrefined-profile-logout")) return;

    makeElement("a", content, {
        id: "canvasrefined-profile-logout",
        className: "canvasrefined-custom-btn",
        href: `${domain}/logout`,
        textContent: "Logout",
        style: "display:inline-flex;align-items:center;justify-content:center;align-self:flex-start;margin:0 0 12px 0;padding:10px 14px;text-decoration:none;font-weight:700;",
    }, true);
}

function ensureProfileLogoutPageButton() {
    if (!isProfilePage()) return false;
    const content = document.getElementById("content");
    if (!content) return false;
    if (content.querySelector("#canvasrefined-profile-logout")) return true;
    addProfileLogoutPageButton();
    return Boolean(content.querySelector("#canvasrefined-profile-logout"));
}

function watchProfileLogoutPageButton() {
    if (!isProfilePage()) {
        document.getElementById("canvasrefined-profile-logout")?.remove();
        return;
    }
    if (ensureProfileLogoutPageButton()) return;
    if (profileLogoutButtonObserver) return;

    profileLogoutButtonObserver = new MutationObserver(() => {
        if (ensureProfileLogoutPageButton() && profileLogoutButtonObserver) {
            profileLogoutButtonObserver.disconnect();
            profileLogoutButtonObserver = null;
        }
    });

    profileLogoutButtonObserver.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
        if (profileLogoutButtonObserver) {
            profileLogoutButtonObserver.disconnect();
            profileLogoutButtonObserver = null;
        }
    }, 10000);
}

// Reconcile the button against the current page on a rAF-throttled schedule.
// Canvas (React-based "New Canvas" UI) re-renders the content area on SPA
// navigation and can wipe our injected node; a persistent observer re-adds it.
function maintainSubmissionPageButton() {
    if (submissionButtonScheduled) return;
    submissionButtonScheduled = true;
    requestAnimationFrame(() => {
        submissionButtonScheduled = false;
        const link = getSubmissionAssignmentLink();
        const existing = document.getElementById("canvasrefined-assignment-return");
        if (!link) {
            existing?.remove();
            return;
        }
        if (existing) {
            if (existing.href !== link) existing.href = link;
            return;
        }
        addSubmissionPageButton();
    });
}

// Same reconciliation pattern as maintainSubmissionPageButton, but for the
// "Go to Grades" button on assignment pages. The grades link needs the
// current user id, so on the first assignment page visit we kick off the API
// fetch and re-run once it resolves.
function maintainAssignmentPageButton() {
    if (assignmentButtonScheduled) return;
    assignmentButtonScheduled = true;
    requestAnimationFrame(() => {
        assignmentButtonScheduled = false;
        const isAssignmentPage = /^\/courses\/\d+\/assignments\/\d+(?!\/submissions)(?:\/|$)/.test(window.location.pathname);
        const existing = document.getElementById("canvasrefined-assignment-grades");
        if (!isAssignmentPage) {
            if (existing) {
                const titleContent = existing.closest(".title-content");
                existing.remove();
                // Undo the flex-row layout we applied to the title block.
                if (titleContent) {
                    titleContent.style.display = "";
                    titleContent.style.alignItems = "";
                    titleContent.style.gap = "";
                }
            }
            return;
        }
        if (currentUserIdCache === undefined) {
            ensureCurrentUserId().then(() => maintainAssignmentPageButton());
            return;
        }
        const link = getAssignmentGradesLink();
        if (!link) return;
        if (existing) {
            if (existing.href !== link) existing.href = link;
            return;
        }
        addAssignmentPageButton();
    });
}



function removeSequenceFooter() {
    if (options.hide_sequence_footer !== true) return false;
    if (!isAssignmentPage()) return false;
    const sequenceFooter = document.getElementById("sequence_footer");
    if (!sequenceFooter) return false;
    sequenceFooter.remove();
    return true;
}

// CSS-based hiding is the primary mechanism: the style element persists across
// Canvas re-renders and full reloads, so the footer can never flash back after
// the JS observer has removed it (or timed out) once.
function applyHideSequenceFooter() {
    let style = document.getElementById("canvasrefined-hide-sequence-footer");
    if (options.hide_sequence_footer === true) {
        if (!style) {
            style = document.createElement("style");
            style.id = "canvasrefined-hide-sequence-footer";
            style.textContent = "#sequence_footer{display:none!important}";
            (document.head || document.documentElement).appendChild(style);
        }
    } else if (style) {
        style.remove();
    }
}

function watchSequenceFooter() {
    applyHideSequenceFooter();
    if (options.hide_sequence_footer !== true) {
        if (sequenceFooterObserver) {
            sequenceFooterObserver.disconnect();
            sequenceFooterObserver = null;
        }
        return;
    }
    if (!isAssignmentPage()) return;
    if (removeSequenceFooter()) return;
    if (sequenceFooterObserver) return;

    // The observer strips the footer from the DOM (no leftover gap), and
    // disconnects once removed — after that (or after the 10s timeout below)
    // the CSS rule above is what keeps it hidden across Canvas re-renders.
    sequenceFooterObserver = new MutationObserver(() => {
        if (removeSequenceFooter() && sequenceFooterObserver) {
            sequenceFooterObserver.disconnect();
            sequenceFooterObserver = null;
        }
    });

    sequenceFooterObserver.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
        if (sequenceFooterObserver) {
            sequenceFooterObserver.disconnect();
            sequenceFooterObserver = null;
        }
    }, 10000);
}

// One persistent, rAF-throttled observer that keeps both assignment-page
// navigation buttons present: the "Back to Assignment" button on submission
// pages and the "Go to Grades" button on assignment pages. Unlike the old
// 10s-disconnecting observer, this survives Canvas' post-navigation re-renders
// that remove injected nodes. The extra delayed checks cover React hydration
// that wipes the button after our first add without emitting any later mutation
// for the observer to catch.
function maintainAssignmentNavButtons() {
    maintainSubmissionPageButton();
    maintainAssignmentPageButton();
}

function watchSubmissionPageButton() {
    if (submissionPageButtonObserver) return;
    maintainAssignmentNavButtons();
    submissionPageButtonObserver = new MutationObserver(maintainAssignmentNavButtons);
    submissionPageButtonObserver.observe(document.documentElement, { childList: true, subtree: true });
    for (const ms of [300, 800, 1600, 3000, 5000]) {
        setTimeout(maintainAssignmentNavButtons, ms);
    }
}

function removeNewCanvasButton() {
    document.querySelectorAll('[data-testid="switch-to-new-dashboard-button"]').forEach(btn => btn.remove());
}

function watchNewCanvasButton() {
    if (newCanvasButtonObserver) {
        newCanvasButtonObserver.disconnect();
        newCanvasButtonObserver = null;
    }
    if (options.hide_new_canvas !== true) return;
    removeNewCanvasButton();
    let newCanvasButtonScheduled = false;
    newCanvasButtonObserver = new MutationObserver((mutationList) => {
        if (options.hide_new_canvas !== true) {
            if (newCanvasButtonObserver) {
                newCanvasButtonObserver.disconnect();
                newCanvasButtonObserver = null;
            }
            return;
        }
        // Only scan when nodes were actually added, and coalesce to one pass per frame.
        let added = false;
        for (const mutation of mutationList) {
            if (mutation.addedNodes && mutation.addedNodes.length) { added = true; break; }
        }
        if (!added || newCanvasButtonScheduled) return;
        newCanvasButtonScheduled = true;
        requestAnimationFrame(() => {
            newCanvasButtonScheduled = false;
            if (options.hide_new_canvas !== true) return;
            removeNewCanvasButton();
        });
    });
    newCanvasButtonObserver.observe(document.documentElement, { childList: true, subtree: true });
}

async function getActiveCustomBackground() {
    const syncOpts = await chrome.storage.sync.get([
        "customBackgroundDaily",
        "customBackgroundNasaDaily",
        "customBackgroundLink",
        "customBackgroundScale",
    ]);

    if (syncOpts.customBackgroundNasaDaily === true) {
        return await getNasaDailyBackground();
    }

    if (syncOpts.customBackgroundDaily === true) {
        const dailyPreset = await getDailyBackgroundPreset();
        if (dailyPreset) {
            return {
                url: dailyPreset.url,
                scale: dailyPreset.scale,
            };
        }
    }

    if (syncOpts.customBackgroundLink && syncOpts.customBackgroundLink !== "") {
        return {
            url: syncOpts.customBackgroundLink,
            scale: syncOpts.customBackgroundScale || 100,
        };
    }

    return null;
}

async function getDailyBackgroundPreset() {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const cacheKey = `picsum_daily_${dateStr}`;
    const cached = await chrome.storage.local.get(cacheKey);
    if (cached[cacheKey]) return cached[cacheKey];

    const url = `https://picsum.photos/seed/${dateStr}/1920/1080`;
    const result = { url, scale: 100 };
    await chrome.storage.local.set({ [cacheKey]: result });
    return result;
}

async function getNasaDailyBackground() {
    try {
        return await chrome.runtime.sendMessage({ type: "getNasaBackground" });
    } catch (error) {
        console.error("[CanvasRefined] Failed to fetch NASA APOD:", error);
        return null;
    }
}

let nasaInfoOverlayEl = null;

// Todo_tuna - move to other isPage functions unless that breaks something.
function isDashboardPage() {
    return document.querySelector("#DashboardCard_Container") !== null;
}

function createNasaInfoOverlay() {
    if (options.customBackgroundNasaDaily !== true) return;
    if (nasaInfoOverlayEl || !isDashboardPage()) return;
    
    const contentMain = document.querySelector("#content.ic-Layout-contentMain, .ic-Layout-contentMain");
    if (!contentMain) return;
    if (getComputedStyle(contentMain).position === "static") {
        contentMain.style.position = "relative";
    }

    nasaInfoOverlayEl = document.createElement("div");
    nasaInfoOverlayEl.id = "canvasrefined-nasa-info-overlay";
    nasaInfoOverlayEl.style.cssText = "position:absolute;right:24px;bottom:24px;z-index:9999;";
    nasaInfoOverlayEl.innerHTML = `
        <div id="nasa-info-icon" style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(30,30,30,0.85);border:1px solid rgba(255,255,255,0.15);cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.4);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e2e2e2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
        </div>
        <div id="nasa-info-panel" style="display:none;position:absolute;bottom:calc(100% + 10px);right:0;background:#1e1e1e;border:1px solid #3c3c3c;border-radius:8px;padding:14px 18px;width:340px;max-width:calc(100vw - 40px);box-shadow:0 4px 16px rgba(0,0,0,0.4);">
            <div id="nasa-info-title" style="font-weight:600;font-size:14px;margin-bottom:4px;color:#f5f5f5;"></div>
            <div id="nasa-info-date" style="font-size:12px;color:#ababab;margin-bottom:4px;"></div>
            <div id="nasa-info-credit" style="font-size:12px;color:#dfa581;margin-bottom:8px;"></div>
            <div id="nasa-info-explanation" style="font-size:12px;color:#e2e2e2;line-height:1.5;max-height:200px;overflow-y:auto;white-space:pre-wrap;"></div>
        </div>
    `;
    
    const icon = nasaInfoOverlayEl.querySelector("#nasa-info-icon");
    const panel = nasaInfoOverlayEl.querySelector("#nasa-info-panel");
    
    const populatePanel = async () => {
        // Search backward up to 7 days for the APOD actually cached, since today's may not be ready.
        const date = new Date();
        for (let i = 0; i < 7; i++) {
            const dateStr = date.toISOString().slice(0, 10);
            const cacheKey = `nasa_apod_${dateStr}`;
            const cached = await chrome.storage.local.get(cacheKey);
            if (!cached[cacheKey]) {
                date.setDate(date.getDate() - 1);
                continue;
            }
            const metadataKey = `nasa_apod_meta_${dateStr}`;
            const metadata = await chrome.storage.local.get(metadataKey);
            const meta = metadata[metadataKey];
            if (!meta) return false;
            document.getElementById("nasa-info-title").textContent = meta.title || "";
            document.getElementById("nasa-info-date").textContent = `Date: ${meta.date}`;
            document.getElementById("nasa-info-credit").textContent = meta.copyright ? `Credit: ${meta.copyright}` : "";
            document.getElementById("nasa-info-explanation").textContent = meta.explanation || "No description available.";
            return true;
        }
        return false;
    };

    let pinned = false;

    const showPanel = async () => {
        if (pinned) return;
        if (await populatePanel()) panel.style.display = "block";
    };

    const hidePanel = () => {
        if (pinned) return;
        panel.style.display = "none";
    };

    const togglePanel = async () => {
        if (pinned) {
            pinned = false;
            panel.style.display = "none";
        } else {
            pinned = true;
            if (await populatePanel()) panel.style.display = "block";
        }
    };

    icon.addEventListener("mouseenter", showPanel);
    icon.addEventListener("mouseleave", hidePanel);
    panel.addEventListener("mouseenter", showPanel);
    panel.addEventListener("mouseleave", hidePanel);
    icon.addEventListener("click", togglePanel);
    
    contentMain.appendChild(nasaInfoOverlayEl);
}

function removeNasaInfoOverlay() {
    if (nasaInfoOverlayEl) {
        nasaInfoOverlayEl.remove();
        nasaInfoOverlayEl = null;
    }
}

function getSidebarStateMode(mode = getSidebarLayoutMode()) {
    return mode === "course" ? "course" : "dashboard";
}

function getSidebarStateKey(mode = getSidebarLayoutMode()) {
    return `better_sidebar_expanded_${getSidebarStateMode(mode)}`;
}

async function getSidebarExpandedState(mode = getSidebarLayoutMode()) {
    const key = getSidebarStateKey(mode);
    const result = await chrome.storage.local.get(key);
    return result[key] ?? false;
}

function setSidebarExpandedState(mode, expanded) {
    chrome.storage.local.set({ [getSidebarStateKey(mode)]: expanded });
}

let assignments = null;
let grades = null;
let announcements = [];
let completed = [];
let assignmentsDue = [];
let options = {};
let timeCheck = null;
let reminderCheck = null;
let betterSidebarLoading = false;
let dashboardReadyTimer = null;
let sidebarReadyTimer = null;
// Signature of the dashboard card set last time we ran the full setup pass.
// The MutationObserver in checkDashboardReady fires on every childList change
// in the document — including the ones our own setup pass (loadCardAssignments,
// customizeCards, etc.) causes. Without a guard, that re-triggers the observer
// and re-runs the whole pass every animation frame (an infinite reflow loop).
// We only need to re-run when Canvas actually changes the dashboard cards, so
// we skip the heavy pass whenever the card set is unchanged.
let lastDashboardCardSignature = null;
let sidebarBadgeObserver = null;
let sidebarBadgeSyncTimer = null;
let sidebarBadgeWatchRetries = 0;