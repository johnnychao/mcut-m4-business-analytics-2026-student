(() => {
  "use strict";

  const STORAGE_KEY = "m4-course-progress:v1";
  const ENTERPRISE_STORAGE_KEY = "m4-enterprise-selection:v1";
  const LAST_PAGE_STORAGE_KEY = "m4-last-course-page:v1";
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

  const loadEnterpriseSelection = () => {
    try {
      return String(localStorage.getItem(ENTERPRISE_STORAGE_KEY) || "").trim();
    } catch (_error) {
      return "";
    }
  };

  const saveEnterpriseSelection = (enterpriseId) => {
    try {
      localStorage.setItem(ENTERPRISE_STORAGE_KEY, enterpriseId);
      return true;
    } catch (_error) {
      showToast("瀏覽器無法保存企業選擇；離開本頁後可能需要重新選擇。", 4200);
      return false;
    }
  };

  const initEnterpriseSelectors = () => {
    const selectors = [...document.querySelectorAll("[data-enterprise-select]")];
    const groups = [...document.querySelectorAll("[data-enterprise-group]")];
    const contentGroups = [...document.querySelectorAll("[data-enterprise-content]")];
    const currentNameNodes = [...document.querySelectorAll("[data-enterprise-current]")];
    const enterpriseFigures = [...document.querySelectorAll("img[data-enterprise-src-template]")];
    // 首頁只有選擇器、沒有企業資源群組；仍需保存選擇供每日頁與資源中心套用。
    if (!selectors.length) return;

    const availableIds = new Set(
      selectors.flatMap((select) => [...select.options].map((option) => option.value)),
    );
    const fallbackId = selectors[0]?.options[0]?.value || "";
    const savedId = loadEnterpriseSelection();
    const initialId = availableIds.has(savedId) ? savedId : fallbackId;

    const applySelection = (enterpriseId, announce = false) => {
      if (!availableIds.has(enterpriseId)) return;
      selectors.forEach((select) => {
        if ([...select.options].some((option) => option.value === enterpriseId)) {
          select.value = enterpriseId;
        }
      });
      groups.forEach((group) => {
        group.hidden = group.dataset.enterpriseGroup !== enterpriseId;
      });
      contentGroups.forEach((group) => {
        group.hidden = group.dataset.enterpriseContent !== enterpriseId;
      });
      const activeOption = selectors
        .flatMap((select) => [...select.options])
        .find((option) => option.value === enterpriseId);
      const enterpriseName = activeOption?.textContent.trim() || enterpriseId;
      currentNameNodes.forEach((node) => {
        node.textContent = enterpriseName;
      });
      enterpriseFigures.forEach((image) => {
        const template = image.dataset.enterpriseSrcTemplate || "";
        const nextSource = template.replace("{enterprise}", enterpriseId);
        const day = image.dataset.figureDay || "";
        const step = image.dataset.figureStep || "";
        if (nextSource && image.getAttribute("src") !== nextSource) {
          image.setAttribute("src", nextSource);
        }
        image.alt = `${enterpriseName} Day ${day} ${step} 完成後的 Colab 輸出或操作檢核示意`;
        image.dataset.enterpriseActive = enterpriseId;
      });
      document.documentElement.dataset.enterprise = enterpriseId;
      if (announce && activeOption) {
        showToast(`已切換為「${enterpriseName}」；任務、故事、圖表與專屬資源均已更新。`);
      }
    };

    applySelection(initialId);
    selectors.forEach((select) => {
      select.addEventListener("change", () => {
        const enterpriseId = select.value;
        saveEnterpriseSelection(enterpriseId);
        applySelection(enterpriseId, true);
      });
    });
  };

  const currentCoursePage = () => {
    const page = document.body.dataset.page || "";
    if (page === "day" && /^[1-4]$/.test(document.body.dataset.day || "")) {
      return `day-${document.body.dataset.day}/index.html`;
    }
    if (["preflight", "resources", "faq"].includes(page)) return `${page}/index.html`;
    return "";
  };

  const initLastVisitedPage = () => {
    const current = currentCoursePage();
    if (current) {
      try {
        localStorage.setItem(LAST_PAGE_STORAGE_KEY, current);
      } catch (_error) {
        // 只保存相對課程頁；無法使用 localStorage 時不影響課程功能。
      }
      return;
    }

    const continueLink = document.querySelector("[data-continue-link]");
    if (!continueLink) return;
    let saved = "";
    try {
      saved = String(localStorage.getItem(LAST_PAGE_STORAGE_KEY) || "");
    } catch (_error) {
      return;
    }
    if (!/^(?:day-[1-4]|preflight|resources|faq)\/index\.html$/.test(saved)) return;
    continueLink.setAttribute("href", saved);
    continueLink.hidden = false;
    const pageLabel = saved.startsWith("day-") ? `Day ${saved.charAt(4)}` : "課程頁面";
    continueLink.setAttribute("aria-label", `繼續上次進度：${pageLabel}`);
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
    const isComplete = total > 0 && complete === total;
    document.querySelectorAll(`[data-completion-state][data-day="${day}"]`).forEach((node) => {
      node.hidden = !isComplete;
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

  const formatAssessmentUnlockTime = (unlockAt) =>
    new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(unlockAt);

  const formatAssessmentUnlockClock = (unlockAt) =>
    new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(unlockAt);

  const initAssessmentAvailability = () => {
    document.querySelectorAll("[data-assessment-gate]").forEach((gate) => {
      const link = gate.querySelector("[data-assessment-link]");
      const status = gate.querySelector("[data-assessment-status]");
      const label = gate.querySelector("[data-assessment-label]");
      const unlockAt = new Date(gate.dataset.assessmentUnlockAt || "");
      if (!link || Number.isNaN(unlockAt.getTime())) return;

      const unlockText = formatAssessmentUnlockTime(unlockAt);
      const unlockClock = formatAssessmentUnlockClock(unlockAt);
      const updateAvailability = () => {
        const isOpen = Date.now() >= unlockAt.getTime();
        if (isOpen) {
          const url = link.dataset.assessmentUrl || "";
          if (url) link.setAttribute("href", url);
          link.classList.remove("is-locked");
          link.removeAttribute("aria-disabled");
          link.removeAttribute("tabindex");
          if (status) status.textContent = "當日驗收已開放；完成分析後即可前往作答。";
          if (label) label.textContent = "前往當日驗收";
          return;
        }

        link.removeAttribute("href");
        link.classList.add("is-locked");
        link.setAttribute("aria-disabled", "true");
        link.setAttribute("tabindex", "-1");
        if (status) status.textContent = `當日驗收將於 ${unlockText}（台灣時間）開放。`;
        if (label) label.textContent = `${unlockClock} 開放`;
      };

      updateAvailability();
      const wait = unlockAt.getTime() - Date.now();
      if (wait > 0) window.setTimeout(updateAvailability, wait);
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
    initLastVisitedPage();
    initEnterpriseSelectors();
    initDayProgress();
    initPreflight();
    initPrint();
    initAssessmentAvailability();
    initKeyboard();
    initActiveNav();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
