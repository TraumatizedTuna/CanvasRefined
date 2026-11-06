/**
 * General UI stuff
 */

// TODO_tuna - compare to makeElement() in utils.js... We probably don't need this one.
function makeElement(element, location, options) {
    let creation = document.createElement(element);
    Object.keys(options).forEach(key => {
        creation[key] = options[key];
    });
    location.appendChild(creation);
    return creation
}

// Generic range slider (0..max). `key` is the storage id, `valueId` is the
// <span> that shows the live value, `resetId` is the small reset button that
// restores `defaultValue`. `unit` is appended to the displayed value ("%" or "px").
function setupRangeSlider(key, sliderId, valueId, resetId, defaultValue, max, unit, initial) {
    const el = document.querySelector("#" + sliderId);
    const out = document.querySelector("#" + valueId);
    if (!el || !out) return;
    const value = Math.max(0, Math.min(max, parseInt(initial)));
    if (isNaN(value)) return;
    el.value = value;
    out.textContent = `${value}${unit}`;
    el.addEventListener("input", function () {
        out.textContent = `${this.value}${unit}`;
        chrome.storage.sync.set({ [key]: parseInt(this.value) });
    });
    const reset = document.querySelector("#" + resetId);
    if (reset) {
        reset.addEventListener("click", () => {
            const v = Math.max(0, Math.min(max, parseInt(defaultValue)));
            el.value = v;
            out.textContent = `${v}${unit}`;
            chrome.storage.sync.set({ [key]: v });
        });
    }
}

// Hide a toggle's sub-options when it's off; auto_dark only hides its time clocks.
function toggleSubOptionsVisibility(option, isOn) {
    const togglesWithSubOptions = ["gpa_calc", "assignments_due", "better_todo", "auto_dark", "grade_analytics"];
    if (!togglesWithSubOptions.includes(option)) return;
    const optionEl = document.getElementById(option);
    if (!optionEl) return;
    const subOptions = optionEl.parentElement.querySelector(":scope > .sub-options");
    if (!subOptions) return;
    if (option === "auto_dark") {
        const timesets = subOptions.querySelector(".timesets");
        if (timesets) timesets.style.display = isOn ? "" : "none";
    } else {
        subOptions.style.display = isOn ? "" : "none";
    }
}