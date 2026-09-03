// @vitest-environment jsdom
import {
  loadPluginApp,
  mountPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DOCK_COLLAPSED_ATTRIBUTE,
  DOCK_STORAGE_KEY,
} from "../src/composer-dock.js";

const app = await loadPluginApp(() => import("../app.js"));

let disposeMounted: (() => Promise<void>) | null = null;

function buildComposer(): { composer: HTMLElement; stack: HTMLElement } {
  const composer = document.createElement("div");
  composer.setAttribute("data-app-composer", "");
  composer.setAttribute("data-promptbox-shell", "");
  const stack = document.createElement("div");
  stack.className = "grid gap-2";
  stack.innerHTML = `
    <section class="goal-banner" data-status="paused">
      <div class="goal-banner-header-row"><svg></svg> GOAL PAUSED 0 of 4 Revise the four client-review drafts</div>
      <div class="goal-banner-body">long body text that must not appear in a pill</div>
    </section>
    <section class="todo-banner" data-full-active="true">
      <div class="todo-banner-header-row">3/6 complete · 1 active · 2 blocked Running production work</div>
      <div class="todo-banner-body">body</div>
    </section>
    <section class="space-y-2">
      <section class="overflow-hidden rounded-lg"><div class="row">legal-source-grounded-review 2/3 agents 7m 7s</div></section>
      <section class="overflow-hidden rounded-lg"><div class="row">legal-source-grounded-review 2/3 agents 8m 6s</div></section>
    </section>
  `;
  composer.append(stack);
  const promptbox = document.createElement("form");
  promptbox.setAttribute("data-promptbox", "");
  composer.append(promptbox);
  document.body.append(composer);
  return { composer, stack };
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ ok: false }) })));
  window.localStorage.clear();
});

afterEach(async () => {
  await disposeMounted?.();
  disposeMounted = null;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const mount = async () => {
  const mounted = await mountPluginContentScripts(app, { pluginId: "liquid-glass" });
  disposeMounted = () => mounted.lifecycle.dispose();
  return mounted;
};

describe("the composer-dock content script", () => {
  it("adds a minimize control above a banner stack and leaves the stack visible by default", async () => {
    const { composer } = buildComposer();
    const mounted = await mount();
    expect(mounted.inspection.mountedIds).toContain("composer-dock");
    const dock = composer.querySelector(":scope > .lg-dock");
    expect(dock).not.toBeNull();
    expect(dock?.nextElementSibling?.classList.contains("grid")).toBe(true);
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    const toggle = dock?.querySelector<HTMLButtonElement>(".lg-dock-toggle");
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
  });

  it("minimizes into one pill per card, persists the choice, and expands again", async () => {
    const { composer } = buildComposer();
    await mount();
    const toggle = composer.querySelector<HTMLButtonElement>(".lg-dock-toggle");
    toggle?.click();

    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(true);
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBe("1");
    const pills = Array.from(composer.querySelectorAll<HTMLElement>(".lg-dock-pill"));
    expect(pills).toHaveLength(4);
    expect(pills[0]?.textContent).toMatch(/^GOAL PAUSED 0 of 4/);
    expect(pills[0]?.textContent).not.toContain("long body");
    expect(pills[0]?.querySelector("svg")).not.toBeNull();
    expect(pills[1]?.dataset.tone).toBe("alert");
    expect(pills[2]?.dataset.tone).toBe("live");
    expect(pills[2]?.textContent?.length).toBeLessThanOrEqual(28);
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");

    pills[0]?.click();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    expect(window.localStorage.getItem(DOCK_STORAGE_KEY)).toBeNull();
  });

  it("starts minimized when the choice was saved and refreshes pills in one frame per mutation burst", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(DOCK_STORAGE_KEY, "1");
    const { composer, stack } = buildComposer();
    await mount();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(true);

    const header = stack.querySelector(".todo-banner-header-row");
    for (let index = 0; index < 5; index += 1) {
      if (header) header.textContent = `${index + 4}/6 complete · 0 active`;
      await Promise.resolve();
    }
    await vi.advanceTimersByTimeAsync(20);
    const pills = Array.from(composer.querySelectorAll<HTMLElement>(".lg-dock-pill"));
    expect(pills[1]?.textContent).toBe("8/6 complete · 0 active");
    expect(pills[1]?.dataset.tone).toBe("live");
  });

  it("removes the control when the stack empties and cleans up on dispose", async () => {
    vi.useFakeTimers();
    const { composer, stack } = buildComposer();
    const mounted = await mount();
    stack.replaceChildren();
    await vi.advanceTimersByTimeAsync(20);
    expect(composer.querySelector(":scope > .lg-dock")).toBeNull();

    buildComposer();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelectorAll(".lg-dock")).toHaveLength(1);
    await mounted.lifecycle.dispose();
    disposeMounted = null;
    expect(document.querySelectorAll(".lg-dock")).toHaveLength(0);
    expect(document.querySelector("style[data-lg-composer-dock]")).toBeNull();
  });
});
