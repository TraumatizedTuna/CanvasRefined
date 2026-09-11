async function getCardColors() {
    // Same display order changeColorPreset uses to APPLY palettes, so an
    // exported theme's color list maps back onto the same courses when
    // applied. Works in list mode too (API fallback inside getPaletteCards).
    const { cards, apiColors } = await getPaletteCards();
    if (cards.length === 0) return [];
    return cards.map(card => card.el
        ? rgbToHex(card.el.querySelector(".ic-DashboardCard__header_hero").style.backgroundColor)
        : (apiColors["course_" + card.href.split("courses/")[1]] || "#ffffff"));
}

function getCardsFromDashboard() {
    console.log("getting cards from dashboard")
    const dashboard_cards = document.querySelectorAll(".ic-DashboardCard");
    return new Promise(resolve => {
    chrome.storage.sync.get(["custom_cards", "custom_cards_2", "custom_cards_3"], storage => {
        let cards = storage["custom_cards"] || {};
        let cards_2 = storage["custom_cards_2"] || {};
        let cards_3 = storage["custom_cards_3"] || {};
        let newCards = false;
        let count = 0;
        try {
            dashboard_cards.forEach(card => {
                const id = card.querySelector(".ic-DashboardCard__link").href.split("courses/")[1];
                if (count >= (options["card_limit"] || 25)) return;

                if (!cards[id]) {
                    newCards = true;
                    cards[id] = { "default": card.querySelector(".ic-DashboardCard__header-subtitle").textContent.substring(0, 20), "fullName": card.querySelector(".ic-DashboardCard__header-title")?.textContent?.trim() || "", "name": "", "code": "", "img": "", "hidden": false, "weight": "regular", "credits": 1, "eid": 100000 - count, "gr": null };
    
                    let links = [];
                    for (let i = 0; i < 4; i++) {
                        links.push({ "path": "default", "is_default": true });
                    }
                    cards_2[id] = { "links": links };
        
                    cards_3[id] = { "url": domain };
                } else {
                    // backfill full name for cards created before this field existed
                    const full = card.querySelector(".ic-DashboardCard__header-title")?.textContent?.trim() || "";
                    if (full && cards[id].fullName !== full) {
                        cards[id].fullName = full;
                        newCards = true;
                    }
                }
                count++;
            });

            // there shouldn't be 0 cards
            if (count === 0) return;

            //delete cards that aren't on the dashboard anymore
            Object.keys(cards).forEach(key => {
                let found = false;
                // ignore cards that are not for the current url
                if (cards_3[key] && cards_3[key].url !== domain) {
                    found = true;
                } else {
                    dashboard_cards.forEach(card => {
                        const id = card.querySelector(".ic-DashboardCard__link").href.split("courses/")[1];
                        if (parseInt(key) === parseInt(id)) found = true;
                    });
                }

                if (found === false) {
                    console.log("Deleting " + key);
                    cards[key] && delete cards[key];
                    cards_2[key] && delete cards_2[key];
                    cards_3[key] && delete cards_3[key];
                    newCards = true;
                }

            });

        } catch (e) {
            console.log("Error getting dashboard cards\n", e);
            logError(e);
        } finally {
            if(newCards !== true) { resolve(); return; }
            console.log(newCards ? "new cards found" : "");
            chrome.storage.sync.set({ "custom_cards": cards, "custom_cards_2": cards_2, "custom_cards_3": cards_3 }, () => resolve());
        }
    });
    });
}

