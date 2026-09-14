function resetBetterSidebarLayout() {
    document.getElementById("header")?.style.removeProperty("display");
    document.querySelector(".ic-Layout-wrapper")?.style.removeProperty("margin-left");
    document.querySelector("#main")?.style.removeProperty("margin-left");
    document.querySelector(".ic-app-nav-toggle-and-crumbs")?.style.removeProperty("display");
    document.getElementById("not_right_side")?.style.removeProperty("display");
    document.getElementById("not_right_side")?.style.removeProperty("flex");
    document.getElementById("not_right_side")?.style.removeProperty("min-width");
    document.getElementById("right-side-wrapper")?.style.removeProperty("flex");
    document.getElementById("right-side-wrapper")?.style.removeProperty("width");
    document.getElementById("right-side-wrapper")?.style.removeProperty("max-width");
    document.querySelector(".ic-Layout-contentWrapper")?.style.removeProperty("display");
    document.querySelector(".ic-Layout-contentWrapper")?.style.removeProperty("align-items");
    document.querySelector(".ic-Layout-contentWrapper")?.style.removeProperty("min-width");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("flex");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("min-width");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("margin");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("padding");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("background");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("backdrop-filter");
    document.querySelector(".ic-Layout-contentMain")?.style.removeProperty("-webkit-backdrop-filter");
    document.getElementById("left-side")?.style.removeProperty("display");
    document.getElementById("left-side")?.style.removeProperty("padding-top");
    document.getElementById("left-side")?.style.removeProperty("padding-left");
    document.getElementById("section-tabs")?.style.removeProperty("padding-top");
    document.getElementById("better-sidebar-container")?.remove();
    clearBetterSidebarLayoutFix();
    if (sidebarBadgeObserver) { sidebarBadgeObserver.disconnect(); sidebarBadgeObserver = null; }
    if (sidebarBadgeSyncTimer) { clearTimeout(sidebarBadgeSyncTimer); sidebarBadgeSyncTimer = null; }
    sidebarBadgeWatchRetries = 0;
}

function ensureBetterSidebar() {
    if (!options.better_sidebar) return;
    // Quiz safe mode: don't replace the Canvas sidebar on quiz pages.
    if (quizSafeModeActive()) return;
    if (document.querySelector("#better-sidebar-container")) return;
    if (!document.querySelector("#wrapper") || !document.querySelector(".ic-Layout-contentWrapper")) return;
    setupBetterSidebar(getSidebarLayoutMode());
}

function applyBetterSidebarLayoutFix() {
    let style = document.querySelector("#canvasrefined-sidebar-layout-fix") || document.createElement("style");
    style.id = "canvasrefined-sidebar-layout-fix";
    style.textContent = `
        #wrapper,
        .ic-Layout-wrapper,
        #main {
            margin-left: 0 !important;
        }
    `;
    document.documentElement.appendChild(style);
}

function clearBetterSidebarLayoutFix() {
	let style = document.querySelector("#canvasrefined-sidebar-layout-fix");
	if (style) style.remove();
}

function getSidebarScale() {
    const rawScale = parseInt(options.sidebar_scale || 100);
    if (isNaN(rawScale)) return 1;
    return Math.max(0.7, Math.min(1.5, rawScale / 100));
}

function applySidebarScaleStyles(sidebarList) {
    const scale = getSidebarScale();
    sidebarList.style.setProperty("--bc-sidebar-icon-size", `${Math.round(20 * scale)}px`);
    sidebarList.style.setProperty("--bc-sidebar-btn-height", `${Math.round(30 * scale)}px`);
    sidebarList.style.setProperty("--bc-sidebar-btn-gap", `${Math.round(8 * scale)}px`);
    sidebarList.style.setProperty("--bc-sidebar-label-size", `${Math.round(14 * scale)}px`);
}

// Re-apply the tinted course-content panel when the background opacity slider
// changes. Only the better sidebar (course mode) gives .ic-Layout-contentMain a
// tinted panel in the first place (see setupBetterSidebar). Re-applies both the
// opacity and blur sliders so changing either updates the panel live.
function applyBetterSidebarContentPanel() {
    if (!options.better_sidebar) return;
    if (getSidebarLayoutMode() !== "course") return;
    const contentMain = document.querySelector(".ic-Layout-contentMain");
    if (!contentMain) return;
    const bgOpacity = Math.max(0, Math.min(100, Number(options.bg_opacity ?? 65)));
    const bgBlur = Math.max(0, Math.min(30, Number(options.bg_blur ?? 8)));
    contentMain.style.setProperty("background", `color-mix(in srgb, var(--bcbackground-0) ${bgOpacity}%, transparent)`, "important");
    contentMain.style.setProperty("backdrop-filter", `blur(${bgBlur}px)`, "important");
    contentMain.style.setProperty("-webkit-backdrop-filter", `blur(${bgBlur}px)`, "important");
}

