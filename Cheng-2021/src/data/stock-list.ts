import config from "../config.ts";
import { jd, log, puppeteer, sleep } from "../deps.ts";

/** 日志输出 */
function info(content: string) {
  log.info(`stock-list ${content}`);
}

/** 股票列表解码器 */
const decoder = jd.arrayDecoder(jd.objectDecoder({
  code: jd.stringDecoder,
  name: jd.stringDecoder,
}));

/** 股票列表类型 */
type StockList = jd.DecoderType<typeof decoder>;

/** 股票列表存储位置 */
const path = new URL("stock-list.json", config.dataDir);

/** 加载股票列表 */
async function fetchStockList(): Promise<StockList> {
  try {
    // 尝试读取已有数据
    const text = await Deno.readTextFile(path);
    const data = await decoder.decodeAsync(JSON.parse(text));
    info("从data/stock-list.json加载股票列表");
    return data;
  } catch {
    // 重新下载数据
    info("将要从`金融界`重新下载股票列表");
    const data: StockList = [];
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    // 共计99页
    for (let i = 1; i <= 99; i++) {
      const url =
        `http://summary.jrj.com.cn/scfl/index.shtml?q=cn%7Cs%7Csa&c=m&n=hqa&o=pl,d&p=${i}050`;
      await page.goto(url);
      await sleep(5);
      const trs = await page.$$("#grid1 tr");
      for (const tr of trs) {
        const code = (await tr.$eval("td:nth-of-type(1)", (el) =>
          el.textContent));
        const name = (await tr.$eval("td:nth-of-type(2)", (el) =>
          el.textContent));
        data.push({ code, name });
      }
      info(`第${i}页爬取完毕，目前总数据量：${data.length}`);
    }
    await browser.close();
    // 保存数据
    await Deno.writeTextFile(path, JSON.stringify(data, undefined, 2));
    info("保存股票列表到stock-list.json");
    return data;
  }
}

/** 默认导出股票列表 */
export default await fetchStockList();
