isDomainCanvasPage();

// TODO_tuna - Rename. All the other is...Page() functions just return true if page matches, otherwise false.
function isDomainCanvasPage() {
    chrome.storage.sync.get(['custom_domain', 'dark_mode', 'dark_preset', 'device_dark', 'remind'], result => {
        options = result;
        if (result.custom_domain.length && result.custom_domain[0] !== "") {
            for (let i = 0; i < result.custom_domain.length; i++) {
                if (domain.includes(result.custom_domain[i])) {
                    startExtension();
                    return;
                }
            }

            // if the code reaches this point, its not a canvas page so run the reminders
            setTimeout(reminderWatch, 2000);
            setInterval(reminderWatch, 60000);
            // turn the reminders on/off if the option is changed
            chrome.storage.onChanged.addListener((changes) => {
                Object.keys(changes).forEach(key => {
                    if (key === "remind") reminderWatch();
                })
            })
        } else {
            setupCustomURL();
        }
    });
}

function startExtension() {
    // TODO_tuna - Why tf do we need a function to remove footer?
    // Remove footer robustly - run first so a crash below can't block it
    const removeFooter = () => {
        const footer = document.querySelector('footer#footer.ic-app-footer, footer#footer');
        if (footer) footer.remove();
    };
    removeFooter();
    let footerScheduled = false;
    const footerObserver = new MutationObserver(() => {
        // Canvas mutates the DOM constantly; only check for the footer at most once
        // per animation frame instead of running a querySelector on every mutation.
        if (footerScheduled) return;
        footerScheduled = true;
        requestAnimationFrame(() => {
            footerScheduled = false;
            removeFooter();
        });
    });
    footerObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Start the submission-page "Back to Assignment" button watcher and the SPA
    // navigation hook immediately, before the async storage callbacks below.
    // These don't depend on `options`, and running them first means a throw in
    // any later init step can't prevent the button from appearing. The watcher
    // reads window.location.pathname live and uses a persistent MutationObserver
    // to (re)inject the button once the content container exists.
    setupNavigationListener();
    watchSubmissionPageButton();

    toggleDarkMode();

    // Include bg_opacity/bg_blur so setupBetterSidebar (called below) tints the
    // course-content panel with the user's slider values on first load, instead
    // of falling back to the defaults until a slider is touched.
    chrome.storage.sync.get(["better_sidebar", "sidebar_scale", "bg_opacity", "bg_blur"], result => {
        options = { ...options, ...result };
        ensureBetterSidebar();
    });

    chrome.storage.sync.get(null, result => {
        options = { ...options, ...result };
        applyTodoAlternateColors();
        toggleAutoDarkMode();
        // toggleScheduledReminders();
        getApiData();
        checkDashboardReady();
        loadCustomFont();
        applyAestheticChanges();
        watchNewCanvasButton();
        changeFavicon();
        updateReminders();
        applyCustomBackground();
        ensureBetterSidebar();
        watchSequenceFooter();
        watchProfileLogoutPageButton();
        watchGradeAnalytics();

        setupQuizSafeModeBanner();

        setupGlobalSearch();

        
        setTimeout(() => runDarkModeFixer(false), 800);
        setTimeout(() => runDarkModeFixer(false), 4500);
    });

    chrome.runtime.onMessage.addListener(recieveMessage);

    chrome.storage.onChanged.addListener(applyOptionsChanges);

    console.log("Canvas Refined - running");
}

