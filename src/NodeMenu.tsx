import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  createBlock,
  createPage,
  getPageUidByPageTitle,
  getTextByBlockUid,
  getTreeByPageName,
  getUids,
  openBlockInSidebar,
  updateBlock,
} from "roam-client";
import { getCoordsFromTextarea } from "roamjs-components";
import { getNodes, nodeFormatToDatalog } from "./util";

type Props = {
  textarea: HTMLTextAreaElement;
};

const NodeMenu = ({ onClose, textarea }: { onClose: () => void } & Props) => {
  const NODE_LABELS = useMemo(getNodes, []);
  const indexBySC = useMemo(
    () => Object.fromEntries(NODE_LABELS.map((mi, i) => [mi.shortcut, i])),
    [NODE_LABELS]
  );
  const shortcuts = useMemo(() => new Set(Object.keys(indexBySC)), [indexBySC]);
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const onSelect = useCallback(
    (index) => {
      const format = menuRef.current.children[index]
        .querySelector(".bp3-menu-item")
        .getAttribute("data-format");
      const highlighted = textarea.value.substring(
        textarea.selectionStart,
        textarea.selectionEnd
      );
      setTimeout(() => {
        const text = getTextByBlockUid(blockUid);
        const pagename = format.replace(/{([\w\d-]*)}/g, (_, val) => {
          if (/content/i.test(val)) return highlighted;
          const referencedNode = NODE_LABELS.find(({ text }) =>
            new RegExp(text, "i").test(val)
          );
          if (referencedNode) {
            const referencedTitle =
              window.roamAlphaAPI.q(
                `[:find ?t :where [?b :block/uid "${blockUid}"] (or-join [?b ?r] (and [?b :block/parents ?p] [?p :block/refs ?r]) (and [?b :block/page ?r])) [?r :node/title ?t] ${nodeFormatToDatalog(
                  {
                    freeVar: "t",
                    nodeFormat: referencedNode.format,
                  }
                )}]`
              )?.[0]?.[0] || "";
            return referencedTitle ? `[[${referencedTitle}]]` : "";
          }
          return "";
        });
        const newText = `${text.substring(
          0,
          textarea.selectionStart
        )}[[${pagename}]]${text.substring(textarea.selectionEnd)}`;
        updateBlock({ text: newText, uid: blockUid });
        setTimeout(() => {
          const pageUid =
            getPageUidByPageTitle(pagename) || createPage({ title: pagename });
          setTimeout(() => {
            const nodes = getTreeByPageName(format);
            nodes.forEach(
              ({ text, textAlign, heading, viewType, children }, order) =>
                createBlock({
                  node: { text, textAlign, heading, viewType, children },
                  order,
                  parentUid: pageUid,
                })
            );
            openBlockInSidebar(pageUid);
            setTimeout(() => {
              const sidebarTitle = document.querySelector(
                ".rm-sidebar-outline .rm-title-display"
              );
              sidebarTitle.dispatchEvent(
                new MouseEvent("mousedown", { bubbles: true })
              );
              setTimeout(() => {
                const ta = document.activeElement as HTMLTextAreaElement;
                const index = ta.value.length;
                ta.setSelectionRange(index, index);
              }, 1);
            }, 100);
          }, 1);
        }, 1);
      });
      onClose();
    },
    [menuRef, blockUid, onClose]
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index + 1) % count);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        const count = menuRef.current.childElementCount;
        setActiveIndex((index - 1 + count) % count);
      } else if (e.key === "Enter") {
        const index = Number(menuRef.current.getAttribute("data-active-index"));
        onSelect(index);
      } else if (shortcuts.has(e.key.toUpperCase())) {
        onSelect(indexBySC[e.key.toUpperCase()]);
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex]
  );
  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener);
    textarea.addEventListener("input", onClose);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
      textarea.removeEventListener("input", onClose);
    };
  }, [keydownListener, onClose]);
  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_RIGHT}
      content={
        <Menu ulRef={menuRef} data-active-index={activeIndex}>
          {NODE_LABELS.map((item, i) => {
            return (
              <MenuItem
                key={item.text}
                data-format={item.format}
                text={`${item.text} - (${item.shortcut})`}
                active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(i)}
              />
            );
          })}
        </Menu>
      }
    />
  );
};

export const render = (props: Props) => {
  const parent = document.createElement("span");
  const coords = getCoordsFromTextarea(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement.insertBefore(parent, props.textarea);
  ReactDOM.render(
    <NodeMenu
      {...props}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent
  );
};

export default NodeMenu;
