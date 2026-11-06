sendFromPopup("getCards");

// refresh the cards if new ones were just recieved
chrome.storage.onChanged.addListener((changes) => {
    // TODO_tuna - Is length really a reliable way to find changes? Maybe use sets instead of lists and check diff? Idk, haven't looked into the onChanged event yet.
    if (changes["custom_cards"]) {
        if (Object.keys(changes["custom_cards"].oldValue).length !== Object.keys(changes["custom_cards"].newValue).length) {
            displayAdvancedCards();
        }
    }
});

function setupCardLimitSlider(initial) {
    let el = document.querySelector("#card_limit");
    el.value = initial;
    document.querySelector("#card_limit_num").textContent = initial;
    el.addEventListener("change", (e) => {
        chrome.storage.sync.set({ "custom_cards": {}, "custom_cards_2": {}, "custom_cards_3": {}, "card_limit": parseInt(e.target.value)});
    });
    el.addEventListener("input", (e) => {
        document.querySelector("#card_limit_num").textContent = e.target.value;
    })
}

function setupDashboardMethod(initial) {
    const el = document.getElementById("card_method_dashboard");
    el.checked = initial === true ? true : false;

    el.addEventListener("change", (e) => {
        chrome.storage.sync.set({ "custom_cards": {}, "custom_cards_2": {}, "custom_cards_3": {}, "card_method_dashboard": e.target.checked });
    });
}

// Custom card style inputs (image size, roundness, spacing, width, height,
// padding) fire `chrome.storage.sync.set` on every keystroke/arrow press.
// chrome.storage.sync caps writes at MAX_WRITE_OPERATIONS_PER_MINUTE (120/min),
// so rapidly adjusting these number inputs used to hit the quota and surface
// a "quota exceeded" error. Coalesce rapid edits into a single write with a
// short (200ms) debounce — barely noticeable to the user, but stays well
// under the write quota even when dragging arrows or typing fast.
const cardStyleSetTimers = {};
function debouncedCardStyleSet(key, value, delay = 200) {
    if (cardStyleSetTimers[key]) clearTimeout(cardStyleSetTimers[key]);
    cardStyleSetTimers[key] = setTimeout(() => {
        chrome.storage.sync.set({ [key]: value });
    }, delay);
}

function setupImageSizeInput(initial) {
    let el = document.querySelector("#imageSize");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("imageSize", e.target.value);
    });
}

function setupCardRoundnessInput(initial) {
    let el = document.querySelector("#cardRoundness");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("cardRoundness", e.target.value);
    });
}

function setupImageRoundnessInput(initial) {
    let el = document.querySelector("#imageRoundness");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("imageRoundness", e.target.value);
    });
}

function setupCardSpacingInput(initial) {
    let el = document.querySelector("#cardSpacing");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("cardSpacing", e.target.value);
    });
}

function setupCardWidthInput(initial) {
    let el = document.querySelector("#cardWidth");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("cardWidth", e.target.value);
    });
}

function setupCardHeightInput(initial) {
	let el = document.querySelector("#cardHeight");
	el.value = initial;
	el.addEventListener("input", (e) => {
		debouncedCardStyleSet("cardHeight", e.target.value);
	});
}

function setupCardPaddingInput(initial) {
    let el = document.querySelector("#cardPadding");
    el.value = initial;
    el.addEventListener("input", (e) => {
        debouncedCardStyleSet("cardPadding", e.target.value);
    });
}

function toggleOpacityOptions() {
    const el = document.getElementById("opacity-options");
    if (el) el.style.display = customBackgroundActive() ? "" : "none";
    toggleCardTransparencyOptions();
}

// Card opacity/blur sliders only show when both a custom background is active
// (so #opacity-options is visible) and the "Card transparency" checkbox is on.
function toggleCardTransparencyOptions() {
    const on = document.getElementById("card_transparency")?.checked === true;
    const opacityRow = document.getElementById("card-transparency-options");
    const blurRow = document.getElementById("card-transparency-blur-row");
    if (opacityRow) opacityRow.style.display = on ? "" : "none";
    if (blurRow) blurRow.style.display = on ? "" : "none";
}


