function inspectDarkMode(withOutput = false) {
    let output = "";
    let bgcount = 0, textcount = 0, time = performance.now();
    let bg0 = hexToRgb(options.dark_preset["background-0"]);
    let bg1 = hexToRgb(options.dark_preset["background-1"]);
    let txt = hexToRgb(options.dark_preset["text-0"]);
    let bdr = hexToRgb(options.dark_preset["borders"]);
    let lnk = hexToRgb(options.dark_preset["links"]);
    document.querySelectorAll("*").forEach(el => {
        let style = getComputedStyle(el);
        let bgcolor = style.getPropertyValue("background").match(/rgb\((?<r>\d*)\, ?(?<g>\d*)\, ?(?<b>\d*)\) none/);
        let selector = "class=." + el.className + ",id=#" + el.id;

        if (bgcolor) {
            const r = parseInt(bgcolor.groups["r"]);
            const g = parseInt(bgcolor.groups["g"]);
            const b = parseInt(bgcolor.groups["b"]);
            if (r > 245 && g > 245 && b > 245 && !(r === bg0.r && g === bg0.g && b === bg0.b) && !(r === lnk.r && g === lnk.g && b === lnk.b)) {
                el.style.cssText = (";background:" + options.dark_preset["background-0"] + "!important;color" + options.dark_preset["text-0"] + "!important;") + el.style.cssText;
                if (withOutput === true) output += selector + "{background: background-0, color: text-0}\n";
                bgcount++;
            } else if (r > 225 && r < 245 && g > 225 && g < 245 && b > 225 && b < 245 && !(r === bg1.r && g === bg1.g && b === bg1.b) && !(r === lnk.r && g === lnk.g && b === lnk.b)) {
                el.style.cssText = (";background:" + options.dark_preset["background-1"] + "!important;color" + options.dark_preset["text-0"] + "!important;") + el.style.cssText;
                if (withOutput === true) output += selector + "{background: background-1, color: text-0}";
                bgcount++;
            }
        }


        let bordercolor = style.getPropertyValue("border-color").match(/rgb\((?<r>\d*)\, ?(?<g>\d*)\, ?(?<b>\d*)/);
        if (bordercolor) {
            const r = parseInt(bordercolor.groups["r"]);
            const g = parseInt(bordercolor.groups["g"]);
            const b = parseInt(bordercolor.groups["b"]);
            if (r > 195 && g > 195 && b > 195 && !(r === bdr.r && g === bdr.g && b === bdr.b) && !(r === lnk.r && g === lnk.g && b === lnk.b)) {
                el.style.cssText = "border-color:" + options.dark_preset["borders"] + "!important;" + el.style.cssText;
                if (withOutput === true) output += selector + "{border: borders}";
            }
        }

        let text = style.getPropertyValue("color").match(/rgb\((?<r>\d*)\, ?(?<g>\d*)\, ?(?<b>\d*)/);
        if (text) {
            const r = parseInt(text.groups["r"]);
            const g = parseInt(text.groups["g"]);
            const b = parseInt(text.groups["b"]);
            if (r <= 70 && g <= 70 && b <= 70 && !(r === txt.r && g === txt.g && b === txt.b)) {
                el.style.cssText = "color:" + options.dark_preset["text-0"] + "!important;" + el.style.cssText;
                if (withOutput === true) output += selector + "{text: text-0}";
                textcount++;
            }
        }

    });
    console.log("done fixing dark mode - time:", performance.now() - time, "total backgrounds changed: ", bgcount, ", total colors changed: ", textcount);
    return { "selectors": output === "" ? "no gaps determined" : output, "time": performance.now() - time };
}

// Light-mode fallbacks for the --bc* variables, always emitted so extension UI renders in light mode; dark mode overrides below.
const BC_LIGHT_DEFAULTS = {
    "background-0": "#ffffff",
    "background-1": "#c7c7c7",
    "background-2": "#d9d9d9",
    "borders": "#808080",
    "links": "#418df1",
    "sidebar": "#e3e3e3",
    "sidebar-text": "#000000",
    "text-0": "#000000",
    "text-1": "#050505",
    "text-2": "#4f4f4f"
};

function generateDarkModeCSS() {
    // Always-on light-mode defaults so var(--bc*) resolves in light mode too.
    let css = ":root{\n";
    Object.keys(BC_LIGHT_DEFAULTS).forEach((key) => {
        css += "    --bc" + key + ": " + BC_LIGHT_DEFAULTS[key] + ";\n";
    });
    css += "}\n\n";

    const darkOn = options.dark_mode === true || options.device_dark === true;
    if (!darkOn) return css;

    let darkBlock = ":root{\n";
    if (options.dark_preset) {
        Object.keys(options.dark_preset).forEach((key) => {
            darkBlock += "    --bc" + key + ": " + options.dark_preset[key] + ";\n";
        });
    }
    darkBlock += "}\n\n";
    darkBlock += DARKMODE_CSS;

    if (options.device_dark === true) {
        css += "@media (prefers-color-scheme: dark) {\n" + darkBlock + "\n}";
    } else {
        css += darkBlock;
    }
    return css;
}

let darkStyleInserted = false;
// --- Submission tray dark-mode fixer ---------------------------------------
// The comment chip on the grades page (…/grades) opens an InstUI
// "Submission Comments Tray". Its "Attempt N Feedback" card, close-button
// glyph, and some labels arrive with Canvas's light surface and dark ink
// through emotion classes whose hashes change between Canvas releases, so
// they can't be themed from the static dark stylesheet. Instead, watch for
// the tray and recolor at runtime, scoped strictly to elements inside it.
// Touched elements are tagged (data-crdarkfix) so turning dark mode off can
// restore the original colors.
let submissionTrayObserver = null;
let submissionTrayFixScheduled = false;

function crApplySubmissionTrayFix(el, props) {
    const applied = el.dataset.crdarkfix ? el.dataset.crdarkfix.split(" ") : [];
    for (const prop of Object.keys(props)) {
        if (!applied.includes(prop)) applied.push(prop);
        el.style.setProperty(prop, props[prop], "important");
    }
    el.dataset.crdarkfix = applied.join(" ");
}

function fixSubmissionTrayColors(root) {
    const preset = options.dark_preset;
    if (!preset) return;
    const light = (r, g, b) => r >= 225 && g >= 225 && b >= 225;
    const darkInk = (r, g, b) => r <= 70 && g <= 70 && b <= 70;
    const rgb = (str) => { const m = str && str.match(/rgb\((\d+), ?(\d+), ?(\d+)/); return m ? [+m[1], +m[2], +m[3]] : null; };
    root.querySelectorAll("*").forEach(el => {
        if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) return;
        const cs = getComputedStyle(el);
        const bg = rgb(cs.backgroundColor);
        if (bg && light(bg[0], bg[1], bg[2])) {
            // light card/surface -> theme surface with readable text
            crApplySubmissionTrayFix(el, {
                "background-color": preset["background-2"],
                "color": preset["text-0"]
            });
        } else {
            const c = rgb(cs.color);
            if (c && darkInk(c[0], c[1], c[2])) {
                // dark ink on dark tray (headings, icon glyphs)
                crApplySubmissionTrayFix(el, { "color": preset["text-0"] });
            }
        }
        const bc = rgb(cs.borderColor);
        if (bc && light(bc[0], bc[1], bc[2])) {
            crApplySubmissionTrayFix(el, { "border-color": preset["borders"] });
        }
    });
}

function setupSubmissionTrayWatcher() {
    if (submissionTrayObserver) return;
    const run = () => {
        submissionTrayFixScheduled = false;
        if (options.dark_mode !== true && options.device_dark !== true) return;
        const tray = document.querySelector('[data-testid="submission-tray"]');
        if (tray) fixSubmissionTrayColors(tray);
    };
    // Canvas mutates the DOM constantly; debounce to one run per frame (same
    // pattern as the footer observer in startExtension). Comments load into
    // the tray asynchronously, so re-run whenever the tray subtree changes.
    submissionTrayObserver = new MutationObserver(() => {
        if (submissionTrayFixScheduled) return;
        submissionTrayFixScheduled = true;
        requestAnimationFrame(run);
    });
    submissionTrayObserver.observe(document.documentElement, { childList: true, subtree: true });
    run();
}

function teardownSubmissionTrayFixes() {
    if (submissionTrayObserver) {
        submissionTrayObserver.disconnect();
        submissionTrayObserver = null;
    }
    document.querySelectorAll("[data-crdarkfix]").forEach(el => {
        (el.dataset.crdarkfix || "").split(" ").forEach(prop => el.style.removeProperty(prop));
        delete el.dataset.crdarkfix;
    });
}

function toggleDarkMode() {
    const css = generateDarkModeCSS();
    const darkOn = options.dark_mode === true || options.device_dark === true;
    // Reuse the existing #darkcss style if present (never create a duplicate), so a
    // document_start dark-mode bootstrap and later updates stay on one element.
    let style = document.querySelector("#darkcss");
    if (!style) {
        style = document.createElement('style');
        style.id = 'darkcss';
        document.documentElement.append(style);
    }
    style.textContent = css;
    style.className = darkOn ? "canvasrefined-darkmode-enabled" : "";
    darkStyleInserted = true;
    // The InstUI submission tray is themed at runtime (emotion class hashes
    // change between Canvas releases); keep the watcher in sync with the
    // current mode, and undo inline fixes when dark mode turns off.
    if (darkOn) {
        setupSubmissionTrayWatcher();
    } else {
        teardownSubmissionTrayFixes();
    }
    runiframeChecker();
}

function runDarkModeFixer(override = false) {
    // Quiz safe mode: never auto-run the dark mode fixer on quiz pages.
    if (quizSafeModeActive()) return { "path": "canvasrefined-none", "time": "" };
    if (options.dark_mode !== true) return { "path": "canvasrefined-darkmode_off", "time": "" };
    if (override === false && !options["dark_mode_fix"].includes(window.location.pathname)) return { "path": "canvasrefined-none", "time": "" };
    let output = inspectDarkMode();
    return { "path": window.location.pathname, "time": output.time };
}

function autoDarkModeCheck() {
    let date = new Date();
    let currentHour = date.getHours();
    let currentMinute = date.getMinutes();
    let status = false;
    if (options.auto_dark === false) return;
    let startHour = parseInt(options.auto_dark_start["hour"]);
    let startMinute = parseInt(options.auto_dark_start["minute"]);
    let endHour = parseInt(options.auto_dark_end["hour"]);
    let endMinute = parseInt(options.auto_dark_end["minute"]);
    if (currentHour === startHour) {
        status = currentMinute >= startMinute;
    } else if (currentHour === endHour) {
        status = currentMinute <= endMinute;
    } else if (startHour > endHour) {
        status = currentHour > startHour || currentHour < endHour;
    } else if (startHour < endHour) {
        status = currentHour > startHour && currentHour < endHour;
    }
    if (options.auto_dark === true) {
        // Skip the write (and the storage.onChanged cascade it would trigger) when the
        // computed state already matches dark_mode, so the 60s timer is a cheap no-op.
        if (status === options.dark_mode) return;
        options.dark_mode = status;
        chrome.storage.sync.set({ "dark_mode": status }, toggleDarkMode);
    }
}

function toggleAutoDarkMode() {
    clearInterval(timeCheck);
    if (options.auto_dark && options.auto_dark === false) return;
    autoDarkModeCheck();
    timeCheck = setInterval(autoDarkModeCheck, 60000);
}


let iframeObserver;
function runiframeChecker() {
    if (current_page === "/" || current_page === "") return;

    if (!options.dark_mode) {
        if (iframeObserver) iframeObserver.disconnect();
        document.querySelectorAll('iframe').forEach((frame) => {
            if (frame.contentDocument && frame.contentDocument.documentElement && frame.contentDocument.documentElement.querySelector('#darkcss')) {
                frame.contentDocument.documentElement.querySelector('#darkcss').textContent = '';
                frame.contentDocument.body.classList.remove("canvasrefined--darkmode--enabled");
            }
        });
        return;
    }

    const callback = (mutationList) => {
        for (const mutation of mutationList) {
            if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;
            for (const node of mutation.addedNodes) {
                if (node.nodeName !== 'IFRAME') continue;
                // Cross-origin iframes expose no contentDocument; access it safely so we
                // don't throw a TypeError into the console on every added iframe.
                let doc;
                try { doc = node.contentDocument; } catch (_) { continue; }
                if (!doc || !doc.documentElement || !doc.body) continue;
                try {
                    const new_style_element = document.createElement("style");
                    new_style_element.textContent = generateDarkModeCSS();
                    new_style_element.id = "darkcss";
                    doc.body.classList.add("canvasrefined--darkmode--enabled");
                    doc.documentElement.prepend(new_style_element);
                } catch (_) { /* cross-origin or detached frame: ignore */ }
            }
        }
    };

    iframeObserver = new MutationObserver(callback);
    iframeObserver.observe(document.documentElement, { childList: true, subtree: true });
}