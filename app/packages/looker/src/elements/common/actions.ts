/**
 * Copyright 2017-2021, Voxel51, Inc.
 */

import { SCALE_FACTOR } from "../../constants";
import {
  BaseState,
  Control,
  ControlMap,
  StateUpdate,
  VideoState,
} from "../../state";
import { clampScale } from "../../util";
import { BaseElement, Events } from "../base";
import { getFrameNumber } from "../util";

import {
  lookerHelpPanelItems,
  lookerShortcutValue,
  lookerShortcutTitle,
  lookerShortcutDetail,
} from "./actions.module.css";
import {
  lookerPanel,
  lookerPanelContainer,
  lookerPanelHeader,
  lookerPanelVerticalContainer,
  lookerPanelClose,
  lookerPanelFlex,
} from "./panel.module.css";
import { dispatchTooltipEvent } from "./util";
import closeIcon from "../../icons/close.svg";

const readActions = <State extends BaseState>(
  actions: ControlMap<State>
): ControlMap<State> => {
  return Object.fromEntries(
    Object.entries(actions).reduce((acc, [_, v]) => {
      if (Array.isArray(v.eventKeys)) {
        return [...acc, ...v.eventKeys.map((key) => [key, v])];
      }

      return [...acc, [v.eventKeys || v.shortcut, v]];
    }, [])
  );
};

const escape: Control = {
  title: "Escape context",
  shortcut: "Esc",
  eventKeys: "Escape",
  detail: "Escape the current context",
  action: (update, dispatchEvent, eventKey) => {
    update(
      ({
        hasDefaultZoom,
        showHelp,
        showOptions,
        options: { fullscreen: fullscreenSetting, showJSON, selectedLabels },
      }) => {
        if (showHelp) {
          return { showHelp: false };
        }

        if (showOptions) {
          return { showOptions: false };
        }

        if (showJSON) {
          dispatchEvent("options", { showJSON: false });
          return { options: { showJSON: false } };
        }

        if (!hasDefaultZoom) {
          return {
            setZoom: true,
          };
        }

        if (fullscreenSetting) {
          fullscreen.action(update, dispatchEvent, eventKey);
          return {};
        }

        if (selectedLabels.length) {
          dispatchEvent("clear");
          return {};
        }

        dispatchEvent("close");
        return {};
      }
    );
  },
};

export const controls: Control = {
  title: "Show controls",
  shortcut: "c",
  detail: "Show the conrols bar and navigation arrows",
  action: (update) => {
    update(({ config: { thumbnail }, showControls }) => {
      if (thumbnail) {
        return {};
      }

      return {
        showControls: !showControls,
        disableControls: showControls,
        showOptions: false,
      };
    });
  },
};

export const wheel: Control = {
  title: "Zoom",
  shortcut: "Wheel",
  eventKeys: null,
  detail: "Zoom in and out",
  action: () => null,
};

export const next: Control = {
  title: "Next sample",
  shortcut: "&#8594;",
  eventKeys: "ArrowRight",
  detail: "Go to the next sample",
  action: (_, dispatchEvent) => {
    dispatchEvent("next");
  },
};

export const previous: Control = {
  title: "Previous sample",
  shortcut: "&#8592;",
  eventKeys: "ArrowLeft",
  detail: "Go to the previous sample",
  action: (_, dispatchEvent) => {
    dispatchEvent("previous");
  },
};

export const rotatePrevious: Control = {
  title: "Rotate label forward",
  shortcut: "&#8595;",
  eventKeys: "ArrowUp",
  detail: "Rotate the bottom label to the back",
  action: (update, dispatchEvent) =>
    update(
      ({ disableOverlays, rotate }) => {
        if (!disableOverlays) {
          return { rotate: Math.max(0, rotate - 1) };
        }
        return {};
      },
      (state, overlays) => {
        dispatchTooltipEvent(dispatchEvent)(state, overlays);
      }
    ),
};

export const rotateNext: Control = {
  title: "Rotate label backward",
  shortcut: "&#8593;",
  eventKeys: "ArrowDown",
  detail: "Rotate the current label to the back",
  action: (update, dispatchEvent) =>
    update(
      ({ disableOverlays, rotate }) => {
        if (!disableOverlays) {
          return {
            rotate: rotate + 1,
          };
        }
        return {};
      },
      (state, overlays) => {
        dispatchTooltipEvent(dispatchEvent)(state, overlays);
      }
    ),
};

