
const cheerio = require("cheerio");

const shops = {
  depot: [
    "https://laminatdepot.de/laminat",
    "https://laminatdepot.de/vinylboeden",
    "https://laminatdepot.de/parkett"
  ],
  shop24: [
    "https://laminat-shop24.com/pages/bodenbelage"
  ]
};

const clean = text =>
  String(text || "").replace(/\s+/g, " ").trim();

const category = text => {
  if (/parkett/i.test(text)) return "Parkett";
  if (/vinyl|rigid|designboden/i.test(text)) return "Vinyl";
  if (/laminat/i.test(text)) return "Laminat";
  if (/leiste|sockel|dämmung|profil/i.test(text))
    return "Zubehör";
  return null;
};

const number = value => {
  if (!value) return null;
  const text = String(value);
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};

function extract(html, shop, pageUrl) {
  const $ = cheerio.load(html);
  $("script,style,noscript,footer,nav").remove();

  const products = [];
  const seen = new Set();

  const pricePattern =
    /(\d{1,3}(?:[.,]\d{2})?)\s*€\s*\/\s*(?:m²|m2|m\^\{2\}|qm)/gi;

  const selector = [
    "article",
    "li",
    "div[class*='product']",
    "div[class*='Product']",
    "div[class*='card']"
  ].join(",");

  $(selector).each((_, element) => {
    const node = $(element);
    const text = clean(node.text());

    if (text.length < 20 || text.length > 1500) return;

    const matches = [...text.matchAll(pricePattern)];

    if (!matches.length) return;

    const candidates = matches.filter(match => {
      const before = text
        .slice(Math.max(0, match.index - 65), match.index)
        .split(/m²|m2|m\^\{2\}/i)
        .pop()
        .toLowerCase();

      return !/(du sparst|ersparnis|statt|uvp)\s*[\d.,]*\s*$/.test(before);
    });

    if (!candidates.length) return;

    const links = node.find("a[href]").toArray().filter(a => {
      const href = $(a).attr("href") || "";
      return shop === "shop24"
        ? /\/products\//i.test(href)
        : /\/(laminat|vinylboeden|parkett)\//i.test(href);
    });

    const uniqueLinks = [...new Set(
      links.map(a => $(a).attr("href")?.split("?")[0])
    )].filter(Boolean);

    if (uniqueLinks.length !== 1) return;

    const href = uniqueLinks[0];
    let url;

    try {
      url = new URL(href, pageUrl);
      const allowed = shop === "depot"
        ? ["laminatdepot.de", "www.laminatdepot.de"]
        : ["laminat-shop24.com", "www.laminat-shop24.com"];

      if (!allowed.includes(url.hostname)) return;
    } catch {
      return;
    }

    const headings = node
      .find("h2,h3,h4,[class*='title']")
      .map((_, e) => clean($(e).text()))
      .get()
      .filter(t => t.length > 7 && t.length < 150);

    const linkedName = clean($(links[0]).text());
    const name = headings.find(h => category(h)) ||
      linkedName.slice(0, 140);

    const type = category(name) ||
      category(pageUrl);

    if (!name || !type || name.length < 7) return;

    const price = number(candidates[0][1]);

    if (!price || price <= 0 || price >= 1000) return;

    const key = url.href;
    if (seen.has(key)) return;
    seen.add(key);

    const thicknessMatch = text.match(
      /(\d+(?:[.,]\d+)?)\s*mm\s*(?:stärke|stark|dicke)/i
    ) || text.match(
      /(?:stärke|dicke)\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i
    ) || name.match(/(\d+(?:[.,]\d+)?)\s*mm/i);

    const wearMatch = text.match(
      /nutzschicht\s*:?\s*(\d+(?:[.,]\d+)?)\s*mm/i
    );

    const nkMatch = text.match(/\bNK\s*(\d{2})\b/i);

    products.push({
      shop,
      name,
      category: type,
      price,
      thickness: thicknessMatch
        ? number(thicknessMatch[1]) : null,
      wear: wearMatch ? number(wearMatch[1]) : null,
      nk: nkMatch ? nkMatch[1] : null,
      unit: "m²",
      url: url.href,
      sourcePage: pageUrl
    });
  });

  return products.slice(0, 100);
}

async function loadPage(url, shop) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 MarktRadar/1.0",
        "Accept": "text/html"
      }
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const html = (await response.text()).slice(0, 4000000);
    return extract(html, shop, url);
  } finally {
    clearTimeout(timer);
  }
}

exports.handler = async event => {
  const shop = event.queryStringParameters?.shop;

  if (!shops[shop]) {
    return {
      statusCode: 400,
      body: JSON.stringify({error: "Unbekannter Shop"})
    };
  }

  const results = await Promise.allSettled(
    shops[shop].map(url => loadPage(url, shop))
  );

  const products = [];
  const errors = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      products.push(...result.value);
    } else {
      errors.push({
        page: shops[shop][index],
        message: String(result.reason?.message || "Abruf fehlgeschlagen")
      });
    }
  });

  const unique = [...new Map(
    products.map(p => [p.url, p])
  ).values()];

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=900"
    },
    body: JSON.stringify({
      shop,
      checkedAt: new Date().toISOString(),
      products: unique,
      count: unique.length,
      errors
    })
  };
};
