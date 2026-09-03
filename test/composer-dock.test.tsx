// @vitest-environment jsdom
import {
  loadPluginApp,
  mountPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DOCK_CARDS_ATTRIBUTE,
  DOCK_COLLAPSED_ATTRIBUTE,
  DOCK_EMPTY_ATTRIBUTE,
  DOCK_HIDDEN_ATTRIBUTE,
  DOCK_MODE_KEY,
  writeDockMode,
} from "../src/composer-dock.js";

const app = await loadPluginApp(() => import("../app.js"));

let disposeMounted: (() => Promise<void>) | null = null;
let phone = false;

function buildComposer(): { composer: HTMLElement; stack: HTMLElement } {
  const composer = document.createElement("div");
  composer.setAttribute("data-app-composer", "");
  composer.setAttribute("data-promptbox-shell", "");
  const stack = document.createElement("div");
  stack.className = "grid gap-2";
  stack.innerHTML = `
    <div class="contents"></div>
    <div class="contents"><section class="goal-banner" data-status="paused">
      <div class="goal-banner-header-row"><svg></svg><span>Goal</span><span>Paused</span><span>0 of 4</span><span>Revise the four client-review drafts</span></div>
      <div class="goal-banner-body">long body text that must not appear in a pill</div>
    </section></div>
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

const pillsOf = (composer: HTMLElement) =>
  Array.from(composer.querySelectorAll<HTMLElement>(".lg-dock-pill"));

beforeEach(() => {
  phone = false;
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ ok: false }) })));
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return phone;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
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
  it("leaves the cards alone on desktop in auto mode and adds no chrome", async () => {
    const { composer } = buildComposer();
    const mounted = await mount();
    expect(mounted.inspection.mountedIds).toContain("composer-dock");
    expect(composer.querySelector(".lg-dock")).toBeNull();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    expect(composer.getAttribute(DOCK_CARDS_ATTRIBUTE)).toBe("4");
    expect(app.composerCustomizations.map((entry) => entry.id)).toContain("composer-dock");
  });

  it("folds the cards into pills on a phone in auto mode", async () => {
    phone = true;
    const { composer, stack } = buildComposer();
    await mount();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(true);
    expect(stack.hasAttribute(DOCK_EMPTY_ATTRIBUTE)).toBe(true);
    expect(composer.querySelector(".lg-dock")?.nextElementSibling).toBe(stack);
    const pills = pillsOf(composer);
    expect(pills).toHaveLength(4);
    expect(pills[0]?.textContent).toBe("Goal Paused 0 of 4 Revise t…");
    expect(pills[0]?.querySelector("svg")).not.toBeNull();
    expect(pills[1]?.dataset.tone).toBe("alert");
    expect(pills[2]?.dataset.tone).toBe("live");
    expect(pills.every((pill) => pill.dataset.active === "false")).toBe(true);
  });

  it("opens one card under the pills when its pill is tapped and puts it away on the second tap", async () => {
    writeDockMode("pills");
    const { composer, stack } = buildComposer();
    await mount();
    const leaves = Array.from(stack.querySelectorAll("section.goal-banner, section.todo-banner"));
    const goalWrapper = stack.querySelector("div.contents:has(.goal-banner)");
    const runs = stack.querySelector("section.space-y-2");

    pillsOf(composer)[3]?.click();
    expect(stack.hasAttribute(DOCK_EMPTY_ATTRIBUTE)).toBe(false);
    expect(runs?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(false);
    const secondRun = runs?.children[1];
    expect(secondRun?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(runs?.children[0]?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(leaves[0]?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(goalWrapper?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(leaves[1]?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(pillsOf(composer)[3]?.dataset.active).toBe("true");
    expect(pillsOf(composer)[3]?.getAttribute("aria-pressed")).toBe("true");

    pillsOf(composer)[3]?.click();
    expect(stack.hasAttribute(DOCK_EMPTY_ATTRIBUTE)).toBe(true);
    expect(runs?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(true);
    expect(pillsOf(composer)[3]?.dataset.active).toBe("false");

    pillsOf(composer)[0]?.click();
    expect(goalWrapper?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(leaves[0]?.hasAttribute(DOCK_HIDDEN_ATTRIBUTE)).toBe(false);
    expect(stack.hasAttribute(DOCK_EMPTY_ATTRIBUTE)).toBe(false);
  });

  it("switches live when the mode changes and refreshes pills once per mutation burst", async () => {
    vi.useFakeTimers();
    const { composer, stack } = buildComposer();
    await mount();
    expect(composer.querySelector(".lg-dock")).toBeNull();

    writeDockMode("pills");
    expect(window.localStorage.getItem(DOCK_MODE_KEY)).toBe("pills");
    expect(pillsOf(composer)).toHaveLength(4);

    const header = stack.querySelector(".todo-banner-header-row");
    for (let index = 0; index < 5; index += 1) {
      if (header) header.textContent = `${index + 4}/6 complete · 0 active`;
      await Promise.resolve();
    }
    await vi.advanceTimersByTimeAsync(20);
    expect(pillsOf(composer)[1]?.textContent).toBe("8/6 complete · 0 active");

    writeDockMode("cards");
    expect(composer.querySelector(".lg-dock")).toBeNull();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    expect(stack.querySelectorAll(`[${DOCK_HIDDEN_ATTRIBUTE}]`)).toHaveLength(0);
  });

  it("removes the pills when the stack empties and cleans up on dispose", async () => {
    vi.useFakeTimers();
    writeDockMode("pills");
    const { composer, stack } = buildComposer();
    const mounted = await mount();
    stack.replaceChildren();
    await vi.advanceTimersByTimeAsync(20);
    expect(composer.querySelector(".lg-dock")).toBeNull();
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);

    const second = buildComposer();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelectorAll(".lg-dock")).toHaveLength(1);
    await mounted.lifecycle.dispose();
    disposeMounted = null;
    expect(document.querySelectorAll(".lg-dock")).toHaveLength(0);
    expect(second.composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    expect(document.querySelector("style[data-lg-composer-dock]")).toBeNull();
  });
});