export const help: Control = {
  title: "Display help",
  eventKeys: ["/", "?"],
  shortcut: "?",
  detail: "Display this help window",
  action: (update, dispatchEvent) => {
    update(({ showHelp, config: { thumbnail } }) => {
      if (thumbnail) {
        return {};
      }

      if (!showHelp) {
        dispatchEvent("options", { showJSON: false });
        return { showHelp: true, options: { showJSON: false } };
      }

      return { showHelp: false };
    });
  },
};

export const zoomIn: Control = {
  title: "Zoom in",
  eventKeys: ["+", "="],
  shortcut: "+",
  detail: "Zoom in on the sample",
  action: (update) => {
    update(
      ({
        scale,
        windowBBox: [_, __, ww, wh],
        config: { dimensions },
        pan: [px, py],
        options: { zoomPad },
      }) => {
        const x = ww / 2;
        const y = wh / 2;

        const xs = (x - px) / scale;
        const ys = (y - py) / scale;

        const newScale = clampScale(
          [ww, wh],
          dimensions,
          scale * SCALE_FACTOR,
          zoomPad
        );
        return {
          scale: newScale,
          pan: [x - xs * newScale, y - ys * newScale],
        };
      }
    );
  },
};

export const zoomOut: Control = {
  title: "Zoom  out",
  eventKeys: ["-", "_"],
  shortcut: "-",
  detail: "Zoom out on the sample",
  action: (update) => {
    update(
      ({
        scale,
        windowBBox: [_, __, ww, wh],
        config: { dimensions },
        pan: [px, py],
        options: { zoomPad },
      }) => {
        const x = ww / 2;
        const y = wh / 2;

        const xs = (x - px) / scale;
        const ys = (y - py) / scale;

        const newScale = clampScale(
          [ww, wh],
          dimensions,
          scale / SCALE_FACTOR,
          zoomPad
        );
        return {
          scale: newScale,
          pan: [x - xs * newScale, y - ys * newScale],
        };
      }
    );
  },
};

export const cropToContent: Control = {
  title: "Crop to content",
  shortcut: "z",
  detail: "Crop on visible labels",
  action: (update) => {
    update(({ disableOverlays }) => ({ zoomToContent: !disableOverlays }));
  },
};

export const resetZoom: Control = {
  title: "Reset zoom",
  shortcut: "r",
  detail: "Reset zoom to default",
  action: (update) => {
    update({ setZoom: true });
  },
};

export const settings: Control = {
  title: "Settings",
  shortcut: "s",
  detail: "Toggle the settings panel",
  action: (update) => {
    update(({ showOptions, config: { thumbnail } }) => {
      if (thumbnail) {
        return {};
      } else if (showOptions) {
        return {
          showOptions: false,
          disableControls: false,
        };
      } else {
        return {
          disableControls: false,
          showControls: true,
          showOptions: true,
        };
      }
    });
  },
};

export const controlsToggle: Control = {
  title: "Controls",
  shortcut: "c",
  detail: "Toggle controls",
  action: (update) => {
    update(({ config: { thumbnail }, showControls }) => {
      if (thumbnail) {
        return {};
      } else if (showControls) {
        return {
          showControls: false,
          disableControls: false,
        };
      } else {
        return {
          disableControls: false,
          showControls: true,
        };
      }
    });
  },
};

export const fullscreen: Control = {
  title: "Fullscreen",
  shortcut: "f",
  detail: "Toggle fullscreen mode",
  action: (update, dispatchEvent) => {
    update(
      ({ config: { thumbnail }, options: { fullscreen } }) =>
        thumbnail ? {} : { options: { fullscreen: !fullscreen } },
      ({ config: { thumbnail }, options: { fullscreen } }) => {
        if (!thumbnail) {
          dispatchEvent("fullscreen", fullscreen);
        }
      }
    );
  },
};

export const json: Control = {
  title: "JSON",
  shortcut: "j",
  detail: "View JSON",
  action: (update, dispatchEvent) => {
    let newJSON = null;
    update(
      ({ disableOverlays, config: { thumbnail }, options: { showJSON } }) => {
        if (thumbnail) {
          return {};
        }

        newJSON = disableOverlays ? false : !showJSON;

        if (newJSON) {
          return { showHelp: false, options: { showJSON: newJSON } };
        }

        return { options: { showJSON: false } };
      }
    );
    newJSON !== null && dispatchEvent("options", { showJSON: newJSON });
  },
};

export const COMMON = {
  escape,
  next,
  previous,
  rotateNext,
  rotatePrevious,
  help,
  zoomIn,
  zoomOut,
  cropToContent,
  resetZoom,
  controlsToggle,
  settings,
  fullscreen,
  json,
  wheel,
};

