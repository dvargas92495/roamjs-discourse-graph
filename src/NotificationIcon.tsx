import { Classes, Drawer, Position } from "@blueprintjs/core";
import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { getDisplayNameByUid } from "roam-client";

type Props = {
  parentUid: string;
  timestamp: number;
};

const idRef: Record<string, string> = {};

const getUserIdentifier = (uid: string) =>
  idRef[uid] || (idRef[uid] = getDisplayNameByUid(uid)) || (idRef[uid] = uid);

const getPixelValue = (el: HTMLElement, field: "width" | "paddingLeft") =>
  Number((getComputedStyle(el)[field] || "0px").replace(/px$/, ""));

const NotificationIcon = ({ parentUid, timestamp }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newBlocks, setNewBlocks] = useState<
    { uid: string; text: string; editedBy: string; editedTime: number }[]
  >([]);
  useEffect(() => {
    setNewBlocks(
      window.roamAlphaAPI
        .q(
          `[:find ?u ?s ?w ?t :where [?b :edit/time ?t] [(<= ${timestamp} ?t)] [?user :user/uid ?w] [?b :edit/user ?user] [?b :block/uid ?u] [?b :block/string ?s] [?b :block/parents ?p] [?p :block/uid "${parentUid}"]]`
        )
        .map(([uid, text, editedBy, editedTime]) => ({
          uid,
          text,
          editedBy,
          editedTime,
        }))
    );
  }, [setNewBlocks]);
  const [width, setWidth] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const width = getPixelValue(drawerRef.current, "width");
        const paddingLeft = getPixelValue(
          document.querySelector(".rm-article-wrapper"),
          "paddingLeft"
        );
        setWidth(width - paddingLeft);
      }, 1);
    } else {
      setWidth(0);
    }
  }, [drawerRef, setWidth, isOpen]);
  return (
    <>
      <span
        onClick={() => setIsOpen(true)}
        style={{
          backgroundColor: "#cc7711",
          width: 12,
          height: 12,
          borderRadius: "50%",
          display: "inline-block",
          cursor: "pointer",
        }}
      />
      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={"Notifications"}
        position={Position.LEFT}
        canEscapeKeyClose
        isCloseButtonShown
        hasBackdrop={false}
        portalClassName={"roamjs-discourse-notification-drawer"}
      >
        <style>
          {`.roam-article {
  margin-left: ${width}px;
}`}
        </style>
        <div className={Classes.DRAWER_BODY} ref={drawerRef}>
          {newBlocks
            .sort(({ editedTime: a }, { editedTime: b }) => b - a)
            .map((b) => (
              <div
                key={b.uid}
                style={{ borderTop: "1px solid #88888880", padding: "0 4px" }}
              >
                <p style={{ marginTop: 2, fontSize: 12 }}>
                  <b>{getUserIdentifier(b.editedBy)}</b> edited block{" "}
                  <span
                    className={"roamjs-discourse-notification-uid"}
                    onClick={() => {
                      window.roamAlphaAPI
                        .q(
                          `[:find ?u ?o :where [?p :block/uid ?u] [?b :block/parents ?p] [?p :block/open ?o] [?b :block/uid "${b.uid}"]]`
                        )
                        .forEach(
                          ([uid, openState]) =>
                            !openState &&
                            window.roamAlphaAPI.updateBlock({
                              block: { uid, open: true },
                            })
                        );
                      setTimeout(() => {
                        const blockDiv = Array.from(
                          document.querySelectorAll<HTMLDivElement>(
                            ".roam-article .roam-block"
                          )
                        ).find(
                          (d) =>
                            d.id.endsWith(b.uid) &&
                            !d.closest(".rm-inline-reference")
                        );
                        if (blockDiv) {
                          blockDiv.focus();
                          blockDiv.style.border = "1px solid #000000";
                          blockDiv.style.borderRadius = "4px";
                          blockDiv.style.transition = "unset";
                          setTimeout(() => {
                            blockDiv.style.borderColor = "#FFFFFF";
                            blockDiv.style.transition = "border-color 5s ease";
                          }, 1);
                        }
                      }, 1);
                    }}
                  >
                    {b.uid}
                  </span>{" "}
                  at <i>{new Date(b.editedTime).toLocaleString()}</i> to:
                </p>
                <p style={{ marginTop: 4, fontSize: 10 }}>{b.text}</p>
              </div>
            ))}
        </div>
      </Drawer>
    </>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<NotificationIcon {...props} />, p);

export default NotificationIcon;
