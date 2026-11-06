// --- Indexing ---------------------------------------------------------------

// Drop any cached index so the next access rebuilds it from the API. Called
// at setup time so every page load starts fresh.
function invalidateGlobalSearchIndex() {
    globalSearchIndex = null;
    globalSearchIndexAt = 0;
    globalSearchIndexPromise = null;
    try { chrome.storage.local.remove(GLOBAL_SEARCH_STORAGE_KEY); } catch (_) { /* ignore */ }
}

async function ensureGlobalSearchIndex() {
    // A per-session in-memory build is shared across opens so we don't refetch
    // on every keystroke, but we never serve a persisted cache across reloads.
    if (globalSearchIndex && (Date.now() - globalSearchIndexAt) < GLOBAL_SEARCH_INDEX_TTL) {
        return globalSearchIndex;
    }
    if (globalSearchIndexPromise) return globalSearchIndexPromise;

    globalSearchIndexPromise = (async () => {
        const index = await buildGlobalSearchIndex();
        globalSearchIndex = index;
        globalSearchIndexAt = Date.now();
        return index;
    })();

    try {
        return await globalSearchIndexPromise;
    } finally {
        globalSearchIndexPromise = null;
    }
}

async function buildGlobalSearchIndex() {
    let courses = [];
    try {
        // enrollment_state=active excludes concluded/inactive enrollments at the
        // source so we never index (or waste requests on) past-term courses.
        courses = await getData(`${domain}/api/v1/courses?enrollment_state=active&per_page=100`);
    } catch (e) {
        console.warn("[CanvasRefined] global search: failed to load courses", e);
        return [];
    }
    if (!Array.isArray(courses) || !courses.length) return [];

    // Skip inactive/concluded/hidden courses. `enrollment_state=active`
    // already filters at the source, but some institutions return past-term
    // courses as "active", so we double-check here:
    //   - access_restricted_by_date (locked courses)
    //   - concluded === true (Canvas marks concluded courses)
    //   - term end_date in the past (when the API exposes it)
    //   - courses the user hid from their dashboard (custom_cards.hidden)
    const now = Date.now();
    courses = courses.filter(c => {
        if (!c || !c.name) return false;
        if (c.access_restricted_by_date === true) return false;
        if (c.concluded === true) return false;
        // term end date check (API may return term.end_at)
        const endAt = c?.term?.end_at || c?.end_at;
        if (endAt) {
            const end = new Date(endAt).getTime();
            if (!isNaN(end) && end < now) return false;
        }
        if (isCourseHidden(c.id)) return false;
        return true;
    });
    // Cap to keep request volume sane.
    courses = courses.slice(0, 60);

    // Canvas can return the same course more than once (multi-role enrollments,
    // cross-listed sections). Dedupe by id so we don't double-index or double-fetch.
    const seenCourseIds = new Set();
    courses = courses.filter(c => {
        if (seenCourseIds.has(c.id)) return false;
        seenCourseIds.add(c.id);
        return true;
    });

    const index = [];
    // Shared dedup state. Keys identify a piece of *content* regardless of where
    // it surfaced, so the same assignment (which Canvas exposes both as a module
    // item AND a standalone assignment) collapses to a single result.
    //   - standalone assignment:  `asn:<courseId>:<assignmentId>`
    //   - module item with content_id: `<type>:<courseId>:<contentId>`
    //       (for type "assignment" this becomes `asn:<courseId>:<contentId>` —
    //        the SAME key as the standalone assignment, so whichever is added
    //        first wins; we add assignments first to keep the direct URL)
    //   - module item without content_id (external url/tool): `url:<normalizedUrl>`
    //   - module itself: `module:<courseId>:<moduleId>`
    const seenContent = new Set();

    await Promise.all(courses.map(async (course) => {
        const courseId = course.id;
        const courseName = course.name;
        const courseCode = course.course_code || courseName;

        // Assignments first so their direct URLs win over the module-item
        // versions of the same assignment.
        try {
            const assignments = await getData(`${domain}/api/v1/courses/${courseId}/assignments?per_page=100`);
            if (Array.isArray(assignments)) {
                for (const a of assignments) {
                    if (!a || !a.name || !a.html_url) continue;
                    const key = `asn:${courseId}:${a.id}`;
                    if (seenContent.has(key)) continue;
                    seenContent.add(key);
                    index.push({
                        type: "Assignment",
                        title: a.name,
                        course: courseName,
                        courseCode,
                        courseId,
                        url: a.html_url
                    });
                }
            }
        } catch (_) { /* non-fatal */ }

        // Modules + their items.
        try {
            const modules = await getData(`${domain}/api/v1/courses/${courseId}/modules?per_page=100`);
            if (Array.isArray(modules)) {
                for (const m of modules) {
                    if (!m || !m.name) continue;
                    const modKey = `module:${courseId}:${m.id}`;
                    if (!seenContent.has(modKey)) {
                        seenContent.add(modKey);
                        index.push({
                            type: "Module",
                            title: m.name,
                            course: courseName,
                            courseCode,
                            courseId,
                            url: `${domain}/courses/${courseId}/modules`
                        });
                    }
                    try {
                        const items = await getData(`${domain}/api/v1/courses/${courseId}/modules/${m.id}/items?per_page=100`);
                        if (Array.isArray(items)) {
                            for (const it of items) {
                                if (!it || !it.title) continue;
                                // Skip text headers / dividers — no destination page.
                                const itype = (it.type || "").toLowerCase();
                                if (itype === "subheader") continue;
                                // Prefer the real page link (html_url). External
                                // URL items expose external_url instead; the bare
                                // `url` field is the API endpoint, never use it.
                                const url = it.html_url || it.external_url;
                                if (!url) continue;

                                // Build a content-identity key so the same item
                                // appearing in multiple modules (or mirroring a
                                // standalone assignment) only produces one result.
                                let key;
                                if (itype === "assignment" && it.content_id) {
                                    key = `asn:${courseId}:${it.content_id}`;
                                } else if (it.content_id) {
                                    key = `${itype}:${courseId}:${it.content_id}`;
                                } else {
                                    key = `url:${normalizeGlobalSearchUrl(url)}`;
                                }
                                if (seenContent.has(key)) continue;
                                seenContent.add(key);

                                index.push({
                                    type: prettyModuleItemType(it.type),
                                    title: it.title,
                                    course: courseName,
                                    courseCode,
                                    courseId,
                                    url
                                });
                            }
                        }
                    } catch (_) { /* per-module failure is non-fatal */ }
                }
            }
        } catch (_) { /* per-course failure is non-fatal */ }
    }));

    // Final safety net: collapse any remaining normalized-URL duplicates (e.g.
    // external links whose content_id differed but resolve to the same page).
    const seen = new Set();
    return index.filter(item => {
        const key = normalizeGlobalSearchUrl(item.url);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function normalizeGlobalSearchUrl(url) {
    if (!url) return "";
    try {
        const u = new URL(url, domain);
        let path = u.pathname.replace(/\/+$/, ""); // strip trailing slashes
        // Ignore case + fragment/query for matching purposes.
        return (u.host.toLowerCase() + path).toLowerCase();
    } catch (_) {
        // Non-absolute (shouldn't happen, but be safe) — normalize as-is.
        return String(url).replace(/\/+$/, "").toLowerCase();
    }
}

function prettyModuleItemType(type) {
    switch ((type || "").toLowerCase()) {
        case "assignment": return "Assignment";
        case "quiz": return "Quiz";
        case "discussion": case "discussion_topic": return "Discussion";
        case "externalurl": return "Link";
        case "externaltool": return "External Tool";
        case "file": return "File";
        case "page": return "Page";
        case "subheader": return "Section";
        default: return type || "Item";
    }
}