import {
  Alert,
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import React, { useCallback, useRef, useState } from "react";
import {
  createPage,
  getBasicTreeByParentUid,
  getCurrentPageUid,
  getGraph,
  getPageTitleByBlockUid,
  getPageTitleByPageUid,
} from "roam-client";
import { createOverlayRender, renderToast } from "roamjs-components";
import type { Panel } from "./util";

const SendBlockOverlay = ({
  onClose,
  sendChannel,
  onMessageHandlers,
}: {
  sendChannel: RTCDataChannel;
  onClose: () => void;
  onMessageHandlers: ((s: string) => void)[];
}) => {
  const [value, setValue] = useState(getCurrentPageUid());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      isOpen={true}
      onClose={onClose}
      canEscapeKeyClose
      canOutsideClickClose
      title={`Export Discourse Graph`}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Send Page
          <InputGroup
            disabled={true}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <span style={{ color: "darkred" }}>{error}</span>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
          <Button
            text={"Send"}
            disabled={loading}
            intent={Intent.PRIMARY}
            style={{ minWidth: 64 }}
            onClick={() => {
              setLoading(true);
              const tree = getBasicTreeByParentUid(value);
              const title = getPageTitleByPageUid(value);
              onMessageHandlers.push((s) => {
                const { success } = JSON.parse(s);
                if (success) {
                  onClose();
                  renderToast({
                    id: "roamjs-success-discourse",
                    content: "Successfully sent data to peer!",
                  });
                  onMessageHandlers.pop();
                } else {
                  setLoading(false);
                  setError("Received on unsuccessful message");
                }
              });
              sendChannel.send(
                JSON.stringify({ operation: "createPage", tree, title })
              );
            }}
          />
        </div>
      </div>
    </Dialog>
  );
};

const AlertCode = ({ code }: { code: React.MutableRefObject<string> }) => {
  const [text, setText] = useState("Copy");
  return code.current ? (
    <>
      <p>
        Clock the button below to copy the handshake code and send it to your
        peer
      </p>
      <p>
        <Button
          style={{ minWidth: 120 }}
          onClick={() => {
            window.navigator.clipboard.writeText(code.current);
            setText("Copied!");
          }}
        >
          {text}
        </Button>
      </p>
    </>
  ) : null;
};

const NetworkConfigPanel: Panel = ({ uid, parentUid }) => {
  const [setupDisabled, setSetupDisabled] = useState(false);
  const [connectDisabled, setConnectDisabled] = useState(false);
  const [disconnectDisabled, setDisconnectDisabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const alertOnConfirm = useRef<(s: string) => void>(() => {});
  const alertCode = useRef("");
  const [alertValue, setAlertValue] = useState("");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-evenly" }}>
        <Button
          onClick={() => {
            setLoading(true);
            setSetupDisabled(true);
            setConnectDisabled(true);
            const localConnection = new RTCPeerConnection();

            const sendChannel = localConnection.createDataChannel(getGraph());
            const onMessageHandlers: ((s: string) => void)[] = [];
            sendChannel.onmessage = (e) => {
              onMessageHandlers.forEach((handler) => handler(e.data));
            };
            sendChannel.onerror = (e) => {
              console.error(e);
            };
            sendChannel.onopen = () => {
              setLoading(false);
              setDisconnectDisabled(false);
              window.roamAlphaAPI.ui.commandPalette.addCommand({
                label: "Send Page",
                callback: () => {
                  createOverlayRender<{}>(
                    "roamjs-discource-send-block",
                    SendBlockOverlay
                  )({ sendChannel, onMessageHandlers });
                },
              });
            };
            sendChannel.onclose = () => {
              setLoading(false);
              setDisconnectDisabled(true);
              setSetupDisabled(false);
              setConnectDisabled(false);
              window.roamAlphaAPI.ui.commandPalette.removeCommand({
                label: "Send Page",
              });
            };
            Promise.all([
              new Promise((resolve) => {
                localConnection.onicecandidate = (c) => {
                  if (c.candidate) {
                    resolve(c.candidate);
                  }
                };
              }),
              localConnection.createOffer().then((offer) => {
                return localConnection
                  .setLocalDescription(offer)
                  .then(() => offer);
              }),
            ]).then(([candidate, offer]) => {
              alertCode.current = window.btoa(
                JSON.stringify({ type: offer.type, sdp: offer.sdp, candidate })
              );
              alertOnConfirm.current = (s) => {
                const { candidate, ...description } = JSON.parse(
                  window.atob(s)
                );
                localConnection.setRemoteDescription(description).then(() =>
                  localConnection.addIceCandidate(candidate).then(() => {
                    alertCode.current = "";
                    setAlertOpen(false);
                  })
                );
              };
              setAlertOpen(true);
            });
          }}
          disabled={setupDisabled}
        >
          Setup
        </Button>
        <Button
          disabled={connectDisabled}
          onClick={() => {
            setLoading(true);
            setSetupDisabled(true);
            setConnectDisabled(true);
            const remoteConnection = new RTCPeerConnection();
            remoteConnection.ondatachannel = (event) => {
              const receiveChannel = event.channel;
              receiveChannel.onmessage = (e) => {
                const { title, tree, operation } = JSON.parse(e.data);
                if (operation === "createPage") {
                  const uid = createPage({ title, tree });
                  window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
                  receiveChannel.send(JSON.stringify({ success: true }));
                }
              };
              receiveChannel.onopen = () => {
                setLoading(false);
                setDisconnectDisabled(false);
                alertCode.current = "";
              };
              receiveChannel.onclose = () => {
                setLoading(false);
                setDisconnectDisabled(true);
                setSetupDisabled(false);
                setConnectDisabled(false);
              };
            };
            setAlertOpen(true);
            Promise.all([
              new Promise((resolve) => {
                remoteConnection.onicecandidate = (c) => {
                  if (c.candidate) {
                    resolve(c.candidate);
                  }
                };
              }),
              new Promise<RTCSessionDescriptionInit>((resolve) => {
                alertOnConfirm.current = (s) => {
                  const { candidate, ...description } = JSON.parse(
                    window.atob(s)
                  );
                  remoteConnection
                    .setRemoteDescription(description)
                    .then(() => remoteConnection.addIceCandidate(candidate))
                    .then(() => remoteConnection.createAnswer())
                    .then((answer) =>
                      remoteConnection
                        .setLocalDescription(answer)
                        .then(() => resolve(answer))
                    );
                };
              }),
            ]).then(([candidate, answer]) => {
              alertCode.current = window.btoa(
                JSON.stringify({
                  type: answer.type,
                  sdp: answer.sdp,
                  candidate,
                })
              );
              setAlertOpen(false);
            });
          }}
        >
          Connect
        </Button>
        <Button
          disabled={disconnectDisabled}
          onClick={() => {
            setLoading(true);
            setDisconnectDisabled(true);
          }}
        >
          Disconnect
        </Button>
        <div style={{ minWidth: 40 }}>
          {loading && <Spinner size={SpinnerSize.SMALL} />}
        </div>
      </div>
      <AlertCode code={alertCode} />
      {alertOpen && (
        <Alert
          isOpen={alertOpen}
          onConfirm={() => alertOnConfirm.current(alertValue)}
        >
          <AlertCode code={alertCode} />
          <Label>
            Peer's Handshake Code
            <InputGroup
              value={alertValue}
              onChange={(e) => setAlertValue(e.target.value)}
            />
          </Label>
        </Alert>
      )}
    </div>
  );
};

export default NetworkConfigPanel;
