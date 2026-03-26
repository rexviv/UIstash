// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("dialog accessibility", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("omits aria-describedby when no description is rendered", async () => {
    await act(async () => {
      root.render(
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <DialogTitle>设置</DialogTitle>
          </DialogContent>
        </Dialog>
      );
      await Promise.resolve();
    });

    const dialog = document.querySelector("[role='dialog']");

    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-describedby")).toBeNull();
  });

  it("preserves aria-describedby wiring when a description is rendered", async () => {
    await act(async () => {
      root.render(
        <Dialog open>
          <DialogContent showCloseButton={false}>
            <DialogTitle>设置</DialogTitle>
            <DialogDescription>管理本地目录和导出行为。</DialogDescription>
          </DialogContent>
        </Dialog>
      );
      await Promise.resolve();
    });

    const dialog = document.querySelector("[role='dialog']");
    const descriptionId = dialog?.getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId as string)?.textContent).toContain("管理本地目录和导出行为");
  });
});