function applyOptionsChanges(changes) {
    let rewrite = {};
    Object.keys(changes).forEach(key => {
        rewrite[key] = changes[key].newValue;
    });
    options = { ...options, ...rewrite };

    // when an option is updated it will call the necessary functions again
    // so any changes made in the menu no longer require a refresh to apply

    Object.keys(changes).forEach(key => {
        switch (key) {
			case "dark_mode":
			case "dark_preset":
			case "device_dark":
				toggleDarkMode();
				applyTodoAlternateColors();
				// "Ignore card colors" picks black vs. theme text color based on dark
				// mode, so re-render the Better Todo list to keep it in sync.
				if (options.todo_ignore_card_colors && options.better_todo && document.getElementById("better-todo-main")) {
					clearTodoList();
					createTodoSections(document.querySelector("#canvasrefined-todo-list"));
				}
				break;
			case "todo_alternate_colors":
				applyTodoAlternateColors();
				break;
			case "auto_dark":
			case "auto_dark_start":
			case "auto_dark_end":
				toggleAutoDarkMode();
				break;
			case "gradient_cards":
				changeGradientCards();
				break;
			case "dashboard_notes":
			case "dashboard_notes_text":
			case "dashboard_notes_mode":
				loadDashboardNotes();
				break;
			case "dashboard_grades":
			case "grade_hover":
			case "card_letter":
				if (!grades) getGrades();
				insertGrades();
				break;
			case "assignments_due":
			case "num_assignments":
				if (!assignments) getAssignments();
				if (
					document.querySelectorAll(".canvasrefined-card-assignment")
						.length === 0
				)
					setupCardAssignments();
				loadCardAssignments();
				// The card overflow fix in applyAestheticChanges() depends on
				// assignments_due, so re-run it when that option toggles to keep
				// the overflow rule in sync without a page reload.
				applyAestheticChanges();
				break;
			case "custom_assignments":
			case "assignment_date_format":
			case "card_overdues":
			case "relative_dues":
				cardAssignments = preloadAssignmentEls();
				loadCardAssignments();
				break;
			case "equal_height_cards":
				// Stretch or reset card heights in place instead of rebuilding rows.
				equalizeCardHeights();
				break;
			case "custom_cards":
				customizeCards();
				// Hiding/unhiding a card changes which courses appear in the todo
				// list and the progress display, so re-render them immediately.
				if (options.better_todo && document.getElementById("better-todo-main")) {
					moreAnnouncementCount = 0;
					moreAssignmentCount = 0;
					clearTodoList();
					createTodoSections(document.querySelector("#canvasrefined-todo-list"));
				}
				break;
			case "custom_cards_2":
			case "custom_cards_3":
				customizeCards();
				break;
			case "todo_hr24":
			case "todo_separate_scrollbar":
			case "num_todo_items":
			case "hover_preview":
			case "todo_timeframe":
			// case "todo_overdues":
			case "todo_hide_feedback":
			case "todo_full_height":
			case "todo_ignore_card_colors":
			case "todo_remove_icons":
			case "custom_cards_3":
				moreAnnouncementCount = 0;
				moreAssignmentCount = 0;
				// A new timeframe starts back at the current window.
				betterTodoTimeframeOffset = 0;
				// loadBetterTodo();
				clearTodoList();
				createTodoSections(document.querySelector("#canvasrefined-todo-list"));
				break;
			case "gpa_calc":
			case "gpa_calc_prepend":
			case "gpa_calc_weighted":
			case "gpa_calc_cumulative":
				if (!grades) getGrades();
				setupGPACalc();
				break;
			case "gpa_calc_bounds":
				calculateGPA2();
				break;
			case "custom_font":
				loadCustomFont();
				break;
			case "remlogo":
			case "disable_color_overlay":
			case "condensed_cards":
			case "full_width":
			case "center_cards":
			case "custom_styles":
				applyAestheticChanges();
				break;
			case "hide_new_canvas":
				watchNewCanvasButton();
				break;
			case "hide_sequence_footer":
				watchSequenceFooter();
				break;
			case "global_search":
				if (options.global_search) {
					setupGlobalSearch();
				} else {
					removeGlobalSearch();
				}
				break;
            case "customBackgroundScale":
                applyCustomBackground();
                break;
            case "customBackgroundDaily":
                applyCustomBackground();
                removeNasaInfoOverlay();
                break;
            case "customBackgroundNasaDaily":
                applyCustomBackground();
                if (options.customBackgroundNasaDaily === true) {
                    createNasaInfoOverlay();
                } else {
                    removeNasaInfoOverlay();
                }
                break;
            case "fitImageToScreen":
                applyCustomBackground();
                break;
			case "remind":
				showExampleReminder();
				break;
			case "imageSize":
			case "cardRoundness":
			case "imageRoundness":
			case "cardSpacing":
			case "cardWidth":
			case "cardHeight":
			case "cardPadding":
			case "customCardStyles":
				// Coalesce rapid card-style edits (e.g. holding the arrow keys on a
			// number input) into a single applyAestheticChanges() call. Each
			// storage onChanged event would otherwise re-run the dashboard style
			// pass immediately; a ~150ms cooldown is barely noticeable but keeps
			// the page from thrashing while the user is still adjusting values.
				debouncedApplyAestheticChanges();
				break;
			case "customBackgroundLink":
				applyCustomBackground();
				break;
            case "bg_opacity":
                applyCustomBackground();
                applyBetterSidebarContentPanel();
                break;
            case "bg_blur":
                applyCustomBackground();
                applyBetterSidebarContentPanel();
                break;
            case "sidebar_opacity":
            case "sidebar_blur":
                applyCustomBackground();
                break;
            case "card_transparency":
            case "card_opacity":
            case "card_blur":
                applyCustomBackground();
                break;
			case "better_todo":
				if (options.better_todo) {
					setupBetterTodo();
				} else {
					window.location.reload();
				}
                    break;
                case "todo_progress_rings": {
                    // toggle progress rings immediately
                    const placeholder = document.getElementById("better-todo-progress-placeholder");
                    if (!placeholder) break;
                    if (progressRingsEnabled()) {
                        if (typeof assignments?.then === 'function') {
                            assignments.then(data => {
                                const courseId = getCurrentCourseId();
                                const scopedData = getTodoScopedData(data, courseId);
                                renderProgressRings(placeholder, scopedData);
                            });
                        }
                    } else {
                        placeholder.innerHTML = "";
                    }
                    break;
                }
			case "better_sidebar":
                if (options.better_sidebar) {
                    ensureBetterSidebar();
                } else {
                    resetBetterSidebarLayout();
                }
				break;
            case "grade_analytics":
                watchGradeAnalytics();
                break;
            case "grade_analytics_zones":
                // Colored 10% zones on the line chart — just redraw the charts.
                if (gradeAnalyticsActive() && gaOpen && gaData) renderGradeAnalytics();
                break;
            case "quiz_safe_mode":
                // Toggling safe mode changes which features run on quiz pages; reload
                // so the gating is applied cleanly.
                if (isQuizPage()) window.location.reload();
                break;
            case "sidebar_scale": {
                const existingSidebar = document.getElementById("better-sidebar-container");
                if (existingSidebar) {
                    const expander = existingSidebar.querySelector(".better-sidebar-expander");
                    updateSidebar(existingSidebar.dataset.expanded === "true", existingSidebar, expander);
                }
                break;
            }
		}
    });
}

