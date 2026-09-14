function getApiData() {
    if (current_page === "/" || current_page === "" || options.better_todo || options.better_sidebar) {
        getAssignments();
        getGrades();
        getColors();
    }
}


function makeElement(element, location, options, prepend = false) {
    let creation = document.createElement(element);
    Object.keys(options).forEach(key => {
        creation[key] = options[key];
    });
    if (prepend) {
        location.insertBefore(creation, location.firstChild);
    } else {
        location.appendChild(creation);
    }
    return creation
}


async function getData(url) {
    let response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });
    let data = await response.json();
    // Deep-clone via JSON to unwrap Firefox Xray objects so nested props are mutable.
    try {
        return JSON.parse(JSON.stringify(data));
    } catch (_) {
        return data;
    }
}

//TODO_tuna - Surely there is a mathier way to do rgb to hex and vice versa?

function rgbToHex(rgb) {
    try {
        let pat = /^rgb\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;
        let exec = pat.exec(rgb);
        return "#" + parseInt(exec[1]).toString(16).padStart(2, "0") + parseInt(exec[2]).toString(16).padStart(2, "0") + parseInt(exec[3]).toString(16).padStart(2, "0");
    } catch (e) {
        console.warn(e);
    }
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max == min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0); break;
            case g:
                h = (b - r) / d + 2; break;
            case b:
                h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return [h * 360, s * 100, l * 100];
}

function hexToRgb(hex) {
    let match = (/#(.{2})(.{2})(.{2})/).exec(hex);
    if (match) {
        return { "r": parseInt(match[1], 16), "g": parseInt(match[2], 16), "b": parseInt(match[3], 16) };
    }
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

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatTodoDate(date, submissions, hr24) {
    let { time, ms } = getRelativeDate(date);
    let fromNow = ms < 0 ? "in " + time : time + " ago";
    let dueSoon = false;
    if (submissions && submissions.submitted === false && ms >= -21600000) {
        dueSoon = true;
    }
    return { "dueSoon": dueSoon, "date": months[date.getMonth()] + " " + date.getDate() + " at " + (date.getHours() - (hr24 ? "" : date.getHours() > 12 ? 12 : 0)) + ":" + (date.getMinutes() < 10 ? "0" : "") + date.getMinutes() + (hr24 ? "" : date.getHours() >= 12 ? "pm" : "am") + " (" + fromNow + ")" };
}

// TODO_tuna - Probably move this function?
function formatCardDue(date) {
    let due = new Date(date);
    if (options.relative_dues === true) {
        let relative = getRelativeDate(due, true);
        return relative.ms > 0 ? relative.time + " ago" : "in " + relative.time;
    }
    return options.assignment_date_format ? (due.getDate()) + "/" + (due.getMonth() + 1) : (due.getMonth() + 1) + "/" + (due.getDate());
}

function logError(e) {
    chrome.storage.local.get("errors", storage => {
        // TODO_tuna - Wtf???
        if (storage.errors.length > 20) {
            storage["errors"] = [];
        }
        chrome.storage.local.set({ "errors": storage["errors"].concat(e.stack) });

        console.log(e.stack);
        console.log(storage["errors"].concat(e.stack));
    })
}

// TODO_tuna - Why const?
const CSRFtoken = function () {
    return decodeURIComponent((document.cookie.match('(^|;) *_csrf_token=([^;]*)') || '')[2])
}