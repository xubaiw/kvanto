import config from "./config.ts";
import { ensureDir, jd } from "./mod.ts";

type AsyncFn<T> = () => Promise<T>;

/** 使用缓存 */
export async function withCache<T>(
  name: string,
  decoder: jd.Decoder<T>,
  fn: AsyncFn<T>,
): Promise<T> {
  // 缓存文件路径
  const path = new URL(`${name}.json`, config.dataDir);
  // 确保父目录存在
  await ensureParent(path);
  try {
    // 尝试从缓存读取
    const text = await Deno.readTextFile(path);
    const json = JSON.parse(text);
    const res = await decoder.decodeAsync(json);
    return res;
  } catch {
    // 无有效缓存 => 运行函数并保存缓存
    const data = await fn();
    await Deno.writeTextFile(path, JSON.stringify(data, undefined, 2));
    return data;
  }
}

/** 确认文件父目录存在 */
async function ensureParent(path: URL) {
  const parent = new URL("./", path);
  await ensureDir(parent);
}