function applyAestheticChanges() {
    // Quiz safe mode: don't inject custom layout/aesthetic CSS on quiz pages.
    if (quizSafeModeActive()) return;
    let style = document.querySelector("#canvasrefined-aesthetics") || document.createElement('style');
    style.id = "canvasrefined-aesthetics";
    style.textContent = "";
    if (options.condensed_cards === true) style.textContent += ".ic-DashboardCard__header_hero {height:60px!important}.ic-DashboardCard__header-subtitle, .ic-DashboardCard__header-term{display:none}";
    if (options.remlogo === true) style.textContent += ".ic-app-header__logomark-container{display:none}";
    if (options.disable_color_overlay === true) style.textContent += ".ic-DashboardCard__header_hero{opacity: 0!important} .ic-DashboardCard__header-button-bg{opacity: 1!important}";
    if (options.full_width === true) style.textContent += "#wrapper,.ic-Layout-wrapper{max-width:100%!important}";
    if (options.center_cards === true) style.textContent += ".ic-DashboardCard__box__container{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;align-items:flex-start!important}";
    if (options.customCardStyles === true) {
        if (options.imageSize !== undefined && options.imageSize !== 100) style.textContent += `.ic-DashboardCard__header_image {transform: scale(${options.imageSize / 100})!important; }`;
        if (options.cardRoundness !== undefined && options.cardRoundness !== 5) style.textContent += `.ic-DashboardCard {border-radius: ${options.cardRoundness}px!important;}`;
        // Rounds the header image band. The photo is the background of
        // .ic-DashboardCard__header_image, and .ic-DashboardCard__header_hero (a
        // child that covers the full photo with its colored overlay + 1px
        // border) sits on top of it. border-radius only clips the element it's
        // on — rounding the parent alone leaves the hero's square overlay
        // covering the corners, and rounding the hero alone leaves the photo's
        // square corners behind it — so both elements need the same radius.
        // Default 0; guard skips the default so stock cards keep square corners.
        if (options.imageRoundness !== undefined && options.imageRoundness !== 0) style.textContent += `.ic-DashboardCard__header_image, .ic-DashboardCard__header_hero {border-radius: ${options.imageRoundness}px!important;}`;
        if (options.cardSpacing !== undefined && options.cardSpacing !== 0) style.textContent += `.ic-DashboardCard {margin-right: ${options.cardSpacing / 2}px!important; margin-bottom: ${options.cardSpacing / 2}px!important;}`;
        if (options.cardWidth !== undefined && options.cardWidth !== 262) style.textContent += `.ic-DashboardCard {width: ${options.cardWidth}px!important;}`;
        // Card height sizes the image band via .ic-DashboardCard__header_hero —
        // the element Canvas pins at 146px that actually drives the header image
        // height (both .ic-DashboardCard and .ic-DashboardCard__header are
        // content-sized, so a height on either just clips or adds dead space).
        // Everything else — title, actions, and the appended
        // .canvasrefined-card-assignment rows — flows below the hero, so the card
        // grows with the assignment list and nothing gets clipped. Skipped when
        // condensed cards is on, since that mode pins the hero at 60px.
        if (options.condensed_cards !== true && options.cardHeight !== undefined && options.cardHeight !== null && options.cardHeight !== "") {
            style.textContent += `.ic-DashboardCard__header_hero {height: ${options.cardHeight}px!important;}`;
        }
        // Inner card padding. Applied to the whole .ic-DashboardCard box so the
        // hero header, title, and action buttons all get breathing room from the
        // card's edges. Canvas sizes the card with border-box + a fixed width,
        // so padding alone squishes the content area (narrower image/rows)
        // instead of expanding the card — switch to content-box so the padding
        // grows the card outward and the content keeps its full width.
        // Guarded by > 0 (default).
        if (options.cardPadding !== undefined && Number(options.cardPadding) > 0) {
            style.textContent += `.ic-DashboardCard {padding: ${options.cardPadding}px!important; box-sizing: content-box!important;}`;
        }
    }

    style.textContent += ".ic-app-nav-toggle-and-crumbs{display:none!important}";
    if (options.custom_styles !== "") style.textContent += options.custom_styles;
    document.documentElement.appendChild(style);
}