export const COMMON_SHORTCUTS = readActions(COMMON);

export const nextFrame: Control<VideoState> = {
  title: "Next frame",
  eventKeys: [".", ">"],
  shortcut: ">",
  detail: "Seek to the next frame",
  action: (update, dispatchEvent) => {
    update(
      ({
        frameNumber,
        duration,
        playing,
        config: { frameRate, support, thumbnail },
        lockedToSupport,
      }) => {
        if (playing || thumbnail) {
          return {};
        }
        const end = lockedToSupport
          ? support[1]
          : getFrameNumber(duration, duration, frameRate);

        return {
          frameNumber: Math.min(end, frameNumber + 1),
        };
      },
      (state, overlays) => dispatchTooltipEvent(dispatchEvent)(state, overlays)
    );
  },
};

export const previousFrame: Control<VideoState> = {
  title: "Previous frame",
  eventKeys: [",", "<"],
  shortcut: "<",
  detail: "Seek to the previous frame",
  action: (update, dispatchEvent) => {
    update(
      ({
        frameNumber,
        playing,
        config: { support, thumbnail },
        lockedToSupport,
      }) => {
        if (playing || thumbnail) {
          return {};
        }
        return {
          frameNumber: Math.max(
            lockedToSupport ? support[0] : 1,
            frameNumber - 1
          ),
        };
      },
      (state, overlays) => dispatchTooltipEvent(dispatchEvent)(state, overlays)
    );
  },
};

export const playPause: Control<VideoState> = {
  title: "Play / pause",
  shortcut: "Space",
  eventKeys: " ",
  detail: "Play or pause the video",
  action: (update, dispatchEvent) => {
    update(
      ({
        frameNumber,
        playing,
        duration,
        config: { frameRate, support, thumbnail },
        lockedToSupport,
      }) => {
        if (thumbnail) {
          return {};
        }
        const start = lockedToSupport ? support[0] : 1;
        const end = lockedToSupport
          ? support[1]
          : getFrameNumber(duration, duration, frameRate);

        dispatchEvent("options", { showJSON: false });
        return {
          playing: !playing && start !== end,
          frameNumber:
            end === frameNumber
              ? lockedToSupport
                ? support[0]
                : 1
              : frameNumber,
          options: { showJSON: false },
        };
      }
    );
  },
};

export const muteUnmute: Control<VideoState> = {
  title: "Mute / unmute",
  shortcut: "m",
  detail: "Mute or unmute the video",
  action: (update, dispatchEvent) => {
    update(({ options: { volume }, config: { thumbnail } }) => {
      if (thumbnail) {
        return {};
      }

      volume = volume === 0 ? 0.5 : 0;

      dispatchEvent("options", { volume });

      return {
        options: { volume },
      };
    });
  },
};

export const resetPlaybackRate: Control<VideoState> = {
  title: "Reset playback rate",
  shortcut: "p",
  detail: "Reset the video's playback rate",
  action: (update, dispatchEvent) => {
    update(({ config: { thumbnail } }) => {
      if (thumbnail) {
        return {};
      }

      dispatchEvent("options", { playbackRate: 1 });

      return {
        options: { playbackRate: 1 },
      };
    });
  },
};

const seekTo: Control<VideoState> = {
  title: "Seek to",
  detail: "Seek to 0%, 10%, 20%... of the video",
  shortcut: "0-9",
  eventKeys: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  action: (update, dispatchEvent, eventKey) => {
    update(({ duration, config: { frameRate } }) => {
      const total = getFrameNumber(duration, duration, frameRate);
      dispatchEvent("options", { showJSON: false });
      return {
        frameNumber: Math.max(
          1,
          Math.round((parseInt(eventKey, 10) / 10) * total)
        ),
        options: { showJSON: false },
      };
    });
  },
};

export const supportLock: Control<VideoState> = {
  title: "Support lock",
  filter: (config) => Boolean(config.support),
  detail: "Toggle the lock on the support frame(s)",
  shortcut: "l",
  action: (update) => {
    update(({ lockedToSupport, config: { support } }) => {
      return {
        lockedToSupport: support ? !lockedToSupport : false,
      };
    });
  },
};

