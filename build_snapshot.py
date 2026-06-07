#!/usr/bin/env python3
"""アプリ70(カーチス共有取り込み用)から在庫データを取得し docs/data.json を生成する。
   1日1回これを実行してgit pushすればGitHub Pagesの一覧が更新される。
   認証情報は .claude/.env から読む（Gitにはコミットしない）。
"""
import json, os, urllib.request, urllib.parse, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))


def url_ok(u):
    """画像URLが実在する(HTTP 200)か。404等はFalse。"""
    try:
        req = urllib.request.Request(u, method="HEAD")
        with urllib.request.urlopen(req, timeout=15) as resp:
            return u, (resp.status == 200)
    except Exception:
        return u, False


def load_env():
    env = {}
    with open(os.path.join(HERE, ".claude", ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def clean(s):
    """全角スペース等のゴミをトリム"""
    if s is None:
        return ""
    return str(s).replace("　", " ").strip()


def load_masters():
    """masters.json（コード→表示名）を読む"""
    path = os.path.join(HERE, "masters.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def decode(masters, group, code):
    """マスタで変換。無ければ元コードをそのまま返す"""
    m = masters.get(group, {})
    return m.get(code, code)


# 取り出すフィールド（アプリ70の日本語コード）
TEXT_FIELDS = [
    "車名", "グレード名", "業販価格", "初年度登録年月日", "走行距離", "排気量",
    "シフト", "駆動区分", "燃料区分", "ハンドル", "形状", "メーカーコード",
    "系統色コード", "在庫場所", "車検満了日", "事故有無区分", "外装評価点", "内装評価点",
    "整理番号", "アピールポイント", "装備品",
]
IMAGE_FIELDS = ["画像前", "画像内", "画像後", "画像1", "画像2", "画像3", "画像4", "画像5", "画像6"]


def main():
    env = load_env()
    base = env["KINTONE_BASE_URL"]
    app = env["KINTONE_APP_ID"]
    token = env["KINTONE_API_TOKEN"]
    masters = load_masters()

    all_recs = []
    offset = 0
    while True:
        q = "order by レコード番号 asc limit 500 offset %d" % offset
        url = base + "/k/v1/records.json?app=" + app + "&query=" + urllib.parse.quote(q)
        req = urllib.request.Request(url, headers={"X-Cybozu-API-Token": token})
        with urllib.request.urlopen(req) as resp:
            data = json.load(resp)
        recs = data.get("records", [])
        if not recs:
            break
        for r in recs:
            front = clean(r.get("画像前", {}).get("value", ""))
            if not front.startswith("http"):
                continue  # 画像前URLが無いものは除外
            item = {"id": r["$id"]["value"]}
            for f in TEXT_FIELDS:
                item[f] = clean(r.get(f, {}).get("value", ""))
            # マスタでコード→表示名に変換した項目を追加
            item["メーカー名"] = decode(masters, "maker", item.get("メーカーコード", ""))
            item["駆動名"] = decode(masters, "drive", item.get("駆動区分", ""))
            item["燃料名"] = decode(masters, "fuel", item.get("燃料区分", ""))
            item["ハンドル名"] = decode(masters, "handle", item.get("ハンドル", ""))
            item["在庫場所名"] = decode(masters, "place", item.get("在庫場所", ""))
            item["形状名"] = decode(masters, "shape", item.get("形状", ""))
            item["色名"] = decode(masters, "color", item.get("系統色コード", ""))
            imgs = [front]  # 主写真を先頭に
            for f in IMAGE_FIELDS:
                if f == "画像前":
                    continue
                u = clean(r.get(f, {}).get("value", ""))
                if u.startswith("http") and u not in imgs:
                    imgs.append(u)
            item["front"] = front
            item["images"] = imgs
            report = clean(r.get("状態評価書", {}).get("value", ""))
            item["report"] = report if report.startswith("http") else ""
            all_recs.append(item)
        print("取得: %d 件" % len(all_recs), file=sys.stderr)
        offset += 500

    # 全画像URLの実在チェック（HTTP 200か）を並列で実施
    all_urls = set()
    for it in all_recs:
        all_urls.update(it["images"])
        if it.get("report"):
            all_urls.add(it["report"])
    print("画像URL %d 本を存在チェック中…" % len(all_urls), file=sys.stderr)
    ok = {}
    with ThreadPoolExecutor(max_workers=30) as ex:
        for u, good in ex.map(url_ok, all_urls):
            ok[u] = good

    # 画像前が404の車両は除外。ギャラリーは生きている画像だけ残す
    final = []
    dropped = 0
    for it in all_recs:
        if not ok.get(it["front"]):
            dropped += 1
            continue
        it["images"] = [u for u in it["images"] if ok.get(u)]
        it["report"] = it["report"] if (it.get("report") and ok.get(it["report"])) else ""
        final.append(it)
    all_recs = final
    print("画像前404で除外: %d 件" % dropped, file=sys.stderr)

    out = {"count": len(all_recs), "cars": all_recs}
    os.makedirs(os.path.join(HERE, "docs"), exist_ok=True)
    with open(os.path.join(HERE, "docs", "data.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("✅ docs/data.json 生成完了: %d 件" % len(all_recs))


if __name__ == "__main__":
    main()