async function getCards(api = null) {
    let dashboard_cards = api ? api : await getData(`${domain}/api/v1/courses?${/*enrollment_state=active&*/""}per_page=100`);
    await new Promise(resolve => {
    chrome.storage.sync.get(["custom_cards", "custom_cards_2", "custom_cards_3"], storage => {
        let cards = storage["custom_cards"] || {};
        let cards_2 = storage["custom_cards_2"] || {};
        let cards_3 = storage["custom_cards_3"] || {};
        let newCards = false;
        let count = 0;
        // sort cards by enrollment id (i think the higher the id, the more recent it is)
        if (options["card_method_date"] === true) {
            dashboard_cards.sort((a, b) => (b?.created_at) > (a?.created_at) ? 1 : -1);
        } else {
            dashboard_cards.sort((a, b) => (b?.enrollment_term_id || 0) - (a?.enrollment_term_id || 0));
        }
        try {
            dashboard_cards.forEach(card => {
                if (!card.course_code || count >= (options["card_limit"] || 25)) return;
                let id = card.id;
                if (!cards || !cards[id]) {
                    newCards = true;
                    cards[id] = { "default": card.course_code.substring(0, 20), "fullName": card.name || card.course_code || "", "name": "", "code": "", "img": "", "hidden": false, "weight": "regular", "credits": 1, "eid": card.enrollment_term_id || 0, "gr": null };
                } else if (cards && cards[id]) {
                    newCards = true;
                    cards[id].default = card.course_code.substring(0, 20);
                    cards[id].fullName = card.name || card.course_code || cards[id].fullName || "";
                    cards[id].eid = card.enrollment_term_id || 0;
                    if (!cards[id].code) cards[id].code = "";
                }
                if (!cards_2 || !cards_2[id]) {
                    newCards = true;
                    let links = [];

                    for (let i = 0; i < 4; i++) {
                        links.push({ "path": "default", "is_default": true });
                    }

                    cards_2[id] = { "links": links };
                }

                if (!cards_3 || !cards_3[id]) {
                    newCards = true;
                    cards_3[id] = { "url": domain };
                }
                count++;

            });

            //delete cards that aren't on the dashboard anymore
            Object.keys(cards).forEach(key => {
                let found = false;
                // ignore cards that are not for the current url
                if (cards_3[key] && cards_3[key].url !== domain) {
                    found = true;
                } else {
                    dashboard_cards.forEach(card => {
                        if (parseInt(key) === card.id) found = true;
                    });
                }

                if (found === false) {
                    console.log("Deleting " + key + " from custom_cards...", cards[key]);
                    cards[key] && delete cards[key];
                    cards_2[key] && delete cards_2[key];
                    cards_3[key] && delete cards_3[key];
                    newCards = true;
                }

            });

        } catch (e) {
            console.log(e);
        } finally {
            chrome.storage.sync.set(newCards ? { "custom_cards": cards, "custom_cards_2": cards_2, "custom_cards_3": cards_3 } : {}, () => resolve());
        }
    });
    });
}


let changeColorInterval = null;
let colorChanges = [];

// Course list for palette operations, in DISPLAY order (first shown to
// last) so palette colors land on courses in the order the user sees them.
// Card view: dashboard cards are already in the DOM in display order.
// List mode: there are no .ic-DashboardCard elements (which used to make the
// palette silently do nothing), so fall back to the dashboard_cards API —
// ordered by where each course's planner grouping first appears top-to-
// bottom, with any courses not currently displayed (no items in the loaded
// date range) at the end in API order. Also returns the user's current
// course colors from the users/self/colors API (used for "revert colors"
// when no DOM cards exist to read inline styles from).
async function getPaletteCards() {
    let cards = [];
    let apiColors = {};
    document.querySelectorAll(".ic-DashboardCard__header").forEach(card => {
        cards.push({ "href": card.querySelector(".ic-DashboardCard__link").href, "el": card });
    });
    if (cards.length > 0) return { cards, apiColors };
    try {
        const [cardsRes, colorsRes] = await Promise.all([
            fetch(domain + "/api/v1/dashboard/dashboard_cards", { headers: { "accept": "application/json" } }),
            fetch(domain + "/api/v1/users/self/colors", { headers: { "accept": "application/json" } })
        ]);
        const apiCards = await cardsRes.json();
        apiColors = (await colorsRes.json())?.custom_colors || {};
        const seen = new Set();
        const orderedIds = [];
        document.querySelectorAll("a.Grouping-styles__hero").forEach(hero => {
            const m = (hero.getAttribute("href") || "").match(/\/courses\/(\d+)/);
            if (m && !seen.has(m[1])) { seen.add(m[1]); orderedIds.push(m[1]); }
        });
        apiCards.forEach(card => {
            const id = String(card.id);
            if (!seen.has(id)) { seen.add(id); orderedIds.push(id); }
        });
        orderedIds.forEach(id => cards.push({ "href": domain + "/courses/" + id, "el": null }));
    } catch (e) {
        logError(e);
    }
    return { cards, apiColors };
}

