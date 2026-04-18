(async () => {
  const desired = {
    "Country of Residence": "United States",
    "Are you legally entitled to work in the country you are applying for?": "Yes",
    "Will you now or in the future require sponsorship for employment visa status (e.g. H-1B/L-1 visa status)?": "Yes",
    "Have you entered into any agreement or understanding that will in any way prevent you from joining Capgemini or from fully performing the services required by the position for which you are applying?": "No",
    Ethnicity: "South Asian (e.g. Indian)",
    "Veteran Status": "Not a Protected Veteran",
    "If you believe you have a disability as defined above, please Indicate by making the appropriate selection below.": "No, I don’t have a disability",
    "Have you been employed by Capgemini Group before?": "No",
    "I give my explicit consent for Capgemini Group to collect and process information about my gender for the purpose of observing and ensuring our recruitment practices align with our Inclusion Policy and Recruitment Data Protection Notice. This information will be used in aggregated, anonymized form only and will not impact the outcome of my application. I understand that providing this information is entirely voluntary, and that I may withdraw my data or consent at any time.": "Yes",
    "Do you agree to be contacted via SMS?": "Yes",
    "Do you agree to be contacted via WhatsApp?": "Yes",
    "Do you agree to receive communications via SMS?": "Yes"
  };

  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const key = (el, type, opts = {}) => el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...opts }));
  const cssEscape = value => {
    if (!value) return "";
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
    return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  };
  const attrSelector = (attr, value) => `[${attr}="${value.replace(/"/g, '\\"')}"]`;
  const getDijitWidget = input => {
    if (!input?.id) return null;
    const dijitApi = typeof window !== "undefined" ? window.dijit : null;
    if (!dijitApi || typeof dijitApi.byId !== "function") return null;
    const baseId = input.id.endsWith(":_input") ? input.id.replace(/:_input$/, "") : null;
    if (!baseId) return null;
    const widget = dijitApi.byId(baseId);
    return widget || null;
  };

  const setDijitFilteringSelect = async (input, target) => {
    const widget = getDijitWidget(input);
    if (!widget) return null;

    if (typeof widget.loadDropDown === "function") {
      await new Promise(resolve => {
        try {
          widget.loadDropDown(resolve);
        } catch (err) {
          resolve();
        }
      });
    }

    if (typeof widget.focus === "function") widget.focus();
    if (typeof widget.set === "function") {
      widget.set("displayedValue", target);
    } else if (widget.textbox) {
      widget.textbox.value = target;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await wait(100);
      const displayed = typeof widget.get === "function" ? widget.get("displayedValue") : widget.textbox?.value || "";
      const hiddenValue = widget.valueNode?.value ?? widget.item?.value ?? widget.item?.id ?? "";
      if (norm(displayed) === norm(target) && hiddenValue) {
        widget.closeDropDown?.();
        widget._onBlur?.();
        if (typeof widget.onChange === "function") {
          widget.onChange(widget.get ? widget.get("value") : hiddenValue);
        }
        fire(input, "input");
        fire(input, "change");
        return true;
      }
    }

    return false;
  };

  const commitTypedValue = el => {
    key(el, "keydown", { key: "Enter", code: "Enter" });
    key(el, "keyup", { key: "Enter", code: "Enter" });
    key(el, "keydown", { key: "Tab", code: "Tab" });
    key(el, "keyup", { key: "Tab", code: "Tab" });
    fire(el, "input");
    fire(el, "change");
    el.blur?.();
  };

  const describeElement = el => {
    const elementId = el.id || null;
    const automationId = el.getAttribute("data-automation-id") || el.closest("[data-automation-id]")?.getAttribute("data-automation-id") || null;
    const nameAttr = el.getAttribute("name") || null;

    const buildPath = () => {
      const segments = [];
      let node = el;
      while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
        if (node.id) {
          segments.unshift(`#${cssEscape(node.id)}`);
          break;
        }
        if (!node.parentElement) {
          segments.unshift(node.tagName.toLowerCase());
          break;
        }
        const siblings = [...node.parentElement.children].filter(child => child.tagName === node.tagName);
        const idx = siblings.indexOf(node);
        segments.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${idx + 1})`);
        node = node.parentElement;
      }
      segments.unshift("body");
      return segments.join(" > ");
    };

    const selector = elementId
      ? `#${cssEscape(elementId)}`
      : automationId
        ? `${attrSelector("data-automation-id", automationId)}`
        : nameAttr
          ? `${attrSelector("name", nameAttr)}`
          : buildPath();

    return { elementId, automationId, name: nameAttr, selector };
  };

  const getLabelText = el => {
    const pick = value => {
      const text = typeof value === "string" ? value : value?.textContent;
      return norm(text) || null;
    };

    const ariaLabel = pick(el.getAttribute("aria-label"));
    if (ariaLabel) return ariaLabel;

    const labelledBy = (el.getAttribute("aria-labelledby") || "")
      .split(/\s+/)
      .filter(Boolean);
    for (const id of labelledBy) {
      const labelText = pick(document.getElementById(id));
      if (labelText) return labelText;
    }

    if (el.id) {
      const forLabel = document.querySelector(`label${attrSelector("for", el.id)}`);
      const labelText = pick(forLabel);
      if (labelText) return labelText;
    }

    const closestLabel = pick(el.closest("label"));
    if (closestLabel) return closestLabel;

    const title = pick(el.getAttribute("title"));
    if (title) return title;

    return "";
  };

  const setSelect = (el, target) => {
    const match = [...el.options].find(o => norm(o.textContent) === norm(target) || norm(o.value) === norm(target));
    if (!match) return false;
    el.value = match.value;
    fire(el, "input");
    fire(el, "change");
    return true;
  };

  const setCombo = async (el, target) => {
    const dijitResult = await setDijitFilteringSelect(el, target);
    if (dijitResult === true) return true;
    const resolveList = () => {
      const listId = el.getAttribute("aria-owns") || el.getAttribute("aria-controls");
      if (listId) return document.getElementById(listId);
      const sibling = el.nextElementSibling;
      if (sibling && (sibling.getAttribute("role") === "listbox" || sibling.matches("ul, ol"))) return sibling;
      return null;
    };

    const ensureOptions = async () => {
      let list = resolveList();
      if (!list || !list.childElementCount) {
        el.focus();
        el.click();
        key(el, "keydown", { key: "ArrowDown", code: "ArrowDown" });
        key(el, "keyup", { key: "ArrowDown", code: "ArrowDown" });
        for (let attempt = 0; attempt < 5; attempt += 1) {
          await wait(100);
          list = resolveList();
          if (list && list.childElementCount) break;
        }
      }
      if (!list) return [];
      return [...list.querySelectorAll('[role="option"], li, option')];
    };

    const options = await ensureOptions();
    const match = options.find(o => norm(o.textContent) === norm(target) || norm(o.getAttribute("data-value")) === norm(target));

    if (!match) {
      el.value = target;
      commitTypedValue(el);
      return false;
    }

    match.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    match.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    match.click();
    await wait(10);
    fire(el, "input");
    fire(el, "change");
    return true;
  };

  const dropdowns = Array.from(new Set([
    ...document.querySelectorAll("select"),
    ...document.querySelectorAll('[role="combobox"], [role="listbox"], input[aria-owns], input[role="combobox"]')
  ]));

  const desiredEntries = Object.entries(desired).map(([label, value]) => ({ label, value, normalized: norm(label) }));
  const desiredLookup = new Map(desiredEntries.map(entry => [entry.normalized, entry]));
  const resolved = {};

  for (const el of dropdowns) {
    const labelKey = getLabelText(el);
    if (!labelKey) continue;
    const spec = desiredLookup.get(labelKey);
    if (!spec || resolved[spec.label]) continue;
    resolved[spec.label] = {
      desiredValue: spec.value,
      descriptor: describeElement(el),
      matchedOption: false,
      fillStrategy: "pending"
    };
  }

  const fieldIds = {};
  const desiredById = {};
  for (const [label, info] of Object.entries(resolved)) {
    if (info.descriptor.elementId) {
      fieldIds[label] = info.descriptor.elementId;
      desiredById[info.descriptor.elementId] = info.desiredValue;
    }
  }

  if (Object.keys(fieldIds).length) {
    console.log("Copy/paste these mappings for ID-based automation:");
    console.log("const fieldIds = " + JSON.stringify(fieldIds, null, 2) + ";");
    console.log("const desiredById = " + JSON.stringify(desiredById, null, 2) + ";");
  } else {
    console.warn("No element IDs found. The form may render custom widgets without stable ids.");
  }

  for (const [label, info] of Object.entries(resolved)) {
    const descriptor = info.descriptor;
    const byId = descriptor.elementId ? document.getElementById(descriptor.elementId) : null;
    const target = byId || document.querySelector(descriptor.selector);
    if (!target) {
      console.warn(`Skipped "${label}" (element not found again)`);
      info.matchedOption = false;
      info.fillStrategy = "missing";
      continue;
    }
    const ok = target.tagName === "SELECT" ? setSelect(target, info.desiredValue) : await setCombo(target, info.desiredValue);
    info.matchedOption = ok;
    info.fillStrategy = descriptor.elementId ? "id" : "selector";
    console.log(`Set "${label}" via ${info.fillStrategy === "id" ? `id ${descriptor.elementId}` : "selector"} -> "${info.desiredValue}" ${ok ? "(matched option)" : "(filled text)"}`);
  }

  const missing = desiredEntries
    .filter(entry => !resolved[entry.label])
    .map(entry => entry.label);
  if (missing.length) {
    console.warn("No matching element found for:", missing);
  }

  const table = {};
  for (const [label, info] of Object.entries(resolved)) {
    const descriptor = info.descriptor;
    table[label] = {
      desiredValue: info.desiredValue,
      matchedOption: info.matchedOption,
      fillStrategy: info.fillStrategy,
      elementId: descriptor.elementId || "-",
      automationId: descriptor.automationId || "-",
      name: descriptor.name || "-",
      selector: descriptor.selector
    };
  }

  console.log("Resolved field identifiers (label -> selectors):");
  console.table(table);
})();