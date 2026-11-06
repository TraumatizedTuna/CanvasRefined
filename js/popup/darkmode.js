function displayDarkModeFixUrls() {
    let output = document.getElementById("dark-mode-fix-urls");
    output.textContent = "";
    chrome.storage.sync.get("dark_mode_fix", sync => {
        sync["dark_mode_fix"].forEach(url => {
            //let div = makeElement("div", "customization-button", output, url);
            let div = makeElement("div", output, { "className": "customization-button", "textContent": url });
            div.classList.add("fixed-url");
            let btn = makeElement("button", div, { "className": "dd", "textContent": "x" });
            btn.addEventListener("click", () => {
                chrome.storage.sync.get("dark_mode_fix", sync => {
                    for (let i = 0; i < sync["dark_mode_fix"].length; i++) {
                        if (sync["dark_mode_fix"][i] === url) {
                            sync["dark_mode_fix"].splice(i);
                            chrome.storage.sync.set({ "dark_mode_fix": sync["dark_mode_fix"] }).then(() => div.remove());
                        }
                    }
                });
            })
        })
    })
}


function setupAutoDarkInput(initial, time) {
    let el = document.querySelector('#' + time);
    el.value = initial.hour + ":" + initial.minute;
    el.addEventListener('change', function () {
        let timeinput = { "hour": this.value.split(':')[0], "minute": this.value.split(':')[1] };
        time === "auto_dark_start" ? chrome.storage.sync.set({ auto_dark_start: timeinput }) : chrome.storage.sync.set({ auto_dark_end: timeinput });
    });
}

// The opacity sliders live under "Edit dark mode" but only make sense (and
// only show) when a custom background is active, since transparency without a
// background image behind these surfaces would just expose the dark body.
function customBackgroundActive() {
    const link = document.querySelector("#customBackgroundLink");
    const daily = document.querySelector("#customBackgroundDaily");
    const nasa = document.querySelector("#customBackgroundNasaDaily");
    return (link && link.value.trim() !== "") || (daily && daily.checked) || (nasa && nasa.checked);
}