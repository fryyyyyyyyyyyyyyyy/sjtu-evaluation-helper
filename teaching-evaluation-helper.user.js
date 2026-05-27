// ==UserScript==
// @name         上海交大教学评价助手
// @name:en      SJTU Teaching Evaluation Helper
// @namespace    https://github.com/fryyyyyyyyyyyyyyyy/sjtu-evaluation-helper
// @version      1.0.0
// @description  一键完成上海交通大学教学评价，自动选择最高分选项并填充文本框
// @description:en  Automatically complete SJTU teaching evaluation with one click
// @author       Jie Frey
// @match        https://i.sjtu.edu.cn/xspjgl/*
// @grant        none
// @license      MIT
// @homepage     https://github.com/fryyyyyyyyyyyyyyyy/sjtu-evaluation-helper
// @supportURL   https://github.com/fryyyyyyyyyyyyyyyy/sjtu-evaluation-helper/issues
// @icon         https://www.sjtu.edu.cn/favicon.ico
// ==/UserScript==

(function () {
  "use strict";

  console.log("[Teaching Evaluation Helper] Script loaded");

  const isSjtuEvaluationPage =
    location.hostname === "i.sjtu.edu.cn" &&
    location.pathname.includes("/xspjgl/") &&
    location.pathname.endsWith("xspj_cxXspjIndex.html");

  console.log("[Teaching Evaluation Helper] Is evaluation page:", isSjtuEvaluationPage);

  if (!isSjtuEvaluationPage) return;

  const TARGET_TEXTS = ["非常认同"];
  const TARGET_COLOR = { r: 45, g: 220, b: 26 };
  const COLOR_TOLERANCE = 8;
  const AUTO_SUBMIT = false; // 设置为 true 可以启用自动提交（不推荐）
  const BUTTON_ID = "teaching-evaluation-helper-button";
  const AUTO_BUTTON_ID = "teaching-evaluation-helper-auto-button";
  const DEBUG_BUTTON_ID = "teaching-evaluation-helper-debug-button";
  const RESULT_ID = "teaching-evaluation-helper-result";
  const PANEL_ID = "teaching-evaluation-helper-panel";

  function normalizeText(text) {
    return String(text || "").replace(/\s+/g, "").trim();
  }

  function isVisible(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    try {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    } catch (e) {
      return false;
    }
  }

  function matchesTargetText(element) {
    const text = normalizeText(element.innerText || element.textContent || element.value || element.title);
    return TARGET_TEXTS.some(function(target) { return text === target || text.includes(target); });
  }

  function parseRgb(value) {
    const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  function isTargetColor(value) {
    const rgb = parseRgb(value);
    if (!rgb) return false;
    return (
      Math.abs(rgb.r - TARGET_COLOR.r) <= COLOR_TOLERANCE &&
      Math.abs(rgb.g - TARGET_COLOR.g) <= COLOR_TOLERANCE &&
      Math.abs(rgb.b - TARGET_COLOR.b) <= COLOR_TOLERANCE
    );
  }

  function matchesTargetColor(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || !isVisible(element)) return false;
    try {
      const style = window.getComputedStyle(element);
      return [
        style.color,
        style.backgroundColor,
        style.borderColor,
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor,
        style.outlineColor,
      ].some(isTargetColor);
    } catch (e) {
      return false;
    }
  }

  function findClickableOption(element) {
    const label = element.closest("label");
    if (label) return label;

    const option = element.closest("[role='radio'], [role='checkbox'], .radio, .checkbox, .iradio_square-green, .icheckbox_square-green");
    if (option) return option;

    const rowCell = element.closest("td, th, li, div, span");
    const nestedControl = rowCell ? rowCell.querySelector("input[type='radio'], input[type='checkbox']") : null;
    if (nestedControl) return nestedControl;

    return element;
  }

  function clickElement(element) {
    try {
      element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      element.click();
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (e) {
      // Fallback to simple click
      element.click();
    }
  }

  function selectByLabelText(root) {
    let count = 0;
    const labels = Array.from(root.querySelectorAll("label")).filter(matchesTargetText);

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const nestedControl = label.querySelector("input[type='radio'], input[type='checkbox']");

      if (!nestedControl) continue;
      if (nestedControl.checked || nestedControl.disabled) continue;

      const before = nestedControl.checked;

      clickElement(nestedControl);

      if (!nestedControl.checked) {
        clickElement(label);
      }

      if (nestedControl.checked && !before) {
        count += 1;
      }
    }

    return count;
  }

  function selectByNearbyText(root) {
    let count = 0;
    const controls = Array.from(root.querySelectorAll("input[type='radio'], input[type='checkbox']"));

    for (let i = 0; i < controls.length; i++) {
      const control = controls[i];
      if (control.checked || control.disabled) continue;

      const nearbyText = normalizeText([
        control.value,
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.closest("td, th, li, div, span") ? control.closest("td, th, li, div, span").innerText : "",
        control.parentElement ? control.parentElement.innerText : "",
        control.nextElementSibling ? control.nextElementSibling.innerText : "",
      ].join(" "));

      let hasTarget = false;
      for (let j = 0; j < TARGET_TEXTS.length; j++) {
        if (nearbyText.includes(TARGET_TEXTS[j])) {
          hasTarget = true;
          break;
        }
      }
      if (!hasTarget) continue;

      clickElement(control);
      if (control.checked) count += 1;
    }

    return count;
  }

  function selectByTableColumn(root) {
    let count = 0;
    const tables = Array.from(root.querySelectorAll("table"));

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) continue;

      const headerCells = Array.from(rows[0].children);
      const targetIndexes = [];
      for (let j = 0; j < headerCells.length; j++) {
        if (matchesTargetText(headerCells[j])) {
          targetIndexes.push(j);
        }
      }

      if (targetIndexes.length === 0) continue;

      for (let j = 1; j < rows.length; j++) {
        const row = rows[j];
        const cells = Array.from(row.children);
        for (let k = 0; k < targetIndexes.length; k++) {
          const index = targetIndexes[k];
          const cell = cells[index];
          const control = cell ? cell.querySelector("input[type='radio'], input[type='checkbox']") : null;
          if (!control || control.checked || control.disabled) continue;
          clickElement(control);
          if (control.checked) count += 1;
        }
      }
    }

    return count;
  }

  function submitForm(root) {
    // Try to find and click the submit button
    const submitButtons = Array.from(root.querySelectorAll("button, input[type='submit'], input[type='button']"));
    let submitButton = null;
    let saveButton = null;

    for (let i = 0; i < submitButtons.length; i++) {
      const btn = submitButtons[i];
      const text = normalizeText(btn.innerText || btn.textContent || btn.value || "");
      const id = btn.id || "";
      const className = btn.className || "";

      // Prioritize submit button over save button
      if (text.includes("提交") || id.includes("tj") || className.includes("btn_tj")) {
        submitButton = btn;
        break; // Found submit, stop looking
      } else if (text.includes("保存") || id.includes("bc") || className.includes("btn_bc")) {
        saveButton = btn; // Remember save button as fallback
      }
    }

    const targetButton = submitButton || saveButton;

    if (targetButton) {
      const text = normalizeText(targetButton.innerText || targetButton.textContent || targetButton.value || "");
      const id = targetButton.id || "";
      console.log("[Teaching Evaluation Helper] Found button:", text, "id:", id);

      // Try multiple click methods with delays
      try {
        // Method 1: Direct click
        targetButton.click();

        // Method 2: jQuery trigger (most likely to work for this site)
        if (window.jQuery && window.jQuery(targetButton).length) {
          console.log("[Teaching Evaluation Helper] Triggering jQuery click");
          setTimeout(function() {
            window.jQuery(targetButton).click();
          }, 100);
          setTimeout(function() {
            window.jQuery(targetButton).trigger("click");
          }, 200);
        }

        // Method 3: Mouse events
        setTimeout(function() {
          targetButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
          targetButton.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
          targetButton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }, 300);

        console.log("[Teaching Evaluation Helper] Button click triggered");
        return true;
      } catch (e) {
        console.error("[Teaching Evaluation Helper] Error clicking button:", e);
      }
    }

    console.log("[Teaching Evaluation Helper] No submit button found");
    return false;
  }

  function fillTextInputs(root, text) {
    let count = 0;
    const textInputs = Array.from(root.querySelectorAll("input[type='text'], textarea"));

    for (let i = 0; i < textInputs.length; i++) {
      const input = textInputs[i];
      if (input.disabled || input.readOnly) continue;
      if (input.value && input.value.trim() !== "") continue;

      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      count += 1;
    }

    return count;
  }

  function selectByHighestScore(root) {
    let count = 0;
    const radioGroups = {};
    const allRadios = Array.from(root.querySelectorAll("input[type='radio']"));

    for (let i = 0; i < allRadios.length; i++) {
      const radio = allRadios[i];
      const name = radio.name;
      if (!name) continue;

      if (!radioGroups[name]) {
        radioGroups[name] = [];
      }
      radioGroups[name].push(radio);
    }

    for (const groupName in radioGroups) {
      const radios = radioGroups[groupName];
      let bestRadio = null;
      let bestScore = -1;

      for (let i = 0; i < radios.length; i++) {
        const radio = radios[i];
        if (radio.checked || radio.disabled) continue;

        const score = parseInt(radio.getAttribute("data-dyf") || "0", 10);
        if (score > bestScore) {
          bestScore = score;
          bestRadio = radio;
        }
      }

      if (bestRadio && bestScore > 0) {
        const before = bestRadio.checked;
        clickElement(bestRadio);

        if (!bestRadio.checked) {
          const label = bestRadio.closest("label");
          if (label) clickElement(label);
        }

        if (bestRadio.checked && !before) {
          count += 1;
        }
      }
    }

    return count;
  }

  function getCheckedCount(root) {
    return root.querySelectorAll("input[type='radio']:checked, input[type='checkbox']:checked").length;
  }

  function findAllFrames() {
    const frames = [window];
    try {
      const iframes = document.querySelectorAll("iframe");
      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        try {
          if (iframe.contentWindow && iframe.contentWindow.document) {
            frames.push(iframe.contentWindow);
          }
        } catch (e) {
          // Cross-origin iframe, skip
        }
      }
    } catch (e) {
      // Ignore
    }
    return frames;
  }

  function selectVerySatisfied() {
    const frames = findAllFrames();
    let totalSelected = 0;
    let totalChecked = 0;
    let totalFilled = 0;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const doc = frame.document;
      const before = getCheckedCount(doc);

      // Use the new score-based selection first
      const scoreCount = selectByHighestScore(doc);
      const labelCount = selectByLabelText(doc);
      const nearbyCount = selectByNearbyText(doc);
      const tableCount = selectByTableColumn(doc);
      const textCount = fillTextInputs(doc, "无");
      const after = getCheckedCount(doc);

      totalSelected += Math.max(after - before, scoreCount + labelCount + nearbyCount + tableCount);
      totalFilled += textCount;
      totalChecked += after;
    }

    return {
      selected: totalSelected,
      filled: totalFilled,
      checkedTotal: totalChecked,
    };
  }

  function getOptionDiagnostics() {
    const frames = findAllFrames();
    const allDiagnostics = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const doc = frame.document;

      // Get all visible elements count
      const allInputs = doc.querySelectorAll("input");
      const allRadios = doc.querySelectorAll("input[type='radio']");
      const allCheckboxes = doc.querySelectorAll("input[type='checkbox']");
      const allButtons = doc.querySelectorAll("button");
      const allDivs = doc.querySelectorAll("div");

      const allLabels = Array.from(doc.querySelectorAll("label")).filter(isVisible).slice(0, 80);
      const labels = [];
      for (let j = 0; j < allLabels.length; j++) {
        const label = allLabels[j];
        labels.push({
          text: normalizeText(label.innerText || label.textContent).slice(0, 80),
          for: label.getAttribute("for") || "",
          html: label.outerHTML.slice(0, 240),
        });
      }

      const allControls = Array.from(doc.querySelectorAll("input[type='radio'], input[type='checkbox']")).slice(0, 120);
      const controls = [];
      for (let j = 0; j < allControls.length; j++) {
        const control = allControls[j];
        const closest = control.closest("td, th, li, div, span, label");
        controls.push({
          type: control.type,
          name: control.name || "",
          id: control.id || "",
          value: control.value || "",
          checked: control.checked,
          disabled: control.disabled,
          visible: isVisible(control),
          context: normalizeText(closest ? closest.innerText : "").slice(0, 120),
          html: control.outerHTML.slice(0, 240),
        });
      }

      const allTables = Array.from(doc.querySelectorAll("table")).filter(isVisible).slice(0, 20);
      const tables = [];
      for (let j = 0; j < allTables.length; j++) {
        const table = allTables[j];
        const firstRow = table.querySelector("tr");
        const headers = [];
        if (firstRow) {
          const headerCells = Array.from(firstRow.children);
          for (let k = 0; k < headerCells.length; k++) {
            const cell = headerCells[k];
            headers.push(normalizeText(cell.innerText || cell.textContent).slice(0, 60));
          }
        }
        tables.push({
          headers: headers,
          rows: table.querySelectorAll("tr").length,
          controls: table.querySelectorAll("input[type='radio'], input[type='checkbox']").length,
        });
      }

      // Sample some text content
      const bodyText = doc.body ? normalizeText(doc.body.innerText).slice(0, 500) : "";

      allDiagnostics.push({
        frameIndex: i,
        isMainFrame: i === 0,
        url: frame.location.href,
        title: doc.title,
        totalInputs: allInputs.length,
        totalRadios: allRadios.length,
        totalCheckboxes: allCheckboxes.length,
        totalButtons: allButtons.length,
        totalDivs: allDivs.length,
        labelCount: labels.length,
        controlCount: controls.length,
        tableCount: tables.length,
        bodyTextSample: bodyText,
        labels: labels,
        controls: controls,
        tables: tables,
      });
    }

    return {
      totalFrames: frames.length,
      frames: allDiagnostics,
    };
  }

  function showDiagnosticsPanel(diagnostics) {
    const existingPanel = document.getElementById(PANEL_ID);
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = "position:fixed;inset:40px;z-index:2147483647;padding:16px;border-radius:8px;background:#fff;box-shadow:0 18px 60px rgba(0,0,0,.32);font-family:Arial,'Microsoft YaHei',sans-serif;";

    const title = document.createElement("div");
    title.textContent = "评价页诊断信息";
    title.style.cssText = "font-size:16px;font-weight:700;margin-bottom:10px;color:#111827;";

    const textarea = document.createElement("textarea");
    textarea.value = diagnostics;
    textarea.readOnly = true;
    textarea.style.cssText = "width:100%;height:calc(100% - 86px);box-sizing:border-box;padding:10px;border:1px solid #d1d5db;border-radius:6px;font:12px/1.45 Consolas,monospace;color:#111827;background:#f9fafb;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:10px;";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "复制";
    copyButton.style.cssText = "height:34px;padding:0 12px;border:0;border-radius:6px;background:#2563eb;color:#fff;cursor:pointer;";
    copyButton.addEventListener("click", function() {
      textarea.focus();
      textarea.select();
      let copied = false;
      try {
        if (typeof GM_setClipboard === "function") {
          GM_setClipboard(diagnostics, "text");
          copied = true;
        } else if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(diagnostics).then(function() {
            updateResult("已复制诊断信息。");
          }).catch(function() {
            updateResult("复制被浏览器拦截了，请在面板里 Ctrl+A / Ctrl+C。");
          });
          return;
        }
      } catch (error) {
        copied = false;
      }
      updateResult(copied ? "已复制诊断信息。" : "复制被浏览器拦截了，请在面板里 Ctrl+A / Ctrl+C。");
    });

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "关闭";
    closeButton.style.cssText = "height:34px;padding:0 12px;border:0;border-radius:6px;background:#374151;color:#fff;cursor:pointer;";
    closeButton.addEventListener("click", function() {
      panel.remove();
    });

    actions.appendChild(copyButton);
    actions.appendChild(closeButton);
    panel.appendChild(title);
    panel.appendChild(textarea);
    panel.appendChild(actions);
    document.body.appendChild(panel);
    textarea.focus();
    textarea.select();
  }

  function copyDiagnostics() {
    try {
      const diagnostics = JSON.stringify(getOptionDiagnostics(), null, 2);
      console.log("[Teaching Evaluation Helper diagnostics]", diagnostics);

      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(diagnostics, "text");
        updateResult("已复制页面选项诊断信息；也打开了诊断面板。");
      } else {
        updateResult("已打开诊断面板，请复制里面的文本。");
      }

      showDiagnosticsPanel(diagnostics);
    } catch (error) {
      console.error("[Teaching Evaluation Helper diagnostics error]", error);
      alert("诊断脚本报错：" + (error.message || error));
    }
  }

  function waitForControls(callback, maxAttempts) {
    maxAttempts = maxAttempts || 20;
    let attempts = 0;

    function check() {
      attempts++;
      const frames = findAllFrames();
      let totalControls = 0;

      for (let i = 0; i < frames.length; i++) {
        const doc = frames[i].document;
        totalControls += doc.querySelectorAll("input[type='radio'], input[type='checkbox']").length;
      }

      if (totalControls > 0) {
        callback(true);
      } else if (attempts >= maxAttempts) {
        callback(false);
      } else {
        setTimeout(check, 500);
      }
    }

    check();
  }

  function updateResult(text) {
    let result = document.getElementById(RESULT_ID);
    if (!result) {
      result = document.createElement("div");
      result.id = RESULT_ID;
      result.style.cssText = "position:fixed;right:16px;bottom:64px;z-index:2147483647;max-width:280px;padding:8px 10px;border-radius:6px;background:#111827;color:#fff;font-size:13px;line-height:1.4;box-shadow:0 8px 24px rgba(0,0,0,.18);";
      document.body.appendChild(result);
    }
    result.textContent = text;
    if (updateResult.timer) {
      window.clearTimeout(updateResult.timer);
    }
    updateResult.timer = window.setTimeout(function() {
      result.remove();
    }, 4500);
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "一键评教";
    button.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:2147483647;height:50px;padding:0 20px;border:0;border-radius:8px;background:#10b981;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.4);transition:all 0.3s;";

    button.addEventListener("mouseover", function() {
      button.style.background = "#059669";
      button.style.boxShadow = "0 6px 16px rgba(16,185,129,0.5)";
    });

    button.addEventListener("mouseout", function() {
      button.style.background = "#10b981";
      button.style.boxShadow = "0 4px 12px rgba(16,185,129,0.4)";
    });

    button.addEventListener("click", function() {
      button.disabled = true;
      button.style.opacity = "0.6";
      button.textContent = "正在处理...";
      updateResult("正在等待表单加载...");

      waitForControls(function(found) {
        button.disabled = false;
        button.style.opacity = "1";
        button.textContent = "一键评教";

        if (found) {
          const result = selectVerySatisfied();
          if (result.selected === 0 && result.filled === 0) {
            updateResult("未找到可填写的内容，请检查页面。");
          } else {
            const msg = "已完成填写";
            const details = [];
            if (result.selected > 0) details.push(result.selected + " 个选项");
            if (result.filled > 0) details.push(result.filled + " 个文本框");
            updateResult(msg + "（" + details.join("，") + "）。请检查后手动提交。");
          }
        } else {
          updateResult("未找到表单，请确认页面已加载。");
        }
      }, 20);
    });

    document.body.appendChild(button);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createButton);
  } else {
    createButton();
  }
})();
