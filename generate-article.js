#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const ARTICLES_FILE = path.join(__dirname, 'data/articles.json');
const INDEX_FILE = path.join(__dirname, 'index.html');
const ARTICLES_DIR = path.join(__dirname, 'articles');

const DEFAULT_THUMB = "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80";

const ARTICLE_THEMES = [
  {title:"AGA治療の最新動向{year}年{month}月版｜効果的な治療法を解説",category:"AGA治療",tag:"AGA治療",prompt:"2026年最新のAGA治療法について、フィナステリド・ミノキシジル・デュタステリドの効果と副作用、最新の治療トレンドを800文字程度で解説してください。見出しをつけて読みやすく構成してください。"},
  {title:"育毛剤おすすめランキング｜効果・成分・価格を徹底比較",category:"育毛剤",tag:"育毛剤",prompt:"育毛剤の選び方と効果的な使い方について、有効成分・価格帯・使用方法の観点から800文字程度で解説してください。見出しをつけて読みやすく構成してください。"},
  {title:"女性の薄毛対策｜原因別おすすめの改善方法",category:"女性の薄毛",tag:"女性薄毛",prompt:"女性の薄毛・抜け毛の原因と対策について、ホルモンバランス・栄養・頭皮ケアの観点から800文字程度で解説してください。見出しをつけて読みやすく構成してください。"},
  {title:"AGAクリニックで後悔しないための選び方ガイド",category:"クリニック選び",tag:"クリニック選び",prompt:"AGAクリニックを選ぶ際の重要なポイントについて、料金・医師の専門性・オンライン対応などの観点から800文字程度で解説してください。見出しをつけて読みやすく構成してください。"},
  {title:"頭皮マッサージで薄毛改善！正しいやり方と効果",category:"頭皮ケア",tag:"頭皮ケア",prompt:"頭皮マッサージが薄毛改善に効果的な理由と、正しいやり方・おすすめのオイルについて800文字程度で解説してください。見出しをつけて読みやすく構成してください。"},
  {title:"育毛シャンプーの選び方｜薄毛・抜け毛に効く成分とは",category:"育毛シャンプー",tag:"育毛シャンプー",prompt:"育毛シャンプーの選び方と効果的な使い方について、有効成分・頭皮タイプ別おすすめ・洗い方のポイントを800文字程度で解説してください。見出しをつけて読みやすく構成してください。"}
];

function callAnthropicAPI(prompt) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { reject(new Error('ANTHROPIC_API_KEY が設定されていません')); return; }
    const body = JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1200,messages:[{role:'user',content:prompt}]});
    const options = {hostname:'api.anthropic.com',path:'/v1/messages',method:'POST',headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','Content-Length':Buffer.byteLength(body)}};
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data).content[0].text); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const THEME_THUMBS = {
  "AGA治療": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&q=80",
  "育毛剤": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
  "女性薄毛": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&q=80",
  "クリニック選び": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=80",
  "頭皮ケア": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80",
  "育毛シャンプー": "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=400&q=80"
};

function textToHtml(text) {
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  let inOl = false;

  for (let line of lines) {
    // 見出し
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += '<h2>' + line.slice(3).replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</h2>\n';
      continue;
    }
    if (line.startsWith('### ')) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      html += '<h3>' + line.slice(4).replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</h3>\n';
      continue;
    }
    // #で始まる行は削除
    if (line.startsWith('# ')) continue;
    // 番号付きリスト（1. **xxx**：yyy）
    const numMatch = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*[：:]\s*(.+)/);
    if (numMatch) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += '<li><u>' + numMatch[2] + '</u>：' + numMatch[3].replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</li>\n';
      continue;
    }
    const numMatch2 = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch2) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOl) { html += '<ol>'; inOl = true; }
      html += '<li>' + numMatch2[2].replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</li>\n';
      continue;
    }
    // 箇条書き
    if (line.startsWith('- ') || line.startsWith('・')) {
      if (inOl) { html += '</ol>'; inOl = false; }
      if (!inList) { html += '<ul>'; inList = true; }
      html += '<li>' + line.slice(2).replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</li>\n';
      continue;
    }
    // 空行
    if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOl) { html += '</ol>'; inOl = false; }
      continue;
    }
    // 通常段落
    if (inList) { html += '</ul>'; inList = false; }
    if (inOl) { html += '</ol>'; inOl = false; }
    html += '<p>' + line.replace(/\*\*(.+?)\*\*/g, '<u>$1</u>') + '</p>\n';
  }
  if (inList) html += '</ul>';
  if (inOl) html += '</ol>';
  return html;
}

