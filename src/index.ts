import {
  createButtonObserver,
  createHTMLObserver,
  getDisplayNameByUid,
  getPageTitleByHtmlElement,
  getRoamUrl,
  openBlockInSidebar,
  toConfig,
} from "roam-client";
import { createConfigObserver } from "roamjs-components";
import { render } from "./NodeMenu";
import { render as exportRender } from "./ExportDialog";
import { render as synthesisRender } from "./SynthesisQuery";
import { render as contextRender } from "./DiscourseContext";
import { NODE_TITLE_REGEX } from "./util";

const CONFIG = toConfig("discourse-graph");
createConfigObserver({ title: CONFIG, config: { tabs: [] } });

document.addEventListener("keydown", (e) => {
  if (e.key === "\\") {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "TEXTAREA" &&
      target.classList.contains("rm-block-input")
    ) {
      render({ textarea: target as HTMLTextAreaElement });
      e.preventDefault();
      e.stopPropagation();
    }
  }
});

window.roamAlphaAPI.ui.commandPalette.addCommand({
  label: "Export Property Graph CSV",
  callback: () => exportRender({}),
});

const elToTitle = (e: Node): string => {
  if (e.nodeName === "#text") {
    return e.nodeValue;
  } else if (
    e.nodeName === "SPAN" &&
    (e as HTMLSpanElement).classList.contains("rm-page-ref__brackets")
  ) {
    return "";
  } else if (
    e.nodeName === "SPAN" &&
    (e as HTMLSpanElement).classList.contains("rm-page-ref")
  ) {
    return `[[${Array.from(e.childNodes).map(elToTitle).join("")}]]`;
  } else {
    return Array.from(e.childNodes).map(elToTitle).join("");
  }
};

const getCitation = (title: string) => {
  const earliestBlockRef = window.roamAlphaAPI
    .q(
      `[:find ?u ?t :where [?b :block/uid ?u] [?b :create/time ?t] [?b :block/refs ?p] [?p :node/title "${title}"]]`
    )
    .reduce(
      (prev, cur) => (prev[1] > cur[1] ? cur : prev),
      ["", Number.MAX_VALUE]
    )[0];
  if (earliestBlockRef) {
    const referencedPaper = window.roamAlphaAPI
      .q(
        `[:find ?t ?u :where [?r :block/uid ?u] [?r :node/title ?t] [?p :block/refs ?r] [?b :block/parents ?p] [?b :block/uid "${earliestBlockRef}"]]`
      )
      .map((s) => ({ title: s[0] as string, uid: s[1] as string }))
      .find(({ title }) => title.startsWith("@"));
    if (referencedPaper) {
      const citation = document.createElement("span");
      const formatting = document.createElement("span");
      formatting.innerText = " - ";
      const link = document.createElement("span");
      link.innerText = referencedPaper.title;
      link.onclick = (e) => {
        if (e.shiftKey || e.ctrlKey) {
          openBlockInSidebar(referencedPaper.uid);
        } else {
          window.location.assign(getRoamUrl(referencedPaper.uid));
        }
      };
      link.onmousedown = (e) => e.stopPropagation();
      link.style.userSelect = "none";
      link.style.cursor = "pointer";
      citation.appendChild(formatting);
      citation.appendChild(link);
      return citation;
    }
  }
};

createHTMLObserver({
  tag: "H1",
  className: "rm-title-display",
  callback: (h1: HTMLHeadingElement) => {
    const title = elToTitle(h1);
    const [createdTime, uid] = window.roamAlphaAPI.q(
      `[:find ?ct ?uid :where [?cu :user/uid ?uid] [?p :create/user ?cu] [?p :create/time ?ct] [?p :node/title "${title}"]]`
    )[0] || [0, ""];
    if (uid) {
      const displayName = getDisplayNameByUid(uid);
      const container = document.createElement("div");
      const oldMarginBottom = getComputedStyle(h1).marginBottom;
      container.style.marginTop = `${
        4 - Number(oldMarginBottom.replace("px", "")) / 2
      }px`;
      container.style.marginBottom = oldMarginBottom;
      const label = document.createElement("i");
      label.innerText = `Created by ${displayName || "Anonymous"} on ${new Date(
        createdTime
      ).toLocaleDateString()}`;
      container.appendChild(label);
      if (h1.parentElement.lastChild === h1) {
        h1.parentElement.appendChild(container);
      } else {
        h1.parentElement.insertBefore(container, h1.nextSibling);
      }
      if (title.startsWith("[[EVD]]")) {
        const citation = getCitation(title);
        if (citation) {
          h1.appendChild(citation);
          new MutationObserver(() => h1.appendChild(citation)).observe(h1, {
            attributeFilter: ["class"],
          });
        }
      }
    }
  },
});

createButtonObserver({
  shortcut: "synthesis",
  attribute: "synthesis",
  render: synthesisRender,
});

createHTMLObserver({
  useBody: true,
  tag: "SPAN",
  className: "rm-page-ref",
  callback: (s: HTMLSpanElement) => {
    const tag =
      s.getAttribute("data-tag") ||
      s.parentElement.getAttribute("data-link-title");
    if (
      NODE_TITLE_REGEX.test(tag) &&
      !s.getAttribute("data-roamjs-discourse-augment-tag")
    ) {
      s.setAttribute("data-roamjs-discourse-augment-tag", "true");
      const child = getCitation(tag);
      if (child) {
        s.appendChild(child);
      }
    }
  },
});

createHTMLObserver({
  useBody: true,
  tag: "SPAN",
  className: "rm-page__title",
  callback: (s: HTMLSpanElement) => {
    const tag = s.innerText;
    if (
      NODE_TITLE_REGEX.test(tag) &&
      !s.getAttribute("data-roamjs-discourse-augment-tag")
    ) {
      s.setAttribute("data-roamjs-discourse-augment-tag", "true");
      const child = getCitation(tag);
      if (child) {
        s.appendChild(child);
      }
    }
  },
});

createHTMLObserver({
  tag: "DIV",
  className: "rm-reference-main",
  callback: (d: HTMLDivElement) => {
    if (!d.getAttribute("data-roamjs-discourse-context")) {
      d.setAttribute("data-roamjs-discourse-context", "true");
      const parent = d.querySelector("div.rm-reference-container");
      const p = document.createElement("div");
      parent.parentElement.insertBefore(p, parent);
      contextRender({ p, title: elToTitle(getPageTitleByHtmlElement(d)) });
    }
  },
});
