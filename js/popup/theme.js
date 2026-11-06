function setupCustomStyle(initial) {
    const el = document.getElementById("custom-styles");
    el.value = initial;
    el.addEventListener("change", (e) => {
        chrome.storage.sync.set({ "custom_styles": e.target.value });
    });
}


function displayThemeSubmissionForm() {
    document.getElementById("submit-form").style.display = "block";
    document.getElementById("view-submissions").style.display = "none";
    document.getElementById("submit-form-btn").classList.add("active");
    document.getElementById("view-submissions-btn").classList.remove("active");
}


async function getExport(storage, options) {
    let final = {};
    for (const option of options) {
        switch (option) {
            case "custom_cards":
                let arr = [];
                Object.keys(storage["custom_cards"]).forEach(key => {
                    const img = storage["custom_cards"][key].img;
                    if (img && img !== "none" && img.trim() !== "") arr.push(img);
                });
                final["custom_cards"] = arr;
                break;
            case "card_colors":
                final["card_colors"] = [];
                try {
                    final["card_colors"] = await sendFromPopup("getcolors");
                } catch (e) {
                    console.log(e);
                }
                break;
			case "custom_styles":
				final["custom_styles"] = storage["custom_styles"];
				break;
            default:
                final[option] = storage[option];
        }
    }
    return final;
}

let pageTimeout = false;

function changePage(direction) {
    if (pageTimeout) return;
    pageTimeout = true;
    displayThemeList(direction);
    setTimeout(() => {
        pageTimeout = false;
    }, 500);
}

const colorValues = {
    "red": 1,
    "pink": 2,
    "orange": 3,
    "yellow": 4,
    "lightgreen": 5,
    "green": 6,
    "lightblue": 7,
    "blue": 8,
    "lightpurple": 9,
    "purple": 10,
    "lightpurple": 11,
    "beige": 12,
    "brown": 13,
    "gray": 14,
}

function themeSortFn(method) {
    let themes = getTheme("all");
    switch (method) {
        case "New":
            return themes.reverse();
        case "Old":
            return themes;
        case "Color":
            return themes.sort((a, b) => {
                return (colorValues[a.color] || (a.color !== "whiteblack" && a.color.includes("white") ? 15 : 16)) - (colorValues[b.color] || (b.color !== "whiteblack" && b.color.includes("white") ? 15 : 16))
            })
            return themes.sort((a, b) => {
                return a.color < b.color ? 1 : -1;
            })
        case "ABC":
            return themes.sort((a, b) => {
                return a.title.toLowerCase() > b.title.toLowerCase() ? 1 : -1;
            })
        default:
            return shuffle(themes).sort((a, b) => {
                a = a.score + "";
                b = b.score + "";
                a = parseInt(a.charAt(0)) + parseInt(a.charAt(1)) + parseInt(a.charAt(2)) + parseInt(a.charAt(3));
                b = parseInt(b.charAt(0)) + parseInt(b.charAt(1)) + parseInt(b.charAt(2)) + parseInt(b.charAt(3));
                return b - a;
            });
    }
}

let cache = {};

// new theme sort button
function themeSort(sort) {
    current_sort = sort;
    current_page_num = 1;
    allThemes = themeSortFn(current_sort);
    displayThemeList(0);
}

// TODO_tuna - Feels like this could be a more general function... Maybe there's no need?
function clickout() {
    setTimeout(() => {
        document.getElementById("theme-sort-selector").classList.remove("open");
        document.removeEventListener("click", clickout);
    }, 10);
}

// shuffle function for the score sorting so there's no order bias
function shuffle (arr) {
    var j, x, index;
    for (index = arr.length - 1; index > 0; index--) {
        j = Math.floor(Math.random() * (index + 1));
        x = arr[index];
        arr[index] = arr[j];
        arr[j] = x;
    }
    return arr;
}

let current_page_num = 1;
let maxPage = 0;
let searchFor = "";
let current_sort = "Popular";
let allThemes = themeSortFn(current_sort);

let fallback = false;