function generateArticleHtml(article, content) {
  const canonical = 'https://usuge.kujira-media.com/articles/article' + article.id + '.html';
  const htmlContent = textToHtml(content);
  return '<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + article.title + ' | うすげナビ</title>\n<meta name="description" content="' + article.excerpt + '">\n<link rel="canonical" href="' + canonical + '">\n<style>\n:root{--primary:#1B2A1B;--accent:#2E7D32;--accent-light:#E8F5E9;--text:#1A1A1A;--text-secondary:#4A4A4A;--text-muted:#888;--bg:#F7F9F7;--border:#E0E8E0;--radius:12px;}\n*{box-sizing:border-box;margin:0;padding:0;}\nbody{font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;background:var(--bg);color:var(--text);font-size:16px;line-height:1.8;}\na{color:var(--accent);text-decoration:none;}a:hover{text-decoration:underline;}\nheader{background:var(--primary);padding:0 24px;}\n.header-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;height:56px;}\n.logo{font-size:17px;font-weight:700;color:#fff;}.logo span{color:#81C784;}\n.article-wrap{max-width:860px;margin:0 auto;padding:40px 24px;}\n.breadcrumb{font-size:12px;color:var(--text-muted);margin-bottom:24px;}\n.breadcrumb a{color:var(--text-muted);}\n.article-cat{display:inline-block;background:var(--accent-light);color:var(--accent);font-size:12px;font-weight:700;padding:3px 10px;border-radius:4px;margin-bottom:12px;}\nh1{font-size:clamp(20px,3vw,28px);font-weight:800;line-height:1.4;margin-bottom:16px;}\n.article-meta{display:flex;gap:16px;font-size:13px;color:var(--text-muted);margin-bottom:32px;}\n.article-body h2{font-size:20px;font-weight:700;margin:40px 0 16px;padding-left:12px;border-left:4px solid var(--accent);}\n.article-body h3{font-size:17px;font-weight:700;margin:28px 0 12px;}\n.article-body p{margin-bottom:16px;color:var(--text-secondary);}\n.article-body ul{margin:0 0 16px 20px;color:var(--text-secondary);}\n.article-body ol{margin:0 0 16px 20px;color:var(--text-secondary);}\n.article-body ul li,.article-body ol li{margin-bottom:8px;}\n.article-body u{text-decoration:underline;font-weight:600;color:var(--text);}\n.cta-box{background:var(--accent-light);border:2px solid var(--accent);border-radius:var(--radius);padding:24px;margin:40px 0;text-align:center;}\n.cta-box h3{font-size:18px;font-weight:700;margin-bottom:8px;}\n.cta-box p{font-size:14px;color:var(--text-secondary);margin-bottom:16px;}\n.btn-primary{display:inline-block;background:var(--accent);color:#fff;font-size:15px;font-weight:700;padding:12px 32px;border-radius:8px;text-decoration:none;}\nfooter{background:var(--primary);color:rgba(255,255,255,.5);padding:24px;text-align:center;font-size:12px;margin-top:40px;}\n</style>\n</head>\n<body>\n<header><div class="header-inner"><a href="/" class="logo">うすげ<span>ナビ</span></a></div></header>\n<div class="article-wrap">\n<div class="breadcrumb"><a href="/">トップ</a> &gt; 育毛コラム &gt; ' + article.title + '</div>\n<span class="article-cat">' + article.category + '</span>\n<h1>' + article.title + '</h1>\n<div class="article-meta"><span>📅 ' + article.date + '</span><span>⏱ 読了時間 約' + article.readTime + '分</span></div>\n<div class="article-body">\n' + htmlContent + '\n<div class="cta-box">\n<h3>薄毛・育毛サービスを比較する</h3>\n<p>編集部が厳選したAGAクリニック・育毛剤・育毛シャンプーのランキングをご覧ください。</p>\n<a href="/" class="btn-primary">ランキングを見る →</a>\n</div>\n</div>\n</div>\n<footer><p>© 2026 うすげナビ. All rights reserved.</p></footer>\n</body>\n</html>';
}

function updateIndexHtml(articles) {
  let html = fs.readFileSync(INDEX_FILE, 'utf-8');
  const articlesData = articles.map(function(a) {
    const obj = {id:a.id,title:a.title,date:a.date,category:a.category,readTime:a.readTime,tag:a.tag};
    if (a.url) obj.url = a.url;
    if (a.thumb) obj.thumb = a.thumb;
    return obj;
  });
  const articlesJson = JSON.stringify(articlesData, null, 2);
  const newBlock = 'const ARTICLES = ' + articlesJson + ';';
  html = html.replace(/const ARTICLES = \[[\s\S]*?\];/, newBlock);
  fs.writeFileSync(INDEX_FILE, html);
  console.log('index.html のARTICLES配列を更新しました');
}

async function generateArticle() {
  const articles = JSON.parse(fs.readFileSync(ARTICLES_FILE, 'utf-8'));
  const maxId = Math.max(...articles.map(a => a.id));
  const newId = maxId + 1;

  const recentTags = articles.slice(0, 6).map(a => a.tag);
  const availableThemes = ARTICLE_THEMES.filter(t => !recentTags.includes(t.tag));
  const theme = availableThemes.length > 0
    ? availableThemes[Math.floor(Math.random() * availableThemes.length)]
    : ARTICLE_THEMES.filter(t => t.tag !== articles[0].tag)[Math.floor(Math.random() * (ARTICLE_THEMES.length - 1))];

  const now = new Date();
  const title = theme.title.replace('{year}', now.getFullYear()).replace('{month}', now.getMonth() + 1);
  console.log('[' + now.toISOString() + '] 記事生成開始: ' + title);

  let content = '';
  let excerpt = '';
  try {
    content = await callAnthropicAPI(theme.prompt);
    excerpt = content.replace(/\n/g, ' ').replace(/#+\s/g, '').slice(0, 150) + '…';
    console.log('APIからの生成成功');
  } catch(err) {
    console.error('API呼び出し失敗:', err.message);
    content = '## ' + title + 'について\n\n詳しく解説します。';
    excerpt = title + 'について解説します。';
  }

  const articleFileName = 'article' + newId + '.html';
  const articleUrl = 'articles/' + articleFileName;
  const thumb = THEME_THUMBS[theme.tag] || DEFAULT_THUMB;
  const newArticle = {id:newId,title,excerpt,date:now.toISOString().split('T')[0],category:theme.category,readTime:Math.floor(Math.random()*4)+4,tag:theme.tag,url:articleUrl,thumb:thumb};

  const articleHtml = generateArticleHtml(newArticle, content);
  fs.writeFileSync(path.join(ARTICLES_DIR, articleFileName), articleHtml);
  console.log('記事ページ生成: ' + articleFileName);

  articles.unshift(newArticle);
  if (articles.length > 20) articles.splice(20);
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2));
  console.log('[' + now.toISOString() + '] 記事追加完了: ID=' + newId);

  updateIndexHtml(articles);
}

generateArticle().catch(err => { console.error('エラー:', err); process.exit(1); });
