const { test } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { buildSync } = require("esbuild");

const source = buildSync({
  entryPoints: [path.join(__dirname, "../src/theme/tokens.js")],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs"
}).outputFiles[0].text;
const loaded = new Module(__filename, module);
loaded._compile(source, __filename);
const {
  colors,
  getModeTokens,
  getStatusTokens,
  getChartPalette,
  motion,
  layers,
  spacing,
  shadows
} = loaded.exports;

function luminance(hex) {
  const rgb = hex
    .slice(1)
    .match(/../g)
    .map(channel => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const pair = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (pair[0] + 0.05) / (pair[1] + 0.05);
}

for (const dark of [false, true]) {
  test(`${
    dark ? "dark" : "light"
  } mode keeps normal text above WCAG AA contrast`, () => {
    const mode = getModeTokens(dark);
    for (const background of [
      mode.canvas,
      mode.surface,
      mode.surfaceMuted,
      mode.surfaceRaised,
      mode.surfaceOverlay,
      mode.surfaceTint,
      mode.conversation,
      mode.messageIncoming,
      mode.messageOutgoing
    ]) {
      for (const foreground of [mode.text, mode.textMuted]) {
        assert.ok(
          contrast(foreground, background) >= 4.5,
          `${foreground} on ${background}`
        );
      }
    }
    assert.ok(contrast(mode.navMuted, mode.nav) >= 4.5);
    assert.ok(contrast(mode.navText, mode.nav) >= 4.5);
    assert.ok(contrast(mode.navMuted, mode.navActive) >= 4.5);
    assert.ok(contrast(mode.navText, mode.navActiveHover) >= 4.5);
    assert.ok(contrast(mode.avatarText, mode.avatar) >= 4.5);
    for (const background of [
      mode.surface,
      mode.surfaceMuted,
      mode.surfaceRaised,
      mode.surfaceTint
    ]) {
      assert.ok(
        contrast(mode.brandText, background) >= 4.5,
        `brandText ${mode.brandText} on ${background}`
      );
    }
  });
  test(`${dark ? "dark" : "light"} mode status pairs stay readable`, () => {
    const status = getStatusTokens(dark);
    for (const [name, token] of Object.entries(status)) {
      assert.ok(
        contrast(token.fg, token.bg) >= 4.5,
        `${name}: ${token.fg} on ${token.bg}`
      );
    }
  });
  test(`${dark ? "dark" : "light"} mode surfaces form an ordered ramp`, () => {
    const mode = getModeTokens(dark);
    const step = hex => luminance(hex);
    const ramp = [mode.canvas, mode.surface, mode.surfaceRaised, mode.surfaceOverlay];
    for (let index = 1; index < ramp.length; index += 1) {
      // No escuro cada degrau clareia; no claro a canvas e cinza e as
      // superficies sao brancas, entao nunca escurece.
      assert.ok(
        dark ? step(ramp[index]) > step(ramp[index - 1]) : step(ramp[index]) >= step(ramp[index - 1]),
        `${ramp[index - 1]} -> ${ramp[index]}`
      );
    }
  });
  test(`${dark ? "dark" : "light"} mode chart palette stays distinguishable`, () => {
    const mode = getModeTokens(dark);
    const palette = getChartPalette(dark);
    assert.ok(palette.length >= 6);
    assert.equal(new Set(palette).size, palette.length);
    for (const series of palette) {
      // Serie precisa se destacar da superficie do painel onde o grafico vive.
      assert.ok(contrast(series, mode.surface) >= 3, `${series} on ${mode.surface}`);
    }
  });
  test(`${dark ? "dark" : "light"} mode defines the whole elevation ramp`, () => {
    const ramp = dark ? shadows.dark : shadows.light;
    for (const level of ["rest", "soft", "hover", "raised", "overlay", "focus"]) {
      assert.equal(typeof ramp[level], "string", `shadows.${level} ausente`);
      assert.ok(ramp[level].length > 0);
    }
  });
  test(`${dark ? "dark" : "light"} mode uses a visible focus indicator`, () => {
    const mode = getModeTokens(dark);
    for (const surface of [mode.canvas, mode.surface, mode.surfaceMuted]) {
      assert.ok(contrast(mode.focus, surface) >= 3);
    }
  });
}
test("primary button colors support white text", () => {
  for (const background of [
    colors.brand,
    colors.brandDark,
    colors.brandHover
  ]) {
    assert.ok(contrast("#FFFFFF", background) >= 4.5);
  }
});
test("motion stays short and layer/spacing scales stay ordered", () => {
  assert.ok(
    Object.values(motion.duration).every(value => value > 0 && value <= 300)
  );
  assert.deepEqual(
    [...spacing].sort((a, b) => a - b),
    spacing
  );
  assert.ok(layers.header < layers.drawer && layers.drawer < layers.modal);
  assert.ok(layers.modal < layers.toast && layers.toast < layers.tooltip);
});
