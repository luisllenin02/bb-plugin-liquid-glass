// @vitest-environment jsdom
import {
  loadPluginApp,
  mountPluginContentScripts,
} from "@get-bb/plugin-sdk/testing/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DOCK_CARDS_ATTRIBUTE,
  DOCK_COLLAPSED_ATTRIBUTE,
  DOCK_DEPTH_ATTRIBUTE,
  DOCK_EMPTY_ATTRIBUTE,
  DOCK_FIRST_ATTRIBUTE,
  DOCK_HIDDEN_ATTRIBUTE,
  DOCK_LEAF_ATTRIBUTE,
  DOCK_MODE_KEY,
  DOCK_OPEN_ATTRIBUTE,
  DOCK_PREVIEW_ATTRIBUTE,
  DOCK_STACK_ATTRIBUTE,
  METER_ATTRIBUTE,
  METER_HOST_ATTRIBUTE,
  nextDockMode,
  writeDockMode,
  writeMeterPlacement,
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
    <div class="contents"><div class="flex items-center gap-2 px-1.5 text-xs tabular-nums text-muted-foreground"><div class="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-border"></div><span class="shrink-0">~324k / 260k</span></div></div>
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
  const footer = document.createElement("div");
  footer.setAttribute("data-follow-up-composer-footer", "");
  composer.append(footer);
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
    // On a phone the meter stays in the stack, so it is the first pill.
    expect(pills).toHaveLength(5);
    expect(pills[0]?.textContent).toBe("~324k / 260k");
    expect(pills[1]?.textContent).toBe("Goal Paused 0 of 4 Revise t…");
    expect(pills[1]?.querySelector("svg")).not.toBeNull();
    expect(pills[2]?.dataset.tone).toBe("alert");
    expect(pills[3]?.dataset.tone).toBe("live");
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

  it("tucks the cards into a deck in stack mode; a click on a card pins it open, a control click passes through", async () => {
    writeDockMode("stack");
    const { composer, stack } = buildComposer();
    await mount();
    expect(composer.hasAttribute(DOCK_STACK_ATTRIBUTE)).toBe(true);
    expect(composer.hasAttribute(DOCK_COLLAPSED_ATTRIBUTE)).toBe(false);
    expect(composer.querySelector(".lg-dock")).toBeNull();
    const leaves = Array.from(stack.querySelectorAll<HTMLElement>(`[${DOCK_LEAF_ATTRIBUTE}]`));
    expect(leaves).toHaveLength(4);
    expect(leaves[0]?.hasAttribute(DOCK_FIRST_ATTRIBUTE)).toBe(true);
    expect(leaves[0]?.getAttribute(DOCK_DEPTH_ATTRIBUTE)).toBe("3");
    expect(leaves[0]?.style.getPropertyValue("--lg-dock-depth")).toBe("3");
    expect(leaves[3]?.getAttribute(DOCK_DEPTH_ATTRIBUTE)).toBe("0");
    expect(stack.querySelectorAll(`[${DOCK_HIDDEN_ATTRIBUTE}]`)).toHaveLength(0);
    // The context meter left the stack for the footer row and is not a deck card.
    const meter = stack.querySelector(`[${METER_ATTRIBUTE}="under"]`);
    expect(meter?.textContent).toContain("~324k / 260k");
    expect(meter?.hasAttribute(DOCK_LEAF_ATTRIBUTE)).toBe(false);
    expect(composer.hasAttribute(METER_HOST_ATTRIBUTE)).toBe(true);
    expect(composer.getAttribute(DOCK_CARDS_ATTRIBUTE)).toBe("4");

    // The rail lists the cards back to front; hovering an entry previews, clicking brings to front.
    const rail = composer.querySelector(":scope > .lg-deck-rail");
    const items = Array.from(rail?.querySelectorAll<HTMLElement>(".lg-deck-rail-item") ?? []);
    expect(items.map((item) => item.dataset.index)).toEqual(["0", "1", "2", "3"]);
    expect(items[3]?.dataset.front).toBe("true");
    items[0]?.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(leaves[0]?.getAttribute(DOCK_PREVIEW_ATTRIBUTE)).toBe("true");
    rail?.dispatchEvent(new MouseEvent("pointerleave"));
    expect(leaves[0]?.hasAttribute(DOCK_PREVIEW_ATTRIBUTE)).toBe(false);
    items[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(leaves[0]?.getAttribute(DOCK_DEPTH_ATTRIBUTE)).toBe("0");
    expect(leaves[0]?.hasAttribute(DOCK_FIRST_ATTRIBUTE)).toBe(false);
    expect(leaves[1]?.hasAttribute(DOCK_FIRST_ATTRIBUTE)).toBe(true);
    expect(leaves[1]?.getAttribute(DOCK_DEPTH_ATTRIBUTE)).toBe("3");
    const goalWrapperItem = leaves[0]?.closest("div.contents")?.firstElementChild as HTMLElement;
    expect(goalWrapperItem.style.order).toBe("2");
    expect(Array.from(rail?.querySelectorAll<HTMLElement>(".lg-deck-rail-item") ?? []).map((item) => item.dataset.index)).toEqual(["1", "2", "3", "0"]);

    const goal = leaves[0];
    goal?.querySelector(".goal-banner-header-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(goal?.getAttribute(DOCK_OPEN_ATTRIBUTE)).toBe("true");
    goal?.querySelector(".goal-banner-header-row")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(goal?.getAttribute(DOCK_OPEN_ATTRIBUTE)).toBe("false");

    const control = document.createElement("button");
    goal?.append(control);
    control.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(goal?.getAttribute(DOCK_OPEN_ATTRIBUTE)).toBe("false");

    writeDockMode("cards");
    expect(composer.hasAttribute(DOCK_STACK_ATTRIBUTE)).toBe(false);
    expect(stack.querySelectorAll(`[${DOCK_LEAF_ATTRIBUTE}]`)).toHaveLength(0);
    expect(composer.querySelector(".lg-deck-rail")).toBeNull();
    expect(stack.querySelector(`[${METER_ATTRIBUTE}="under"]`)).not.toBeNull();

    writeMeterPlacement("stack");
    expect(stack.querySelector(`[${METER_ATTRIBUTE}]`)).toBeNull();
    expect(composer.hasAttribute(METER_HOST_ATTRIBUTE)).toBe(false);
    expect(composer.getAttribute(DOCK_CARDS_ATTRIBUTE)).toBe("5");
    expect(nextDockMode("cards")).toBe("stack");
    expect(nextDockMode("stack")).toBe("pills");
    expect(nextDockMode("pills")).toBe("cards");
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
