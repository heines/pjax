/**
* Pjax
*
* Copyright (c) 2018 Yoichi Kobayashi
* Released under the MIT license
* http://opensource.org/licenses/mit-license.php
*/

require("babel-polyfill");

const ConsoleSignature = require('../common/ConsoleSignature').default;
const consoleSignature = new ConsoleSignature('page transition in this website with original pjax module', 'https://github.com/ykob/pjax', '#497');

const CLASSNAME_LINK = 'js-pjax-link';
const CLASSNAME_PAGE = 'js-pjax-page';
const CLASSNAME_CONTENTS = 'js-pjax-contents';
const CLASSNAME_TRANSITION_ARRIVED = 'is-arrived-contents';
const CLASSNAME_TRANSITION_LEAVED = 'is-leaved-contents';
const TIME_REMOVE_PREV_CONTENTS = 1000;

const page = {
  common: require('./init/common.js'),
  blank: require('./init/blank.js'),
  index: require('./init/index.js'),
  lower: require('./init/lower.js'),
};

export default class Pjax {
  constructor() {
    this.modules = null;
    this.xhr = new XMLHttpRequest();
    this.xhrOpenMethod = 'GET';
    this.elm = {
      page: document.querySelector(`.${CLASSNAME_PAGE}`),
      contents: document.querySelector(`.${CLASSNAME_CONTENTS}`),
    };
    this.href = location.pathname + location.search;
    this.page = null;
    this.isTransition = false;
    this.isPageLoaded = false;

    this.on();
  }
  async onLoad() {
    // ページが最初に読み込まれた際の処理
    this.selectPageFunc();

    // ページごとの、遷移演出終了前に実行する初期化処理
    page.common.initBeforeTransit(document, this.modules, this.isPageLoaded);
    await this.page.initBeforeTransit(this.elm.contents, this.modules);

    // Pjaxの初期ロード処理を行ったのちにScroll Managerを開始
    await this.modules.scrollManager.start();

    // 初期ロード後の非同期遷移のイベント設定
    this.onPjaxLinks(document);

    // 遷移演出の終了
    this.transitEnd();

    // ロード完了のフラグを立てる
    this.isPageLoaded = true;
  }
  selectPageFunc() {
    // ページごと個別に実行する関数の選択
    switch (this.elm.page.dataset.pageId) {
      case 'index':
        this.page = page.index;
        break;
      case 'page01':
      case 'page02':
      case 'page03':
        this.page = page.lower;
        break;
      default:
        this.page = page.blank;
    }
  }
  send() {
    // XMLHttpRequestの通信開始
    this.modules.scrollManager.off();
    this.xhr.open(this.xhrOpenMethod, this.href, true);
    this.xhr.send();

    // fire the page transition effect.
    this.leave();
  }
  async replaceContent() {
    // 前ページの変数を空にするclear関数を実行
    this.page.clear(this.modules);

    // 現在のページの本文を取得
    const currentContents = this.elm.contents;
    currentContents.classList.remove('js-contents')

    // 次のページを取得
    const responseHtml = document.createElement('div');
    responseHtml.innerHTML = this.xhr.responseText;
    const responsePage = responseHtml.querySelector(`.${CLASSNAME_PAGE}`);
    const responseContents = responseHtml.querySelector(`.${CLASSNAME_CONTENTS}`);

    // 遷移時に前後のページ本文が重なるようにfixed配置に変更する
    if (this.modules.scrollManager.isValidSmooth() === false) {
      currentContents.style.position = 'fixed';
      currentContents.style.top = `${this.modules.scrollManager.scrollTop * -1}px`;
    }
    responseContents.style.position = 'fixed';
    responseContents.style.top = '0';

    // 次のページのDOMを追加
    this.elm.page.dataset.pageId = responsePage.dataset.pageId;
    this.elm.page.appendChild(responseContents);
    this.elm.contents = responseContents;
    document.title = responseHtml.querySelector('title').innerHTML;

    // スクロール値をトップに戻す
    window.scrollTo(0, 0);

    // Google Analytics の集計処理。
    if (window.ga) ga('send', 'pageview', window.location.pathname.replace(/^\/?/, '/') + window.location.search);

    // ページの初期化関数オブジェクトを選択
    this.selectPageFunc();

    // 演出分のタイマーを回したあとで現在のページを削除
    setTimeout(() => {
      this.elm.page.removeChild(currentContents);
    }, TIME_REMOVE_PREV_CONTENTS);

    // ページごとの、遷移演出終了前に実行する初期化処理
    page.common.initBeforeTransit(this.elm.contents, this.modules, this.isPageLoaded);
    await this.page.initBeforeTransit(this.elm.contents, this.modules);

    // 差し替えたページの本文に対しての非同期遷移のイベント設定
    this.onPjaxLinks(this.elm.contents);

    // Scroll Managerの初期化
    await this.modules.scrollManager.start();

    this.transitEnd();
  }
  transitStart() {
    // ページ切り替え前の処理
    if (this.isTransition) return;
    this.isTransition = true;
    this.modules.scrollManager.isWorkingScroll = false;

    this.href = location.pathname + location.search;
    this.send();
  }
  transitEnd() {
    // fire the page transition effect.
    this.arrive();

    // 遷移時に付与した遷移後の本文wrapperのsytle値をリセット
    this.elm.contents.style.position = '';
    this.elm.contents.style.top = '';

    // ページ切り替え後のフラグ変更
    this.isTransition = false;
    this.modules.scrollManager.isWorkingScroll = true;

    // history.back連打によって、読み込まれた本文とその瞬間に表示されているURIが異なる場合、自動的に再度読み込みを行う。
    if (this.href !== location.pathname + location.search) {
      this.transitStart();
      return;
    }

    // ページごとの、遷移演出終了後に実行する初期化処理
    page.common.initAfterTransit(this.elm.contents, this.modules);
    this.page.initAfterTransit(this.elm.contents, this.modules);
  }
  arrive() {
    // toggle CSS classes for to add page transition effect to the content element that exists after the transition.
    this.elm.contents.classList.add(CLASSNAME_TRANSITION_ARRIVED);
    this.elm.contents.classList.remove(CLASSNAME_TRANSITION_LEAVED);
  }
  leave() {
    // toggle CSS classes for to add page transition effect to the content element that exists before the transition.
    this.elm.contents.classList.remove(CLASSNAME_TRANSITION_ARRIVED);
    this.elm.contents.classList.add(CLASSNAME_TRANSITION_LEAVED);
  }
  on() {
    // 各イベントの設定
    // 非同期通信に関する処理
    this.xhr.onreadystatechange = () => {
      switch (this.xhr.readyState) {
        case 0: // UNSENT
          break;
        case 1: // OPENED
          break;
        case 2: // HEADERS_RECEIVED
          break;
        case 3: // LOADING
          break;
        case 4: // DONE
          switch (this.xhr.status) {
            case 200:
              this.replaceContent();
              break;
            case 404:
              console.error('Async request by Pjax has error, 404 not found.');
              this.replaceContent();
              break;
            case 500:
              console.error('Async request by Pjax has error, 500 Internal Server Error.');
              break;
            default:
          }
          break;
        default:
      }
    }

    // History API 関連の処理
    window.addEventListener('popstate', (event) => {
      event.preventDefault();
      history.scrollRestoration = 'manual';
      this.transitStart(true);
    });
  }
  transit(href, method = 'GET') {
    // 非同期遷移のイベント内関数を事前に定義
      if (href == location.pathname + location.search) {
        return;
      }
      history.pushState(null, null, href);
      this.xhrOpenMethod = method;
      this.transitStart();
  }
  onPjaxLinks(content, fixedBefore, fixedAfter) {
    const self = this;

    // 非同期遷移のイベント設定は頻発するため、処理を独立させた。
    const elms = [
      content.getElementsByTagName('a'),
      (fixedBefore) ? fixedBefore.getElementsByTagName('a') : [],
      (fixedAfter) ? fixedAfter.getElementsByTagName('a') : [],
    ];

    // 事前に取得したアンカーリンク要素が非同期遷移の対象かどうかを判定し、イベントを付与する
    for (var i = 0; i < elms.length; i++) {
      for (var j = 0; j < elms[i].length; j++) {
        const elm = elms[i][j];
        const href = elm.getAttribute('href');
        const target = elm.getAttribute('target');
        if (
          elm.classList.contains(CLASSNAME_LINK) // It has the class name to set Pjax transition.
          || (
            target !== '_blank' // It doesn't have "_blank" value in target attribute.
            && href.indexOf('#') < 0 // It doesn't link to an anchor on the same page.
            && !(href.indexOf('http') > -1 && href.match(location.host) === null) // It doesn't have this website's hostname in the href attribute value.
          )
        ) {
          elm.addEventListener('click', function(event) {
            event.preventDefault();
            self.transit(this.getAttribute('href'));
          });
        }
      }
    }
  }
}
