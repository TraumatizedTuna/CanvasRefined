let dashboardNotesTimer;
function delayDashboardNotesStorage(text) {
    clearTimeout(dashboardNotesTimer);
    dashboardNotesTimer = setTimeout(() => {
        chrome.storage.sync.set({ dashboard_notes_text: text });
    }, 250);
}

/* Fallback Markdown renderer used only if js/markdown.js failed to load. */
function crRenderMarkdownFallback(src) {
    if (src == null) return "";
    const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const sanitizeUrl = (u) => {
        const v = String(u == null ? "" : u).trim();
        if (!v) return "";
        if (/^(https?:|mailto:|ftp:|tel:)/i.test(v)) return v;
        if (/^(javascript:|vbscript:|file:|data:)/i.test(v)) return "#";
        if (/^[#/?]/.test(v)) return v;
        if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return "#";
        return v;
    };
    let text = String(src).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const out = [];
    const lines = text.split("\n");
    let i = 0;
    let taskSeq = 0; // ordinal of rendered task items, stable across code-block stashing
    const inline = (t) => {
        let h = escapeHtml(t);
        h = h.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, alt, url, title) =>
            `<img src="${sanitizeUrl(url)}" alt="${alt}"${title ? ` title="${title}"` : ""}>`);
        h = h.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (m, txt, url, title) =>
            `<a href="${sanitizeUrl(url)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ""}>${txt}</a>`);
        h = h.replace(/`([^`\n]+)`/g, (m, c) => `<code>${c}</code>`);
        h = h.replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>");
        h = h.replace(/~~([^~]+?)~~/g, "<del>$1</del>");
        h = h.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
        return h;
    };
    while (i < lines.length) {
        const line = lines[i];
        if (/^\s*$/.test(line)) { i++; continue; }
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) { const l = h[1].length; out.push(`<h${l}>${inline(h[2])}</h${l}>`); i++; continue; }
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
        if (/^>\s?/.test(line)) {
            const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(inline(lines[i].replace(/^>\s?/, ""))); i++; }
            out.push(`<blockquote>${q.join("<br>")}</blockquote>`); continue;
        }
        if (/^\s*[-*+]\s+/.test(line)) {
            const items = []; while (i < lines.length) { const m = lines[i].match(/^\s*[-*+]\s+(.*)$/); if (!m) break; const tk = m[1].match(/^\[([ xX])\]\s+(.*)$/); if (tk) { items.push(`<li class="cr-task" data-cr-task="${taskSeq++}"><input type="checkbox"${/x/i.test(tk[1]) ? " checked" : ""}> ${inline(tk[2])}</li>`); } else { items.push(`<li>${inline(m[1])}</li>`); } i++; } out.push(`<ul>${items.join("")}</ul>`); continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = []; while (i < lines.length) { const m = lines[i].match(/^\s*\d+\.\s+(.*)$/); if (!m) break; items.push(`<li>${inline(m[1])}</li>`); i++; } out.push(`<ol>${items.join("")}</ol>`); continue;
        }
        const para = [line]; i++; while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+\.\s|>)/.test(lines[i])) { para.push(lines[i]); i++; }
        out.push(`<p>${para.map(inline).join("<br>")}</p>`);
    }
    return out.join("\n");
}

function renderDashboardNotesPreview(preview, text) {
    if (!preview) return;
    // Skip identical re-renders to avoid a self-sustaining observer loop.
    if (preview._crLastText === text) return;
    preview._crLastText = text;
    const renderer = (typeof window.renderMarkdown === "function") ? window.renderMarkdown : crRenderMarkdownFallback;
    preview.innerHTML = renderer(text);
}

/* Insert/wrap Markdown formatting at the selection and fire an input event. */
function notesApplyFormat(editor, action) {
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const fire = () => {
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.focus();
    };

    const wrap = (before, after, placeholder) => {
        const had = end > start;
        const sel = had ? value.slice(start, end) : (placeholder || "");
        editor.setRangeText(before + sel + after, start, end, "end");
        editor.selectionStart = start + before.length;
        editor.selectionEnd = start + before.length + sel.length;
        fire();
    };

    // Range covering every line touched by the selection.
    const lineBlock = () => {
        const ls = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
        let le = value.indexOf("\n", end);
        if (le === -1) le = value.length;
        return { ls, le, block: value.slice(ls, le) };
    };

    const togglePrefix = (prefix) => {
        const { ls, le, block } = lineBlock();
        const lines = block.split("\n");
        const allHave = lines.every((l) => l.startsWith(prefix));
        const newBlock = lines.map((l) => allHave ? l.slice(prefix.length) : prefix + l).join("\n");
        editor.setRangeText(newBlock, ls, le, "end");
        editor.selectionStart = ls;
        editor.selectionEnd = ls + newBlock.length;
        fire();
    };

    switch (action) {
        case "bold": wrap("**", "**", "bold"); break;
        case "italic": wrap("*", "*", "italic"); break;
        case "strike": wrap("~~", "~~", "strikethrough"); break;
        case "code": wrap("`", "`", "code"); break;
        case "h1": togglePrefix("# "); break;
        case "h2": togglePrefix("## "); break;
        case "list": togglePrefix("- "); break;
        case "numbered": togglePrefix("1. "); break;
        case "quote": togglePrefix("> "); break;
        case "task": {
            const { ls, le, block } = lineBlock();
            const marker = block.match(/^-\s*\[([ xX])\]\s+/);
            const bullet = block.match(/^[-*+]\s+/);
            let newBlock;
            if (marker) {
                newBlock = block.slice(marker[0].length);
            } else if (bullet) {
                newBlock = "- [ ] " + block.slice(bullet[0].length);
            } else {
                newBlock = "- [ ] " + block;
            }
            editor.setRangeText(newBlock, ls, le, "end");
            editor.selectionStart = ls;
            editor.selectionEnd = ls + newBlock.length;
            fire();
            break;
        }
        case "link": {
            const had = end > start;
            const sel = had ? value.slice(start, end) : "text";
            editor.setRangeText("[" + sel + "](url)", start, end, "end");
            const urlStart = start + 1 + sel.length + 2; // after "]("
            editor.selectionStart = urlStart;
            editor.selectionEnd = urlStart + 3; // select "url"
            fire();
            break;
        }
        case "hr": {
            const lead = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
            editor.setRangeText(lead + "---\n", start, start, "end");
            fire();
            break;
        }
        case "codeblock": {
            const had = end > start;
            const sel = had ? value.slice(start, end) : "code";
            const lead = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
            editor.setRangeText(lead + "```\n" + sel + "\n```", start, end, "end");
            fire();
            break;
        }
    }
}

/* Toggle the Nth rendered Markdown task checkbox and re-render, using a task
   ordinal that skips fenced code blocks. */
function toggleDashboardNoteTask(editor, taskIndex) {
    if (!editor) return;
    const value = editor.value || "";
    const lines = value.split("\n");
    let inFence = false;
    let count = 0;
    for (let idx = 0; idx < lines.length; idx++) {
        const line = lines[idx];
        if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = line.match(/^(\s*[-*+]\s+)\[([ xX])\](\s+)/);
        if (!m) continue;
        if (count === taskIndex) {
            const newMark = m[2] === " " ? "x" : " ";
            lines[idx] = m[1] + "[" + newMark + "]" + m[3] + line.slice(m[0].length);
            editor.value = lines.join("\n");
            editor.dispatchEvent(new Event("input", { bubbles: true }));
            const notes = editor.closest(".canvasrefined-dashboard-notes");
            const rendered = notes ? notes.querySelector(".canvasrefined-notes-rendered") : null;
            if (rendered) renderDashboardNotesPreview(rendered, editor.value);
            return;
        }
        count++;
    }
}

const DASHBOARD_NOTES_HTML = `
    <div class="canvasrefined-notes-toolbar" role="toolbar" aria-label="Format notes">
        <button type="button" class="cr-fmt" data-action="bold" title="Bold (Ctrl/Cmd+B)"><strong>B</strong></button>
        <button type="button" class="cr-fmt" data-action="italic" title="Italic (Ctrl/Cmd+I)"><em>I</em></button>
        <button type="button" class="cr-fmt" data-action="strike" title="Strikethrough"><s>S</s></button>
        <button type="button" class="cr-fmt" data-action="code" title="Inline code"><code>&lt;/&gt;</code></button>
        <span class="cr-fmt-sep"></span>
        <button type="button" class="cr-fmt" data-action="h1" title="Heading 1">H1</button>
        <button type="button" class="cr-fmt" data-action="h2" title="Heading 2">H2</button>
        <span class="cr-fmt-sep"></span>
        <button type="button" class="cr-fmt" data-action="list" title="Bullet list">&bull;</button>
        <button type="button" class="cr-fmt" data-action="numbered" title="Numbered list">1.</button>
        <button type="button" class="cr-fmt" data-action="task" title="Task list">&#9744;</button>
        <button type="button" class="cr-fmt" data-action="quote" title="Quote">&ldquo;</button>
        <span class="cr-fmt-sep"></span>
        <button type="button" class="cr-fmt" data-action="link" title="Insert link">Link</button>
        <button type="button" class="cr-fmt" data-action="hr" title="Horizontal rule">&mdash;</button>
        <button type="button" class="cr-fmt" data-action="codeblock" title="Code block">&#96;&#96;&#96;</button>
    </div>
    <div class="canvasrefined-notes-surface">
        <div class="canvasrefined-notes-rendered" tabindex="0" aria-label="Dashboard notes — click to edit" title="Click to edit"></div>
        <textarea class="canvasrefined-notes-editor" placeholder="Type away!" spellcheck="false"></textarea>
    </div>