async function applyCustomBackground() {
    // Quiz safe mode: leave the quiz page background untouched.
    if (quizSafeModeActive()) return;
    // let style = document.querySelector("#DashboardCard_Container")
    let style = document.querySelector("#canvasrefined-background") || document.createElement('style');
    style.id = "canvasrefined-background";

    const activeBackground = await getActiveCustomBackground();
    if (!activeBackground) {
        if (style.isConnected) style.remove();
        return;
    }

    const backgroundScale = Number(activeBackground.scale) || 100;
    const backgroundUrl = JSON.stringify(activeBackground.url);
    const fitToScreen = options.fitImageToScreen === true;
    // Opacity sliders (0-100). 100 = fully opaque surface, 0 = fully transparent
    // so the background image shows through. Only emitted while a background is
    // active, since transparency without an image just exposes the dark body.
    const bgOpacity = Math.max(0, Math.min(100, Number(options.bg_opacity ?? 65)));
    const sidebarOpacity = Math.max(0, Math.min(100, Number(options.sidebar_opacity ?? 100)));
    const bgTransparent = 100 - bgOpacity;
    const sidebarTransparent = 100 - sidebarOpacity;
    // Blur sliders (px). Pairs with opacity: blur only has a visible effect when
    // the surface is semi-transparent (opacity < 100) so the background behind
    // shows through and gets blurred. Default 8px on content surfaces preserves
    // the previous dashboard-header glass look; sidebar defaults to none.
    const bgBlur = Math.max(0, Math.min(30, Number(options.bg_blur ?? 8)));
    const sidebarBlur = Math.max(0, Math.min(30, Number(options.sidebar_blur ?? 0)));
    // Card transparency mirrors the content-panel glass effect (bg_opacity/
    // bg_blur) but applies it to dashboard course cards (.ic-DashboardCard).
    // Only active when the user explicitly enables it, since transparent cards
    // over a busy background can hurt legibility.
    const cardTransparency = options.card_transparency === true;
    const cardOpacity = Math.max(0, Math.min(100, Number(options.card_opacity ?? 80)));
    const cardBlur = Math.max(0, Math.min(30, Number(options.card_blur ?? 8)));
    const cardTransparent = 100 - cardOpacity;
    style.textContent = `
        #wrapper {
            background-image: url(${backgroundUrl}) !important;
            background-repeat: no-repeat !important;
            background-position: center center !important;
            background-attachment: fixed !important;
        }
        @media (orientation: landscape) {
            #wrapper { background-size: ${fitToScreen ? 'cover' : backgroundScale + '% auto'} !important; }
        }
        @media (orientation: portrait) {
            #wrapper { background-size: cover !important; }
        }
        .ic-Dashboard-header__layout {
            background: none !important;
            /* backdrop-filter: blur(10px) !important; */
            border-radius: 5px;
            padding-left: 20px !important;
        }
        #dashboard_header_container {
            margin-left: -35px !important;
            margin-right: -35px !important;
            box-sizing: border-box !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            border: 1px solid color-mix(in srgb, var(--bcborders) 60%, transparent) !important;
            border-radius: 10px !important;
            position: sticky !important;
            top: 0 !important;
            z-index: 1000 !important;
            backdrop-filter: blur(${bgBlur}px) saturate(120%) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) saturate(120%) !important;
        }
        /* Dashboard list view (planner). Canvas paints each day block an
           opaque theme color, so with a background image the whole list reads
           as one solid slab that hides the image — unlike card view, where
           the glass header and (optionally) translucent cards let it show
           through. Give each day group the same glass treatment as the module
           panels (color-mix tint + slider blur + rounded border) so the
           background peeks through between the day cards. */
        #dashboard-planner .planner-day,
        #dashboard-planner .planner-empty-days {
            background: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 12px !important;
            border: 1px solid color-mix(in srgb, var(--bcborders) 75%, transparent) !important;
            padding: 8px 12px !important;
            box-sizing: border-box !important;
        }
        /* Inner surfaces Canvas keeps opaque (the "Show N completed
           item" facade, "Nothing Planned" filler, and the Today/Add To Do
           header cluster that sits on the glass dashboard header bar):
           flatten them so the glass behind shows through. The course-
           grouping label instead gets a subtle chip behind the course name —
           it sits over the course hero image, so without a backdrop the
           text can be hard to read on busy images. */
        #dashboard-planner .CompletedItemsFacade-styles__root,
        #dashboard-planner .EmptyDays-styles__nothingPlanned,
        #dashboard-planner-header .PlannerHeader-styles__root {
            background: transparent !important;
        }
        #dashboard-planner .Grouping-styles__title {
            background: var(--bcbackground-1) !important;
            border-radius: 6px !important;
        }
        /* Item-row hover: subtle tint on the glass instead of Canvas's flat
           gray, so rows feel alive on the translucent day cards. */
        #dashboard-planner .planner-item:hover,
        #dashboard-planner .Grouping-styles__heroHover:hover {
            background: color-mix(in srgb, var(--bctext-0) 5%, transparent) !important;
            border-radius: 8px !important;
        }
        #right-side-wrapper {
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%);
            border-radius: 5px;
        }
        /* Native left nav column: #left-side > #sticky-container.ic-sticky-frame
           (the course/account/group menu links). Tint the whole #left-side column
           rather than the inner .ic-sticky-frame, whose height only wraps its
           links — the column spans the full viewport height like the other
           sidebars, at the same bg_opacity/bg_blur as the Better Todo List
           panel. Without this, a custom background (most visible in light mode)
           shows through untinted behind the nav links. */
        #left-side {
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
        }
        /* Recent feedback lives in #right-side. The dark-mode CSS
           (darkmodecss.js) recolors its text, but those rules are dark-mode-
           only — so in light mode + custom background the sub-text (context,
           grade, quote) keeps Canvas's default gray on the now-translucent
           panel and becomes hard to read. Recolor to the theme text color so
           it stays readable in both modes whenever a background is active.
           Mirrors the dark-mode selectors; redundant (same value) in dark mode. */
        .recent_feedback .event-details {
            background: none !important;
        }
        #right-side .event-details .event-details__context,
        #right-side .event-details .event-details__context *,
        #right-side .recent_feedback .event-details p,
        #right-side .recent_feedback .event-details span {
            color: var(--bctext-0) !important;
        }
        .event-details strong {
            color: var(--bctext-0) !important;
        }
        /* Native global nav sidebar. color-mix only accepts a solid color, so
           gradient/image sidebars keep their existing look (rule is invalid and
           ignored). At 100% opacity this is equivalent to var(--bcsidebar).
           Sidebar blur only shows when sidebar opacity < 100.
           The icon/text colors are recolored to var(--bcsidebar-text) to match
           the background we just set — without this, light mode (where
           --bcsidebar is the light default #e3e3e3) would leave institution-
           themed light icons on a now-light background = white-on-white.
           Mirrors the dark-mode rules in css/darkmodecss.js. */
        .ic-app-header {
            background: color-mix(in srgb, var(--bcsidebar), transparent ${sidebarTransparent}%) !important;
            backdrop-filter: blur(${sidebarBlur}px) !important;
            -webkit-backdrop-filter: blur(${sidebarBlur}px) !important;
        }
        .ic-app-header__menu-list-link svg,
        .ic-app-header__menu-list-item.ic-app-header__menu-list-item--active svg {
            fill: var(--bcsidebar-text) !important;
        }
        .menu-item-icon-container,
        .ic-app-header__menu-list-link .menu-item__text,
        .ic-app-header__menu-list-item.ic-app-header__menu-list-item--active .menu-item__text {
            color: var(--bcsidebar-text) !important;
        }
        .ic-app-header__menu-list-item.ic-app-header__menu-list-item--active .ic-app-header__menu-list-link,
        .ic-app-header__menu-list-link:hover {
            background: #0000004f !important;
        }
        /* Better sidebar. The inline background-color is var(--bcsidebar), so the
           !important here is required to override it. The same sidebar_opacity /
           sidebar_blur sliders drive both surfaces, so whichever sidebar is
           active (Better Sidebar when enabled, otherwise the native nav) picks
           up the value. */
        #better-sidebar-container {
            background-color: color-mix(in srgb, var(--bcsidebar), transparent ${sidebarTransparent}%) !important;
            backdrop-filter: blur(${sidebarBlur}px) !important;
            -webkit-backdrop-filter: blur(${sidebarBlur}px) !important;
        }
        .header-bar {
            background: none !important;
            padding: 0 !important;
            border: none !important;
        }
        .item-group-condensed,
        .item-group-container {
            background: transparent !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 12px !important;
            border: 1px solid color-mix(in srgb, var(--bcborders) 75%, transparent) !important;
            /* box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important; */
        }
        #context_modules_sortable_container {
            border: none !important;
            background: none !important;
            padding: 0 !important;
            /* backdrop-filter: blur(0) !important; */
        }
        .item-group-condensed .ig-header,
        .item-group-condensed .ig-row,
        .item-group-container .ig-header,
        .item-group-container .ig-row,
        .item-group-condensed .header,
        .item-group-container .header {
            background: transparent !important;
        }
        .item-group-condensed .ig-header.header,
        .item-group-container .ig-header.header {
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
        }
        #assignments.ui-tabs-panel {
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 5px !important;
        }
        #assignments {
            padding-top: 0px !important;
            padding-bottom: 0px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
        }
        ${isCoursesIndexPage() ? `
        #content {
            margin: 36px 48px 48px !important;
            padding: 10px !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 5px !important;
            box-sizing: border-box !important;
        }
        ` : ""}
        ${isGroupsIndexPage() ? `
        #content {
            margin: 36px 48px 48px !important;
            padding: 10px !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 5px !important;
            box-sizing: border-box !important;
        }
        ` : ""}
        /* Course content pages (sidebar layout "course": /courses/:id/* and
           /profile): tint the #content.ic-Layout-contentMain panel so the
           bg_opacity/bg_blur sliders have a surface to control even without Better
           Sidebar. setupBetterSidebar only adds this panel when Better Sidebar is
           on; this mirrors its inline values so the panel shows regardless. When
           Better Sidebar is on, its inline !important overrides these (same values),
           so this rule is inert in that case. */
        ${getSidebarLayoutMode() === "course" ? `
        .ic-Layout-contentMain {
            margin: 26px 38px 38px !important;
            padding: 10px !important;
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 10px !important;
        }
        ` : ""}
        ${isConversationsPage() ? `
        .css-1nh4pc4-view-flexItem {
            background-color: color-mix(in srgb, var(--bcbackground-0), transparent ${bgTransparent}%) !important;
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
            border-radius: 5px !important;
            box-sizing: border-box !important;
        }
        .css-1nh4pc4-view-flexItem svg,
        .css-1nh4pc4-view-flexItem svg * {
            fill: currentColor !important;
            stroke: currentColor !important;
            color: var(--bctext-0) !important;
        }
        ` : ""}
        .item-group-condensed .ig-row.ig-published.no-estimated-duration {
            color: var(--bctext-1) !important;
            border: 1px solid color-mix(in srgb, var(--bcborders) 60%, transparent) !important;
            border-radius: 0 !important;
            padding: 10px 12px !important;
        }
        .item-group-condensed .context_module_item,
        .item-group-container .context_module_item {
            background: transparent !important;
            /* backdrop-filter: blur(10px) saturate(115%) !important;
               -webkit-backdrop-filter: blur(10px) saturate(115%) !important; */
        }
        .item-group-condensed .context_module_item:hover,
        .item-group-container .context_module_item:hover,
        .item-group-condensed .context_module_item.context_module_item_hover,
        .item-group-container .context_module_item.context_module_item_hover {
            background: transparent !important;
            border-radius: 10px !important;
        }
        .item-group-container {
            background: transparent !important;
            border-radius: 12px !important;
            border: 1px solid color-mix(in srgb, var(--bcborders) 75%, transparent) !important;
        }
        .ig-header {
            /* backdrop-filter: blur(10px) !important; */
        }
        .item-group-condensed.context_module,
        .item-group-condensed.context_module_item,
        .item-group-condensed[class~="context_module"] {
            margin-bottom: 10px !important;
            padding-top: 0 !important;
            padding-bottom: 0 !important;
        }

        .item-group-condensed .ig-header.header,
        .item-group-container .ig-header.header {
            padding-top: 0 !important;
        }

        /* Module panels keep the slider blur on hover (previously a fixed 5px). */
        .item-group-condensed.context_module,
        .item-group-condensed.context_module_item,
        .item-group-condensed[class~="context_module"],
        .item-group-condensed.context_module:hover,
        .item-group-condensed.context_module_item:hover,
        .item-group-condensed.context_module.context_module_item_hover,
        .item-group-condensed.context_module_item.context_module_item_hover {
            backdrop-filter: blur(${bgBlur}px) !important;
            -webkit-backdrop-filter: blur(${bgBlur}px) !important;
        }
        .canvasrefined-gpa-card,
        .canvasrefined-gpa,
        .ic-DashboardCard {
            ${cardTransparency
                ? `background: color-mix(in srgb, var(--bcbackground-0), transparent ${cardTransparent}%) !important;
            backdrop-filter: blur(${cardBlur}px) saturate(120%) !important;
            -webkit-backdrop-filter: blur(${cardBlur}px) saturate(120%) !important;`
                : `background: var(--bcbackground-0) !important;`}
        }
        /* Card header strip (the course-nickname bar under the hero). Canvas
           paints it a solid light color ($ic-color-light) and nothing overrides
           that in light mode, so with card transparency on it reads as a solid
           band across an otherwise translucent card. Mirror the card surface:
           transparent cards drop the strip's background so the card's glass
           (tint + blur already applied to .ic-DashboardCard) shows through;
           opaque cards paint it the same solid theme color as the card body.
           Dark mode already flattens this strip via darkmodecss.js, so this
           is inert there (same value). */
        .ic-DashboardCard__header_content {
            ${cardTransparency
                ? `background: none !important;`
                : `background: var(--bcbackground-0) !important;`}
        }
        tr.student_assignment.assignment_graded.editable > * {
            border:none!important
        }`; 
    // TODO: liquid glass?
    
    document.documentElement.appendChild(style);
}