function saveCurrentTheme() {
    const allOptions = syncedSwitches.concat(syncedSubOptions).concat(["dark_preset", "custom_cards", "custom_font", "gpa_calc_bounds", "card_colors", "custom_styles"]);
    chrome.storage.local.get("saved_themes", local => {
        chrome.storage.sync.get(allOptions, async sync => {
            let current = await getExport(sync, allOptions);
            let trimmed = { 
                "disable_color_overlay": current["disable_color_overlay"], 
                "gradient_cards": current["gradient_cards"],
                "dark_mode": current["dark_mode"],
                "dark_preset": current["dark_preset"],
                "custom_cards": current["custom_cards"],
                "card_colors": current["card_colors"] === null ? [current["dark_preset"]["links"]] : current["card_colors"],
                "custom_font": current["custom_font"],
                "better_todo": current["better_todo"],
                "todo_hide_feedback": current["todo_hide_feedback"],
                "todo_hide_read": current["todo_hide_read"] !== false,
                "todo_full_height": current["todo_full_height"],
                "todo_confetti": current["todo_confetti"],
                "todo_progress_rings": current["todo_progress_rings"],
                "todo_timeframe": current["todo_timeframe"],
                "todo_hr24": current["todo_hr24"],
                "todo_separate_scrollbar": current["todo_separate_scrollbar"],
                "todo_alternate_colors": current["todo_alternate_colors"],
                "todo_ignore_card_colors": current["todo_ignore_card_colors"],
                "todo_remove_icons": current["todo_remove_icons"],
                "better_sidebar": current["better_sidebar"],
                "sidebar_scale": current["sidebar_scale"],
				"imageSize": current["imageSize"],
				"cardRoundness": current["cardRoundness"],
				"imageRoundness": current["imageRoundness"],
				"cardSpacing": current["cardSpacing"],
				"cardWidth": current["cardWidth"],
				"cardHeight": current["cardHeight"],
				"custom_styles": current["custom_styles"],
				"customCardStyles": current["customCardStyles"],
				"customBackgroundLink": current["customBackgroundLink"],
				"customBackgroundScale": current["customBackgroundScale"],
				"customBackgroundDaily": current["customBackgroundDaily"],
				"customBackgroundNasaDaily": current["customBackgroundNasaDaily"],
				"fitImageToScreen": current["fitImageToScreen"],
				"bg_opacity": current["bg_opacity"],
				"sidebar_opacity": current["sidebar_opacity"],
				"bg_blur": current["bg_blur"],
				"sidebar_blur": current["sidebar_blur"],
            }
            const now = new Date();
            local["saved_themes"][now.getTime()] = trimmed;
            chrome.storage.local.set({ "saved_themes": local["saved_themes"] }).then(() => {
                displaySavedThemes();
            });
        });        
    });
}


function displayThemeList(direction = 0) {
    // Render the sorted theme list, filtered by any active search.
    let themesToShow = allThemes;
    if (searchFor) {
        themesToShow = allThemes.filter(theme => theme.title.toLowerCase().includes(searchFor.toLowerCase()));
    }
    displayThemeSearchList(themesToShow, direction);
}


function displayThemeSearchList(themesToShow, pageDir = 0) {
    document.getElementById("theme-current-sort").textContent = current_sort;
    const perPage = 24;
    const maxPage = Math.ceil(themesToShow.length / perPage);
    if (pageDir == -1 && current_page_num > 1) current_page_num--;
    if (pageDir == 1 && current_page_num < maxPage) current_page_num++;
    let container = document.getElementById("premade-themes");
    container.textContent = "";
    let start = (current_page_num - 1) * perPage, end = start + perPage;
    themesToShow.forEach((theme, index) => {
            if (index < start || index >= end) return;
            let themeBtn = makeElement("button", container, { "className": "theme-button" });
            themeBtn.classList.add("customization-button");
            if (!themeBtn.style.background) themeBtn.style.backgroundImage = "linear-gradient(#00000070, #00000070), url(" + theme.preview + ")";
            let split = theme.title.split(" by ");
            makeElement("p", themeBtn, {"className": "theme-button-title", "textContent":  split[0] });
            makeElement("p", themeBtn, {"className": "theme-button-creator", "textContent": split[1] });
            themeBtn.addEventListener("click", () => {
                const allOptions = syncedSwitches.concat(syncedSubOptions).concat(["dark_preset", "custom_cards", "custom_font", "gpa_calc_bounds", "card_colors", "custom_styles"]);
                chrome.storage.sync.get(allOptions, sync => {
                    chrome.storage.local.get(["previous_theme"], async local => {
                        if (local["previous_theme"] === null) {
                            let previous = await getExport(sync, allOptions);
                            chrome.storage.local.set({ "previous_theme": previous });
                        }
                        importTheme(theme.exports);
                    });
                });
            });
        }
    )
}

