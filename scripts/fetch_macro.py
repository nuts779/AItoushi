"""
マクロ分析用：3エコノミストの最新記事を取得して macro_raw.txt に保存
使い方: python scripts/fetch_macro.py

取得後、Claude Code に「マクロ分析を更新してください」と伝えることで
data.ts の economistReports / weather / weatherDetail / targetSectors が更新される。
"""
import sys, io, re, time, requests
from bs4 import BeautifulSoup
from datetime import datetime

# 出力を UTF-8 にする。新しい TextIOWrapper を被せると、
# 別スクリプトから import されたとき前のラッパーが破棄されて
# 元の buffer ごと閉じられてしまうため、reconfigure で既存の stdout を設定し直す。
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
ARTICLE_COUNT = 3  # 各エコノミストから取得する記事数


def fetch_html(url: str) -> BeautifulSoup | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
        r.encoding = r.apparent_encoding
        return BeautifulSoup(r.text, 'html.parser')
    except Exception as e:
        print(f'  ✗ 取得失敗: {url} ({e})')
        return None


def extract_body(soup: BeautifulSoup, max_chars: int = 600) -> str:
    """記事本文から最大 max_chars 文字を抽出"""
    # ナビ・ヘッダー系タグを除去
    for tag in soup.select('nav, header, footer, script, style, .nav, .header, .footer, .menu'):
        tag.decompose()
    paragraphs = soup.find_all('p')
    text = ' '.join(p.get_text(strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 30)
    return text[:max_chars] + ('...' if len(text) > max_chars else '')


# ──────────────────────────────────────────
# 藤代宏一（第一生命経済研究所）
# ──────────────────────────────────────────
def fetch_fujishiro() -> list[dict]:
    BASE = 'https://www.dlri.co.jp'
    INDEX = f'{BASE}/members/fujishiro.html'
    print('[1/3] 藤代宏一（第一生命経済研究所）を取得中...')

    soup = fetch_html(INDEX)
    if not soup:
        return []

    articles = []
    # /report/ で始まるリンクを抽出
    links = soup.find_all('a', href=re.compile(r'^/report/'))
    for a in links:
        href = a.get('href', '')
        text = a.get_text(strip=True)
        # 日付パターン: YYYY.MM.DD　タイトル
        m = re.match(r'(\d{4}\.\d{2}\.\d{2})\s+(.+)', text)
        if m:
            date_str = m.group(1).replace('.', '-')
            title = m.group(2).strip()
        else:
            date_str = datetime.today().strftime('%Y-%m-%d')
            title = text

        url = BASE + href
        articles.append({'date': date_str, 'title': title, 'url': url})
        if len(articles) >= ARTICLE_COUNT:
            break

    # 各記事本文を取得
    for art in articles:
        time.sleep(0.5)
        s = fetch_html(art['url'])
        art['body'] = extract_body(s) if s else '（本文取得失敗）'
        print(f'  ✓ {art["date"]} {art["title"][:30]}')

    return articles


# ──────────────────────────────────────────
# 木内登英（NRI）
# ──────────────────────────────────────────
def fetch_kiuchi() -> list[dict]:
    BASE = 'https://www.nri.com'
    INDEX = f'{BASE}/jp/media/column/kiuchi/index.html'
    print('[2/3] 木内登英（NRI）を取得中...')

    soup = fetch_html(INDEX)
    if not soup:
        return []

    articles = []
    # /jp/media/column/kiuchi/YYYYMMDD で始まるリンク
    links = soup.find_all('a', href=re.compile(r'/jp/media/column/kiuchi/\d{8}'))
    seen_urls = set()
    for a in links:
        href = a.get('href', '')
        if href in seen_urls:
            continue
        seen_urls.add(href)

        title = a.get_text(strip=True)
        # URLから日付抽出: /jp/media/column/kiuchi/20260421_2.html
        m = re.search(r'/kiuchi/(\d{4})(\d{2})(\d{2})', href)
        date_str = f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else ''

        url = BASE + href if href.startswith('/') else href
        articles.append({'date': date_str, 'title': title, 'url': url})
        if len(articles) >= ARTICLE_COUNT:
            break

    for art in articles:
        time.sleep(0.5)
        s = fetch_html(art['url'])
        art['body'] = extract_body(s) if s else '（本文取得失敗）'
        print(f'  ✓ {art["date"]} {art["title"][:30]}')

    return articles


# ──────────────────────────────────────────
# 武者陵司（武者リサーチ）
# ──────────────────────────────────────────
def fetch_musha() -> list[dict]:
    BASE = 'https://www.musha.co.jp'
    INDEX = f'{BASE}/'
    print('[3/3] 武者陵司（武者リサーチ）を取得中...')

    soup = fetch_html(INDEX)
    if not soup:
        return []

    articles = []
    seen = set()
    # /short_comment/detail/[番号] を最新順で取得
    links = soup.find_all('a', href=re.compile(r'/short_comment/detail/\d+'))
    # 番号が大きいほど新しい
    links_sorted = sorted(
        links,
        key=lambda a: int(re.search(r'/(\d+)$', a.get('href', '0')).group(1)),
        reverse=True
    )
    for a in links_sorted:
        href = a.get('href', '')
        if href in seen:
            continue
        seen.add(href)
        title = a.get_text(strip=True) or '（タイトル取得中）'
        url = BASE + href if href.startswith('/') else href
        articles.append({'date': '', 'title': title, 'url': url})
        if len(articles) >= ARTICLE_COUNT:
            break

    for art in articles:
        time.sleep(0.5)
        s = fetch_html(art['url'])
        if s:
            # 日付取得
            date_tag = s.find(string=re.compile(r'\d{4}年\d{2}月\d{2}日'))
            if date_tag:
                m = re.search(r'(\d{4})年(\d{2})月(\d{2})日', date_tag)
                if m:
                    art['date'] = f'{m.group(1)}-{m.group(2)}-{m.group(3)}'
            # タイトル取得（h1/h2/h3優先）
            for tag in ['h1', 'h2', 'h3']:
                h = s.find(tag)
                if h and len(h.get_text(strip=True)) > 5:
                    art['title'] = h.get_text(strip=True)
                    break
            art['body'] = extract_body(s)
        else:
            art['body'] = '（本文取得失敗）'
        print(f'  ✓ {art["date"]} {art["title"][:30]}')

    return articles


# ──────────────────────────────────────────
# メイン: 取得してファイルに保存
# ──────────────────────────────────────────
def main():
    print('\n=== マクロ分析用記事取得開始 ===\n')
    today = datetime.today().strftime('%Y-%m-%d')

    results = {
        'fujishiro': fetch_fujishiro(),
        'kiuchi':    fetch_kiuchi(),
        'musha':     fetch_musha(),
    }

    economists = [
        {
            'key': 'fujishiro',
            'name': '藤代 宏一',
            'org': '第一生命経済研究所',
            'role': 'チーフエコノミスト',
            'url': 'https://www.dlri.co.jp/members/fujishiro.html',
        },
        {
            'key': 'kiuchi',
            'name': '木内 登英',
            'org': 'NRI（野村総合研究所）',
            'role': 'エグゼクティブ・エコノミスト',
            'url': 'https://www.nri.com/jp/media/column/kiuchi/index.html',
        },
        {
            'key': 'musha',
            'name': '武者 陵司',
            'org': '武者リサーチ',
            'role': '代表',
            'url': 'https://www.musha.co.jp/',
        },
    ]

    lines = [
        f'# マクロ分析用 最新記事データ',
        f'# 取得日時: {today}',
        f'# このファイルを Claude Code に読み込ませて「マクロ分析を更新してください」と依頼してください',
        '',
    ]

    for ec in economists:
        arts = results[ec['key']]
        lines.append(f'{"="*60}')
        lines.append(f'エコノミスト: {ec["name"]}（{ec["org"]}）')
        lines.append(f'役職: {ec["role"]}')
        lines.append(f'URL: {ec["url"]}')
        lines.append('')
        if not arts:
            lines.append('  ※ 記事取得失敗')
        for i, art in enumerate(arts, 1):
            lines.append(f'--- 記事{i} ---')
            lines.append(f'日付: {art["date"]}')
            lines.append(f'タイトル: {art["title"]}')
            lines.append(f'URL: {art["url"]}')
            lines.append(f'本文要約:')
            lines.append(f'{art["body"]}')
            lines.append('')
        lines.append('')

    output = '\n'.join(lines)
    out_path = 'scripts/macro_raw.txt'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(output)

    total = sum(len(v) for v in results.values())
    print(f'\n✓ {total}記事を {out_path} に保存しました')
    print('次のステップ: Claude Code に「マクロ分析を更新してください」と伝えてください')


if __name__ == '__main__':
    main()
