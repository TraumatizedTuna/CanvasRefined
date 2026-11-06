// TODO_tuna - Figure out what these lists do. Maybe use sets or even enums for better performance?
const syncedSwitches = ['remind', 'tab_icons', 'dark_mode', 'remlogo', 'full_width', 'auto_dark', 'assignments_due', 'gpa_calc', 'gradient_cards', 'disable_color_overlay', 'dashboard_grades', 'dashboard_notes', 'better_todo', 'better_sidebar', 'condensed_cards', 'hide_new_canvas', 'hide_sequence_footer', 'center_cards', 'quiz_safe_mode', 'global_search', 'grade_analytics'];
const syncedSubOptions = [
	"grade_analytics_zones",
	"todo_hide_feedback",
	"todo_hide_read",
	"todo_full_height",
    "todo_confetti",
    "todo_progress_rings",
    "todo_timeframe",
	"device_dark",
	"relative_dues",
	"card_overdues",
	"equal_height_cards",
	// "todo_overdues",
	"gpa_calc_prepend",
	"gpa_calc_cumulative",
	"gpa_calc_weighted",
	"auto_dark",
	"auto_dark_start",
	"auto_dark_end",
	"num_assignments",
	"assignment_date_format",
	"todo_hr24",
	"todo_separate_scrollbar",
	"todo_alternate_colors",
	"todo_ignore_card_colors",
	"todo_remove_icons",
	"grade_hover",
	"card_letter",
	// "hide_completed",
	"num_todo_items",
	"hover_preview",
	"customCardStyles",
	"imageSize",
	"cardRoundness",
	"imageRoundness",
	"cardSpacing",
	"cardWidth",
	"cardHeight",
	"cardPadding",
	"customBackgroundLink",
    "customBackgroundScale",
    "customBackgroundDaily",
    "customBackgroundNasaDaily",
    "fitImageToScreen",
    "sidebar_scale",
    "bg_opacity",
    "sidebar_opacity",
    "bg_blur",
    "sidebar_blur",
    "card_opacity",
    "card_blur",
];
const localSwitches = [];

// Theme export only carries visual settings, never personal productivity data.
const exportDarkSchedule = ["auto_dark", "auto_dark_start", "auto_dark_end", "device_dark"];
const exportCardColorToggles = ["gradient_cards", "disable_color_overlay"];
const exportCardStyles = ["customCardStyles", "imageSize", "cardRoundness", "imageRoundness", "cardSpacing", "cardWidth", "cardHeight", "cardPadding"];
const exportLayout = ["full_width", "center_cards", "condensed_cards", "equal_height_cards", "remlogo", "hide_new_canvas", "tab_icons"];
const exportSidebar = ["better_sidebar", "sidebar_scale"];
const exportTodo = ["better_todo", "todo_hide_feedback", "todo_hide_read", "todo_full_height", "todo_confetti", "todo_progress_rings", "todo_timeframe", "todo_hr24", "todo_separate_scrollbar", "todo_alternate_colors", "todo_ignore_card_colors", "todo_remove_icons", "hover_preview"];
const exportGpa = ["gpa_calc", "gpa_calc_prepend", "gpa_calc_cumulative", "gpa_calc_weighted"];
const exportBackground = ["customBackgroundLink", "customBackgroundScale", "customBackgroundDaily", "customBackgroundNasaDaily", "fitImageToScreen", "card_transparency", "bg_opacity", "sidebar_opacity", "bg_blur", "sidebar_blur", "card_opacity", "card_blur"];
// Master "On/off toggles" = every visual toggle (no GPA, no dark-mode schedule,
// no personal productivity features). Includes the former separate Layout and
// Sidebar groups, plus Grade Analytics and its colored-zones sub-toggle.
const exportToggles = ["dark_mode", "quiz_safe_mode", "grade_analytics", "grade_analytics_zones"].concat(exportCardColorToggles, exportLayout, exportSidebar, exportTodo);
const fontsDropdownStateKey = "fonts_dropdown_open";

const apiurl = "none";

