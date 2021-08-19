import { Button, Tooltip } from "@blueprintjs/core";
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
    document
      .getElementById("roamjs-discourse-live-preview-container")
      ?.remove?.();
    if (numChildren) {
      const el = document.createElement("div");
      el.id = "roamjs-discourse-live-preview-container";
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
      });
      containerRef.current.appendChild(el);
      containerRef.current.parentElement.style.padding = "0";
    }
  }, [uid, containerRef, numChildren]);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={(e) => open(e.ctrlKey)}
      onMouseLeave={close}
    >
      {!!numChildren && (
        <Button
          minimal
          style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
          icon={"zoom-in"}
          onClick={() => setSizeIndex(sizeIndex + 1)}
        />
      )}
      <div
        ref={containerRef}
        className={"roamjs-discourse-live-preview"}
        style={{
          paddingTop: numChildren ? 16 : 0,
          maxWidth: size,
          maxHeight: size,
        }}
      >
        {!numChildren && <span>Page <i>{tag}</i> is empty.</span>}
      </div>
    </div>
  );
};

export type Props = {
  tag: string;
  registerMouseEvents: (a: {
    open: (ctrl: boolean) => void;
    close: () => void;
    span: HTMLSpanElement;
  }) => void;
};

const LivePreview = ({ tag, registerMouseEvents }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const spanRef = useRef<HTMLSpanElement>(null);
  const openRef = useRef<boolean>(false);
  const timeoutRef = useRef(null);
  const open = useCallback(
    (ctrlKey: boolean) => {
      if (ctrlKey || timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setIsOpen(true);
          openRef.current = true;
          timeoutRef.current = null;
        }, 100);
      }
    },
    [setIsOpen, timeoutRef, openRef]
  );
  const close = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (openRef.current) {
      timeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        openRef.current = false;
        timeoutRef.current = null;
      }, 1000);
    }
  }, [setIsOpen, timeoutRef, openRef]);
  useEffect(() => {
    if (!loaded) setLoaded(true);
  }, [loaded, setLoaded]);
  useEffect(() => {
    if (loaded) {
      registerMouseEvents({ open, close, span: spanRef.current });
    }
  }, [spanRef, loaded, close, open, registerMouseEvents]);
  const ref = useRef<Tooltip>(null);
  useEffect(() => {
    ref.current.reposition();
  }, [tag]);
  return (
    <Tooltip
      content={<TooltipContent tag={tag} open={open} close={close} />}
      placement={"right"}
      isOpen={isOpen}
      ref={ref}
    >
      <span ref={spanRef} />
    </Tooltip>
  );
};

export const render = ({
  parent,
  ...props
}: {
  parent: HTMLSpanElement;
} & Props) => ReactDOM.render(<LivePreview {...props} />, parent);

export default LivePreview;
