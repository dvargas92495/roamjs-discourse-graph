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
        Click the button below to copy the handshake code and send it to your
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

// These RTC objects are not JSON serializable -.-
const serialize = ({
  candidates,
  description,
}: {
  candidates: RTCIceCandidate[];
  description: RTCSessionDescriptionInit;
}) =>
  window.btoa(
    JSON.stringify({
      description: {
        type: description.type,
        sdp: description.sdp,
      },
      candidates: candidates.map((c) => c.toJSON()),
    })
  );

const deserialize = (
  s: string
): {
  candidates: RTCIceCandidate[];
  description: RTCSessionDescriptionInit;
} => JSON.parse(window.atob(s));

const gatherCandidates = (con: RTCPeerConnection) => {
  const candidates: RTCIceCandidate[] = [];
  return new Promise<RTCIceCandidate[]>((resolve) => {
    con.onicegatheringstatechange = (e) =>
      (e.target as RTCPeerConnection).iceGatheringState === "complete" &&
      resolve(candidates);
    con.onicecandidate = (c) => {
      if (c.candidate) {
        candidates.push(c.candidate);
      }
    };
  });
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
            const localConnection = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

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
              gatherCandidates(localConnection),
              localConnection.createOffer().then((offer) => {
                return localConnection.setLocalDescription(offer);
              }),
            ]).then(([candidates]) => {
              alertCode.current = serialize({
                candidates,
                description: localConnection.localDescription,
              });
              alertOnConfirm.current = (s) => {
                const { candidates, description } = deserialize(s);
                localConnection
                  .setRemoteDescription(new RTCSessionDescription(description))
                  .then(() =>
                    Promise.all(
                      candidates.map((c) =>
                        localConnection.addIceCandidate(new RTCIceCandidate(c))
                      )
                    ).then(() => {
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
            const remoteConnection = new RTCPeerConnection({
              iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
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
                alertCode.current = "";
                setLoading(false);
                setDisconnectDisabled(false);
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
              gatherCandidates(remoteConnection),
              new Promise<void>((resolve) => {
                alertOnConfirm.current = (s) => {
                  const { candidates, description } = deserialize(s);
                  remoteConnection
                    .setRemoteDescription(
                      new RTCSessionDescription(description)
                    )
                    .then(() =>
                      Promise.all(
                        candidates.map((c) =>
                          remoteConnection.addIceCandidate(
                            new RTCIceCandidate(c)
                          )
                        )
                      )
                    )
                    .then(() => remoteConnection.createAnswer())
                    .then((answer) =>
                      remoteConnection.setLocalDescription(answer).then(resolve)
                    );
                };
              }),
            ]).then(([candidates]) => {
              alertCode.current = serialize({
                candidates,
                description: remoteConnection.localDescription,
              });
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
          canOutsideClickCancel
     //     onClose={() => setAlertOpen(false)}
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
