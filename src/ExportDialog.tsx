import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useState } from "react";
import {
  getGraph,
  getPageTitlesAndUidsDirectlyReferencingPage,
} from "roam-client";
import { createOverlayRender } from "roamjs-components";
import { getNodes } from "./util";
import format from "date-fns/format";
import download from "downloadjs";
import JSZip from "jszip";

const ExportDialog = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filename, setFilename] = useState(
    `${getGraph()}_discourse-graph_${format(new Date(), "yyyyMMddhhmm")}`
  );
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Discourse Graph to CSV`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Filename
          <InputGroup
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"export"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                const zip = new JSZip();
                const nodeHeader = "uid:ID,label:LABEL,title\n";
                const nodeData = getNodes().flatMap((n) =>
                  getPageTitlesAndUidsDirectlyReferencingPage(n.abbr).map(
                    ({ title, uid }) => {
                      const value = title.replace(/\[\[[A-Z]{3}\]\] - /,'');
                      return `${uid},${n.text.toUpperCase()},${
                        value.includes(",") ? `"${value}"` : value
                      }`}
                  )
                ).join("\n");
                zip.file(
                  `${filename.replace(/\.csv/, "")}_nodes.csv`,
                  `${nodeHeader}${nodeData}`
                );

                const relationHeader = "start:START_ID,end:END_ID,label:TYPE\n";
                const informs = window.roamAlphaAPI
                  .q(
                    `[:find ?cu ?qu :where [?c :block/uid ?cu] [?q :block/uid ?qu] [?nc :node/title "CLM"] [?c :block/refs ?nc] [?b :block/refs ?c] [?q :block/children ?b] [?q :block/refs ?n] [?n :node/title "QUE"]]`
                  )
                  .map(([start, end]) => `${start},${end},INFORMS`)
                  .join("\n");
                zip.file(
                  `${filename.replace(/\.csv/, "")}_relations.csv`,
                  `${relationHeader}${informs}`
                );

                zip.generateAsync({ type: "blob" }).then((content) => {
                  download(content, `${filename}.zip`, "application/zip");
                  onClose();
                });
              }, 1);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender<{}>("discourse-export", ExportDialog);

export default ExportDialog;
