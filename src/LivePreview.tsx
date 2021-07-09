import { Position, Tooltip } from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { getPageUidByPageTitle } from "roam-client";

const TooltipContent = ({
  tag,
  open,
  close,
}: {
  tag: string;
  open: () => void;
  close: () => void;
}) => {
  const uid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    window.roamAlphaAPI.ui.components.renderBlock({
      uid,
      el: containerRef.current,
    });
    containerRef.current.parentElement.style.padding = "0";
  }, [uid, containerRef]);
  return (
    <div
      ref={containerRef}
      onMouseEnter={open}
      onMouseLeave={close}
      className={"roamjs-discourse-live-preview"}
    />
  );
};

const LivePreview = ({ tag }: { tag: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef(null);
  const open = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(true), 250);
  }, [setIsOpen, timeoutRef]);
  const close = useCallback(() => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsOpen(false), 250);
  }, [setIsOpen, timeoutRef]);
  useEffect(() => {
    if (!loaded) setLoaded(true);
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (loaded) {
      const pageref = spanRef.current.closest<HTMLSpanElement>(".rm-page-ref");
      pageref.addEventListener("mouseenter", open);
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