function setCustomImage(key, val) {
    if (val !== "" && val !== "none") {
        let test = new Image();
        test.onerror = () => {
            displayAlert(true, "It seems that the image link you provided isn't working. Make sure to right click on any images you want to use and select \"copy image address\" to get the correct link.");
            updateCards(key, { "img": val });
        }
        test.onload = clearAlert;
        test.src = val;
    }
    updateCards(key, { "img": val });
}

async function displayAdvancedCards() {
    // Sync from Canvas only when needed: when there are no cards yet (fresh
    // install) or when older cards predate the stored fullName field. Once
    // every card has a fullName this is a no-op and the grid renders instantly.
    const needsSync = await new Promise(resolve => {
        chrome.storage.sync.get("custom_cards", s => {
            const c = s.custom_cards || {};
            const ids = Object.keys(c);
            resolve(!ids.length || ids.some(id => !c[id].fullName));
        });
    });
    if (needsSync) await sendFromPopup("getCards");
    chrome.storage.sync.get(["custom_cards", "custom_cards_2"], storage => {


		const cardGrid = document.getElementById("card-grid");
        if (!cardGrid) {
            console.error("Card grid element not found");
            return;
        }

        cardGrid.innerHTML = "";
        const customCards = storage.custom_cards || {};
        const customCards2 = storage.custom_cards_2 || {};
		const allCards = {};
		Object.keys(customCards).forEach((courseId) => {
			allCards[courseId] = {
				...customCards[courseId],
				...(customCards2[courseId] || {}),
			};
		});

		Object.keys(customCards2).forEach((courseId) => {
			if (!allCards[courseId]) {
				allCards[courseId] = customCards2[courseId];
			}
		});

        if (Object.keys(allCards).length === 0) {
            cardGrid.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No course cards found. Visit your Canvas dashboard to load courses.</p>';
            return;
        }

        Object.keys(allCards).forEach(courseId => {
            const course = allCards[courseId];
            if (course && typeof course === 'object') {
                const courseButton = createCourseButton(courseId, course);
                cardGrid.appendChild(courseButton);
            }
        });

        // showCardEditMenu sets an inline display:none on the grid; clear it
        // so reopening the menu shows the cards again (CSS default = grid).
        cardGrid.style.display = "";
        const editMenu = document.getElementById("card-edit-menu");
        if (editMenu) {
            editMenu.style.display = "none";
        }
    });
}

function createCourseButton(courseId, courseData) {
	const button = document.createElement("button");
	button.className = "course-card-button";
	const displayName =
		courseData.name ||
		courseData.fullName ||
		courseData.default ||
		courseData.code ||
		`Course ${courseId}`;
	button.textContent = displayName;
	button.dataset.courseId = courseId;

	if (courseData.img || courseData.hidden || courseData.hide) {
		button.classList.add("customized");
	}

	button.addEventListener("click", () => {
		document.querySelectorAll(".course-card-button").forEach(btn => btn.classList.remove("active"));
		button.classList.add("active");
		showCardEditMenu(courseId, courseData);
	});

	return button;
}