const videoEscape: Control<VideoState> = {
  title: "Escape context",
  shortcut: "Esc",
  eventKeys: "Escape",
  detail: "Escape the current context",
  action: (update, dispatchEvent, eventKey) => {
    update(
      ({
        hasDefaultZoom,
        showHelp,
        showOptions,
        frameNumber,
        options: { fullscreen: fullscreenSetting, showJSON, selectedLabels },
        lockedToSupport,
      }) => {
        if (showHelp) {
          return { showHelp: false };
        }

        if (showOptions) {
          return { showOptions: false };
        }

        if (showJSON) {
          dispatchEvent("options", { showJSON: false });
          return { options: { showJSON: false } };
        }

        if (lockedToSupport) {
          return {
            lockedToSupport: false,
          };
        }

        if (frameNumber !== 1) {
          return {
            frameNumber: 1,
            playing: false,
          };
        }

        if (!hasDefaultZoom) {
          return {
            setZoom: true,
          };
        }

        if (fullscreenSetting) {
          fullscreen.action(update, dispatchEvent, eventKey);
          return {};
        }

        if (selectedLabels.length) {
          dispatchEvent("clear");
          return {};
        }

        dispatchEvent("close");
        return {};
      }
    );
  },
};

export const VIDEO = {
  ...COMMON,
  escape: videoEscape,
  muteUnmute,
  playPause,
  nextFrame,
  previousFrame,
  seekTo,
  supportLock,
};

export const VIDEO_SHORTCUTS = readActions(VIDEO);

export class HelpPanelElement<State extends BaseState> extends BaseElement<
  State
> {
  private showHelp?: boolean;
  protected items?: HTMLDivElement;

  getEvents(): Events<State> {
    return {
      click: ({ event, update }) => {
        event.stopPropagation();
        event.preventDefault();
        update({ showHelp: false });
      },
      dblclick: ({ event }) => {
        event.stopPropagation();
        event.preventDefault();
      },
    };
  }

  createHTMLElement(update) {
    return this.createHelpPanel(update, COMMON);
  }

  isShown({ thumbnail }: Readonly<State["config"]>) {
    return !thumbnail;
  }

  renderSelf({ showHelp }: Readonly<State>) {
    if (this.showHelp === showHelp) {
      return this.element;
    }
    if (showHelp) {
      this.element.style.opacity = "0.9";
      this.element.style.display = "flex";
    } else {
      this.element.style.opacity = "0.0";
      this.element.style.display = "none";
    }
    this.showHelp = showHelp;
    return this.element;
  }

  protected createHelpPanel(
    update: StateUpdate<State>,
    controls: ControlMap<State>
  ): HTMLElement {
    const element = document.createElement("div");
    const header = document.createElement("div");
    header.innerText = "Help";
    header.classList.add(lookerPanelHeader);
    element.classList.add(lookerPanel);

    const container = document.createElement("div");
    container.classList.add(lookerPanelContainer);

    const vContainer = document.createElement("div");
    vContainer.classList.add(lookerPanelVerticalContainer);

    vContainer.appendChild(element);

    container.appendChild(vContainer);
    const scroll = document.createElement("div");
    scroll.classList.add(lookerPanelFlex);

    const items = document.createElement("div");
    items.classList.add(lookerHelpPanelItems);
    this.items = items;

    const close = document.createElement("img");
    close.src = closeIcon;
    close.classList.add(lookerPanelClose);
    close.onclick = () => update({ showHelp: false });
    element.appendChild(close);

    const first = ["Wheel", "Esc"];

    Object.values(controls)
      .sort((a, b) =>
        a.shortcut.length !== b.shortcut.length
          ? first.includes(b.shortcut)
            ? 1
            : first.includes(a.shortcut)
            ? -1
            : b.shortcut.length - a.shortcut.length
          : a.shortcut > b.shortcut
          ? 1
          : -1
      )
      .forEach(addItem(items));

    scroll.appendChild(header);
    scroll.appendChild(items);
    element.append(scroll);

    return container;
  }
}

export class VideoHelpPanelElement extends HelpPanelElement<VideoState> {
  createHTMLElement(update) {
    let config = null;
    update(({ config: _config }) => {
      config = _config;
      return {};
    });

    return this.createHelpPanel(
      update,
      Object.fromEntries(
        Object.entries(VIDEO).filter(([k, v]) => !v.filter || v.filter(config))
      )
    );
  }
}

const addItem = <State extends BaseState>(items: HTMLDivElement) => (
  value: Control<State>
) => {
  const shortcut = document.createElement("div");
  shortcut.classList.add(lookerShortcutValue);
  shortcut.innerHTML = value.shortcut;

  const title = document.createElement("div");
  title.classList.add(lookerShortcutTitle);
  title.innerText = value.title;

  const detail = document.createElement("div");
  detail.classList.add(lookerShortcutDetail);
  detail.innerText = value.detail;

  items.appendChild(shortcut);
  items.appendChild(title);
  items.appendChild(detail);
};