async function setupBetterSidebar(mode = getSidebarLayoutMode()) {
    if (!options.better_sidebar) return;
    if (document.querySelector('#better-sidebar-container')) return;
    let wrapper = document.querySelector("#wrapper");
    if (!wrapper || betterSidebarLoading) return;
    betterSidebarLoading = true;
    try {
        const layoutMode = mode === "course" || mode === "dash" ? mode : getSidebarLayoutMode();
        let expanded = await getSidebarExpandedState(layoutMode);
        const outerWrapper = document.getElementById("main");
        outerWrapper?.style.setProperty("display", "flex", "important");
        // document.getElementById("not_right_side").style.setProperty("display", "none", "important");
        const leftSide = document.getElementById("left-side");
        leftSide?.style.setProperty("opacity", "1");
        leftSide?.style.setProperty("position", "static");
        const mainWrapper = document.querySelector(".ic-Layout-contentWrapper");
        if (!mainWrapper) return;
        applyBetterSidebarLayoutFix();
        mainWrapper.style.display = "flex";
        mainWrapper.style.alignItems = "stretch";
        mainWrapper.style.minWidth = "0";
        const contentMain = document.querySelector(".ic-Layout-contentMain");
        contentMain?.style.setProperty("flex", "1 1 auto");
        contentMain?.style.setProperty("min-width", "0");
        const notRightSide = document.getElementById("not_right_side");
        if (notRightSide && isAccountsPage()) {
            notRightSide.style.setProperty("width", "100%");
            notRightSide.style.setProperty("max-width", "100%");
            notRightSide.style.setProperty("min-width", "0");
        }
        if (layoutMode === "course" && leftSide) {
            const rightSideWrapper = document.getElementById("right-side-wrapper");
            const sectionTabs = document.getElementById("section-tabs");
            leftSide.style.setProperty("padding-top", "0", "important");
            leftSide.style.setProperty("padding-left", "0", "important");
            if (sectionTabs) {
                if (getCurrentCourseId() !== null || isProfilePage()) {
                    sectionTabs.style.setProperty("padding-top", "40px", "important");
                } else {
                    sectionTabs.style.removeProperty("padding-top");
                }
            }
            leftSide.style.flex = "0 0 250px";
            leftSide.style.width = "250px";
            leftSide.style.maxWidth = "250px";
            if (notRightSide) {
                notRightSide.style.display = "flex";
                notRightSide.style.flex = "1 1 auto";
                notRightSide.style.minWidth = "0";
            }
            if (rightSideWrapper) {
                rightSideWrapper.style.flex = "0 0 280px";
                rightSideWrapper.style.width = "280px";
                rightSideWrapper.style.maxWidth = "280px";
            }
            contentMain?.style.setProperty("margin", "26px 38px 38px", "important");
            contentMain?.style.setProperty("padding", "10px", "important");
            contentMain?.style.setProperty("border-radius", "10px", "important");
            contentMain?.style.setProperty("background", `color-mix(in srgb, var(--bcbackground-0) ${Math.max(0, Math.min(100, Number(options.bg_opacity ?? 65)))}%, transparent)`, "important");
            contentMain?.style.setProperty("backdrop-filter", `blur(${Math.max(0, Math.min(30, Number(options.bg_blur ?? 8)))}px)`, "important");
            contentMain?.style.setProperty("-webkit-backdrop-filter", `blur(${Math.max(0, Math.min(30, Number(options.bg_blur ?? 8)))}px)`, "important");
        }
        // The rail must always render leftmost. Course-layout pages already
        // prepend it into #left-side; dash-layout pages that still have a
        // native left nav (accounts, groups, etc.) must too — otherwise the
        // native #left-side column (made position:static above) flows before
        // #not_right_side and shows up to the LEFT of the Better Sidebar,
        // looking like a competing sidebar once the custom background tints
        // it. Prepending keeps the order: [Better Sidebar rail][native nav].
        const sidebarParent = leftSide ? leftSide : mainWrapper;
        if (leftSide) {
            leftSide.style.display = "flex";
            leftSide.style.flexDirection = "row";
            leftSide.style.alignItems = "stretch";
            leftSide.style.minWidth = "0";
            leftSide.style.gap = "0";
        }
        document.querySelector(".ic-app-nav-toggle-and-crumbs")?.style.setProperty("display", "none");
        if (layoutMode == "dash") {
            document.getElementById("header")?.style.setProperty("display", "none");
        }
        else if (layoutMode == "course") {
            document.getElementById("header")?.style.setProperty("display", "none");
        }

        let sidebarList = makeElement("div", sidebarParent, { id: "better-sidebar-container",
            style: `display:flex;flex-direction:column;width:50px;justify-content:center;align-items:center;box-sizing:border-box;position:relative;background-color:var(--bcsidebar);height:100vh;position:sticky;top:0;left:0;`
        }, true);
        let sidebarContent = makeElement("div", sidebarList, {
            style: "display:flex;flex-direction:column;gap:20px;width:100%;flex:1;justify-content:flex-start;align-items:center;margin:40px;"
        });
        applySidebarScaleStyles(sidebarList);
        let expander = makeElement("div", sidebarList, {
            className: "better-sidebar-expander",
            style: "display:flex;flex-direction:column;gap:0px;margin-top:auto;width:100%;justify-content:center;align-items:center;cursor:pointer;",
        });
        expander.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:30px;height:30px;transition:all .3s ease;">
                <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                <g id="SVGRepo_iconCarrier">
                    <path d="M20 4V20M4 12H16M16 12L12 8M16 12L12 16" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                </g>
            </svg>
        `
        sidebarList.dataset.expanded = expanded ? "true" : "false";
        updateSidebar(expanded, sidebarList, expander);
        setSidebarExpandedState(layoutMode, expanded);
        requestAnimationFrame(() => {
            populateSidebarFromNav(sidebarContent);
            updateSidebar(expanded, sidebarList, expander);
            watchSidebarBadges();
        });

        expander.addEventListener("click", () => {
            expanded = !expanded;
            sidebarList.dataset.expanded = expanded ? "true" : "false";
            setSidebarExpandedState(layoutMode, expanded);
            updateSidebar(expanded, sidebarList, expander);
        })
    } catch (e) {
        logError(e);
    } finally {
        betterSidebarLoading = false;
    }
}
function createSidebarButton(text, url, parent, icon) {
	let button = makeElement("a", parent, {
        style: "width:40%;height:var(--bc-sidebar-btn-height,30px);cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;justify-content:center;align-items:center;gap:var(--bc-sidebar-btn-gap,8px);color:var(--bcsidebar-text) !important;font-weight:bold;position:relative;",
		className: "canvasrefined-custom-btn better-sidebar-btn",
		href: url,
	});
    button.innerHTML = `${icon ? `${icon}<span class="better-sidebar-label" style="font-size:var(--bc-sidebar-label-size,14px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">${text}</span>` : `<span class="better-sidebar-label" style="font-size:var(--bc-sidebar-label-size,14px);">${text}</span>`}`;
    return button;
}

function getNavBadgeCount(item) {
    const badge = item.querySelector(".menu-item__badge");
    if (!badge) return 0;
    const badgeText = badge.querySelector('[aria-hidden="true"]')?.textContent?.trim() || badge.textContent?.trim() || "";
    const count = parseInt(badgeText, 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
}

function addSidebarButtonBadge(button, count) {
    if (!button) return;
    // Always clear any existing badge first so a drop to 0 unread removes it.
    button.querySelector(".better-sidebar-badge")?.remove();
    if (!count) return;
    makeElement("div", button, {
        className: "better-sidebar-badge",
        style: "position:absolute;top:-6px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background-color:#ff0000;color:white;font-size:11px;line-height:16px;display:flex;justify-content:center;align-items:center;box-sizing:border-box;pointer-events:none;",
        textContent: String(count),
    });
}

// Re-read the global nav badge for each better-sidebar button and update its dot.
// Canvas loads the unread counts (Inbox/announcements) asynchronously after the
// page renders, so the dot captured at build time is often missing or stale.
function syncSidebarBadges() {
    document.querySelectorAll(".better-sidebar-btn").forEach(button => {
        const navId = button.dataset.navItemId;
        if (!navId) return;
        const navItem = document.getElementById(navId);
        if (!navItem) return;
        addSidebarButtonBadge(button, getNavBadgeCount(navItem));
    });
}

function scheduleSidebarBadgeSync() {
    if (sidebarBadgeSyncTimer) clearTimeout(sidebarBadgeSyncTimer);
    sidebarBadgeSyncTimer = setTimeout(() => {
        sidebarBadgeSyncTimer = null;
        syncSidebarBadges();
    }, 100);
}

// Watch the global nav for badge changes (late load, new mail, read/unread)
// and keep the better-sidebar dots in sync.
function watchSidebarBadges() {
    const navMenu = document.getElementById("menu");
    if (!navMenu) {
        if (sidebarBadgeWatchRetries++ < 20) setTimeout(watchSidebarBadges, 500);
        return;
    }
    sidebarBadgeWatchRetries = 0;
    if (sidebarBadgeObserver) sidebarBadgeObserver.disconnect();
    sidebarBadgeObserver = new MutationObserver(scheduleSidebarBadgeSync);
    sidebarBadgeObserver.observe(navMenu, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    scheduleSidebarBadgeSync();
}
function populateSidebarFromNav(sidebarContent) {
	const excludeIds = ["global_nav_help_link", "global_nav_history_link"];
	const customIcons = {
		"global_nav_profile_link": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="var(--bcsidebar-text)"></path></g></svg>`,
		"global_nav_dashboard_link": `<svg fill="var(--bcsidebar-text)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><rect x="2" y="2" width="9" height="11" rx="2"></rect><rect x="13" y="2" width="9" height="7" rx="2"></rect><rect x="2" y="15" width="9" height="7" rx="2"></rect><rect x="13" y="11" width="9" height="11" rx="2"></rect></g></svg>`,
		"global_nav_conversations_link": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M4 18L9 12M20 18L15 12M3 8L10.225 12.8166C10.8665 13.2443 11.1872 13.4582 11.5339 13.5412C11.8403 13.6147 12.1597 13.6147 12.4661 13.5412C12.8128 13.4582 13.1335 13.2443 13.775 12.8166L21 8M6.2 19H17.8C18.9201 19 19.4802 19 19.908 18.782C20.2843 18.5903 20.5903 18.2843 20.782 17.908C21 17.4802 21 16.9201 21 15.8V8.2C21 7.0799 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V15.8C3 16.9201 3 17.4802 3.21799 17.908C3.40973 18.2843 3.71569 18.5903 4.09202 18.782C4.51984 19 5.07989 19 6.2 19Z" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></g></svg>`,
		"global_nav_calendar_link": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M3 9H21M7 3V5M17 3V5M6 12H8M11 12H13M16 12H18M6 15H8M11 15H13M16 15H18M6 18H8M11 18H13M16 18H18M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round"></path></g></svg>`,
		"global_nav_courses_link": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M20 12V4C20 2.89543 19.1046 2 18 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V18.5" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13 2V14L16.8182 11L20 14V5" stroke="var(--bcsidebar-text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></g></svg>`,
		"global_nav_groups_link": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path fill-rule="evenodd" clip-rule="evenodd" d="M16 6C14.3432 6 13 7.34315 13 9C13 10.6569 14.3432 12 16 12C17.6569 12 19 10.6569 19 9C19 7.34315 17.6569 6 16 6ZM11 9C11 6.23858 13.2386 4 16 4C18.7614 4 21 6.23858 21 9C21 10.3193 20.489 11.5193 19.6542 12.4128C21.4951 13.0124 22.9176 14.1993 23.8264 15.5329C24.1374 15.9893 24.0195 16.6114 23.5631 16.9224C23.1068 17.2334 22.4846 17.1155 22.1736 16.6591C21.1979 15.2273 19.4178 14 17 14C13.166 14 11 17.0742 11 19C11 19.5523 10.5523 20 10 20C9.44773 20 9.00001 19.5523 9.00001 19C9.00001 18.308 9.15848 17.57 9.46082 16.8425C9.38379 16.7931 9.3123 16.7323 9.24889 16.6602C8.42804 15.7262 7.15417 15 5.50001 15C3.84585 15 2.57199 15.7262 1.75114 16.6602C1.38655 17.075 0.754692 17.1157 0.339855 16.7511C-0.0749807 16.3865 -0.115709 15.7547 0.248886 15.3398C0.809035 14.7025 1.51784 14.1364 2.35725 13.7207C1.51989 12.9035 1.00001 11.7625 1.00001 10.5C1.00001 8.01472 3.01473 6 5.50001 6C7.98529 6 10 8.01472 10 10.5C10 11.7625 9.48013 12.9035 8.64278 13.7207C9.36518 14.0785 9.99085 14.5476 10.5083 15.0777C11.152 14.2659 11.9886 13.5382 12.9922 12.9945C11.7822 12.0819 11 10.6323 11 9ZM3.00001 10.5C3.00001 9.11929 4.1193 8 5.50001 8C6.88072 8 8.00001 9.11929 8.00001 10.5C8.00001 11.8807 6.88072 13 5.50001 13C4.1193 13 3.00001 11.8807 3.00001 10.5Z" fill="var(--bcsidebar-text)"></path></g></svg>`,
		"globalNavExternalTool-69": `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C4.34315 1 3 2.34315 3 4V17V20C3 21.6569 4.34315 23 6 23H18C19.6569 23 21 21.6569 21 20V17V4C21 2.34315 19.6569 1 18 1H6ZM5 20V17C5 16.4477 5.44772 16 6 16H18C18.5523 16 19 16.4477 19 17V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20ZM18 14C18.3506 14 18.6872 14.0602 19 14.1707V4C19 3.44772 18.5523 3 18 3H6C5.44772 3 5 3.44772 5 4V14.1707C5.31278 14.0602 5.64936 14 6 14H18ZM14.5 19.25C15.1904 19.25 15.75 18.6904 15.75 18C15.75 17.3096 15.1904 16.75 14.5 16.75C13.8096 16.75 13.25 17.3096 13.25 18C13.25 18.6904 13.8096 19.25 14.5 19.25Z" fill="var(--bcsidebar-text)"></path></g></svg>`,
	};
	
	const navMenu = document.getElementById("menu");
    let hasDashboardButton = false;

    // Keep the global-search trigger last in the sidebar. The search button's
    // placement pass and this populate pass run on independent rAF callbacks,
    // so either can execute first. If the search button was appended before
    // the nav buttons exist, slot the nav buttons in ahead of it so Search
    // always stays at the bottom of the sidebar.
    const searchBtn = sidebarContent.querySelector("#canvasrefined-gs-sidebar-btn");
    const insertNavButton = (text, href, icon) => {
        const button = createSidebarButton(text, href, sidebarContent, icon);
        if (searchBtn && searchBtn.parentNode === sidebarContent) {
            sidebarContent.insertBefore(button, searchBtn);
        }
        return button;
    };

    if (navMenu) {
        const menuItems = navMenu.querySelectorAll("a[id^='global_nav'], .globalNavExternalTool a");
        menuItems.forEach(item => {
            const itemId = item.id;
            if (excludeIds.includes(itemId)) return;

            const href = item.getAttribute("href");
            let textEl = item.querySelector(".menu-item__text");
            let text = textEl?.textContent?.trim();
		
            // If text not found, try other sources
            if (!text) {
                text = item.getAttribute("aria-label")?.trim() || 
                        item.getAttribute("title")?.trim() || 
                        item.textContent?.trim();
            }
		
            if (!text || !href) return;

            let icon = customIcons[itemId] || "";
            if (!icon) {
                const svg = item.querySelector("svg");
                if (svg) {
                    icon = svg.outerHTML;
                    // Detect and scale down large viewBox SVGs
                    const viewBoxMatch = icon.match(/viewBox="([^"]+)"/);
                    if (viewBoxMatch) {
                        const [, viewBox] = viewBoxMatch;
                        const parts = viewBox.split(/\s+/);
                        const width = parseFloat(parts[2]);
                        const height = parseFloat(parts[3]);
                        // If viewBox is large, add fixed size to scale it down
                        if (width > 32 || height > 32) {
                            // Check if svg already has a style attribute
                            if (icon.includes('style="')) {
                                // Append to existing style
                                icon = icon.replace(/style="([^"]*)"/, `style="$1 width:20px;height:20px;flex-shrink:0;fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);"`);
                            } else {
                                // Add new style attribute
                                icon = icon.replace("<svg", '<svg style="width:20px;height:20px;flex-shrink:0;fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);"');
                            }
                        } else {
                            // Smaller SVG - just add colors
                            if (icon.includes('style="')) {
                                icon = icon.replace(/style="([^"]*)"/, `style="$1 fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);flex-shrink:0;"`);
                            } else {
                                icon = icon.replace("<svg", '<svg style="fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);flex-shrink:0;"');
                            }
                        }
                    } else {
                        // No viewBox - just add colors
                        if (icon.includes('style="')) {
                            icon = icon.replace(/style="([^"]*)"/, `style="$1 fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);"`);
                        } else {
                            icon = icon.replace("<svg", '<svg style="fill:var(--bcsidebar-text);stroke:var(--bcsidebar-text);"');
                        }
                    }
                }
            }

            if (itemId === "global_nav_dashboard_link") hasDashboardButton = true;
            const button = insertNavButton(text, href, icon);
            if (itemId) button.dataset.navItemId = itemId;
            addSidebarButtonBadge(button, getNavBadgeCount(item));
        });
    }

    if (!hasDashboardButton) {
        insertNavButton("Dashboard", `${domain}/`, customIcons["global_nav_dashboard_link"]);
    }
}
function updateSidebar(expanded, sidebarList, expander) {
    const scale = getSidebarScale();
    const expandedWidth = Math.round(150 * scale);
    const collapsedWidth = Math.round(50 * scale);
    sidebarList.style.width = expanded ? `${expandedWidth}px` : `${collapsedWidth}px`;
    applySidebarScaleStyles(sidebarList);

    expander.style.transform = expanded ? "rotate(180deg)" : "rotate(0deg)";
    expander.querySelector("svg").style.width = `${Math.round(30 * scale)}px`;
    expander.querySelector("svg").style.height = `${Math.round(30 * scale)}px`;
    const labels = document.querySelectorAll(".better-sidebar-label");
    labels.forEach(label => label.style.display = expanded ? "block" : "none");
    const buttons = document.querySelectorAll(".better-sidebar-btn");
    buttons.forEach(label => label.style.width = expanded ? "80%" : "40%");
    sidebarList.querySelectorAll(".better-sidebar-btn svg").forEach(svg => {
        svg.style.width = "var(--bc-sidebar-icon-size,20px)";
        svg.style.height = "var(--bc-sidebar-icon-size,20px)";
    });

    // Expand (or restore) the entire left-side column when the sidebar toggles
    const leftSide = document.getElementById("left-side");
    if (leftSide) {
        // on first run store the original width (prefer computed) and inline flex/maxWidth
        if (!leftSide.dataset.bcOrigWidth) {
            const computed = getComputedStyle(leftSide).width || "";
            leftSide.dataset.bcOrigWidth = leftSide.style.width || "";
            leftSide.dataset.bcOrigFlex = leftSide.style.flex || "";
            leftSide.dataset.bcOrigMaxWidth = leftSide.style.maxWidth || "";
            leftSide.dataset.bcOrigWidthPx = parseFloat(computed) || 0;
        }

        const origPx = parseFloat(leftSide.dataset.bcOrigWidthPx || 0);
        const delta = expandedWidth - collapsedWidth;

        if (expanded) {
            if (origPx > 0) {
                const newWidth = Math.round(origPx + delta);
                leftSide.style.flex = `0 0 ${newWidth}px`;
                leftSide.style.width = `${newWidth}px`;
                leftSide.style.maxWidth = `${newWidth}px`;
            } else {
                leftSide.style.flex = `0 0 ${expandedWidth}px`;
                leftSide.style.width = `${expandedWidth}px`;
                leftSide.style.maxWidth = `${expandedWidth}px`;
            }
        } else {
            // restore original inline values if present, otherwise remove the properties
            if (leftSide.dataset.bcOrigWidth !== "") leftSide.style.width = leftSide.dataset.bcOrigWidth; else leftSide.style.removeProperty('width');
            if (leftSide.dataset.bcOrigFlex !== "") leftSide.style.flex = leftSide.dataset.bcOrigFlex; else leftSide.style.removeProperty('flex');
            if (leftSide.dataset.bcOrigMaxWidth !== "") leftSide.style.maxWidth = leftSide.dataset.bcOrigMaxWidth; else leftSide.style.removeProperty('max-width');
        }
    }

    const courseLinksTitle = document.getElementById("better-course-links-title");
    if (courseLinksTitle) {
        courseLinksTitle.style.display = expanded ? "block" : "none";
        // Also hide separator when collapsed
        const separator = courseLinksTitle.nextElementSibling;
        if (separator) separator.style.display = expanded ? "block" : "none";
        
        const container = document.getElementById("better-course-links");
        if (container) {
            container.style.opacity = expanded ? "1" : "0.6";
            container.style.gap = expanded ? "12px" : "8px";
        }
    }
}