let insertTimer;
function resetTimer() {
    clearTimeout(insertTimer);
    insertTimer = setTimeout(() => {
        if (document.querySelectorAll(".ic-DashboardCard__link").length > 0) {
            loadCardAssignments();
            loadBetterTodo();
        } else {
            resetTimer();
        }
    }, 1);
}

// TODO_tuna - Should this function live in nav.js?
function checkDashboardReady() {
    const isDashboard = () => current_page == "/" || current_page == "" || /^\/courses\/(\d+)(?:\/|$)/.test(current_page);

    const callback = (mutationList) => {
        // Ignore attribute-only mutations; only structural (childList) changes matter here.
        let hasChildList = false;
        for (const mutation of mutationList) {
            if (mutation.type === "childList") { hasChildList = true; break; }
        }
        if (!hasChildList) return;

        if (isDashboard()) {
            // Debounce: a single setup pass per burst of mutations.
            if (dashboardReadyTimer) return;
            dashboardReadyTimer = setTimeout(() => {
                dashboardReadyTimer = null;

                const c = document.querySelector("#DashboardCard_Container");
                if (c) {
                    let cards = document.querySelectorAll(".ic-DashboardCard");
                    // Build a cheap signature of the current card set. The setup
                    // pass below mutates the cards' internals (assignment rows,
                    // grades, etc.) but never adds/removes the .ic-DashboardCard
                    // elements themselves, so the signature stays stable across
                    // our own mutations. It only changes when Canvas re-renders the
                    // dashboard (cards added/removed/reordered/replaced). Skipping
                    // when it's unchanged breaks the self-retriggering reflow loop.
                    let signature = cards.length + "";
                    for (let i = 0; i < cards.length; i++) {
                        const link = cards[i].querySelector(".ic-DashboardCard__link");
                        signature += "|" + (link ? link.getAttribute("href") : "");
                    }
                    // Canvas often re-renders the dashboard on a hard reload and
                    // replaces the .ic-DashboardCard nodes with fresh ones that have
                    // the same courses/links (so the signature is unchanged) but no
                    // longer carry our .canvasrefined-card-assignment marker. The
                    // signature guard alone would skip re-setup in that case, leaving
                    // card assignments empty until a popup toggle forces a reload.
                    // Re-run whenever any card is missing its marker too. This is safe
                    // from the self-retriggering reflow loop: after the pass every
                    // card has the marker, so our own subsequent mutation bursts skip.
                    let missingMarker = false;
                    for (let i = 0; i < cards.length; i++) {
                        if (!cards[i].querySelector(".canvasrefined-card-assignment")) {
                            missingMarker = true;
                            break;
                        }
                    }
                    if (signature !== lastDashboardCardSignature || missingMarker) {
                        lastDashboardCardSignature = signature;
                        changeGradientCards();
                        setupCardAssignments();
                        loadCardAssignments();
                        customizeCards(cards);
                        insertGrades();
                        loadDashboardNotes();
                        setupGPACalc();
                        showUpdateMsg();
                        createNasaInfoOverlay();
                    }
                }

                const rightSide = document.querySelector("#right-side");
                if (rightSide && !rightSide.querySelector(".canvasrefined-todosidebar")) {
                    setupBetterTodo();
                    setupBetterSidebar(getSidebarLayoutMode());
                }

                if (options.better_sidebar) {
                    ensureBetterSidebar();
                }
            }, 0);
        } else if (options.better_sidebar) {
            // Throttle sidebar setup checks on non-dashboard (course) pages instead
            // of calling ensureBetterSidebar() on every mutation burst.
            if (sidebarReadyTimer) return;
            sidebarReadyTimer = setTimeout(() => {
                sidebarReadyTimer = null;
                ensureBetterSidebar();
            }, 100);
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

function recieveMessage(request, sender, sendResponse) {
    switch (request.message) {
        case ("getCards"):
            if (options["card_method_dashboard"] === true) {
                getCardsFromDashboard().then(() => sendResponse(true));
            } else {
                getCards().then(() => sendResponse(true));
            }
            return true; // keep the message channel open for async sendResponse
        case ("setcolors"): changeColorPreset(request.options); sendResponse(true); break;
        case ("getcolors"): getCardColors().then(colors => sendResponse(colors)); return true; // keep the message channel open for async sendResponse
        case ("inspect"): sendResponse(inspectDarkMode(true)); break;
        case ("fixdm"): sendResponse(runDarkModeFixer(true)); break;
		case ("updateBackground"): applyCustomBackground(); sendResponse(true); break;
        default: sendResponse(true);
    }
}