async function changeColorPreset(colors) {

    if (colors.length === 0) return;

    // reset everything
    //let res = await getData(`${domain}/api/v1/users/self/colors`);
    clearInterval(changeColorInterval);
    const csrfToken = CSRFtoken();
    const delay = 250;
    previous = []
    colorChanges = [];

    // sort cards
    // (display order — see getPaletteCards; no re-sorting here so palette
    // colors apply from the first course on screen to the last)
    const { cards: sortedCards, apiColors } = await getPaletteCards();

    // push each color change into a queue
    try {
        sortedCards.forEach((card, i) => {
            let course_id = card.href.split("courses/")[1];
            let previousColor = card.el
                ? rgbToHex(card.el.querySelector(".ic-DashboardCard__header_hero").style.backgroundColor)
                : (apiColors["course_" + course_id] || "#ffffff");
            previous.push(previousColor);

            let cnum = i % colors.length;

            // Apply the new color to whatever surface is rendered: dashboard
            // card elements (card view) or planner item avatars (list view),
            // so the change is visible immediately instead of only after a
            // reload.
            let applyColor = () => {
                if (card.el) {
                    card.el.querySelector(".ic-DashboardCard__header_hero").style.backgroundColor = colors[cnum];
                    card.el.querySelector(".ic-DashboardCard__header-title span").style.color = colors[cnum];
                    card.el.querySelector(".ic-DashboardCard__header-button-bg").style.backgroundColor = colors[cnum];
                } else {
                    const coursePrefix = "/courses/" + course_id;
                    document.querySelectorAll(".planner-item").forEach(item => {
                        const titleLink = item.querySelector(".PlannerItem-styles__title a");
                        const heroLink = item.closest(".Grouping-styles__root")?.querySelector("a.Grouping-styles__hero");
                        const inCourse = (titleLink && (titleLink.getAttribute("href") || "").startsWith(coursePrefix)) ||
                            (heroLink && (heroLink.getAttribute("href") || "").startsWith(coursePrefix));
                        if (inCourse) {
                            const avatar = item.querySelector(".PlannerItem-styles__avatar, .PlannerItem-styles__icon");
                            if (avatar) avatar.style.color = colors[cnum];
                        }
                    });
                }
            };

            let changeCardColor = () => {
                fetch(domain + "/api/v1/users/self/colors/courses_" + course_id,
                    {
                        method: "PUT",
                        headers: {
                            "content-type": "application/json",
                            'accept': 'application/json',
                            'X-CSRF-Token': csrfToken,
                        },
                        body: JSON.stringify({ "hexcode": colors[cnum] })
                    }).then(() => applyColor());
            }

            colorChanges.push(changeCardColor);

            applyColor();
        });
    } catch (e) {
        logError(e);
        colorChanges = [];
    }

    changeGradientCards();

    // go through the queue until empty
    changeColorInterval = setInterval(() => {
        if (colorChanges.length > 0) {
            let current = colorChanges.shift();
            current();
        } else {
            clearInterval(changeColorInterval);
        }
    }, delay);

    // set colors to revert back to
    chrome.storage.local.get("previous_colors", local => {
        const now = Date.now();
        const prev = local["previous_colors"];
        // Overwrite when missing or expired — and when an old list-mode run
        // (which found no dashboard cards) stored an empty list, which made
        // revert a silent no-op. Never store an empty capture (nothing to
        // revert to). chrome.storage.local.get yields undefined (not null)
        // for an unset key, so the old `=== null` check never matched it.
        if (previous.length > 0 && (!prev || now >= prev.expire || !Array.isArray(prev.colors) || prev.colors.length === 0)) {
            chrome.storage.local.set({ "previous_colors": { "colors": previous, "expire": now + 86400000 } });
        }
    });
}