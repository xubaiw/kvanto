import stockList from "./stock-list.ts";
import config from "../config.ts";
import { dom, ensureDir, jd, retry } from "../deps.ts";

const newsDir = new URL("news/", config.dataDir);
await ensureDir(newsDir);

// 列出已经爬取的股票
const alreadyFetched: string[] = [];
for await (const d of Deno.readDir(newsDir)) {
  alreadyFetched.push(d.name.replace(".json", ""));
}

// 待爬取的股票
const toFetch = stockList.filter((s) => !alreadyFetched.includes(s.code));

const headers: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.7 Chrome/87.0.4280.144 Safari/537.36",
};

class JRJNewsPage {
  code: string;
  page = 1;
  constructor(code: string) {
    this.code = code;
  }
  next() {
    this.page += 1;
  }
  toURL() {
    if (this.page == 1) {
      return `http://stock.jrj.com.cn/share,${this.code},ggxw.shtml`;
    } else {
      return `http://stock.jrj.com.cn/share,${this.code},ggxw_${this.page}.shtml`;
    }
  }
}

const newsDecoder = jd.arrayDecoder(jd.objectDecoder({
  code: jd.stringDecoder,
  title: jd.stringDecoder,
  href: jd.stringDecoder,
  datetime: jd.stringDecoder,
}));

type News = jd.DecoderType<typeof newsDecoder>;

async function getNews(
  code: string,
  client: Deno.HttpClient,
  decoder: TextDecoder,
): Promise<News | null> {
  const news: News = [];
  const page = new JRJNewsPage(code);
  while (true) {
    const url = page.toURL();
    const res = await fetch(url, { headers, client });
    const buffer = await res.arrayBuffer();
    const text = decoder.decode(buffer);
    const doc = new dom.DOMParser().parseFromString(text, "text/html");
    if (!doc) return null;
    for (const li of doc.querySelectorAll(`ul.newlist li`)) {
      if (!isElement(li)) continue;
      const a = li.querySelector("a");
      const i = li.querySelector("i");
      const title = a?.textContent;
      const href = a?.getAttribute("href");
      const datetime = i?.textContent;
      if (!title || !href || !datetime) continue;
      news.push({ title, href, datetime, code });
    }
    const btn = doc.querySelector(".page_newslib a:last-of-type");
    if (btn?.textContent?.includes("下一页")) {
      page.next();
    } else {
      break;
    }
  }
  return news;
}

function isElement(node: dom.Node): node is dom.Element {
  return node instanceof dom.Element;
}

console.info(`已有${alreadyFetched.length}`);
console.info(`要爬${toFetch.length}`);

if (toFetch.length > 0) {
  const decoder = new TextDecoder("gbk");
  const client = Deno.createHttpClient({
    proxy: config.proxy,
  });

  for (const [i, s] of toFetch.entries()) {
    const res = await retry(() =>
      getNews(s.code, client, decoder), { maxTry: 5 }) ?? [];
    const path = new URL(`${s.code}.json`, newsDir);
    await Deno.writeTextFile(path, JSON.stringify(res, undefined, 2));
    console.info(
      `爬完第${i}/${toFetch.length}个（${s.name} ${s.code}），有${res.length}条`,
    );
  }
}
