(() => {
  "use strict";

  const STORAGE_KEY = "m4-course-progress:v1";
  const SCHEMA_VERSION = 1;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let toastTimer = 0;

  const emptyState = () => ({
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    days: {},
    preflight: {},
  });

  const normalizeState = (candidate) => {
    if (!candidate || candidate.version !== SCHEMA_VERSION) return emptyState();
    return {
      version: SCHEMA_VERSION,
      updatedAt: candidate.updatedAt || new Date().toISOString(),
      days: candidate.days && typeof candidate.days === "object" ? candidate.days : {},
      preflight:
        candidate.preflight && typeof candidate.preflight === "object"
          ? candidate.preflight
          : {},
    };
  };

  const loadState = () => {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch (_error) {
      return emptyState();
    }
  };

  const saveState = (state) => {
    state.version = SCHEMA_VERSION;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_error) {
      showToast("瀏覽器無法儲存進度；本次勾選只會保留到重新整理前。", 4200);
      return false;
    }
  };

  const showToast = (message, duration = 2200) => {
    const toast = document.querySelector("[data-toast]");
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), duration);
  };

  const dayBucket = (state, day) => {
    if (!state.days[day] || typeof state.days[day] !== "object") {
      state.days[day] = { steps: {} };
    }
    if (!state.days[day].steps || typeof state.days[day].steps !== "object") {
      state.days[day].steps = {};
    }
    return state.days[day];
  };

  const updateDayProgress = (day) => {
    const boxes = [...document.querySelectorAll(`[data-progress-checkbox][data-day="${day}"]`)];
    const complete = boxes.filter((box) => box.checked).length;
    const total = boxes.length;
    document.querySelectorAll(`[data-progress-summary][data-day="${day}"]`).forEach((node) => {
      node.textContent = `${complete} / ${total} 步`;
    });
    document.querySelectorAll(`[data-progress-bar][data-day="${day}"]`).forEach((bar) => {
      const percent = total ? (complete / total) * 100 : 0;
      bar.setAttribute("aria-valuenow", String(complete));
      const fill = bar.querySelector("span");
      if (fill) fill.style.width = `${percent}%`;
    });
  };

  const initDayProgress = () => {
    const state = loadState();
    const daySet = new Set();
    document.querySelectorAll("[data-progress-checkbox]").forEach((checkbox) => {
      const day = checkbox.dataset.day;
      const step = checkbox.dataset.step;
      if (!day || !step) return;
      daySet.add(day);
      const bucket = dayBucket(state, day);
      checkbox.checked = Boolean(bucket.steps[step]);
      checkbox.closest("[data-step-card]")?.classList.toggle("is-complete", checkbox.checked);
      checkbox.addEventListener("change", () => {
        const liveState = loadState();
        const liveBucket = dayBucket(liveState, day);
        liveBucket.steps[step] = checkbox.checked;
        saveState(liveState);
        checkbox.closest("[data-step-card]")?.classList.toggle("is-complete", checkbox.checked);
        updateDayProgress(day);
        showToast(checkbox.checked ? "已記錄完成進度。" : "已取消這一步的完成標記。");
      });
    });
    daySet.forEach(updateDayProgress);

    document.querySelectorAll("[data-reset-progress]").forEach((button) => {
      button.addEventListener("click", () => {
        const day = button.dataset.day;
        if (!day || !window.confirm(`確定要重設 Day ${day} 的進度嗎？`)) return;
        const liveState = loadState();
        liveState.days[day] = { steps: {} };
        saveState(liveState);
        document.querySelectorAll(`[data-progress-checkbox][data-day="${day}"]`).forEach((box) => {
          box.checked = false;
          box.closest("[data-step-card]")?.classList.remove("is-complete");
        });
        updateDayProgress(day);
        showToast(`Day ${day} 進度已重設。`);
      });
    });
  };

  const updatePreflight = () => {
    const boxes = [...document.querySelectorAll("[data-preflight-checkbox]")];
    const complete = boxes.filter((box) => box.checked).length;
    const total = boxes.length;
    const summary = document.querySelector("[data-preflight-summary]");
    if (summary) summary.textContent = `${complete} / ${total} 項`;
    const bar = document.querySelector("[data-preflight-bar]");
    if (bar) {
      bar.setAttribute("aria-valuenow", String(complete));
      const fill = bar.querySelector("span");
      if (fill) fill.style.width = `${total ? (complete / total) * 100 : 0}%`;
    }
  };

  const initPreflight = () => {
    const state = loadState();
    document.querySelectorAll("[data-preflight-checkbox]").forEach((checkbox) => {
      const item = checkbox.dataset.item;
      if (!item) return;
      checkbox.checked = Boolean(state.preflight[item]);
      checkbox.addEventListener("change", () => {
        const liveState = loadState();
        liveState.preflight[item] = checkbox.checked;
        saveState(liveState);
        updatePreflight();
      });
    });
    updatePreflight();

    document.querySelector("[data-reset-preflight]")?.addEventListener("click", () => {
      if (!window.confirm("確定要重設所有課前檢查嗎？")) return;
      const liveState = loadState();
      liveState.preflight = {};
      saveState(liveState);
      document.querySelectorAll("[data-preflight-checkbox]").forEach((box) => {
        box.checked = false;
      });
      updatePreflight();
      showToast("課前檢查已重設。");
    });
  };

  const initPrint = () => {
    document.querySelectorAll("[data-print]").forEach((button) => {
      button.addEventListener("click", () => window.print());
    });
  };

  const isTypingTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
  };

  const focusStep = (direction) => {
    const steps = [...document.querySelectorAll("[data-step-card]")];
    if (!steps.length) return;
    let index = steps.findIndex((step) => step === document.activeElement || step.contains(document.activeElement));
    if (index < 0) index = direction > 0 ? -1 : 0;
    const nextIndex = Math.min(Math.max(index + direction, 0), steps.length - 1);
    const target = steps[nextIndex];
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
  };

  const initKeyboard = () => {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() === "j") {
        event.preventDefault();
        focusStep(1);
      } else if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusStep(-1);
      } else if (event.key.toLowerCase() === "p") {
        event.preventDefault();
        window.print();
      }
    });
  };

  const initActiveNav = () => {
    const nav = document.querySelector(".course-nav");
    const active = nav?.querySelector('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    const left = Math.max(0, active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2);
    nav.scrollTo({ left, behavior: "auto" });
  };

  const init = () => {
    initDayProgress();
    initPreflight();
    initPrint();
    initKeyboard();
    initActiveNav();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
