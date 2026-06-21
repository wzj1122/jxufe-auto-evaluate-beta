// ==UserScript==
// @name         江西财经大学自动评教
// @namespace    https://github.com/wzj1122/jxufe-auto-evaluate
// @version      2.0.0-beta.21
// @description  江西财经大学 KINGOSOFT 教务系统自动评教脚本
// @author       MiMo
// @match        https://jwxt.jxufe.edu.cn/frame/homes.action*
// @icon         https://www.jxufe.edu.cn/statics/jxcjdx/images/favicon.png
// @license      MIT
// @homepage     https://github.com/wzj1122/jxufe-auto-evaluate
// @supportURL   https://github.com/wzj1122/jxufe-auto-evaluate/issues
// @updateURL    https://greasyfork.org/scripts/583720-%E6%B1%9F%E8%A5%BF%E8%B4%A2%E7%BB%8F%E5%A4%A7%E5%AD%A6%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.meta.js
// @downloadURL  https://greasyfork.org/scripts/583720-%E6%B1%9F%E8%A5%BF%E8%B4%A2%E7%BB%8F%E5%A4%A7%E5%AD%A6%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var LOG = '[自动评教]';
    function logI() { var a = Array.prototype.slice.call(arguments); a.unshift(LOG); console.log.apply(console, a); }
    function logW() { var a = Array.prototype.slice.call(arguments); a.unshift(LOG); console.warn.apply(console, a); }

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var state = { running: false, paused: false, mode: 'fast', clearing: false };

    function deskDoc() { try { return document.getElementById('frmDesk') ? document.getElementById('frmDesk').contentDocument : null; } catch (e) { return null; } }
    function frame1Doc() { try { var d = deskDoc(); return d ? d.getElementById('frame_1').contentDocument : null; } catch (e) { return null; } }
    function reportDoc() {
        try {
            var d = frame1Doc();
            if (!d) return null;
            var doc = d.getElementById('frmReport') ? d.getElementById('frmReport').contentDocument : null;
            if (doc && doc.querySelectorAll("tr[id^='tr']").length > 0) return doc;
            return null;
        } catch (e) { return null; }
    }
    function dialogDoc() { try { return document.getElementById('dialog-frame') ? document.getElementById('dialog-frame').contentDocument : null; } catch (e) { return null; } }
    function dialogWin() { try { return document.getElementById('dialog-frame') ? document.getElementById('dialog-frame').contentWindow : null; } catch (e) { return null; } }

    function createUI() {
        var p = document.createElement('div');
        p.id = 'ae-panel';
        p.innerHTML = '<style>'
            + '#ae-panel{position:fixed;bottom:20px;right:20px;z-index:99999;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);font:14px/1.5 sans-serif;min-width:200px;cursor:move;user-select:none}'
            + '#ae-panel .t{font-weight:bold;font-size:15px;margin-bottom:10px}'
            + '#ae-panel .s{font-size:12px;opacity:.85;margin-bottom:10px;min-height:18px}'
            + '#ae-panel .b{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-right:6px;transition:.2s}'
            + '#ae-panel .b:hover{filter:brightness(1.15)}'
            + '#ae-panel .bs{background:#2ecc71;color:#fff}'
            + '#ae-panel .bp{background:#f39c12;color:#fff}'
            + '#ae-panel .bd{background:#e74c3c;color:#fff}'
            + '#ae-panel .bc{background:#9b59b6;color:#fff}'
            + '#ae-panel .bm{background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:4px 10px}'
            + '#ae-panel .bm.a{background:rgba(255,255,255,.4)}'
            + '#ae-panel .r{display:flex;flex-wrap:wrap;gap:4px}'
            + '</style>'
            + '<div class="t">自动评教</div>'
            + '<div class="s" id="ae-s">就绪</div>'
            + '<div class="r">'
            + '<button class="b bs" id="ae-start">开始</button>'
            + '<button class="b bp" id="ae-pause" disabled>暂停</button>'
            + '<button class="b bd" id="ae-stop" disabled>停止</button>'
            + '</div>'
            + '<div class="r" style="margin-top:6px">'
            + '<button class="b bm" id="ae-fast">快速</button>'
            + '<button class="b bm" id="ae-compat">兼容</button>'
            + '</div>'
            + '<div class="r" style="margin-top:4px">'
            + '<button class="b bc" id="ae-clear">清除评教</button>'
            + '</div>';
        document.body.appendChild(p);

        document.getElementById('ae-start').onclick = function () { if (!state.running) startEval(); };
        document.getElementById('ae-pause').onclick = function () { togglePause(); };
        document.getElementById('ae-stop').onclick = function () { stopEval(); };
        document.getElementById('ae-fast').onclick = function () { state.mode = 'fast'; updateModeUI(); };
        document.getElementById('ae-compat').onclick = function () { state.mode = 'compat'; updateModeUI(); };
        document.getElementById('ae-clear').onclick = function () {
            if (state.running || state.clearing) return;
            state.clearing = true;
            updateBtns();
            startClear();
        };

        var drag = false, ox, oy;
        p.onmousedown = function (e) { if (e.target.tagName === 'BUTTON') return; drag = true; ox = e.offsetX; oy = e.offsetY; };
        document.onmousemove = function (e) { if (!drag) return; p.style.left = (e.clientX - ox) + 'px'; p.style.top = (e.clientY - oy) + 'px'; p.style.right = 'auto'; p.style.bottom = 'auto'; };
        document.onmouseup = function () { drag = false; };
    }

    function updateModeUI() {
        document.getElementById('ae-fast').className = state.mode === 'fast' ? 'b bm a' : 'b bm';
        document.getElementById('ae-compat').className = state.mode === 'compat' ? 'b bm a' : 'b bm';
    }

    function setStatus(m) { var el = document.getElementById('ae-s'); if (el) el.textContent = m; }
    function updateBtns() {
        document.getElementById('ae-start').disabled = state.running;
        document.getElementById('ae-pause').disabled = !state.running;
        document.getElementById('ae-stop').disabled = !state.running;
        document.getElementById('ae-pause').textContent = state.paused ? '继续' : '暂停';
        document.getElementById('ae-clear').disabled = state.running || state.clearing;
    }

    function closeDialog() {
        try { var w = dialogWin(); if (w && w.closeWindow) { w.closeWindow(); return; } } catch (e) {}
        try { var d = dialogDoc(); if (d) { var b = d.querySelector("input[value='关闭']"); if (b) { b.click(); return; } } } catch (e) {}
        try { var f = document.getElementById('dialog-frame'); if (f) f.style.display = 'none'; } catch (e) {}
    }

    function fillForm(doc) {
        var names = [];
        var nameSet = {};
        var radios = doc.querySelectorAll("input[type='radio'][name^='cj']");
        for (var i = 0; i < radios.length; i++) { if (!nameSet[radios[i].name]) { nameSet[radios[i].name] = true; names.push(radios[i].name); } }
        names.forEach(function (name) {
            var group = doc.querySelectorAll("input[type='radio'][name='" + name + "']");
            var best = null;
            for (var j = 0; j < group.length; j++) { if (/_1$/.test(group[j].id)) { best = group[j]; break; } }
            if (!best && group.length > 0) best = group[0];
            if (best && !best.checked) { best.click(); best.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        logI('选择 ' + names.length + ' 题');
        var filled = 0;
        var tas = doc.querySelectorAll('textarea');
        for (var k = 0; k < tas.length; k++) {
            if (!tas[k].value.trim()) { tas[k].value = '很好'; tas[k].dispatchEvent(new Event('input', { bubbles: true })); tas[k].dispatchEvent(new Event('change', { bubbles: true })); filled++; }
        }
        logI('填写 ' + filled + ' 意见框');
    }

    function waitForForm(timeout) {
        timeout = timeout || 30000;
        var start = Date.now();
        function check() {
            if (!state.running) return Promise.resolve(null);
            var doc = dialogDoc();
            if (doc) {
                try { var w = dialogWin(); if (w) { w.confirm = function () { return true; }; w.alert = function () {}; } } catch (e) {}
                if (doc.querySelector("input[type='radio'][name^='cj']") || doc.querySelector('textarea')) return Promise.resolve(doc);
            }
            if (Date.now() - start >= timeout) return Promise.resolve(null);
            return sleep(500).then(check);
        }
        return check();
    }

    function saveAndWait(doc) {
        try { var w = dialogWin(); if (w) { w.confirm = function () { return true; }; w.alert = function () {}; } } catch (e) {}
        var btn = doc ? doc.querySelector('#butSub') : null;
        if (!btn) { var btns = doc ? doc.querySelectorAll("input[type='button']") : []; for (var i = 0; i < btns.length; i++) { if (/暂存|保存/.test(btns[i].value)) { btn = btns[i]; break; } } }
        if (!btn) { logW('未找到保存按钮'); return Promise.resolve(false); }
        btn.click();
        logI('点击暂存');
        var count = 0;
        function waitLoop() { if (count >= 10) return Promise.resolve(true); try { var w = dialogWin(); if (w) { w.confirm = function () { return true; }; w.alert = function () {}; } } catch (e) {} count++; return sleep(500).then(waitLoop); }
        return waitLoop();
    }

    function navigateToEval() {
        logI('导航到评教页面...');
        setStatus('导航中...');
        return sleep(1000).then(function () { document.querySelector('#header-apps').click(); return sleep(2000); }).then(function () {
            function tryS9(i) { if (i >= 10) return Promise.resolve(); var d = deskDoc(); if (d) { var s = d.querySelector('#S9'); if (s) { s.click(); logI('点击评教菜单'); return Promise.resolve(); } } return sleep(1000).then(function () { return tryS9(i + 1); }); }
            return tryS9(0);
        }).then(function () { return sleep(5000); }).then(function () {
            function waitR(i) { if (i >= 10) return Promise.resolve(); if (reportDoc()) return Promise.resolve(); return sleep(1000).then(function () { return waitR(i + 1); }); }
            return waitR(0);
        });
    }

    function processOneFast() {
        var item = getFirstUnfinishedItem();
        if (!item) return Promise.resolve(false);
        var total = getUnfinishedCount();
        logI('[' + total + ' 剩余] ' + item.teacher + ' - ' + item.course);
        setStatus('[' + total + ' 剩余] ' + item.course);
        item.btn.click();
        return sleep(2000).then(function () { return waitForForm(); }).then(function (doc) {
            if (!doc) { logW('表单加载超时'); return 'retry'; }
            fillForm(doc);
            return saveAndWait(doc);
        }).then(function (ok) {
            if (ok === false) { logW('保存失败'); return 'retry'; }
            logI('完成: ' + item.teacher);
            closeDialog();
            return sleep(2000).then(function () { return true; });
        });
    }

    function processOneCompat() {
        var item = getFirstUnfinishedItem();
        if (!item) return Promise.resolve(false);
        var total = getUnfinishedCount();
        logI('[' + total + ' 剩余] ' + item.teacher + ' - ' + item.course);
        setStatus('[' + total + ' 剩余] ' + item.course);
        item.btn.click();
        return sleep(2000).then(function () { return waitForForm(); }).then(function (doc) {
            if (!doc) { logW('表单加载超时'); return 'retry'; }
            fillForm(doc);
            return saveAndWait(doc);
        }).then(function (ok) {
            if (ok === false) { logW('保存失败'); return 'retry'; }
            logI('完成: ' + item.teacher);
            var remaining = total - 1;
            if (remaining > 0) {
                setStatus('完成，剩余 ' + remaining + ' 项，刷新中...');
                GM_setValue('pending_eval', true);
                return sleep(3000).then(function () { window.location.reload(); return 'reloaded'; });
            }
            return true;
        });
    }

    function getFirstUnfinishedItem() {
        var doc = reportDoc();
        if (!doc) return null;
        var rows = doc.querySelectorAll("tr[id^='tr']");
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var score = doc.querySelector('#' + row.id + '_pjdf');
            if (score && score.innerText && score.innerText.trim()) continue;
            var actions = doc.querySelector('#' + row.id + '_wjdc');
            if (!actions) continue;
            var links = actions.querySelectorAll('a');
            for (var j = 0; j < links.length; j++) {
                if (links[j].innerText.trim() === '评价') {
                    return { btn: links[j], teacher: doc.querySelector('#' + row.id + '_js') ? doc.querySelector('#' + row.id + '_js').innerText.trim() : '未知', course: doc.querySelector('#' + row.id + '_kc') ? doc.querySelector('#' + row.id + '_kc').innerText.trim() : '未知' };
                }
            }
        }
        return null;
    }

    function getUnfinishedCount() {
        var doc = reportDoc();
        if (!doc) return 0;
        var count = 0;
        var rows = doc.querySelectorAll("tr[id^='tr']");
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var score = doc.querySelector('#' + row.id + '_pjdf');
            if (score && score.innerText && score.innerText.trim()) continue;
            var actions = doc.querySelector('#' + row.id + '_wjdc');
            if (!actions) continue;
            var links = actions.querySelectorAll('a');
            for (var j = 0; j < links.length; j++) { if (links[j].innerText.trim() === '评价') { count++; break; } }
        }
        return count;
    }

    function startEval() {
        state.running = true; state.paused = false;
        updateBtns();
        logI('开始评教');
        setStatus('启动中...');

        function checkLogin() {
            if (location.href.indexOf('login.action') >= 0) {
                logW('检测到登录页面，等待重新登录...');
                setStatus('会话过期，请重新登录');
                return sleep(1000).then(function () { if (!state.running) { finishEval(); return; } if (location.href.indexOf('login.action') < 0) return sleep(3000); return checkLogin(); });
            }
            return Promise.resolve();
        }

        function afterLogin() {
            var onEval = !!reportDoc();
            if (!onEval) return navigateToEval();
            logI('已在评教页面');
            return Promise.resolve();
        }

        function doLoop() {
            if (!state.running) return finishEval();
            if (state.paused) { setStatus('已暂停'); return sleep(1000).then(doLoop); }
            var useFast = state.mode === 'fast';
            logI('使用 ' + (useFast ? '快速' : '兼容') + ' 模式');
            var failCount = 0;
            function loop() {
                if (!state.running) return finishEval();
                if (state.paused) { setStatus('已暂停'); return sleep(1000).then(loop); }
                return (useFast ? processOneFast() : processOneCompat()).then(function (result) {
                    if (result === false) { logI('所有评教已完成'); setStatus('全部完成'); return finishEval(); }
                    if (result === 'reloaded') return;
                    if (result === 'retry') {
                        failCount++;
                        if (useFast && failCount >= 3) { logW('快速模式失败，切换兼容模式'); state.mode = 'compat'; updateModeUI(); failCount = 0; return sleep(2000).then(loop); }
                        if (!useFast) { GM_setValue('pending_eval', true); return sleep(2000).then(function () { window.location.reload(); }); }
                        return sleep(3000).then(loop);
                    }
                    failCount = 0;
                    return sleep(useFast ? 1500 : 2000).then(loop);
                });
            }
            return loop();
        }

        checkLogin().then(afterLogin).then(doLoop);
    }

    function finishEval() { state.running = false; state.paused = false; updateBtns(); setStatus('就绪'); }
    function togglePause() { state.paused = !state.paused; updateBtns(); setStatus(state.paused ? '已暂停' : '继续中...'); }
    function stopEval() { state.running = false; state.paused = false; GM_setValue('pending_eval', false); updateBtns(); setStatus('已停止'); logI('已停止'); }

    // ==================== 清除评教 ====================
    function getFirstDeleteBtn() {
        var doc = reportDoc();
        if (!doc) return null;
        var links = doc.querySelectorAll("a");
        for (var i = 0; i < links.length; i++) {
            var onclick = links[i].getAttribute('onclick') || '';
            if (onclick.indexOf('deltwjxpj') >= 0) return links[i];
        }
        return null;
    }

    function getDeleteCount() {
        var doc = reportDoc();
        if (!doc) return 0;
        var count = 0;
        var links = doc.querySelectorAll("a");
        for (var i = 0; i < links.length; i++) {
            var onclick = links[i].getAttribute('onclick') || '';
            if (onclick.indexOf('deltwjxpj') >= 0) count++;
        }
        return count;
    }

    function startClear() {
        logI('开始清除评教状态');
        setStatus('清除评教中...');

        var count = getDeleteCount();
        if (count === 0) { logI('没有暂存数据需要清除'); setStatus('无需清除'); state.clearing = false; updateBtns(); return; }
        logI('找到 ' + count + ' 个暂存数据');

        clearNext(1, count);
    }

    function clearNext(current, total) {
        if (current > total) {
            logI('所有暂存数据已清除');
            setStatus('清除完成');
            state.clearing = false;
            updateBtns();
            return;
        }

        var btn = getFirstDeleteBtn();
        if (!btn) {
            logI('未找到更多删除按钮，清除完成');
            setStatus('清除完成');
            state.clearing = false;
            updateBtns();
            return;
        }

        setStatus('删除中 (' + current + '/' + total + ')');
        logI('删除 (' + current + '/' + total + ')');
        window.confirm = function () { return true; };
        window.alert = function () {};
        window.prompt = function () { return ''; };
        btn.click();
        logI('已点击删除，等待页面刷新...');

        // 强制等待5秒让页面刷新
        sleep(5000).then(function () {
            return waitForPageReady();
        }).then(function () {
            logI('页面已加载，继续下一个');
            clearNext(current + 1, total);
        });
    }

    function waitForPageReady() {
        // 等待页面完全加载（检测 reportDoc 可用）
        var start = Date.now();
        function check() {
            if (Date.now() - start > 30000) {
                logW('等待页面加载超时');
                return Promise.resolve();
            }
            var doc = reportDoc();
            if (doc) {
                logI('页面已就绪');
                return Promise.resolve();
            }
            // 尝试导航到评教页面
            var d = deskDoc();
            if (d) {
                var s9 = d.querySelector('#S9');
                if (s9) {
                    logI('点击评教菜单 #S9');
                    s9.click();
                }
            }
            return sleep(2000).then(check);
        }
        return check();
    }

    // ==================== 启动 ====================
    createUI();
    updateBtns();
    updateModeUI();

    if (GM_getValue('pending_eval', false)) {
        logI('检测到待处理评教，自动继续...');
        startEval();
    }
})();
