// Map a percentage to a letter grade using the user's configurable GPA
// calculator cutoffs (A+ down to F). Returns null when no grade is present.
// Picks the letter with the HIGHEST cutoff the percent meets so the result
// doesn't depend on the key order of the stored bounds object — theme imports
// can reorder keys (e.g. alphabetically, where "A" precedes "A+"), which made
// "+" grades unreachable and displayed e.g. 100% as "A". Cutoffs are coerced
// with Number() so string values carried in by imported themes still match.
function percentToLetterGrade(percent) {
    const bounds = options.gpa_calc_bounds;
    if (!bounds || typeof percent !== "number") return null;
    let best = null;
    let bestCutoff = -Infinity;
    for (const letter of Object.keys(bounds)) {
        const cutoff = Number(bounds[letter]?.cutoff);
        if (Number.isFinite(cutoff) && percent >= cutoff && cutoff > bestCutoff) {
            best = letter;
            bestCutoff = cutoff;
        }
    }
    return best;
}

function insertGrades() {
    if (options.dashboard_grades === true) {
        grades.then(data => {
            try {
                let cards = document.querySelectorAll('.ic-DashboardCard');
                if (cards.length === 0 || cards[0].querySelectorAll(".ic-DashboardCard__link").length === 0) return;
                for (let i = 0; i < cards.length; i++) {
                    let course_id = parseInt(cards[i].querySelector(".ic-DashboardCard__link").href.split("courses/")[1]);
                    data.forEach(grade => {
                        if (course_id === grade.id) {
                            let gradepercent = grade.enrollments[0].has_grading_periods === true ? grade.enrollments[0].current_period_computed_current_score : grade.enrollments[0].computed_current_score;
                            //let gradepercent = grade.enrollments[0].computed_current_score;
                            let percent = (gradepercent || "--") + "%";
                            if (options.card_letter === true) {
                                const letter = percentToLetterGrade(gradepercent);
                                if (letter) percent = `${letter} ${percent}`;
                            }
                            let gradeContainer = cards[i].querySelector(".canvasrefined-card-grade") || makeElement("a", cards[i].querySelector(".ic-DashboardCard__header"), { "className": "canvasrefined-card-grade" });
                            gradeContainer.textContent = percent;
                            if (options.grade_hover === true) {
                                gradeContainer.classList.add("canvasrefined-hover-only");
                            } else {
                                gradeContainer.classList.remove("canvasrefined-hover-only");
                            }
                            gradeContainer.setAttribute("href", `${domain}/courses/${course_id}/grades`);
                            gradeContainer.style.display = "block";
                        }
                    });

                }
            } catch (e) {
                logError(e);
            }
        });
    } else {
        document.querySelectorAll('.canvasrefined-card-grade').forEach(grade => {
            grade.style.display = "none";
        });
    }
}