/* ============================================================
 * カーチス在庫 公開サイト更新トリガー（GAS中継）
 * kintoneアプリ70のボタン → doGet → GitHub Actions(repository_dispatch) 起動
 * GitHubトークンはScript Propertiesに隠す（フロントに出さない）
 * ============================================================ */

function doGet(e) {
  var p = (e && e.parameter) || {};
  appendDebugLog('doGet: action=' + (p.action || ''));
  try {
    var props = PropertiesService.getScriptProperties();   // GAS-1: 各関数内で直接取得
    if (p.action !== 'update') return htmlMsg('不正なアクセスです', false);

    var key = props.getProperty('UPDATE_KEY');
    if (!key || p.key !== key) { appendDebugLog('キー不一致'); return htmlMsg('認証エラーです', false); }

    var token = props.getProperty('GITHUB_TOKEN');
    var owner = props.getProperty('GITHUB_OWNER');
    var repo  = props.getProperty('GITHUB_REPO');
    if (!token || !owner || !repo) return htmlMsg('GAS設定が未完了です（GITHUB_TOKEN/OWNER/REPO）', false);

    var res = UrlFetchApp.fetch('https://api.github.com/repos/' + owner + '/' + repo + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github+json', 'User-Agent': 'cmZaiko' },
      payload: JSON.stringify({ event_type: 'update-inventory' }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    appendDebugLog('dispatch code=' + code + ' ' + res.getContentText().slice(0, 150));
    if (code === 204) return htmlMsg('在庫の更新を開始しました。数分後に公開サイトへ反映されます。', true);
    return htmlMsg('起動に失敗しました（コード ' + code + '）。GAS設定をご確認ください。', false);
  } catch (err) {
    appendDebugLog('doGetエラー: ' + err.message);
    return htmlMsg('エラー: ' + err.message, false);
  }
}

function htmlMsg(msg, ok) {
  var color = ok ? '#0b8043' : '#c0392b';
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="font-family:sans-serif;text-align:center;padding:48px 20px;">'
    + '<div style="font-size:52px">' + (ok ? '✅' : '⚠️') + '</div>'
    + '<p style="font-size:18px;color:' + color + ';font-weight:bold;">' + msg + '</p>'
    + '<p style="color:#777;font-size:13px;">このタブは閉じて構いません。</p></body></html>';
  return HtmlService.createHtmlOutput(html);
}

/* ---- 初期設定（GASエディタで値を入れてから1回ずつ実行）---- GAS-25 個別設定 ---- */
function set_github_token() {
  var v = '←ここにGitHubトークン(ghp_...)を貼る';
  if (v.indexOf('←') !== -1) { Logger.log('NG: 実値を入れてから実行'); return; }
  PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', v);
  Logger.log('GITHUB_TOKEN 登録OK');
}
function set_github_repo() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('GITHUB_OWNER', 'Carmatch-kato');
  props.setProperty('GITHUB_REPO', 'carmatch-zaiko');
  Logger.log('OWNER/REPO 登録OK');
}
function set_update_key() {
  var v = '←ここに任意の合言葉(英数字)を入れる';
  if (v.indexOf('←') !== -1) { Logger.log('NG: 実値を入れてから実行'); return; }
  PropertiesService.getScriptProperties().setProperty('UPDATE_KEY', v);
  Logger.log('UPDATE_KEY 登録OK');
}
function check_properties() {
  var p = PropertiesService.getScriptProperties().getProperties();
  Object.keys(p).sort().forEach(function (k) {
    var v = p[k]; Logger.log(k + ': ' + (v.length > 10 ? v.slice(0, 6) + '****' : '****'));
  });
}

/* ---- デバッグログ3関数（GAS-11・必須）---- */
function appendDebugLog(msg) {
  var props = PropertiesService.getScriptProperties();
  var prev = props.getProperty('DEBUG_LOG') || '';
  var line = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM/dd HH:mm:ss') + ' ' + msg;
  props.setProperty('DEBUG_LOG', (prev + '\n' + line).slice(-8000));
}
function checkDebugLog() {
  Logger.log(PropertiesService.getScriptProperties().getProperty('DEBUG_LOG') || '(ログなし)');
}
function clearDebugLog() {
  PropertiesService.getScriptProperties().deleteProperty('DEBUG_LOG');
  Logger.log('デバッグログをクリアしました');
}
