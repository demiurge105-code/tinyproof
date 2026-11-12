(() => {
  "use strict";

  const STORAGE_KEY = "tinyproof.v1";
  const $ = (id) => document.getElementById(id);
  const state = loadState();
  let activeProjectId = state.projects[0]?.id ?? null;
  let expandedTaskId = null;

  function uid() {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"projects":[]}');
      if (Array.isArray(parsed.projects)) return parsed;
    } catch (error) {
      console.warn("TinyProof could not read saved data:", error);
    }
    return { projects: [] };
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function activeProject() {
    return state.projects.find((project) => project.id === activeProjectId) ?? null;
  }

  function log(project, message) {
    project.history ??= [];
    project.history.unshift({ id: uid(), message, at: new Date().toISOString() });
    project.history = project.history.slice(0, 40);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function describeEvidence(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { type: "Text note", source: "User-provided note" };
      }
      const host = url.hostname.replace(/^www\./i, "").toLowerCase();
      const parts = url.pathname.split("/").filter(Boolean);
      let type = "Web link";

      if (host === "github.com" || host.endsWith(".github.com")) {
        type = "GitHub link";
        if (host === "github.com" && parts.length >= 4) {
          if (parts[2] === "issues") type = "GitHub issue";
          else if (parts[2] === "pull") type = "GitHub pull request";
          else if (parts[2] === "commit" || parts[2] === "commits") type = "GitHub commit";
          else if (parts[2] === "blob" || parts[2] === "tree") type = "GitHub file or folder";
          else type = "GitHub repository";
        }
      } else if (host === "x.com" || host === "twitter.com") {
        type = "X post or profile";
      } else if (host === "youtube.com" || host === "youtu.be") {
        type = "YouTube link";
      } else if (host === "docs.google.com") {
        type = "Google document";
      }

      return { type, source: host };
    } catch {
      return { type: "Text note", source: "User-provided note" };
    }
  }

  function render() {
    renderProjects();
    const project = activeProject();
    $("empty-state").hidden = Boolean(project);
    $("project-view").hidden = !project;
    if (!project) return;

    $("active-project-name").textContent = project.name;
    $("project-meta").textContent = `Created ${new Date(project.createdAt).toLocaleDateString()}`;
    const tasks = project.tasks ?? [];
    const verified = tasks.filter((task) => task.verified && task.evidence?.trim()).length;
    const percent = tasks.length ? Math.round((verified / tasks.length) * 100) : 0;
    $("progress-value").textContent = `${percent}%`;
    $("progress-fill").style.width = `${percent}%`;
    $("completed-count").textContent = `${verified} verified`;
    $("total-count").textContent = `${tasks.length} total tasks`;
    renderTasks(project);
    renderHistory(project);
  }

  function renderProjects() {
    $("project-count").textContent = state.projects.length;
    $("project-list").innerHTML = state.projects.map((project) => `
      <button class="project-item ${project.id === activeProjectId ? "active" : ""}" data-project="${escapeHtml(project.id)}" type="button">
        <span class="project-bullet"></span><span>${escapeHtml(project.name)}</span>
      </button>
    `).join("");
    document.querySelectorAll("[data-project]").forEach((button) => {
      button.addEventListener("click", () => {
        activeProjectId = button.dataset.project;
        expandedTaskId = null;
        render();
      });
    });
  }

  function renderTasks(project) {
    const tasks = project.tasks ?? [];
    if (!tasks.length) {
      $("task-list").innerHTML = '<div class="no-tasks">No tasks yet. Add the first concrete piece of work above.</div>';
      return;
    }
    $("task-list").innerHTML = tasks.map((task) => {
      const open = expandedTaskId === task.id;
      const evidence = task.evidence?.trim();
      const status = task.verified && evidence ? "Verified" : evidence ? "Evidence added · not verified" : "Needs evidence";
      const safeEvidence = evidence ? escapeHtml(evidence) : "";
      const evidenceInfo = evidence ? describeEvidence(evidence) : null;
      const evidenceMeta = evidenceInfo ? `
        <div class="evidence-meta">
          <span><strong>Type</strong>${escapeHtml(evidenceInfo.type)}</span>
          <span><strong>Source</strong>${escapeHtml(evidenceInfo.source)}</span>
        </div>` : "";
      const link = evidence && /^https?:\/\//i.test(evidence)
        ? `<a class="evidence-link" href="${safeEvidence}" target="_blank" rel="noopener noreferrer">${safeEvidence}</a>`
        : (evidence ? `<span class="evidence-link">${safeEvidence}</span>` : "");
      const evidenceHistory = Array.isArray(task.evidenceHistory) ? task.evidenceHistory : [];
      const historyMarkup = evidenceHistory.length ? `
        <div class="evidence-history">
          <span class="evidence-history-title">Evidence change history</span>
          <div class="evidence-history-list">${evidenceHistory.slice().reverse().map((entry) => {
            const hasPreviousValue = Object.prototype.hasOwnProperty.call(entry, "previousValue");
            const actionLabel = entry.action === "removed" ? "Removed" : entry.action === "updated" ? "Updated" : "Saved";
            const previous = hasPreviousValue ? (entry.previousValue ? escapeHtml(entry.previousValue) : "No previous evidence") : null;
            const current = entry.value ? escapeHtml(entry.value) : "Evidence cleared";
            return `
              <div class="evidence-history-item">
                <span class="evidence-history-action">${actionLabel}</span>
                <div class="evidence-history-change">
                  ${hasPreviousValue ? `<div class="evidence-history-line"><strong>From</strong><span>${previous}</span></div><div class="evidence-history-line"><strong>To</strong><span>${current}</span></div>` : `<div class="evidence-history-line"><strong>Value</strong><span>${current}</span></div>`}
                </div>
                <time datetime="${escapeHtml(entry.savedAt)}">${new Date(entry.savedAt).toLocaleString()}</time>
              </div>`;
          }).join("")}</div>
        </div>` : "";
      return `
        <article class="task-card">
          <div class="task-main">
            <input class="task-check" type="checkbox" data-verify="${escapeHtml(task.id)}" ${task.verified && evidence ? "checked" : ""} ${evidence ? "" : "disabled"} aria-label="Verify task">
            <span class="task-title ${task.verified && evidence ? "done" : ""}">${escapeHtml(task.title)}</span>
            <span class="task-status ${task.verified && evidence ? "verified" : ""}">${status}</span>
          </div>
          <div class="task-tools">
            <button type="button" data-evidence="${escapeHtml(task.id)}">${open ? "Close evidence" : (evidence ? "Edit evidence" : "Add evidence")}</button>
            <button type="button" data-delete-task="${escapeHtml(task.id)}">Delete</button>
          </div>
          ${open ? `
            <div class="evidence-area">
              <label for="evidence-${escapeHtml(task.id)}">Evidence URL or a short note describing the proof</label>
              <div class="evidence-row">
                <input class="evidence-input" id="evidence-${escapeHtml(task.id)}" maxlength="500" value="${safeEvidence}" placeholder="https://github.com/... or describe the result">
                <button class="button button-primary" type="button" data-save-evidence="${escapeHtml(task.id)}">Save</button>
              </div>
              <p class="evidence-help">Checking the box marks the task as verified by you. TinyProof does not independently validate links or files yet.</p>
              ${link}
              ${evidenceMeta}
              ${historyMarkup}
            </div>` : ""}
        </article>`;
    }).join("");

    document.querySelectorAll("[data-evidence]").forEach((button) => button.addEventListener("click", () => {
      expandedTaskId = expandedTaskId === button.dataset.evidence ? null : button.dataset.evidence;
      render();
    }));
    document.querySelectorAll("[data-save-evidence]").forEach((button) => button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === button.dataset.saveEvidence);
      const value = $(`evidence-${task.id}`).value.trim();
      const previousValue = task.evidence?.trim() ?? "";
      if (value === previousValue) {
        alert("Evidence hasn't changed. Nothing was saved.");
        return;
      }
      task.evidenceHistory ??= [];
      task.evidenceHistory.push({
        previousValue,
        value,
        action: !value ? "removed" : previousValue ? "updated" : "saved",
        savedAt: new Date().toISOString()
      });
      task.evidenceHistory = task.evidenceHistory.slice(-50);
      task.evidence = value;
      task.verified = false;
      log(project, value ? `Evidence updated for “${task.title}”` : `Evidence removed from “${task.title}”`);
      save();
      render();
    }));
    document.querySelectorAll("[data-verify]").forEach((input) => input.addEventListener("change", () => {
      const task = tasks.find((item) => item.id === input.dataset.verify);
      if (!task?.evidence?.trim()) return;
      task.verified = input.checked;
      log(project, `${input.checked ? "Verified" : "Unverified"} “${task.title}”`);
      save();
      render();
    }));
    document.querySelectorAll("[data-delete-task]").forEach((button) => button.addEventListener("click", () => {
      const task = tasks.find((item) => item.id === button.dataset.deleteTask);
      if (!task || !confirm(`Delete task “${task.title}”?`)) return;
      project.tasks = tasks.filter((item) => item.id !== task.id);
      log(project, `Deleted task “${task.title}”`);
      expandedTaskId = null;
      save();
      render();
    }));
  }

  function renderHistory(project) {
    const history = project.history ?? [];
    $("history").innerHTML = history.length ? `
      <h3>Recent activity</h3>
      <div class="history-list">${history.slice(0, 8).map((item) => `
        <div class="history-item"><span>${escapeHtml(item.message)}</span><span>· ${new Date(item.at).toLocaleString()}</span></div>
      `).join("")}</div>` : "";
  }

  $("project-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("project-name").value.trim();
    if (!name) return;
    const project = { id: uid(), name, createdAt: new Date().toISOString(), tasks: [], history: [] };
    state.projects.unshift(project);
    activeProjectId = project.id;
    $("project-name").value = "";
    save();
    render();
  });

  $("task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const project = activeProject();
    const title = $("task-title").value.trim();
    if (!project || !title) return;
    project.tasks ??= [];
    project.tasks.unshift({ id: uid(), title, evidence: "", verified: false, createdAt: new Date().toISOString() });
    log(project, `Added task “${title}”`);
    $("task-title").value = "";
    save();
    render();
  });

  $("delete-project-btn").addEventListener("click", () => {
    const project = activeProject();
    if (!project || !confirm(`Delete “${project.name}” and all its tasks?`)) return;
    state.projects = state.projects.filter((item) => item.id !== project.id);
    activeProjectId = state.projects[0]?.id ?? null;
    expandedTaskId = null;
    save();
    render();
  });

  $("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tinyproof-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  $("import-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || !Array.isArray(imported.projects) || !imported.projects.every((p) => p && typeof p.name === "string" && Array.isArray(p.tasks))) {
        throw new Error("Invalid TinyProof backup");
      }
      if (!confirm("Replace current browser data with this backup? Export your current data first if you need it.")) return;
      state.projects = imported.projects;
      activeProjectId = state.projects[0]?.id ?? null;
      expandedTaskId = null;
      save();
      render();
    } catch (error) {
      alert("Could not import this file. Choose a valid TinyProof JSON backup.");
    } finally {
      event.target.value = "";
    }
  });

  render();
})();