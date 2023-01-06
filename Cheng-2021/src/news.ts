import { dom, jd, Progressbar, retry } from "./mod.ts";
import { stockList } from "./stock-list.ts";
import { withCache } from "./data.ts";

const headers: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.7 Chrome/87.0.4280.144 Safari/537.36",
};

const client = Deno.createHttpClient({
  proxy: {
    url: "http://i599.kdltps.com:15818",
    basicAuth: {
      username: "t17299184716974",
      password: "ovpxt3lk",
    },
  },
});

const decoder = new TextDecoder("gbk");

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

async function getNews(code: string): Promise<News | null> {
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

export const allNews = await withCache("news", newsDecoder, async () => {
  let allNews: News = [];

  const bar = new Progressbar("|:bar| eta: :eta :percent - :title", {
    total: stockList.length,
  });

  stockList.sort(() => Math.random() - 0.5);
  for (const s of stockList) {
    const res = await retry(() => getNews(s.code), { maxTry: 5 }) ?? [];
    allNews = allNews.concat(res);
    bar.tick(1, { title: `${s.name} ${s.code} ${res.length}` });
  }

  return allNews;
});

if (import.meta.main) {
  console.log(allNews);
  console.log(allNews.length);
}
