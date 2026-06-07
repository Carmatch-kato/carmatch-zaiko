/* ============================================================
 * カーチス共有取り込み用アプリ(70) 一覧画面
 * 「公開サイトを更新」ボタン。押すとGAS経由でGitHub Actionsを起動し
 * 公開サイト(GitHub Pages)の在庫データを再生成する。
 * ※ window.open でGASを開く（fetch直叩きは多Googleアカウントで失敗・GAS-29）
 * ============================================================ */
(function () {
  'use strict';

  // ▼▼ GASをデプロイしたら、ここ2つを書き換える ▼▼
  var GAS_URL = 'ここにGASウェブアプリのURL(/exec)を貼る';
  var UPDATE_KEY = 'ここにGASのUPDATE_KEYと同じ合言葉を貼る';
  // ▲▲ ここまで ▲▲

  kintone.events.on('app.record.index.show', function (event) {
    if (document.getElementById('cmz-update-btn')) return event;
    var menu = kintone.app.getHeaderMenuSpaceElement();
    if (!menu) return event;

    var btn = document.createElement('button');
    btn.id = 'cmz-update-btn';
    btn.textContent = '🔄 公開サイトを更新';
    btn.style.cssText = 'padding:7px 16px;border:none;border-radius:5px;background:#0b5fff;'
      + 'color:#fff;font-size:13px;font-weight:bold;cursor:pointer;';
    btn.onclick = function () {
      if (!confirm('公開サイトの在庫データを最新化します。よろしいですか？\n（反映まで数分かかります）')) return;
      window.open(GAS_URL + '?action=update&key=' + encodeURIComponent(UPDATE_KEY), '_blank');
    };
    menu.appendChild(btn);
    return event;
  });
})();