const defaultOptions = {
    "local": {
        "previous_colors": null,
        "previous_theme": null,
        "errors": [],
    },
    "sync": {
        "dark_preset": {
            "background-0": "#161616",
            "background-1": "#1e1e1e",
            "background-2": "#262626",
            "borders": "#3c3c3c",
            "text-0": "#f5f5f5",
            "text-1": "#e2e2e2",
            "text-2": "#ababab",
            "links": "#56Caf0",
            "sidebar": "#1e1e1e",
            "sidebar-text": "#f5f5f5"
        },
        "new_install": true,
        "assignments_due": true,
        "gpa_calc": false,
        "dark_mode": true,
        "gradent_cards": false,
        "disable_color_overlay": false,
        "auto_dark": false,
        "auto_dark_start": { "hour": "20", "minute": "00" },
        "auto_dark_end": { "hour": "08", "minute": "00" },
        "num_assignments": 4,
        "custom_domain": [""],
        "assignments_done": [],
        "dashboard_grades": false,
        "assignment_date_format": false,
        "dashboard_notes": false,
        "dashboard_notes_text": "",
        "dashboard_notes_mode": "edit",
        "better_todo": true,
        "better_sidebar": false,
        "sidebar_scale": 100,
        "bg_opacity": 65,
        "sidebar_opacity": 100,
        "bg_blur": 8,
        "sidebar_blur": 0,
        "card_transparency": false,
        "card_opacity": 80,
        "card_blur": 8,
        "todo_hr24": false,
		"todo_separate_scrollbar": false,
		"todo_alternate_colors": false,
		"todo_ignore_card_colors": false,
		"todo_remove_icons": false,
        "todo_hide_read": true,
        "condensed_cards": false,
        "center_cards": false,
        "custom_cards": {},
        "custom_cards_2": {},
        "custom_cards_3": {},
        "custom_assignments": [],
        "custom_assignments_overflow": ["custom_assignments"],
        "grade_hover": false,
        "card_letter": true,
        // "hide_completed": false,
        "num_todo_items": 10,
        "custom_font": { "link": "", "family": "" },
        "hover_preview": true,
        "full_width": null,
        "remlogo": null,
        "gpa_calc_bounds": {
            "A+": { "cutoff": 97, "gpa": 4.0 },
            "A": { "cutoff": 93, "gpa": 4 },
            "A-": { "cutoff": 90, "gpa": 3.7 },
            "B+": { "cutoff": 87, "gpa": 3.3 },
            "B": { "cutoff": 83, "gpa": 3 },
            "B-": { "cutoff": 80, "gpa": 2.7 },
            "C+": { "cutoff": 77, "gpa": 2.3 },
            "C": { "cutoff": 73, "gpa": 2 },
            "C-": { "cutoff": 70, "gpa": 1.7 },
            "D+": { "cutoff": 67, "gpa": 1.3 },
            "D": { "cutoff": 63, "gpa": 1 },
            "D-": { "cutoff": 60, "gpa": .7 },
            "F": { "cutoff": 0, "gpa": 0 }
        },
        // "todo_overdues": false,
        "card_overdues": false,
        "relative_dues": false,
        "equal_height_cards": false,
        "hide_new_canvas": true,
        "hide_sequence_footer": false,
        "grade_analytics_zones": false,
        "quiz_safe_mode": false,
        "dark_mode_fix": [],
        "assignment_states": {},
        "tab_icons": false,
        "todo_hide_feedback": false,
		"todo_full_height": false,
        "todo_progress_rings": "rings",
		"todo_timeframe": "all",
		"todo_confetti": true,
        "device_dark": false,
        "cumulative_gpa": { "name": "Cumulative GPA", "hidden": false, "weight": "dnc", "credits": 999, "gr": 3.21 },
        // "show_updates": false,
        "card_method_date": false,
        "card_method_dashboard": true,
        "card_limit": 25,
        "imageSize": 100,
        "cardRoundness": 5,
        "imageRoundness": 0,
        "cardSpacing": 0,
        "cardWidth": 262,
        "cardHeight": 146,
        "cardPadding": 0,
        "customCardStyles": false,
        "customBackgroundLink": "",
        "customBackgroundScale": 100,
        "customBackgroundDaily": false,
        "customBackgroundNasaDaily": false,
        "fitImageToScreen": false,
    }
};




function displayErrors() {
    chrome.storage.local.get("errors", storage => {
        storage["errors"].forEach(e => {
            document.querySelector("#error_log_output").value += (e + "\n\n");
        })
    });
}



document.addEventListener("DOMContentLoaded", setup);

// toggle visibility of the Discord/GitHub social links (persists locally)
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("social-toggle");
    const buttons = document.querySelector(".social-buttons");
    if (!toggle || !buttons) return;
    const KEY = "hide_socials";
    const render = (hidden) => {
        buttons.classList.toggle("hidden", hidden);
        toggle.textContent = chrome.i18n.getMessage(hidden ? "show_links" : "hide_links");
    };
    chrome.storage.local.get(KEY, (res) => render(!!res[KEY]));
    const flip = () => chrome.storage.local.get(KEY, (res) => {
        const next = !res[KEY];
        chrome.storage.local.set({ [KEY]: next });
        render(next);
    });
    toggle.addEventListener("click", flip);
    toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); }
    });
});

