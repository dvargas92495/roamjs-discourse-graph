import { Button, Position, Tooltip } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { getChildrenLengthByPageUid, getPageUidByPageTitle } from "roam-client";

const sizes = [300, 400, 500, 600];

const TooltipContent = ({
  tag,
  open,
  close,
}: {
  tag: string;
  open: (e: boolean) => void;
  close: () => void;
}) => {
  const uid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const numChildren = useMemo(() => getChildrenLengthByPageUid(uid), [uid]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizeIndex, setSizeIndex] = useState(0);
  const size = useMemo(() => sizes[sizeIndex % sizes.length], [sizeIndex]);
  useEffect(() => {
    if (numChildren) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el: containerRef.current,
      });
      containerRef.current.parentElement.style.padding = "0";
    }
  }, [uid, containerRef, numChildren]);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={(e) => open(e.ctrlKey)}
      onMouseLeave={close}
    >
      <Button
        minimal
        style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
        icon={"zoom-in"}
        onClick={() => setSizeIndex(sizeIndex + 1)}
      />
      <div
        ref={containerRef}
        className={"roamjs-discourse-live-preview"}
        style={{
          paddingTop: numChildren ? 16 : 0,
          maxWidth: size,
          maxHeight: size,
        }}
      >
        {!numChildren && <i>Page is empty.</i>}
      </div>
    </div>
  );
};

const LivePreview = ({ tag }: { tag: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef(null);
  const open = useCallback(
    (ctrlKey: boolean) => {
      if (ctrlKey || timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setIsOpen(true);
          timeoutRef.current = null;
        }, 100);
      }
    },
    [setIsOpen, timeoutRef]
  );
  const close = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      timeoutRef.current = null;
    }, 1000);
  }, [setIsOpen, timeoutRef]);
  useEffect(() => {
    if (!loaded) setLoaded(true);
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (loaded) {
      const pageref = spanRef.current.closest<HTMLSpanElement>(".rm-page-ref");
      pageref.addEventListener("mouseenter", (e) => open(e.ctrlKey));
      pageref.addEventListener("mouseleave", close);
    }
  }, [spanRef, loaded, setIsOpen]);
  return (
    <Tooltip
      content={<TooltipContent tag={tag} open={open} close={close} />}
      placement={"right"}
      isOpen={isOpen}
    >
      <span ref={spanRef} />
    </Tooltip>
  );
};

export const render = ({
  parent,
  tag,
}: {
  parent: HTMLSpanElement;
  tag: string;
}) => ReactDOM.render(<LivePreview tag={tag} />, parent);
