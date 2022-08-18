import { Button, Classes, Drawer, Position } from "@blueprintjs/core";
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { PullBlock } from "roamjs-components/types";
import updateBlock from "roamjs-components/writes/updateBlock";
import { getPixelValue } from "./util";

type Props = {
  parentUid: string;
  timestamp: number;
  configUid: string;
};

const idRef: Record<string, string> = {};

const getOtherUserIdentifier = (uid: string) =>
  idRef[uid] || (idRef[uid] = getDisplayNameByUid(uid)) || (idRef[uid] = uid);

const NotificationIcon = ({ parentUid, timestamp, configUid }: Props) => {
  const me = useMemo(getCurrentUserUid, []);
  const [isOpen, setIsOpen] = useState(false);
  const [newBlocks, setNewBlocks] = useState<
    { uid: string; text: string; editedBy: string; editedTime: number }[]
  >([]);
  useEffect(() => {
    setNewBlocks(
      (
        window.roamAlphaAPI.q(
          `[:find ?u ?s ?w ?t :where [?b :edit/time ?t] [(< ${timestamp} ?t)] [?user :user/uid ?w] [(!= ?w "${me}")] [?b :edit/user ?user] [?b :block/uid ?u] [?b :block/string ?s] [?b :block/parents ?p] [?p :block/uid "${parentUid}"]]`
        ) as [string, string, string, number][]
      )
        .map(([uid, text, editedBy, editedTime]) => ({
          uid,
          text,
          editedBy,
          editedTime,
        }))
        .sort(({ editedTime: a }, { editedTime: b }) => a - b)
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
          display: newBlocks.length ? "inline-block" : "none",
          cursor: "pointer",
        }}
      />
      <Drawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={"Notifications"}
        position={Position.LEFT}
        canEscapeKeyClose
        canOutsideClickClose={false}
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
          {newBlocks.length ? (
            newBlocks.map((b) => (
              <div
                key={b.uid}
                style={{
                  borderTop: "1px solid #88888880",
                  padding: "0 4px",
                  position: "relative",
                }}
              >
                <p style={{ marginTop: 2, fontSize: 12 }}>
                  <b>{getOtherUserIdentifier(b.editedBy)}</b> edited block{" "}
                  <span
                    className={"roamjs-discourse-notification-uid"}
                    onClick={() => {
                      (
                        window.roamAlphaAPI.data.fast.q(
                          `[:find (pull ?p [:block/uid :block/open]) :where [?b :block/uid "${b.uid}"] [?b :block/parents ?p]]`
                        ) as [PullBlock][]
                      ).forEach(
                        ([
                          { [":block/uid"]: uid, [":block/open"]: openState },
                        ]) =>
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
                      }, 100);
                    }}
                  >
                    {b.uid}
                  </span>{" "}
                  at <i>{new Date(b.editedTime).toLocaleString()}</i> to:
                </p>
                <p style={{ marginTop: 4, fontSize: 10 }}>{b.text}</p>
                <Button
                  icon={"cross"}
                  minimal
                  onClick={() => {
                    const existingTimestamp =
                      Number(getTextByBlockUid(configUid)) || timestamp;
                    updateBlock({
                      text: `${Math.max(b.editedTime, existingTimestamp)}`,
                      uid: configUid,
                    });
                    setNewBlocks(newBlocks.filter((bb) => b.uid !== bb.uid));
                  }}
                  style={{ position: "absolute", top: 4, right: 4 }}
                />
              </div>
            ))
          ) : (
            <p style={{ padding: 8 }}>All Caught Up!</p>
          )}
        </div>
      </Drawer>
    </>
  );
};

export const render = ({ p, ...props }: { p: HTMLElement } & Props) =>
  ReactDOM.render(<NotificationIcon {...props} />, p);

export default NotificationIcon;