`;

function wireDashboardNotes(notes) {
    const editor = notes.querySelector(".canvasrefined-notes-editor");
    const rendered = notes.querySelector(".canvasrefined-notes-rendered");
    editor.value = options.dashboard_notes_text || "";
    renderDashboardNotesPreview(rendered, editor.value);

    const enterEdit = () => {
        if (notes.classList.contains("is-editing")) return;
        notes.classList.add("is-editing");
        editor.focus();
        const len = editor.value.length;
        editor.setSelectionRange(len, len);
    };
    const exitEdit = () => {
        notes.classList.remove("is-editing");
        renderDashboardNotesPreview(rendered, editor.value);
    };

    rendered.addEventListener("click", (e) => {
        // Clicking a checkbox toggles the task; clicking the text edits.
        const t = e.target;
        if (t && t.nodeType === 1 && t.tagName === "INPUT" && t.type === "checkbox" && t.closest && t.closest("li.cr-task")) {
            e.stopPropagation();
            const li = t.closest("li.cr-task");
            const taskIndex = parseInt(li.dataset.crTask, 10);
            if (!Number.isNaN(taskIndex)) toggleDashboardNoteTask(editor, taskIndex);
            return;
        }
        enterEdit();
    });
    rendered.addEventListener("focus", enterEdit);
    editor.addEventListener("blur", exitEdit);
    editor.addEventListener("input", function () {
        options.dashboard_notes_text = this.value;
        delayDashboardNotesStorage(this.value);
    });

    // preventDefault on the toolbar keeps focus in the editor across misclicks.
    const toolbar = notes.querySelector(".canvasrefined-notes-toolbar");
    if (toolbar) toolbar.addEventListener("mousedown", e => e.preventDefault());
    notes.querySelectorAll(".cr-fmt").forEach(btn => {
        btn.addEventListener("click", () => {
            if (!notes.classList.contains("is-editing")) enterEdit();
            notesApplyFormat(editor, btn.dataset.action);
        });
    });

    editor.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); editor.blur(); return; } // Esc: render
        const mod = e.ctrlKey || e.metaKey;
        if (!mod) return;
        const k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); notesApplyFormat(editor, "bold"); }
        else if (k === "i") { e.preventDefault(); notesApplyFormat(editor, "italic"); }
        else if (k === "enter") { e.preventDefault(); editor.blur(); } // Ctrl/Cmd+Enter: render
    });
}

function loadDashboardNotes() {
    const container = document.querySelector("#DashboardCard_Container");
    if (options.dashboard_notes === true) {
        if (!container) return;
        let notes = document.querySelector('.canvasrefined-dashboard-notes');
        // Rebuild older (split edit/preview) markup into the new single-surface layout.
        if (notes && !notes.querySelector(".canvasrefined-notes-surface")) {
            notes.remove();
            notes = null;
        }
        if (!notes) {
            notes = document.createElement("div");
            notes.classList.add("canvasrefined-dashboard-notes");
            notes.innerHTML = DASHBOARD_NOTES_HTML;
            // Mount as a full-width sibling above the card grid. Prepending inside the
            // DashboardCard_Container makes the notes a masonry/grid cell (narrow & broken).
            const parent = container.parentNode;
            if (parent) parent.insertBefore(notes, container);
            else container.prepend(notes);
            wireDashboardNotes(notes);
        } else {
            notes.style.display = "";
            const editor = notes.querySelector(".canvasrefined-notes-editor");
            const rendered = notes.querySelector(".canvasrefined-notes-rendered");
            // Only sync and render in view mode; the textarea is the source of truth while editing.
            if (!notes.classList.contains("is-editing")) {
                if (editor && editor.value !== (options.dashboard_notes_text || "")) {
                    editor.value = options.dashboard_notes_text || "";
                }
                renderDashboardNotesPreview(rendered, editor ? editor.value : "");
            }
        }
    } else {
        let notes = document.querySelector('.canvasrefined-dashboard-notes');
        if (notes) notes.style.display = "none";
    }
}