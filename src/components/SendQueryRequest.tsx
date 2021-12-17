import {
  Button,
  Classes,
  Dialog,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import { useMemo, useState } from "react";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import PageInput from "roamjs-components/components/PageInput";
import type { RoamOverlayProps } from "roamjs-components/util/createOverlayRender";
import createOverlayRender from "roamjs-components/util/createOverlayRender";
import type { setupMultiplayer } from "../Multiplayer";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import { TreeNode } from "roamjs-components/types";
import { v4 } from "uuid";
import toRoamDateUid from "roamjs-components/date/toRoamDateUid";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";

type Props = Pick<
  ReturnType<typeof setupMultiplayer>,
  "sendToGraph" | "addGraphListener" | "removeGraphListener"
> & {
  graphs: string[];
  uid?: string;
};

const SendQueryRequest = ({
  onClose,
  graphs,
  uid,
  sendToGraph,
  addGraphListener,
  removeGraphListener,
}: RoamOverlayProps<Props>) => {
  const [loading, setLoading] = useState(false);
  const [graph, setGraph] = useState<string>(graphs[0]);
  const [page, setPage] = useState(() =>
    uid
      ? window.roamAlphaAPI
          .q(
            `[:find (pull ?p [:node/title]) :where [?r :block/uid "${uid}"] [?r :block/refs ?p]]`
          )
          .map((p) => (p[0]?.title as string) || "")
          .reduce((prev, cur) => (cur.length > prev.length ? cur : prev), "")
      : ""
  );
  const requestId = useMemo(() => v4(), []);
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Send Query Request`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Graph
          <MenuItemSelect
            items={graphs}
            activeItem={graph}
            onItemSelect={(et) => setGraph(et)}
          />
        </Label>
        <Label>
          Page
          <PageInput value={page} setValue={setPage} />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Request"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              sendToGraph({
                graph,
                operation: "QUERY_REQUEST",
                data: { page, requestId },
              });
              addGraphListener({
                operation: "QUERY_REQUEST_RECEIVED",
                handler: (_, g) => {
                  if (g === graph) {
                    renderToast({
                      id: "query-request-success",
                      content: `Query Successfully Requested From ${g}`,
                      intent: Intent.SUCCESS,
                    });
                    removeGraphListener({
                      operation: "QUERY_REQUEST_RECEIVED",
                    });
                    const operation = `QUERY_RESPONSE/${requestId}`;
                    addGraphListener({
                      operation,
                      handler: (json, g) => {
                        if (g === graph) {
                          const { page } = json as {
                            page: {
                              title: string;
                              tree: TreeNode[];
                              uid: string;
                            };
                          };
                          const pageUid = getPageUidByPageTitle(page.title);
                          if (pageUid) {
                            page.tree.forEach((node, order) =>
                              createBlock({ parentUid: pageUid, node, order })
                            );
                          } else {
                            createPage(page);
                          }
                          renderToast({
                            id: "query-response-success",
                            content: `New Query Response From ${g}!`,
                            intent: Intent.SUCCESS,
                          });
                          removeGraphListener({ operation });
                          sendToGraph({
                            graph,
                            operation: `QUERY_RESPONSE_RECEIVED/${requestId}`,
                          });
                          const todayUid = toRoamDateUid();
                          createBlock({
                            parentUid: todayUid,
                            node: {
                              text: `Received response for page ${page.title} from graph ${g}.`,
                            },
                            order: getChildrenLengthByPageUid(todayUid),
                          });
                        }
                      },
                    });
                    onClose();
                  }
                },
              });
            }}
            style={{ minWidth: 64 }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender<Props>(
  "send-query-request",
  SendQueryRequest
);