function getRelativeDate(date, short = false) {
    let now = new Date();
    let timeSince = (now.getTime() - date.getTime()) / 60000;
    let time = "min";
    timeSince = Math.abs(timeSince);
    if (timeSince >= 60) {
        timeSince /= 60;
        time = short ? "h" : "hour";
        if (timeSince >= 24) {
            timeSince /= 24;
            time = short ? "d" : "day";
            if (timeSince >= 7) {
                timeSince /= 7;
                time = short ? "w" : "week";
            }
        }
    }
    timeSince = Math.round(timeSince);
    let relative = timeSince + (short ? "" : " ") + time + (timeSince > 1 && !short ? "s" : "");
    return { time: relative, ms: now.getTime() - date.getTime() };
}

function displaySavedThemes() {
    chrome.storage.local.get("saved_themes", local => {
        const target = document.getElementById("saved-themes");
        target.textContent = "";
        Object.keys(local["saved_themes"]).forEach((key, index) => {
            const created = new Date(parseInt(key));
            let btn = makeElement("div", target, { "className": "saved-theme" });
            let title = makeElement("p", btn, { "className": "theme-button-title", "textContent": `Theme ${index + 1}`});
            let date = makeElement("p", btn, { "className": "theme-button-creator", "textContent": `${getRelativeDate(created).time} ago` });
            let remove = makeElement("div", btn, { "className": "theme-button-remove", "textContent": "x" });
            btn.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.44), rgba(0, 0, 0, 0.44)), url(${local["saved_themes"][key]["custom_cards"]?.[0] || ""})`;
            btn.addEventListener("click", () => {
                importTheme(local["saved_themes"][key]);
            });
            remove.addEventListener("click", () => {
                chrome.storage.local.get("saved_themes", local => {
                    delete local["saved_themes"][key];
                    chrome.storage.local.set({ "saved_themes": local["saved_themes"] }).then(() => {
                        btn.remove();
                    })
                })
            });
        });
    });
}

function getTheme(name) {

    // get localThemes from themes.js
    console.log(themes);

    if (name === "all") return themes;
    for (const theme in themes) if (theme.title === name) return theme
    return {};
}

function importTheme(theme) {
    try {
        let keys = Object.keys(theme);
        let final = {};
        chrome.storage.sync.get("custom_cards", sync => {
            keys.forEach(key => {
                switch (key) {
                    case "dark_preset":
                        changeToPresetCSS(null, theme["dark_preset"]);
                        break;
                    case "card_colors":
                        sendFromPopup("setcolors", theme["card_colors"]);
                        break;
                    case "custom_cards": {
                        // "none" is a legacy placeholder meaning "this theme has
                        // no custom card images" — treat it as such instead of
                        // writing the literal string into every card (which hides
                        // the card image on the dashboard). Fall back to "" so
                        // cards keep their default Canvas images.
                        const themeImgs = (theme["custom_cards"] || []).filter(u => u && u !== "none" && u.trim() !== "");
                        if (theme["custom_cards"].length > 0) {
                            let pos = 0;
                            Object.keys(sync["custom_cards"]).forEach(key => {
                                sync["custom_cards"][key].img = themeImgs.length ? themeImgs[pos] : "";
                                pos = (pos === themeImgs.length - 1) ? 0 : pos + 1;
                            });
                            final["custom_cards"] = sync["custom_cards"];
                        }
                        break;
                    }
                    default:
                        final[key] = theme[key];
                        break;
                }
            });
            chrome.storage.sync.set(final);
        });
    } catch (e) {
        console.log(e);
    }
}

function toggleDarkModeDisable(disabled) {
    let darkSwitch = document.querySelector('#dark_mode');
    if (disabled === true) {
        darkSwitch.classList.add('switch_disabled');
        darkSwitch.style.pointerEvents = "none";
    } else {
        darkSwitch.classList.remove('switch_disabled');
        darkSwitch.style.pointerEvents = "auto";
    }
}



// customization tab

function getPalette(name) {
    const colors = {
        "Blues": ["#ade8f4", "#90e0ef", "#48cae4", "#00b4d8", "#0096c7"],
        "Reds": ["#e01e37", "#c71f37", "#b21e35", "#a11d33", "#6e1423"],
        "Rainbow": ["#ff0000", "#ff5200", "#efea5a", "#3cf525", "#147df5", "#be0aff"],
        "Candy": ["#cdb4db", "#ffc8dd", "#ffafcc", "#bde0fe", "#a2d2ff"],
        "Purples": ["#e0aaff", "#c77dff", "#9d4edd", "#7b2cbf", "#5a189a"],
        "Pastels": ["#fff1e6", "#fde2e4", "#fad2e1", "#bee1e6", "#cddafd"],
        "Ocean": ["#22577a", "#38a3a5", "#57cc99", "#80ed99", "#c7f9cc"],
        "Sunset": ["#eaac8b", "#e56b6f", "#b56576", "#6d597a", "#355070"],
        "Army": ["#6b705c", "#a5a58d", "#b7b7a4", "#ffe8d6", "#ddbea9", "#cb997e"],
        "Pinks": ["#ff0a54", "#ff5c8a", "#ff85a1", "#ff99ac", "#fbb1bd"],
        "Watermelon": ["#386641", "#6a994e", "#a7c957", "#f2e8cf", "#bc4749"],
        "Popsicle": ["#70d6ff", "#ff70a6", "#ff9770", "#ffd670", "#e9ff70"],
        "Chess": ["#ffffff", "#000000"],
        "Greens": ["#d8f3dc", "#b7e4c7", "#95d5b2", "#74c69d", "#52b788"],
        "Fade": ["#ff69eb", "#ff86c8", "#ffa3a5", "#ffbf81", "#ffdc5e"],
        "Oranges": ["#ffc971", "#ffb627", "#ff9505", "#e2711d", "#cc5803"],
        "Mesa": ["#f6bd60", "#f28482", "#f5cac3", "#84a59d", "#f7ede2"],
        "Berries": ["#4cc9f0", "#4361ee", "#713aed", "#9348c3", "#f72585"],
        "Fade2": ["#f2f230", "#C2F261", "#91f291", "#61F2C2", "#30f2f2"],
        "Muted": ["#E7E6F7", "#E3D0D8", "#AEA3B0", "#827081", "#C6D2ED"],
        "Base": ["#e3b505", "#95190C", "#610345", "#107E7D", "#044B7F"],
        "Fruit": ["#7DDF64", "#C0DF85", "#DEB986", "#DB6C79", "#ED4D6E"],
        "Night": ["#25171A", "#4B244A", "#533A7B", "#6969B3", "#7F86C6"]
    }
    return colors[name] || [];
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}

function getColorInGradient(d, from, to) {
    let pat = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
    var exec1 = pat.exec(from);
    var exec2 = pat.exec(to);
    let a1 = [parseInt(exec1[1], 16), parseInt(exec1[2], 16), parseInt(exec1[3], 16)];
    let a2 = [parseInt(exec2[1], 16), parseInt(exec2[2], 16), parseInt(exec2[3], 16)];
    let rgb = a1.map((x, i) => Math.floor(a1[i] + d * (a2[i] - a1[i])));
    return "#" + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]);
}

function displaySidebarMode(mode, style) {
    style = style.replace(" ", "");
    let match = style.match(/linear-gradient\((?<color1>\#\w*),(?<color2>\#\w*)\)/);
    let c1 = c2 = "#000000";

    if (mode === "image") {
        document.querySelector("#radio-sidebar-image").checked = true;
        document.querySelector("#sidebar-color2").style.display = "flex";
        document.querySelector("#sidebar-image").style.display = "flex";
        if (style.includes("url") && match) {
            if (match.groups.color1) c1 = match.groups.color1.replace("c7", "");
            if (match.groups.color2) c2 = match.groups.color2.replace("c7", "");
        }
        let url = style.match(/url\(\"(?<url>.*)\"\)/);
        document.querySelector('#sidebar-image input[type="text"]').value = url && url.groups.url ? url.groups.url : "";
    } else if (mode === "gradient") {
        document.querySelector("#radio-sidebar-gradient").checked = true;
        document.querySelector("#sidebar-color2").style.display = "flex";
        document.querySelector("#sidebar-image").style.display = "none";
        if (!style.includes("url") && match) {
            if (match.groups.color1) c1 = match.groups.color1;
            if (match.groups.color2) c2 = match.groups.color2;
        }
    } else {
        document.querySelector("#radio-sidebar-solid").checked = true;
        document.querySelector("#sidebar-color2").style.display = "none";
        document.querySelector("#sidebar-image").style.display = "none";
        c1 = match ? "#000000" : style;
    }

    document.querySelector('#sidebar-color1 input[type="text"]').value = c1;
    document.querySelector('#sidebar-color1 input[type="color"]').value = c1;
    document.querySelector('#sidebar-color2 input[type="text"]').value = c2;
    document.querySelector('#sidebar-color2 input[type="color"]').value = c2;
}

let presetChangeTimeout = null;

chrome.storage.sync.get(["dark_preset"], storage => {
    let tab = document.querySelector(".customize-dark");
    Object.keys(storage["dark_preset"]).forEach(key => {
        if (key !== "sidebar") {
            let c = tab.querySelector("#dp_" + key);
            let color = c.querySelector('input[type="color"]');
            let text = c.querySelector('input[type="text"]');
            [color, text].forEach(changer => {
                changer.value = storage["dark_preset"][key];
                changer.addEventListener("input", function (e) {
                    clearTimeout(presetChangeTimeout);
                    presetChangeTimeout = setTimeout(() => changeCSS(key, e.target.value), 200);
                });
            });
        } else {
            let mode = storage["dark_preset"][key].includes("url") ? "image" : storage["dark_preset"][key].includes("gradient") ? "gradient" : "solid";
            displaySidebarMode(mode, storage["dark_preset"][key]);
            let changeSidebar = () => {
                let c1 = tab.querySelector('#sidebar-color1 input[type="text"]').value.replace("c7", "");
                let c2 = tab.querySelector('#sidebar-color2 input[type="text"]').value.replace("c7", "");
                let url = tab.querySelector('#sidebar-image input[type="text"]').value;
                if (tab.querySelector("#radio-sidebar-image").checked) {
                    changeCSS(key, `linear-gradient(${c1}c7, ${c2}c7), center url("${url}")`);
                } else if (tab.querySelector("#radio-sidebar-gradient").checked) {
                    changeCSS(key, `linear-gradient(${c1}, ${c2})`);
                } else {
                    changeCSS(key, c1);
                }
            }
            ["#sidebar-color1", "#sidebar-color2"].forEach(group => {
                ['input[type="text"]', 'input[type="color"]'].forEach(input => {
                    document.querySelector(group + " " + input).addEventListener("input", e => {
                        ['input[type="text"]', 'input[type="color"]'].forEach(i => {
                            document.querySelector(group + " " + i).value = e.target.value;
                        });
                        clearTimeout(presetChangeTimeout);
                        presetChangeTimeout = setTimeout(() => changeSidebar(), 200);
                    });
                });
            });
            document.querySelector('#sidebar-image input[type="text"').addEventListener("change", () => changeSidebar());
        }
    });
});

function refreshColors() {
    chrome.storage.sync.get(["dark_preset"], storage => {
        Object.keys(storage["dark_preset"]).forEach(key => {
            let c = document.querySelector("#dp_" + key);
            let color = c.querySelector('input[type="color"]');
            let text = c.querySelector('input[type="text"]');
            color.value = storage["dark_preset"][key];
            text.value = storage["dark_preset"][key];
        });
        let mode = storage["dark_preset"]["sidebar"].includes("url") ? "image" : storage["dark_preset"]["sidebar"].includes("gradient") ? "gradient" : "solid";
        displaySidebarMode(mode, storage["dark_preset"]["sidebar"]);
    });
}

function changeCSS(name, color) {
    chrome.storage.sync.get("dark_preset", storage => {
        storage["dark_preset"][name] = color;
        chrome.storage.sync.set({ "dark_preset": storage["dark_preset"] }).then(() => refreshColors());
    });
}

function changeToPresetCSS(e, preset = null) {
    const presets = {
        "dark-lighter": { "background-0": "#272727", "background-1": "#353535", "background-2": "#404040", "borders": "#454545", "sidebar": "#353535", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#56Caf0", "sidebar-text": "#f5f5f5" },
        "dark-light": { "background-0": "#202020", "background-1": "#2e2e2e", "background-2": "#4e4e4e", "borders": "#404040", "sidebar": "#2e2e2e", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#56Caf0", "sidebar-text": "#f5f5f5" },
        "dark-default": { "background-0": "#161616", "background-1": "#1e1e1e", "background-2": "#262626", "borders": "#3c3c3c", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#56Caf0", "sidebar": "#1e1e1e", "sidebar-text": "#f5f5f5" },
        "dark-dark": { "background-0": "#101010", "background-1": "#121212", "background-2": "#1a1a1a", "borders": "#272727", "sidebar": "#121212", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#56Caf0", "sidebar-text": "#f5f5f5" },
        "dark-darker": { "background-0": "#000000", "background-1": "#000000", "background-2": "#000000", "borders": "#000000", "sidebar": "#000000", "text-0": "#c5c5c5", "text-1": "#c5c5c5", "text-2": "#c5c5c5", "links": "#c5c5c5", "sidebar-text": "#c5c5c5" },
        "dark-blue": { "background-0": "#14181d", "background-1": "#1a2026", "background-2": "#212930", "borders": "#2e3943", "sidebar": "#1a2026", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#56Caf0", "sidebar-text": "#f5f5f5" },
        "dark-mint": { "background-0": "#0f0f0f", "background-1": "#0c0c0c", "background-2": "#141414", "borders": "#1e1e1e", "sidebar": "#0c0c0c", "text-0": "#f5f5f5", "text-1": "#e2e2e2", "text-2": "#ababab", "links": "#7CF3CB", "sidebar-text": "#f5f5f5" },
        "dark-burn": { "background-0": "#ffffff", "background-1": "#ffffff", "background-2": "#ffffff", "borders": "#cccccc", "sidebar": "#ffffff", "text-0": "#cccccc", "text-1": "#cccccc", "text-2": "#cccccc", "links": "#cccccc", "sidebar-text": "#cccccc" },
        "dark-unicorn": { "background-0": "#ff6090", "background-1": "#00C1FF", "background-2": "#FFFF00", "borders": "#FFFF00", "sidebar": "#00C1FF", "text-0": "#ffffff", "text-1": "#ffffff", "text-2": "#ffffff", "links": "#000000", "sidebar-text": "#ffffff" },
        "dark-lightmode": { "background-0": "#ffffff", "background-1": "#f5f5f5", "background-2": "#d4d4d4", "borders": "#c7cdd1", "links": "#04ff00", "sidebar": "#04ff00", "sidebar-text": "#ffffff", "text-0": "#2d3b45", "text-1": "#919191", "text-2": "#a5a5a5" },
        "dark-catppuccin": { "background-0": "#11111b", "background-1": "#181825", "background-2": "#1e1e2e", "borders": "#4f5463", "text-0": "#cdd6f4", "text-1": "#7f849c", "text-2": "#a6e3a1", "links": "#f5c2e7", "sidebar": "#181825", "sidebar-text": "#7f849c" },
        "dark-sage": { "background-0": "#2f3e46", "background-1": "#354f52", "background-2": "#52796f", "borders": "#84a98c", "links": "#d8f5c7", "sidebar": "#354f52", "sidebar-text": "#e2e8de", "text-0": "#e2e8de", "text-1": "#cad2c5", "text-2": "#adb1aa" },
        "dark-pink": { "background-0": "#ffffff", "background-1": "#ffe0ed", "background-2": "#ff0066", "borders": "#ff007b", "links": "#ff0088", "sidebar": "#f490b3", "sidebar-text": "#ffffff", "text-0": "#ff0095", "text-1": "#ff8f8f", "text-2": "#ff5c5c" },
        "dark-coral": {"background-0":"#131c26","background-1":"#0e1721","background-2":"#151c24","borders":"#0e1721","links":"#f88379","sidebar":"#131c26","sidebar-text":"#f88379","text-0":"#f88379","text-1":"#f88379","text-2":"#f88379"},
    }
    if (preset === null) preset = presets[e.target.id] || presets["default"];
    applyPreset(preset);
}

function applyPreset(preset) {
    chrome.storage.sync.set({ "dark_preset": preset }).then(() => refreshColors());
}