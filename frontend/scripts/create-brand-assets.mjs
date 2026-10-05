// Deterministic brand exports from the existing mark and locally hosted Geist.
// No product bundle, API, network font, illustration library, or image editing.
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const destination = resolve(process.argv[2] ?? "public");
const source = await readFile("public/brand/neuebit-mark.svg", "utf8");
const mark = `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
const sans = (await readFile("public/fonts/geist-sans-latin.woff2")).toString("base64");
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir(resolve(destination, "social"), { recursive: true });
// The favicon shares the exact transparent geometry and follows the browser's theme.
await writeFile(resolve(destination, "favicon.svg"), source);

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: "light" });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="UTF-8"><style>
    @font-face{font-family:Geist;src:url(data:font/woff2;base64,${sans}) format('woff2');font-weight:100 900;}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;padding:58px 64px;background:#fff;color:#191919;font-family:Geist,sans-serif;}
    header{display:flex;gap:19.2px;align-items:center;font-size:40.8px;line-height:1;font-weight:600;letter-spacing:-.02em;}header img{width:48px;height:48px;}
    main{margin-top:58px;}h1{margin:0;font-size:86px;line-height:1.04;letter-spacing:-.045em;font-weight:600;}p{margin:24px 0 0;font-size:25px;line-height:1.5;color:#5f5e5b;}
    footer{position:absolute;left:64px;right:64px;bottom:48px;padding-top:24px;border-top:1px solid #e9e9e7;display:flex;justify-content:space-between;align-items:center;gap:24px;}
    .positioning{font-size:18px;line-height:1.6;color:#5f5e5b;}.capabilities{display:flex;gap:10px}.capabilities span{font-size:17px;line-height:1.4;padding:8px 12px;border-radius:6px;}
    .chat{background:#edf7f0;color:#216847}.documents{background:#edf4fb;color:#286698}.search{background:#fcf0ea;color:#9c4b36}.vectors{background:#f4effa;color:#6d4c9e}
  </style></head><body><header><img src="${mark}" alt=""><span>NeueBit</span></header>
  <main><h1>Your knowledge,<br>in context.</h1><p>Ask your documents. Follow the sources.</p></main>
  <footer><div class="positioning">AI knowledge workspace.<br>Custom vector engine.</div><div class="capabilities"><span class="chat">Chat</span><span class="documents">Documents</span><span class="search">Search</span><span class="vectors">Vector Lab</span></div></footer>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img").evaluate((image) => image.decode());
  await page.screenshot({ path: resolve(destination, "social/neuebit-og.png") });
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(`<!doctype html><html><head><style>body{margin:0;width:180px;height:180px;background:#ffffff;display:grid;place-items:center}img{display:block;width:120px;height:120px}</style></head><body><img src="${mark}" alt=""></body></html>`);
  await page.locator("img").evaluate((image) => image.decode());
  await page.screenshot({ path: resolve(destination, "apple-touch-icon.png") });
  console.log(JSON.stringify({ destination, ogBytes: (await stat(resolve(destination, "social/neuebit-og.png"))).size,
    iconBytes: (await stat(resolve(destination, "apple-touch-icon.png"))).size }));
} finally {
  await browser.close();
}
