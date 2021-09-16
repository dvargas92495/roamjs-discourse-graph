import {
  Button,
  Classes,
  Dialog,
  FileInput,
  Intent,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useMemo, useState } from "react";
import {
  createBlock,
  createPage,
  getChildrenLengthByPageUid,
  InputTextNode,
  toRoamDateUid,
} from "roam-client";
import { createOverlayRender } from "roamjs-components";

const ImportDialog = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File>();
  const title = useMemo(() => value.split(/[/\\]/).slice(-1)[0], [value]);
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Import Discourse Graph`}
    >
      <div className={Classes.DIALOG_BODY}>
        <FileInput
          text="Choose file..."
          onInputChange={(e) => {
            setValue((e.target as HTMLInputElement).value);
            setFile((e.target as HTMLInputElement).files[0]);
          }}
          inputProps={{
            accept: "application/json",
            value,
          }}
        />
        <div>{value.split(/[/\\]/).slice(-1)[0]}</div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Import"}
            intent={Intent.PRIMARY}
            onClick={() => {
              setLoading(true);
              setTimeout(() => {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const { grammar, nodes, relations } = JSON.parse(
                    event.target.result as string
                  );
                  const pagesByUids = Object.fromEntries(
                    nodes.map(({ uid, title }: Record<string, string>) => [
                      uid,
                      title,
                    ])
                  );
                  createPage({
                    title,
                    tree: relations.map(
                      ({ source, target, label }: Record<string, string>) => ({
                        text: `[[${pagesByUids[source]}]]`,
                        children: [
                          {
                            text: label,
                            children: [
                              {
                                text: `[[${pagesByUids[target]}]]`,
                              },
                            ],
                          },
                        ],
                      })
                    ),
                  });
                  nodes.forEach(
                    (node: { title: string; children: InputTextNode[] }) =>
                      createPage({ title: node.title, tree: node.children })
                  );
                  const parentUid = toRoamDateUid(new Date());
                  createBlock({
                    node: { text: `[[${title}]]` },
                    parentUid,
                    order: getChildrenLengthByPageUid(parentUid),
                  });
                  console.log(grammar);
                };
                reader.readAsText(file);
              }, 1);
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const render = createOverlayRender("discourse-import", ImportDialog);

export default ImportDialog;
