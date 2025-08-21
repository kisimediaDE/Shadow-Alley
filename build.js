import { minify as minifyHTML } from "html-minifier-terser";
import { minify as minifyJS } from "terser";
import CleanCSS from "clean-css";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let yazl;
try {
  yazl = require("yazl");
} catch (_) {}

async function build() {
  const html = fs.readFileSync("index.html", "utf8");
  const js = fs.readFileSync("game.js", "utf8");
  const css = fs.readFileSync("style.css", "utf8");
  const levels = fs.existsSync("levels.js")
    ? fs.readFileSync("levels.js", "utf8")
    : "";

  // minify JS
  const minJS = (
    await minifyJS(js, {
      ecma: 2020,
      toplevel: true,
      mangle: true,
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        hoist_vars: true,
        hoist_funs: true,
        collapse_vars: true,
        reduce_vars: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        booleans_as_integers: true,
      },
    })
  ).code;

  // minify CSS
  const minCSS = new CleanCSS({ level: { 2: { all: true } } }).minify(
    css
  ).styles;

  // minify Levels (preserve LEVELS/TIPS identifiers)
  let minLevels = "";
  if (levels) {
    const res = await minifyJS(levels, {
      ecma: 2020,
      toplevel: false,
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        hoist_vars: true,
        hoist_funs: true,
        collapse_vars: true,
        reduce_vars: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        booleans_as_integers: true,
      },
      mangle: { toplevel: false, reserved: ["LEVELS", "TIPS"] },
    });
    minLevels = res.code;
  }

  // ersetze die externen Includes im HTML durch inline Varianten (robust mit RegExp)
  const cssTagRe = new RegExp(
    "<link[^>]*href=[\"']style\\.css[\"'][^>]*>",
    "i"
  );
  const levelsTagRe = new RegExp(
    "<script[^>]*src=[\"']levels\\.js[\"'][^>]*>\\s*<\\/script>",
    "i"
  );
  const jsTagRe = new RegExp(
    "<script[^>]*src=[\"']game\\.js[\"']?[^>]*>\\s*<\\/script>",
    "i"
  );

  let inlinedHTML = html.replace(cssTagRe, `<style>${minCSS}</style>`);
  if (minLevels)
    inlinedHTML = inlinedHTML.replace(
      levelsTagRe,
      `<script>${minLevels}</script>`
    );
  inlinedHTML = inlinedHTML.replace(jsTagRe, `<script>${minJS}</script>`);

  // minify HTML
  const finalHTML = await minifyHTML(inlinedHTML, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    removeOptionalTags: true,
    collapseBooleanAttributes: true,
    decodeEntities: true,
    useShortDoctype: true,
    keepClosingSlash: false,
    minifyCSS: true,
    minifyJS: true,
    sortAttributes: true,
    sortClassName: true,
  });

  fs.mkdirSync("dist", { recursive: true });
  fs.writeFileSync("dist/index.html", finalHTML, "utf8");
  console.log("✅ Build fertig: dist/index.html");

  if (yazl) {
    const zipPath = "dist/shadow-alley.zip";
    const zipfile = new yazl.ZipFile();
    zipfile.addFile("dist/index.html", "index.html", { mtime: new Date(0) });
    zipfile.end();
    await new Promise((resolve, reject) => {
      zipfile.outputStream
        .pipe(fs.createWriteStream(zipPath))
        .on("close", resolve)
        .on("error", reject);
    });
    const bytes = fs.statSync(zipPath).size;
    console.log(
      "🗜️  ZIP erstellt:",
      zipPath,
      (bytes / 1024).toFixed(2) + " kB"
    );
  } else {
    console.log("ℹ️  Tipp: npm i -D yazl  → erzeugt zusätzlich eine ZIP-Datei");
  }
}

build();
