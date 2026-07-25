import { chromium } from "playwright";
import { sleep } from "./scraper-utils.js";

const BASE_URL = "https://wmsw.mofcom.gov.cn";
const SEARCH_URL = `${BASE_URL}/wmsw/sfcxSearch`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("1. Loading search page...");
  await page.goto(SEARCH_URL, { waitUntil: "networkidle", timeout: 30000 });
  await sleep(2000);

  const forms = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll("form").forEach(f => {
      const inputs: any[] = [];
      f.querySelectorAll("input").forEach(i => {
        inputs.push({ name: i.getAttribute("name"), id: i.id, type: i.type, value: (i.value || "").slice(0, 50) });
      });
      result.push({ id: f.id, action: f.action, method: f.method, inputs });
    });
    return result;
  });
  console.log("Forms:", JSON.stringify(forms, null, 2));

  console.log("\n2. Clicking China option...");
  const chinaLi = page.locator("li[data='CN']").first();
  await chinaLi.click({ timeout: 5000 }).catch(() => console.log("  Could not click li[data='CN']"));
  await sleep(500);

  const ecVal = await page.evaluate(() => {
    const el = document.getElementById("taxation_ec") as HTMLInputElement;
    return el ? el.value : "NOT FOUND";
  });
  console.log("  taxation_ec value:", ecVal);

  console.log("\n3. Looking for HS code input...");
  const inputs = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll("input.p_txt_01, input[id='1'], input[id='2']").forEach(i => {
      result.push({ id: i.id, name: i.getAttribute("name"), placeholder: i.getAttribute("placeholder"), value: i.value });
    });
    return result;
  });
  console.log("  Inputs:", JSON.stringify(inputs, null, 2));

  console.log("\n4. Typing chapter 85 into code input...");
  const codeInput = page.locator("input[id='1']");
  if (await codeInput.count() > 0) {
    await codeInput.fill("85");
    console.log("  Filled '85' into input#1");
  } else {
    console.log("  input#1 not found, trying p_txt_01...");
    const fallback = page.locator("input.p_txt_01").first();
    if (await fallback.count() > 0) {
      await fallback.fill("85");
      console.log("  Filled '85' into first p_txt_01 input");
    }
  }

  console.log("\n5. Looking for submit button...");
  const buttons = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll("input[type='submit'], button[type='submit'], .search_btn, .btn_search, .sear_btn, a.search-btn").forEach(b => {
      result.push({ tag: b.tagName, class: b.className, text: b.textContent?.trim().slice(0, 50), type: (b as HTMLInputElement).type });
    });
    return result;
  });
  console.log("  Buttons:", JSON.stringify(buttons, null, 2));

  console.log("\n6. Intercepting network during form submission...");
  const responses: any[] = [];
  page.on("response", resp => {
    responses.push({ url: resp.url(), status: resp.status() });
  });

  const form = page.locator("#taxation_form");
  if (await form.count() > 0) {
    console.log("  Found #taxation_form, clicking submit...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle", timeout: 15000 }).catch(() => console.log("  No navigation after submit")),
      page.locator("#taxation_form input[type='submit'], #taxation_form button[type='submit'], #taxation_form .search_btn").first().click().catch(async () => {
        console.log("  No submit button in form, trying form.submit()...");
        await page.evaluate(() => {
          const f = document.getElementById("taxation_form") as HTMLFormElement;
          if (f) f.submit();
        });
      }),
    ]);
  }

  await sleep(3000);
  console.log("  Current URL:", page.url());
  console.log("  Network responses:", JSON.stringify(responses, null, 2));

  const bodyText = await page.locator("body").innerText();
  console.log("\n7. Page text (first 3000 chars):", bodyText.slice(0, 3000));

  const tables = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll("table").forEach(t => {
      const rows = t.querySelectorAll("tr");
      result.push({
        id: t.id,
        class: t.className,
        rowCount: rows.length,
        firstRows: Array.from(rows).slice(0, 3).map(r =>
          Array.from(r.querySelectorAll("th, td")).map(c => c.textContent?.trim().slice(0, 40))
        ),
      });
    });
    return result;
  });
  console.log("\n8. Tables:", JSON.stringify(tables, null, 2));

  await browser.close();
}

main().catch(e => { console.error(e); process.exitCode = 1; });
