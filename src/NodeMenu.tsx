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
  getTextByBlockUid,
  getUids,
  updateBlock,
} from "roam-client";

type Props = {
  textarea: HTMLTextAreaElement;
};

const menuItems = [
  { text: "Claim", shortcut: "C", abbr: "CLM" },
  { text: "Question", shortcut: "Q", abbr: "QUE" },
  { text: "Evidence", shortcut: "E", abbr: "EVD" },
  { text: "Source", shortcut: "S", abbr: "SOU" },
  { text: "Excerpt", shortcut: "X", abbr: "EXC" },
  { text: "Author", shortcut: "A", abbr: "AUT" },
];

const indexBySC = Object.fromEntries(
  menuItems.map((mi, i) => [mi.shortcut, i])
);

const shortcuts = new Set(Object.keys(indexBySC));

const NodeMenu = ({ onClose, textarea }: { onClose: () => void } & Props) => {
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const onSelect = useCallback(
    (index) => {
      const abbr = menuRef.current.children[index]
        .querySelector(".bp3-menu-item")
        .getAttribute("data-abbr");
      const text = getTextByBlockUid(blockUid);
      const newText = `${text.substring(
        0,
        textarea.selectionStart - 1
      )}[]([[[[${abbr}]] - ]])${text.substring(textarea.selectionStart)}`;
      updateBlock({ text: newText, uid: blockUid });
      setTimeout(() => {
        textarea.setSelectionRange(
          textarea.selectionStart + 1,
          textarea.selectionEnd + 1
        );
      }, 1);
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
          {menuItems.map((item, i) => {
            return (
              <MenuItem
                key={item.text}
                data-abbr={item.abbr}
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
