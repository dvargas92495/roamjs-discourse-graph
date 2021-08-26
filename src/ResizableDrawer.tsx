import { Drawer, Position, Classes } from "@blueprintjs/core";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getPixelValue } from "./util";

const ResizableDrawer = ({
  onClose,
  children,
  title = "Resizable Drawer",
}: {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}) => {
  const [width, setWidth] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const calculateWidth = useCallback(() => {
    const width = getPixelValue(drawerRef.current, "width");
    const paddingLeft = getPixelValue(
      document.querySelector(".rm-article-wrapper"),
      "paddingLeft"
    );
    setWidth(width - paddingLeft);
  }, [setWidth, drawerRef]);
  useEffect(() => {
    setTimeout(calculateWidth, 1);
  }, [calculateWidth]);
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      drawerRef.current.parentElement.style.width = `${Math.max(
        e.clientX,
        100
      )}px`;
      calculateWidth();
    },
    [calculateWidth, drawerRef]
  );
  const onMouseUp = useCallback(() => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);
  const onMouseDown = useCallback(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onMouseMove, onMouseUp]);
  return (
    <Drawer
      isOpen={true}
      isCloseButtonShown
      onClose={onClose}
      position={Position.LEFT}
      title={title}
      hasBackdrop={false}
      canOutsideClickClose={false}
      canEscapeKeyClose
      portalClassName={"roamjs-discourse-drawer"}
      enforceFocus={false}
    >
      <style>{`
        .roam-article {
          margin-left: ${width}px;
        }
        `}</style>
      <div
        className={Classes.DRAWER_BODY}
        ref={drawerRef}
        style={{ padding: 8 }}
      >
        {children}
      </div>
      <div
        style={{
          width: 4,
          cursor: "ew-resize",
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
        }}
        onMouseDown={onMouseDown}
      />
    </Drawer>
  );
};

export default ResizableDrawer;