function showCardEditMenu(courseId, courseData) {
	const editMenu = document.getElementById("card-edit-menu");
	const cardGrid = document.getElementById("card-grid");
	if (cardGrid) cardGrid.style.display = "none";
	editMenu.style.display = "block";

	const displayName =
		courseData.name ||
		courseData.fullName ||
		courseData.default ||
		courseData.code ||
		`Course ${courseId}`;

	editMenu.innerHTML = `
        <div class="card-edit-header">
            <h3 class="card-edit-title">${displayName}</h3>
            <button class="card-close-btn" id="card-close-btn">close</button>
        </div>
        
        <div class="card-edit-section">
            <label class="card-edit-label">Custom Name</label>
            <input type="text" class="card-input" id="card-name-input" 
                   value="${courseData.name || ""}" placeholder="Enter custom course name">
        </div>
        
        <div class="card-edit-section">
            <label class="card-edit-label">Custom Code</label>
            <input type="text" class="card-input" id="card-code-input" 
                   value="${courseData.code || ""}" placeholder="Enter custom course code">
        </div>
        
        <div class="card-edit-section">
            <label class="card-edit-label">Card Image URL</label>
            <input type="text" class="card-input" id="card-image-input" 
                   value="${courseData.img || ""}" placeholder="Enter image URL or 'none'">
            <div class="card-image-preview" id="card-image-preview"></div>
        </div>
        
        <div class="card-edit-section">
            <label class="card-edit-label">Hide Card</label>
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="card-hide-input" ${courseData.hidden || courseData.hide ? "checked" : ""}>
                <span>Hide this card from dashboard</span>
            </div>
        </div>
        
        <div style="display: flex; gap: 10px; margin-top: 20px;">
            <button class="big-button" id="save-card-btn">Save Changes</button>
            <button class="customization-button" id="reset-card-btn">Reset to Default</button>
        </div>
    `;

	document
		.getElementById("card-close-btn")
		.addEventListener("click", hideCardEditMenu);
	document
		.getElementById("save-card-btn")
		.addEventListener("click", () => saveCardChanges(courseId));
	document
		.getElementById("reset-card-btn")
		.addEventListener("click", () => resetCardToDefault(courseId));

	updateImagePreview();
	document
		.getElementById("card-image-input")
		.addEventListener("input", updateImagePreview);
}

function updateImagePreview() {
	const imageInput = document.getElementById("card-image-input");
	const preview = document.getElementById("card-image-preview");

	if (imageInput && preview) {
		const imageUrl = imageInput.value;
		if (imageUrl && imageUrl !== "none" && imageUrl.trim() !== "") {
			preview.style.backgroundImage = `url(${imageUrl})`;
			preview.style.display = "block";
		} else {
			preview.style.backgroundImage = "none";
			preview.style.display = "none";
		}
	}
}

function saveCardChanges(courseId) {
	const nameInput = document.getElementById("card-name-input");
	const codeInput = document.getElementById("card-code-input");
	const imageInput = document.getElementById("card-image-input");
	const hideInput = document.getElementById("card-hide-input");

	const updates = {
		name: nameInput.value,
		code: codeInput.value,
		img: imageInput.value,
		hidden: hideInput.checked,
		hide: hideInput.checked,
	};

	if (imageInput.value !== "" && imageInput.value !== "none") {
		setCustomImage(courseId, imageInput.value);
	} else {
		updateCards(courseId, updates);
	}

	displayAlert(false, "Card settings saved successfully!");

	hideCardEditMenu();

	setTimeout(() => {
		displayAdvancedCards();
	}, 500);
}


function resetCardToDefault(courseId) {
	updateCards(courseId, { name: "", code: "", img: "", hidden: false, hide: false });
	displayAlert(false, "Card reset to default settings!");

	setTimeout(() => {
		displayAdvancedCards();
	}, 500);
}

function hideCardEditMenu() {
	const editMenu = document.getElementById("card-edit-menu");
	const cardGrid = document.getElementById("card-grid");

	if (editMenu) editMenu.style.display = "none";
	if (cardGrid) cardGrid.style.display = "grid";

	document
		.querySelectorAll(".course-card-button")
		.forEach((btn) => btn.classList.remove("active"));
}

function applyGPAPreset(bounds) {
    chrome.storage.sync.set({ "gpa_calc_bounds": bounds }, () => {
        displayGPABounds();
    });
}

function updateCards(key, value) {
    chrome.storage.sync.get(["custom_cards"], result => {
        chrome.storage.sync.set({ "custom_cards": { ...result["custom_cards"], [key]: { ...result["custom_cards"][key], ...value } } }, () => {
            if (chrome.runtime.lastError) {
                displayAlert(true, "The data you're entering is exceeding the storage limit, so it won't save. Try using shorter links, and make sure to press \"copy image address\" and not \"copy image\" for links.");
            }
        })
    });
}
