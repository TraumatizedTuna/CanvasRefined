function createCardAssignment(assignment) {
    let assignmentContainer = document.createElement("div");
    assignmentContainer.className = "canvasrefined-assignment-container";
    let assignmentName = makeElement("a", assignmentContainer, { "className": "canvasrefined-assignment-link", "textContent": assignment.plannable.title, "href": assignment.html_url });
    let assignmentDueAt = makeElement("span", assignmentContainer, { "className": "canvasrefined-assignment-dueat", "textContent": formatCardDue(new Date(assignment.plannable_date)) });
    if (assignment.overdue === true) assignmentDueAt.classList.add("canvasrefined-assignment-overdue");
    if (assignment?.submissions?.submitted === true) {
        assignmentContainer.classList.add("canvasrefined-completed");
    } else {
        if (options.assignment_states[assignment.plannable_id]?.["crs"] === true) {
            assignmentContainer.classList.add("canvasrefined-completed");
        }
    }
    assignmentDueAt.addEventListener('mouseup', function () {
        assignmentContainer.classList.toggle("canvasrefined-completed");
        const status = assignmentContainer.classList.contains("canvasrefined-completed");
        setAssignmentState(assignment.plannable_id, { "crs": status, "expire": assignment.plannable_date });
    });
    return assignmentContainer;
}

let cardAssignments;

/* Equal Height Cards: stretch each card's assignment area to match the tallest
   one, using min-height so cards can still grow. */
let equalHeightResizeTimer = null;

function equalizeCardHeights() {
    const cards = document.querySelectorAll(".ic-DashboardCard");
    if (cards.length === 0) return;

    const enabled = options.equal_height_cards === true && options.assignments_due === true;

    // Clear prior min-height so we can measure fresh or fully reset.
    cards.forEach(card => {
        const area = card.querySelector(".canvasrefined-card-assignment");
        if (area) area.style.removeProperty("min-height");
    });

    if (!enabled) return;

    // Stretch each assignment area to the tallest one.
    let maxHeight = 0;
    cards.forEach(card => {
        const area = card.querySelector(".canvasrefined-card-assignment");
        if (area) maxHeight = Math.max(maxHeight, area.offsetHeight);
    });

    if (maxHeight > 0) {
        cards.forEach(card => {
            const area = card.querySelector(".canvasrefined-card-assignment");
            if (area) area.style.minHeight = maxHeight + "px";
        });
    }
}

window.addEventListener("resize", () => {
    if (equalHeightResizeTimer) clearTimeout(equalHeightResizeTimer);
    equalHeightResizeTimer = setTimeout(equalizeCardHeights, 150);
});

function preloadAssignmentEls() {
    return new Promise((resolve, reject) => {
        let assignmentEls = {};
        const now = new Date();
        assignments.then((data) => {
            data = combineAssignments(data);
            data.forEach(item => {
                let due = new Date(item.plannable_date);
                item.overdue = now >= due;
                let o = {
                    "submitted": item.submissions && item.submissions.submitted === true,
                    "override": item.planner_override && item.planner_override.marked_complete,
                    "type": item.plannable_type,
                    "due": due,
                    "el": createCardAssignment(item)
                }
                if (assignmentEls[item.course_id]) {
                    assignmentEls[item.course_id].push(o);
                } else {
                    assignmentEls[item.course_id] = [o];
                }
            });
            resolve(assignmentEls);
        });
    });
}

function loadCardAssignments() {
    if (options.assignments_due !== true) {
        document.querySelectorAll(".canvasrefined-card-assignment").forEach(card => {
            card.style.display = "none";
        });
        equalizeCardHeights();
        return;
    }
    setupCardAssignments();
    cardAssignments.then(els => {
        try {
            let cards = document.querySelectorAll('.ic-DashboardCard');
            if (cards.length === 0) return;
            const now = new Date();

            cards.forEach(card => {
                let count = 0;
                let link = card.querySelector(".ic-DashboardCard__link");
                if (!link) return;
                let course_id = link.href.split("courses/")[1];
                let cardContainer = card.querySelector('.canvasrefined-card-container');
                if (!cardContainer) return;
                cardContainer.textContent = "";
                if (cardContainer.parentElement) {
                    cardContainer.parentElement.style.display = "block";
                }

                if (els[course_id]) {
                    els[course_id].forEach(assignment => {
                        if (count >= options.num_assignments) return;
                        if (options.hide_completed_cards === true && assignment.submitted === true) return;
                        if ((options.card_overdues !== true && now >= assignment.due) || (options.card_overdues === true && assignment.submitted === true)) return;
                        if (assignment.type !== "assignment" && assignment.type !== "quiz" && assignment.type !== "discussion_topic") return;
                        if (assignment.override === true) return;
                        //assignment.el.querySelector(".canvasrefined-assignment-dueat").textContent = formatCardDue(assignment.due);
                        cardContainer.appendChild(assignment.el);
                        count++;
                    });
                }

                if (count === 0) {
                    let assignmentContainer = makeElement("div", cardContainer, { "className": "canvasrefined-assignment-container" });
                    let assignmentDivLink = makeElement("a", assignmentContainer, { "className": "canvasrefined-assignment-link", "textContent": "None" });
                }
            });
            // Wait one frame so the browser lays out the freshly appended
            // assignment rows before measuring/equalizing card heights.
            requestAnimationFrame(equalizeCardHeights);
        } catch (e) {
            logError(e);
        }
    });
}


function setupCardAssignments() {
    if (options.assignments_due !== true) return;
    try {
        let containersCount = document.querySelectorAll('.canvasrefined-card-container').length;
        if (document.querySelectorAll('.ic-DashboardCard').length > 0 && containersCount > 0) return;
        let cards = document.querySelectorAll('.ic-DashboardCard');
        cards.forEach(card => {
            let assignmentContainer = card.querySelector(".canvasrefined-card-assignment") || makeElement("div", card, { "className": "canvasrefined-card-assignment" });
            let assignmentsDueHeader = card.querySelector(".canvasrefined-card-header-container") || makeElement("div", assignmentContainer, { "className": "canvasrefined-card-header-container" });
            let assignmentsDueLabel = card.querySelector(".canvasrefined-card-header") || makeElement("h3", assignmentsDueHeader, { "className": "canvasrefined-card-header", "textContent": chrome.i18n.getMessage("due") });
            let cardContainer = card.querySelector(".canvasrefined-card-container") || makeElement("div", assignmentContainer, { "className": "canvasrefined-card-container" });
            let skeletonText = card.querySelector(".canvasrefined-skeleton-text") || makeElement("div", cardContainer, { "className": "canvasrefined-skeleton-text" });
        });
    } catch (e) {
        logError(e);
    }
}