function setup() {
// TODO_tuna - Do we really need those lambdas? 🤔
    const menu = {
		switches: syncedSwitches,
		checkboxes: [
			"browser_show_likes",
			"gpa_calc_weighted",
			"gpa_calc_cumulative",
			// /*'card_method_date',*/ "show_updates",
            "todo_hide_feedback",
            "todo_hide_read",
            "todo_confetti",
			"todo_full_height",
			"device_dark",
			"relative_dues",
			"card_overdues",
			"equal_height_cards",
			// "todo_overdues",
			"gpa_calc_prepend",
			"auto_dark",
			"assignment_date_format",
			"todo_hr24",
			"todo_separate_scrollbar",
			"todo_alternate_colors",
			"todo_ignore_card_colors",
			"todo_remove_icons",
			"grade_hover",
			"card_letter",
			// "hide_completed",
			"hover_preview",
            "customBackgroundDaily",
            "customBackgroundNasaDaily",
            "fitImageToScreen",
            "card_transparency",
			"customCardStyles",
			"grade_analytics_zones",
		],
		tabs: {
			"advanced-settings": {
				setup: displayAdvancedCards,
				tab: ".advanced",
			},
			"gpa-bounds-btn": {
				setup: displayGPABounds,
				tab: ".gpa-bounds-container",
			},
			"custom-font-btn": {
				setup: displayCustomFont,
				tab: ".custom-font-container",
			},
			"card-colors-btn": { setup: null, tab: ".card-colors-container" },
			"customize-dark-btn": {
				setup: displayDarkModeFixUrls,
				tab: ".customize-dark",
			},
			"import-export-btn": {
				setup: displayThemeList,
				tab: ".import-export",
			},
			"report-issue-btn": {
				setup: displayErrors,
				tab: ".report-issue-container",
			},
			"updates-btn": { setup: null, tab: ".updates-container" },
		},
		special: [
			{
				identifier: "auto_dark_start",
				setup: (initial) =>
					setupAutoDarkInput(initial, "auto_dark_start"),
			},
			{
				identifier: "auto_dark_end",
				setup: (initial) =>
					setupAutoDarkInput(initial, "auto_dark_end"),
			},
			{
				identifier: "num_assignments",
				setup: (initial) => setupAssignmentsSlider(initial),
			},
			{
				identifier: "num_todo_items",
				setup: (initial) => setupTodoSlider(initial),
			},
            {
                identifier: "sidebar_scale",
                setup: (initial) => setupSidebarScaleSlider(initial),
            },
            {
                identifier: "bg_opacity",
                setup: (initial) => setupRangeSlider("bg_opacity", "bgOpacitySlider", "bgOpacityValue", "bgOpacityReset", 65, 100, "%", initial),
            },
            {
                identifier: "sidebar_opacity",
                setup: (initial) => setupRangeSlider("sidebar_opacity", "sidebarOpacitySlider", "sidebarOpacityValue", "sidebarOpacityReset", 100, 100, "%", initial),
            },
            {
                identifier: "bg_blur",
                setup: (initial) => setupRangeSlider("bg_blur", "bgBlurSlider", "bgBlurValue", "bgBlurReset", 8, 30, "px", initial),
            },
            {
                identifier: "sidebar_blur",
                setup: (initial) => setupRangeSlider("sidebar_blur", "sidebarBlurSlider", "sidebarBlurValue", "sidebarBlurReset", 0, 30, "px", initial),
            },
            {
                identifier: "card_opacity",
                setup: (initial) => setupRangeSlider("card_opacity", "cardOpacitySlider", "cardOpacityValue", "cardOpacityReset", 80, 100, "%", initial),
            },
            {
                identifier: "card_blur",
                setup: (initial) => setupRangeSlider("card_blur", "cardBlurSlider", "cardBlurValue", "cardBlurReset", 8, 30, "px", initial),
            },
			{
				identifier: "card_limit",
				setup: (initial) => setupCardLimitSlider(initial),
			},
			{
				identifier: "card_method_dashboard",
				setup: (initial) => setupDashboardMethod(initial),
			},
			{
				identifier: "custom_styles",
				setup: (initial) => setupCustomStyle(initial),
			},
			{
				identifier: "imageSize",
				setup: (initial) => setupImageSizeInput(initial),
			},
			{
				identifier: "cardRoundness",
				setup: (initial) => setupCardRoundnessInput(initial),
			},
			{
				identifier: "imageRoundness",
				setup: (initial) => setupImageRoundnessInput(initial),
			},
			{
				identifier: "cardSpacing",
				setup: (initial) => setupCardSpacingInput(initial),
			},
			{
				identifier: "cardWidth",
				setup: (initial) => setupCardWidthInput(initial),
			},
			{
				identifier: "cardHeight",
				setup: (initial) => setupCardHeightInput(initial),
			},
			{
				identifier: "cardPadding",
				setup: (initial) => setupCardPaddingInput(initial),
			},
			{
				identifier: "customBackgroundLink",
				setup: (initial) => setupCustomBackgroundLink(initial),
			},
            {
                identifier: "customBackgroundScale",
                setup: (initial) => setupCustomBackgroundScale(initial),
            },
			{
				identifier: "todo_progress_rings",
				setup: (initial) => setupProgressRingsSelect(initial),
			},
			{
				identifier: "todo_timeframe",
				setup: (initial) => setupTimeframeSelect(initial),
			},
		],
	};

    chrome.storage.sync.get(menu.switches, sync => {
        menu.switches.forEach(option => {
            let optionSwitch = document.getElementById(option);
            let status = sync[option] === true ? "#on" : "#off";
            optionSwitch.querySelector(status).checked = true;
            optionSwitch.querySelector(status).classList.add('checked');

            optionSwitch.querySelector(".slider").addEventListener("mouseup", () => {
                let status = !optionSwitch.querySelector("#on").checked;
                optionSwitch.querySelector("#on").checked = status;
                optionSwitch.querySelector("#on").classList.toggle("checked");
                optionSwitch.querySelector("#off").classList.toggle("checked");
                chrome.storage.sync.set({ [option]: status });
                if (option === "auto_dark") {
                    toggleDarkModeDisable(status);
                }
                if (option === "better_sidebar") {
                    toggleBetterSidebarSubOptions(status);
                }
                if (option === "dark_mode") {
                    toggleAlternateColorsVisibility(status);
                }
                toggleSubOptionsVisibility(option, status);
            });
        });
        toggleBetterSidebarSubOptions(sync["better_sidebar"] === true);
        ["gpa_calc", "assignments_due", "better_todo", "auto_dark", "grade_analytics"].forEach(opt => {
            toggleSubOptionsVisibility(opt, sync[opt] === true);
        });
        toggleAlternateColorsVisibility(sync["dark_mode"] === true);
    });

    chrome.storage.sync.get(menu.checkboxes, sync => {
        menu.checkboxes.forEach(option => {
			const checkbox = document.querySelector("#" + option);
			if (!checkbox) {console.log(option); return;}
            checkbox.addEventListener("change", function (e) {
                let status = this.checked;
                if (option === "customBackgroundDaily" && status) {
                    document.querySelector("#customBackgroundNasaDaily").checked = false;
                    chrome.storage.sync.set({ "customBackgroundDaily": true, "customBackgroundNasaDaily": false });
                } else if (option === "customBackgroundNasaDaily" && status) {
                    document.querySelector("#customBackgroundDaily").checked = false;
                    chrome.storage.sync.set({ "customBackgroundNasaDaily": true, "customBackgroundDaily": false });
                } else {
                    chrome.storage.sync.set(JSON.parse(`{"${option}": ${status}}`));
                }
                syncCustomBackgroundDailyState(document.querySelector("#customBackgroundDaily")?.checked === true || document.querySelector("#customBackgroundNasaDaily")?.checked === true);
                toggleOpacityOptions();
            });
            const value = sync[option] !== undefined ? sync[option] : defaultOptions.sync[option];
            document.querySelector("#" + option).checked = value;
        });
        syncCustomBackgroundDailyState(sync.customBackgroundDaily === true || sync.customBackgroundNasaDaily === true);
        toggleDarkModeDisable(sync.auto_dark);
        displayBackgroundPresets();
        toggleOpacityOptions();
    });

    const specialOptions = menu.special.map(obj => obj.identifier);
    chrome.storage.sync.get(specialOptions, sync => {
        console.log(sync);
        menu.special.forEach(option => {
            if (option.setup !== null) {
                const value = sync[option.identifier] !== undefined ? sync[option.identifier] : defaultOptions.sync[option.identifier];
                option.setup(value);
            }
        });
    })


    // activate tab buttons
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (menu.tabs[btn.id].setup !== null) menu.tabs[btn.id].setup();
            document.querySelector(".main").style.display = "none";
            document.querySelector(menu.tabs[btn.id].tab).style.display = "block";
            window.scrollTo(0, 0);
        });
    });

    // activate the back buttons on each tab
    document.querySelectorAll(".back-btn").forEach(btn => {
        btn.addEventListener("click", function () {
            document.querySelectorAll(".tab").forEach(tab => {
                tab.style.display = "none";
            });
            document.querySelector(".main").style.display = "block";
        });
    });

    // give everything the appropirate i18n text
    document.querySelectorAll('[data-i18n]').forEach(text => {
        const msg = chrome.i18n.getMessage(text.dataset.i18n);
        // keep the in-HTML fallback text when a key is missing instead of blanking it
        if (msg) text.innerText = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nPlaceholder);
        if (msg) el.placeholder = msg;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const msg = chrome.i18n.getMessage(el.dataset.i18nTitle);
        if (msg) el.title = msg;
    });

    // header feature search (search bar that jumps to features)
    setupFeatureSearch(menu);

    // activate dark mode inspector button
    document.querySelector("#inspector-btn").addEventListener("click", async function () {
        document.querySelector("#inspector-output").textContent = (await sendFromPopup("inspect"))["selectors"];
    });

    // activate dark mode fixer button
    document.querySelector("#fix-dm-btn").addEventListener("click", async function () {
        let output = await sendFromPopup("fixdm");
        if (output.path === "canvasrefined-none" || output.path === "canvasrefined-darkmode_off") return;
        let rating = "bad";
        if (output.time < 100) {
            rating = "good";
        } else if (output.time < 250) {
            rating = "ok";
        }
        document.getElementById("fix-dm-output").textContent = "Fix took " + Math.round(output.time) + "ms (rating: " + rating + ")";
        chrome.storage.sync.get("dark_mode_fix", sync => {
            if (sync["dark_mode_fix"].includes(output.path)) return;
            sync["dark_mode_fix"].push(output.path);
            chrome.storage.sync.set({ "dark_mode_fix": sync["dark_mode_fix"] }).then(() => displayDarkModeFixUrls());
        })
    });

    // activate storage dump button
    document.querySelector("#rk_btn").addEventListener("click", () => {
        chrome.storage.local.get(null, local => {
            chrome.storage.sync.get(null, sync => {
                document.querySelector("#rk_output").value = JSON.stringify(local) + JSON.stringify(sync);
            })
        })
    });

    // activate storage reset button
    document.querySelector("#storage-reset-btn").addEventListener("click", () => {
        chrome.storage.sync.set(defaultOptions["sync"]);
        updateStorageUsage();
    });

    // activate planner cache clear button (Report issue tab). Clears the
    // cached planner items locally, then tells any open Canvas tabs to
    // re-fetch fresh data so the clear takes effect without a refresh.
    // Keep the key in sync with PLANNER_CACHE_KEY in content.js.
    document.querySelector("#planner-cache-clear-btn").addEventListener("click", async () => {
        displayAlert(false, "Planner cache cleared.");
        try {
            await chrome.storage.local.remove("planner_cache_v1");
        } catch (e) { /* nothing stored yet */ }
        await sendFromPopup("clearPlannerCache");
        updateStorageUsage();
    });

    // ---- Storage usage display (Report issue tab) ----
    // Shows how much space the extension's settings, planner cache, and
    // other local data take, plus the storage quota available to it.
    function formatStorageBytes(bytes) {
        if (bytes == null) return "unknown";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(2) + " MB";
    }

    // getBytesInUse is exact but not implemented everywhere (older Firefox),
    // so fall back to measuring the serialized data as a Blob.
    async function storageBytesInUse(area, keys) {
        try {
            const bytes = await area.getBytesInUse(keys ?? null);
            if (typeof bytes === "number") return bytes;
        } catch (e) { /* not supported */ }
        try {
            const data = await area.get(keys ?? null);
            return new Blob([JSON.stringify(data)]).size;
        } catch (e) {
            return null;
        }
    }

    async function updateStorageUsage() {
        const set = (id, text) => {
            const el = document.querySelector(id);
            if (el) el.textContent = text;
        };

        // Sync settings vs the 100 KB chrome.storage.sync quota.
        const syncBytes = await storageBytesInUse(chrome.storage.sync);
        set("#storage-usage-sync", syncBytes == null ? "unknown" : formatStorageBytes(syncBytes) + " of 100 KB quota");

        // Planner cache: size plus item count, so users can see what the
        // to-do cache actually costs (and that clearing it worked).
        const cacheBytes = await storageBytesInUse(chrome.storage.local, "planner_cache_v1");
        let cacheText = "empty";
        if (cacheBytes) {
            try {
                const result = await chrome.storage.local.get("planner_cache_v1");
                const count = result?.["planner_cache_v1"]?.items?.length;
                cacheText = formatStorageBytes(cacheBytes) + (typeof count === "number" ? ` (${count} items)` : "");
            } catch (e) {
                cacheText = formatStorageBytes(cacheBytes);
            }
        }
        set("#storage-usage-cache", cacheText);

        // Everything else in local storage (settings the extension keeps
        // locally, state like the analytics toggle, etc.).
        const localBytes = await storageBytesInUse(chrome.storage.local);
        if (localBytes == null) {
            set("#storage-usage-local", "unknown");
        } else {
            const other = cacheBytes != null ? Math.max(localBytes - cacheBytes, 0) : null;
            set("#storage-usage-local", other == null ? formatStorageBytes(localBytes) : formatStorageBytes(other));
        }

        // Quota available to the extension. With the unlimitedStorage
        // permission this is a large slice of free disk space, so it reads
        // big — that is expected.
        try {
            const est = await navigator.storage.estimate();
            if (est && est.quota) {
                set("#storage-usage-quota", formatStorageBytes(est.quota) + " available");
            }
        } catch (e) { /* estimate unsupported */ }
    }
    updateStorageUsage();

    // activate custom url input
    document.querySelector('#customDomain').addEventListener('input', function () {
        let domains = this.value.split(",");
        domains.forEach((domain, index) => {
            let val = domain.replace(" ", "");
            if (val === "") return;
            //if (!val.includes("https://") && !val.includes("http://")) val = "https://" + val;
            try {
                let url = new URL(val);
                domains[index] = url.hostname;
                clearAlert();
            } catch (e) {
                domains[index] = val;
                displayAlert(true, "The URL you entered appears to be invalid, so it might not work.");
            }
        });
        chrome.storage.sync.set({ custom_domain: domains });
    });

    // setup custom url
    chrome.storage.sync.get(["custom_domain"], storage => {
        document.querySelector("#customDomain").value = storage.custom_domain ? storage.custom_domain : "";
    });

    // activate import input box
    document.querySelector("#import-input").addEventListener("input", (e) => {
        const obj = JSON.parse(e.target.value);
        importTheme(obj);
    });

    // copy export output to clipboard
    document.querySelector("#export-copy").addEventListener("click", async () => {
        const output = document.querySelector("#export-output");
        const btn = document.querySelector("#export-copy");
        const text = output.value;
        if (!text) { displayAlert(true, "Nothing to copy — select what to export first."); return; }
        const flash = () => { const old = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = old; }, 1200); };
        try {
            await navigator.clipboard.writeText(text);
            flash();
        } catch (e) {
            output.select();
            document.execCommand("copy");
            flash();
        }
    });

    // activate export checkbox
    document.querySelectorAll(".export-details input").forEach(input => {
        input.addEventListener("change", () => {
            chrome.storage.sync.get(syncedSwitches.concat(syncedSubOptions).concat(["dark_preset", "custom_cards", "custom_font", "gpa_calc_bounds", "custom_styles"]), async storage => {
                let final = {};
                for await (item of document.querySelectorAll(".export-details input")) {
                    if (item.checked) {
                        switch (item.id) {
                            case "export-toggles":
                                final = { ...final, ...(await getExport(storage, exportToggles)) };
                                break;
                            case "export-dark":
                                final = { ...final, ...(await getExport(storage, ["dark_preset", "dark_mode"])) };
                                break;
                            case "export-dark-schedule":
                                final = { ...final, ...(await getExport(storage, exportDarkSchedule)) };
                                break;
                            case "export-cards":
                                final = { ...final, ...(await getExport(storage, ["custom_cards"])) };
                                break;
                            case "export-colors":
                                final = { ...final, ...(await getExport(storage, ["card_colors", ...exportCardColorToggles])) };
                                break;
                            case "export-card-styles":
                                final = { ...final, ...(await getExport(storage, exportCardStyles)) };
                                break;
                            case "export-customStyles":
                                final = { ...final, ...(await getExport(storage, ["custom_styles"])) };
                                break;
                            case "export-font":
                                final = { ...final, ...(await getExport(storage, ["custom_font"])) };
                                break;
                            case "export-background":
                                final = { ...final, ...(await getExport(storage, exportBackground)) };
                                break;
                            case "export-todo":
                                final = { ...final, ...(await getExport(storage, exportTodo)) };
                                break;
                            case "export-gpa":
                                final = { ...final, ...(await getExport(storage, [...exportGpa, "gpa_calc_bounds"])) };
                                break;
                        }
                    }
                }
                document.querySelector("#export-output").value = JSON.stringify(final);
            });
        });
    });

    // Toggle all export checkboxes and dispatch one change event to refresh output.
    const exportCheckboxes = () => document.querySelectorAll(".export-details input");
    const refreshExport = () => {
        const first = exportCheckboxes()[0];
        if (first) first.dispatchEvent(new Event("change", { bubbles: true }));
    };
    document.querySelector("#export-check-all")?.addEventListener("click", () => {
        exportCheckboxes().forEach(c => { c.checked = true; });
        refreshExport();
    });
    document.querySelector("#export-check-none")?.addEventListener("click", () => {
        exportCheckboxes().forEach(c => { c.checked = false; });
        refreshExport();
    });

    // activate revert to original button
    document.querySelector("#theme-revert").addEventListener("click", () => {
        chrome.storage.local.get("previous_theme", local => {
            if (local["previous_theme"] !== null) {
                importTheme(local["previous_theme"]);
            }
        });
    });

    document.querySelector("#alert").addEventListener("click", clearAlert);
    // TODO: maybe fix this at some point, idk what is causing the error here
    document.querySelectorAll(".preset-button.customization-button").forEach(btn => btn.addEventListener("click", changeToPresetCSS));

    // activate card color inputs
    document.querySelector("#singleColorInput").addEventListener("change", e => document.querySelector("#singleColorText").value = e.target.value);
    document.querySelector("#singleColorText").addEventListener("change", e => document.querySelector("#singleColorInput").value = e.target.value);
    document.querySelector("#gradientColorFrom").addEventListener("change", e => document.querySelector("#gradientColorFromText").value = e.target.value);
    document.querySelector("#gradientColorFromText").addEventListener("change", e => document.querySelector("#gradientColorFrom").value = e.target.value);
    document.querySelector("#gradientColorTo").addEventListener("change", e => document.querySelector("#gradientColorToText").value = e.target.value);
    document.querySelector("#gradientColorToText").addEventListener("change", e => document.querySelector("#gradientColorTo").value = e.target.value);
    document.querySelector("#setSingleColor").addEventListener("click", () => {
        let colors = [document.querySelector("#singleColorInput").value];;
        sendFromPopup("setcolors", colors);
    });
    document.querySelector("#setGradientColor").addEventListener("click", () => {
        chrome.storage.sync.get("custom_cards", sync => {
            length = 0;
            Object.keys(sync["custom_cards"]).forEach(key => {
                if (sync["custom_cards"][key].hidden !== true) length++;
            });
            let colors = [];
            let from = document.querySelector("#gradientColorFrom").value;
            let to = document.querySelector("#gradientColorTo").value;
            for (let i = 1; i <= length; i++) {
                colors.push(getColorInGradient(i / length, from, to));
            }
            sendFromPopup("setcolors", colors);
        });
    });

    // activate revert to original card colors button
    document.querySelector("#revert-colors").addEventListener("click", () => {
        chrome.storage.local.get("previous_colors", local => {
            const prev = local["previous_colors"];
            // Guard against unset/expired-shape entries and the empty lists
            // old list-mode runs stored — sending [] would be a silent no-op.
            if (prev && Array.isArray(prev.colors) && prev.colors.length > 0) {
                sendFromPopup("setcolors", prev.colors);
            }
        })
    })

    // activate every card color palette button
    document.querySelectorAll(".preset-button.colors-button").forEach(btn => {
        const colors = getPalette(btn.querySelector("p").textContent);
        let preview = btn.querySelector(".colors-preview");
        colors.forEach(color => {
            let div = makeElement("div", preview, { "className": "color-preview"});
            div.style.background = color;
        });
        btn.addEventListener("click", () => {
            sendFromPopup("setcolors", colors);
        })
    });


    // activate sidebar tool radio
    ["#radio-sidebar-image", "#radio-sidebar-gradient", "#radio-sidebar-solid"].forEach(radio => {
        document.querySelector(radio).addEventListener("click", () => {
            chrome.storage.sync.get(["dark_preset"], storage => {
                let mode = radio === "#radio-sidebar-image" ? "image" : radio === "#radio-sidebar-gradient" ? "gradient" : "solid";
                displaySidebarMode(mode, storage["dark_preset"]["sidebar"]);
            });
        })
    });

    // theme browser controls
    document.getElementById("premade-themes-left").addEventListener("click", () => changePage(-1));
    document.getElementById("premade-themes-right").addEventListener("click", () => changePage(1));
    document.getElementById("theme-sorts").addEventListener("click", () => {
        const el = document.getElementById("theme-sort-selector");
        if (el.classList.contains("open")) {
            clickout();
        } else {
            el.classList.add("open");
            setTimeout(() => {
                document.addEventListener("click", clickout);
        }, 10);
        }
    });
    document.getElementById("theme-search").addEventListener("change", async (e) => {
        searchFor = e.target.value;
        console.log(searchFor);
        // linear search
        let themesToShow = [];
        for (let i = 0; i < themes.length; i++) {
            if (themes[i].title.toLowerCase().includes(searchFor.toLowerCase())) {
                themesToShow.push(themes[i]);
            }
        }
        console.log(themesToShow);
        displayThemeSearchList(themesToShow);
    });

    // activate theme save button
    document.getElementById("save-theme").addEventListener("click", saveCurrentTheme);

    // activate submit theme button

    document.getElementById("submit-theme-btn-1").addEventListener("click", () => {
        document.getElementById("submit-popup").classList.add("open");
    });

    document.getElementById("cancel-theme-btn").addEventListener("click", () => {
        document.getElementById("submit-popup").classList.remove("open");
    })

    // update theme button preview on input
    document.getElementById("submit-title").addEventListener("input", (e) => {
        document.getElementById("theme-button-title-preview").textContent = e.target.value.replaceAll(" ", "");
    });

    // update theme button preview on input
    document.getElementById("submit-credits").addEventListener("input", (e) => {
        document.getElementById("theme-button-creator-preview").textContent = e.target.value;
    });

    // activate the show button to open the theme submission drawer
    document.getElementById("show-submit-form").addEventListener("click",  (e) => {
        const drawer = document.getElementById("submit-drawer");
        if (drawer.style.display === "none") {
            drawer.style.display = "block";
            e.target.textContent = "Hide";
        } else {
            drawer.style.display = "none";
            e.target.textContent = "Show";
        }
    });

    // activate theme browser opt out

    // activate theme browser opt in

    document.querySelectorAll(".theme-sort-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            themeSort(e.target.textContent);
        });
    });

    // browser settings buttons
    document.getElementById("browser-settings-btn").addEventListener("click", () => {
        document.getElementById("browser-settings-popup").classList.add("open");
    });

    document.getElementById("close-settings-btn").addEventListener("click", () => {
        displayThemeList(0);
        document.getElementById("browser-settings-popup").classList.remove("open");
    });


    document.getElementById("submit-form-btn").addEventListener("click", displayThemeSubmissionForm);

    document.getElementById("gpa-plus-minus").addEventListener("click", () => {
        applyGPAPreset({
            "A+": { "cutoff": 97, "gpa": 4.0 },
            "A": { "cutoff": 93, "gpa": 4.0 },
            "A-": { "cutoff": 90, "gpa": 3.7 },
            "B+": { "cutoff": 87, "gpa": 3.3 },
            "B": { "cutoff": 83, "gpa": 3.0 },
            "B-": { "cutoff": 80, "gpa": 2.7 },
            "C+": { "cutoff": 77, "gpa": 2.3 },
            "C": { "cutoff": 73, "gpa": 2.0 },
            "C-": { "cutoff": 70, "gpa": 1.7 },
            "D+": { "cutoff": 67, "gpa": 1.3 },
            "D": { "cutoff": 63, "gpa": 1.0 },
            "D-": { "cutoff": 60, "gpa": 0.7 },
            "F": { "cutoff": 0, "gpa": 0 }
        });
    });
    document.getElementById("gpa-by-letter").addEventListener("click", () => {
        applyGPAPreset({
            "A+": { "cutoff": 97, "gpa": 4.0 },
            "A": { "cutoff": 93, "gpa": 4.0 },
            "A-": { "cutoff": 90, "gpa": 4.0 },
            "B+": { "cutoff": 87, "gpa": 3.0 },
            "B": { "cutoff": 83, "gpa": 3.0 },
            "B-": { "cutoff": 80, "gpa": 3.0 },
            "C+": { "cutoff": 77, "gpa": 2.0 },
            "C": { "cutoff": 73, "gpa": 2.0 },
            "C-": { "cutoff": 70, "gpa": 2.0 },
            "D+": { "cutoff": 67, "gpa": 1.0 },
            "D": { "cutoff": 63, "gpa": 1.0 },
            "D-": { "cutoff": 60, "gpa": 1.0 },
            "F": { "cutoff": 0, "gpa": 0 }
        });
    });

    // Note: the card-style number inputs (imageSize, cardRoundness,
    // imageRoundness, cardSpacing, cardWidth, cardHeight, cardPadding) are wired
    // via their setup*Input
    // handlers in menu.special above, which debounce the storage writes. The
    // duplicate listeners that used to live here referenced nonexistent
    // #*Value spans (threw on every input) and double-wrote to storage, which
    // is what blew the sync write quota when adjusting card styles quickly.

    document.getElementById("clearCustomBackground").addEventListener("click", () => {
                chrome.storage.sync.set({ "customBackgroundLink": "", "customBackgroundScale": 100 });
        document.querySelector("#customBackgroundLink").value = "";
		document.querySelector("#customBackgroundScale").value = 100;
		document.querySelector("#customBackgroundScaleValue").textContent = "100%";
		renderBackgroundPresetSelection();
		sendFromPopup("updateBackground");
        toggleOpacityOptions();
    });

    const applyFontsDropdownState = (isOpen) => {
        const el = document.getElementById("quick-fonts");
        const el2 = document.getElementsByClassName("custom-font")[0];
        const arrow = document.getElementById("fontsDropdownArrow");
        if (!el || !el2 || !arrow) return;
        el.style.display = isOpen ? "flex" : "none";
        el2.style.display = isOpen ? "block" : "none";
        arrow.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
    };

    chrome.storage.local.get([fontsDropdownStateKey], (storage) => {
        const isOpen = storage[fontsDropdownStateKey] !== false;
        applyFontsDropdownState(isOpen);
    });

    document.getElementById("fontsDropdown").addEventListener("click", () => {
        const el = document.getElementById("quick-fonts");
        const el2 = document.getElementsByClassName("custom-font")[0];
        if (!el || !el2) return;
        const isCurrentlyOpen = getComputedStyle(el).display !== "none" && getComputedStyle(el2).display !== "none";
        const nextOpen = !isCurrentlyOpen;
        applyFontsDropdownState(nextOpen);
        chrome.storage.local.set({ [fontsDropdownStateKey]: nextOpen });
    });

}


let removeAlert = null;

function clearAlert() {
    clearTimeout(removeAlert);
    document.querySelector("#alert").style.bottom = "-400px";
}

function displayAlert(bad, msg) {
    clearTimeout(removeAlert);
    document.querySelector("#alert").style.bottom = "0";
    document.querySelector("#alert").textContent = msg;
    document.querySelector("#alert").style.background = bad ? "#e7495ed9" : "#468b46d9";
    removeAlert = setTimeout(() => {
        clearAlert();
    }, 15000);
}

async function sendFromPopup(message, options = {}) {

    let response = new Promise((resolve, reject) => {
        chrome.tabs.query({ currentWindow: true }).then(async tabs => {
            for (let i = 0; i < tabs.length; i++) {
                try {
                    let res = await chrome.tabs.sendMessage(tabs[i].id, { "message": message, "options": options });
                    if (res) resolve(res);
                } catch (e) {
                }
            }
            resolve(null);
        });
    })

    return await response;
}
