// ==UserScript==
// @name         江西财经大学自动评教
// @namespace    https://github.com/wzj1122/jxufe-auto-evaluate
// @version      2.0.0-beta.18
// @description  江西财经大学 KINGOSOFT 教务系统自动评教脚本
// @author       MiMo
// @match        https://jwxt.jxufe.edu.cn/frame/homes.action*
// @icon         https://www.jxufe.edu.cn/statics/jxcjdx/images/favicon.png
// @license      MIT
// @homepage     https://github.com/wzj1122/jxufe-auto-evaluate
// @supportURL   https://github.com/wzj1122/jxufe-auto-evaluate/issues
// @updateURL    https://greasyfork.org/scripts/583720-%E6%B1%9F%E8%A5%BF%E8%B4%A2%E7%BB%8F%E5%A4%A7%E5%AD%A6%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.meta.js
// @downloadURL  https://greasyfork.org/scripts/583720-%E6%B1%9F%E8%A5%BF%E8%B4%A2%E7%BB%8F%E5%A4%A7%E5%AD%A6%E8%87%AA%E5%8A%A8%E8%AF%84%E6%95%99.user.js
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var LOG = '[自动评教]';
    var log = {
        i: function () { var args = Array.prototype.slice.call(arguments); args.unshift(LOG); console.log.apply(console, args); },
        w: function () { var args = Array.prototype.slice.call(arguments); args.unshift(LOG); console.warn.apply(console, args); },
        e: function () { var args = Array.prototype.slice.call(arguments); args.unshift(LOG); console.error.apply(console, args); }
    };

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    var state = { running: false, paused: false, mode: 'fast' };

    function frameDoc(id) {
        try { return document.getElementById(id) ? document.getElementById(id).contentDocument : null; }
        catch (e) { return null; }
    }

    function deskDoc() { return frameDoc('frmDesk'); }
    function frame1Doc() {
        try {
            var dd = deskDoc();
            return dd ? dd.getElementById('frame_1').contentDocument : null;
        } catch (e) { return null; }
    }
    function reportDoc() {
        try {
            var f1 = frame1Doc();
            if (!f1) return null;
            var doc = f1.getElementById('frmReport') ? f1.getElementById('frmReport').contentDocument : null;
            if (doc && doc.querySelectorAll("tr[id^='tr']").length > 0) return doc;
            return null;
        } catch (e) { return null; }
    }
    function dialogDoc() { return frameDoc('dialog-frame'); }
    function dialogWin() {
        try { return document.getElementById('dialog-frame') ? document.getElementById('dialog-frame').contentWindow : null; }
        catch (e) { return null; }
    }

    function createUI() {
        var panel = document.createElement('div');
        panel.id = 'ae-panel';
        panel.innerHTML = '<style>'
            + '#ae-panel{position:fixed;bottom:20px;right:20px;z-index:99999;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:16px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.3);font:14px/1.5 sans-serif;min-width:200px;cursor:move;user-select:none}'
            + '#ae-panel .title{font-weight:bold;font-size:15px;margin-bottom:10px}'
            + '#ae-panel .status{font-size:12px;opacity:.85;margin-bottom:10px;min-height:18px}'
            + '#ae-panel .btn{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px;margin-right:6px;transition:.2s}'
            + '#ae-panel .btn:hover{filter:brightness(1.15)}'
            + '#ae-panel .btn-start{background:#2ecc71;color:#fff}'
            + '#ae-panel .btn-pause{background:#f39c12;color:#fff}'
            + '#ae-panel .btn-stop{background:#e74c3c;color:#fff}'
            + '#ae-panel .btn-mode{background:rgba(255,255,255,.2);color:#fff;font-size:11px;padding:4px 10px}'
            + '#ae-panel .btn-mode.active{background:rgba(255,255,255,.4)}'
            + '#ae-panel .btns{display:flex;flex-wrap:wrap;gap:4px}'
            + '#ae-panel .log{display:none;font-size:11px;opacity:.7;margin-top:8px;max-height:80px;min-height:20px;overflow-y:auto;word-break:break-all}'
            + '</style>'
            + '<div class="title">自动评教</div>'
            + '<div class="status" id="ae-status-text">就绪</div>'
            + '<div class="btns">'
            + '<button class="btn btn-start" id="ae-btn-start">开始</button>'
            + '<button class="btn btn-pause" id="ae-btn-pause" disabled>暂停</button>'
            + '<button class="btn btn-stop" id="ae-btn-stop" disabled>停止</button>'
            + '</div>'
            + '<div class="btns" style="margin-top:6px">'
            + '<button class="btn btn-mode" id="ae-mode-fast">快速模式</button>'
            + '<button class="btn btn-mode" id="ae-mode-compat">兼容模式</button>'
            + '</div>'
            + '<div class="log" id="ae-log"></div>';
        document.body.appendChild(panel);

        document.getElementById('ae-btn-start').onclick = function () { if (!state.running) startEval(); };
        document.getElementById('ae-btn-pause').onclick = function () { togglePause(); };
        document.getElementById('ae-btn-stop').onclick = function () { stopEval(); };
        document.getElementById('ae-mode-fast').onclick = function () { state.mode = 'fast'; updateModeUI(); };
        document.getElementById('ae-mode-compat').onclick = function () { state.mode = 'compat'; updateModeUI(); };

        var isDragging = false, offsetX, offsetY;
        panel.onmousedown = function (e) {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true; offsetX = e.offsetX; offsetY = e.offsetY;
        };
        document.onmousemove = function (e) {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        };
        document.onmouseup = function () { isDragging = false; };
    }

    function updateModeUI() {
        document.getElementById('ae-mode-fast').className = state.mode === 'fast' ? 'btn btn-mode active' : 'btn btn-mode';
        document.getElementById('ae-mode-compat').className = state.mode === 'compat' ? 'btn btn-mode active' : 'btn btn-mode';
    }

    function setStatus(msg) {
        var el = document.getElementById('ae-status-text');
        if (el) el.textContent = msg;
    }

    function addLog(msg) {
        var el = document.getElementById('ae-log');
        if (el) { el.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n' + el.textContent; }
    }

    function updateButtons() {
        document.getElementById('ae-btn-start').disabled = state.running;
        document.getElementById('ae-btn-pause').disabled = !state.running;
        document.getElementById('ae-btn-stop').disabled = !state.running;
        document.getElementById('ae-btn-pause').textContent = state.paused ? '继续' : '暂停';
    }

    function updateLogVisibility() {
        var show = GM_getValue('show_log', false);
        var logEl = document.getElementById('ae-log');
        if (logEl) logEl.style.display = show ? 'block' : 'none';
    }

    function toggleLog() {
        var show = GM_getValue('show_log', false);
        GM_setValue('show_log', !show);
        updateLogVisibility();
        log.i(!show ? '日志已开启' : '日志已关闭');
    }

    function handleNotice() {
        log.i('等待注意事项...');
        setStatus('等待注意事项...');
        return sleep(15000).then(function () {
            try {
                var f1 = frame1Doc();
                if (!f1) return;
                var frames = f1.querySelectorAll('iframe, frame');
                for (var i = 0; i < frames.length; i++) {
                    try {
                        var doc = frames[i].contentDocument;
                        if (!doc) continue;
                        var btn = doc.querySelector('#btnClose') || doc.querySelector('input[type="button"]');
                        if (btn && !btn.disabled) { btn.click(); log.i('点击我已阅读'); return; }
                    } catch (e) {}
                }
            } catch (e) {}
            log.i('无注意事项按钮，继续');
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
                    return {
                        id: row.id,
                        btn: links[j],
                        teacher: doc.querySelector('#' + row.id + '_js') ? doc.querySelector('#' + row.id + '_js').innerText.trim() : '未知',
                        course: doc.querySelector('#' + row.id + '_kc') ? doc.querySelector('#' + row.id + '_kc').innerText.trim() : '未知'
                    };
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
            for (var j = 0; j < links.length; j++) {
                if (links[j].innerText.trim() === '评价') { count++; break; }
            }
        }
        return count;
    }

    function waitForForm(timeout) {
        timeout = timeout || 30000;
        var start = Date.now();
        function check() {
            if (!state.running) return Promise.resolve(null);
            var doc = dialogDoc();
            if (doc) {
                try {
                    var w = dialogWin();
                    if (w) {
                        w.confirm = function () { return true; };
                        w.alert = function () {};
                    }
                } catch (err) { /* ignore */ }
                if (doc.querySelector("input[type='radio'][name^='cj']") || doc.querySelector('textarea')) return Promise.resolve(doc);
            }
            if (Date.now() - start >= timeout) return Promise.resolve(null);
            return sleep(500).then(check);
        }
        return check();
    }

    function fillForm(doc) {
        var nameSet = {};
        var radios = doc.querySelectorAll("input[type='radio'][name^='cj']");
        for (var i = 0; i < radios.length; i++) { nameSet[radios[i].name] = true; }
        var names = Object.keys(nameSet);
        names.forEach(function (name) {
            var group = doc.querySelectorAll("input[type='radio'][name='" + name + "']");
            var best = null;
            for (var j = 0; j < group.length; j++) {
                if (/_1$/.test(group[j].id)) { best = group[j]; break; }
            }
            if (!best && group.length > 0) best = group[0];
            if (best && !best.checked) { best.click(); best.dispatchEvent(new Event('change', { bubbles: true })); }
        });
        log.i('选择 ' + names.length + ' 题');
        var filled = 0;
        var tas = doc.querySelectorAll('textarea');
        for (var k = 0; k < tas.length; k++) {
            var ta = tas[k];
            if (!ta.value.trim()) {
                ta.value = '很好';
                ta.dispatchEvent(new Event('input', { bubbles: true }));
                ta.dispatchEvent(new Event('change', { bubbles: true }));
                filled++;
            }
        }
        log.i('填写 ' + filled + ' 意见框');
    }

    function saveAndWait(doc) {
        try {
            var w = dialogWin();
            if (w) {
                w.confirm = function () { return true; };
                w.alert = function () {};
            }
        } catch (err) { /* ignore */ }
        var btn = doc ? doc.querySelector('#butSub') : null;
        if (!btn) {
            var btns = doc ? doc.querySelectorAll("input[type='button']") : [];
            for (var i = 0; i < btns.length; i++) {
                if (/暂存|保存/.test(btns[i].value)) { btn = btns[i]; break; }
            }
        }
        if (!btn) { log.w('未找到保存按钮'); return Promise.resolve(false); }
        btn.click();
        log.i('点击暂存');
        var count = 0;
        function waitLoop() {
            if (count >= 10) return Promise.resolve(true);
                try {
                    var w = dialogWin();
                    if (w) {
                        w.confirm = function () { return true; };
                        w.alert = function () {};
                    }
                } catch (err) { /* ignore */ }
            count++;
            return sleep(500).then(waitLoop);
        }
        return waitLoop();
    }

    function closeDialogClean() {
        try {
            var win = dialogWin();
            if (win && win.closeWindow) {
                win.closeWindow();
                return;
            }
        } catch (err) { /* ignore */ }
        try {
            var doc = dialogDoc();
            if (doc) {
                var btn = doc.querySelector("input[value='关闭']");
                if (btn) { btn.click(); return; }
            }
        } catch (e) {}
        try {
            var iframe = document.getElementById('dialog-frame');
            if (iframe) iframe.style.display = 'none';
        } catch (e) {}
    }

    function navigateToEval() {
        log.i('导航到评教页面...');
        setStatus('导航中...');
        function waitDesk(i) {
            if (i >= 15) return Promise.resolve();
            if (deskDoc()) return Promise.resolve();
            return sleep(1000).then(function () { return waitDesk(i + 1); });
        }
        return waitDesk(0).then(function () {
            document.querySelector('#header-apps').click();
            return sleep(2000);
        }).then(function () {
            function tryClickS9(i) {
                if (i >= 10) return Promise.resolve();
                var dd = deskDoc();
                if (dd) {
                    var s9 = dd.querySelector('#S9');
                    if (s9) { s9.click(); log.i('点击评教菜单 #S9'); return Promise.resolve(); }
                }
                return sleep(1000).then(function () { return tryClickS9(i + 1); });
            }
            return tryClickS9(0);
        }).then(function () {
            return sleep(5000);
        }).then(function () {
            function waitReport(i) {
                if (i >= 10) return Promise.resolve();
                if (reportDoc()) return Promise.resolve();
                return sleep(1000).then(function () { return waitReport(i + 1); });
            }
            return waitReport(0);
        });
    }

    function processOneFast() {
        var item = getFirstUnfinishedItem();
        if (!item) return Promise.resolve(false);
        var total = getUnfinishedCount();
        var info = '[' + total + ' 剩余] ' + item.teacher + ' - ' + item.course;
        log.i(info);
        setStatus(info);
        addLog('评教: ' + item.teacher);

        item.btn.click();
        return sleep(2000).then(function () {
            return waitForForm();
        }).then(function (doc) {
            if (!doc) { log.w('表单加载超时'); return 'retry'; }
            fillForm(doc);
            return saveAndWait(doc);
        }).then(function (ok) {
            if (ok === false) { log.w('保存失败'); return 'retry'; }
            log.i('完成: ' + item.teacher);
            addLog('完成: ' + item.teacher);
            closeDialogClean();
            return sleep(3000).then(function () { return true; });
        });
    }

    function processOneCompat() {
        var item = getFirstUnfinishedItem();
        if (!item) return Promise.resolve(false);
        var total = getUnfinishedCount();
        var info = '[' + total + ' 剩余] ' + item.teacher + ' - ' + item.course;
        log.i(info);
        setStatus(info);
        addLog('评教: ' + item.teacher);

        item.btn.click();
        return sleep(2000).then(function () {
            return waitForForm();
        }).then(function (doc) {
            if (!doc) { log.w('表单加载超时'); return 'retry'; }
            fillForm(doc);
            return saveAndWait(doc);
        }).then(function (ok) {
            if (ok === false) { log.w('保存失败'); return 'retry'; }
            log.i('完成: ' + item.teacher);
            addLog('完成: ' + item.teacher);
            var remaining = total - 1;
            if (remaining > 0) {
                setStatus('完成，剩余 ' + remaining + ' 项，刷新中...');
                addLog('剩余 ' + remaining + ' 项，刷新中...');
                GM_setValue('pending_eval', true);
                return sleep(3000).then(function () { window.location.reload(); return 'reloaded'; });
            }
            return true;
        });
    }

    function startEval() {
        state.running = true;
        state.paused = false;
        updateButtons();
        log.i('开始评教');
        addLog('开始评教');

        var pending = GM_getValue('pending_eval', false);
        if (pending) { GM_setValue('pending_eval', false); }

        function checkLogin() {
            if (location.href.indexOf('login.action') >= 0) {
                log.w('检测到登录页面，等待重新登录...');
                setStatus('会话过期，请重新登录');
                return sleep(1000).then(function () {
                    if (!state.running) return finishEval();
                    if (location.href.indexOf('login.action') < 0) return sleep(3000);
                    return checkLogin();
                });
            }
            return Promise.resolve();
        }

        function afterLogin() {
            var onEvalPage = !!reportDoc();
            if (!onEvalPage) {
                return navigateToEval().then(function () {
                    if (!pending) return handleNotice();
                });
            } else {
                log.i('已在评教页面');
                if (!pending) return handleNotice();
            }
            return Promise.resolve();
        }

        function doEvalLoop() {
            if (!state.running) return Promise.resolve();
            if (state.paused) {
                setStatus('已暂停');
                return sleep(1000).then(doEvalLoop);
            }

            var useFast = state.mode === 'fast';
            log.i('使用 ' + (useFast ? '快速' : '兼容') + ' 模式');
            addLog('模式: ' + (useFast ? '快速' : '兼容'));

            var failCount = 0;
            function loop() {
                if (!state.running) return finishEval();
                if (state.paused) { setStatus('已暂停'); return sleep(1000).then(loop); }

                return (useFast ? processOneFast() : processOneCompat()).then(function (result) {
                    if (result === false) {
                        log.i('所有评教已完成');
                        setStatus('全部完成');
                        addLog('全部完成');
                        GM_notification({ title: '评教完成', text: '所有评教已处理', timeout: 5000 });
                        return finishEval();
                    }
                    if (result === 'reloaded') return;
                    if (result === 'retry') {
                        failCount++;
                        if (useFast && failCount >= 3) {
                            log.w('快速模式连续失败，自动切换兼容模式');
                            setStatus('快速模式失败，切换兼容模式...');
                            state.mode = 'compat';
                            updateModeUI();
                            failCount = 0;
                            return sleep(2000).then(loop);
                        }
                        if (!useFast) {
                            GM_setValue('pending_eval', true);
                            return sleep(2000).then(function () { window.location.reload(); });
                        }
                        return sleep(3000).then(loop);
                    }
                    failCount = 0;
                    return sleep(useFast ? 1500 : 2000).then(loop);
                });
            }
            return loop();
        }

        checkLogin().then(afterLogin).then(doEvalLoop);
    }

    function finishEval() {
        state.running = false;
        state.paused = false;
        updateButtons();
        setStatus('就绪');
    }

    function togglePause() {
        state.paused = !state.paused;
        updateButtons();
        setStatus(state.paused ? '已暂停' : '继续中...');
        addLog(state.paused ? '已暂停' : '已继续');
    }

    function stopEval() {
        state.running = false;
        state.paused = false;
        GM_setValue('pending_eval', false);
        updateButtons();
        setStatus('已停止');
        addLog('已停止');
        log.i('已停止');
    }

    function clearEvalData() {
        log.i('开始清除暂存数据...');
        setStatus('正在清除暂存数据...');

        GM_setValue('pending_eval', false);

        var doc = reportDoc();
        if (!doc) {
            log.w('无法访问评教列表，请先导航到评教页面');
            setStatus('请先导航到评教页面');
            return;
        }

        var allLinks = doc.querySelectorAll("a");
        var deleteLinks = [];

        for (var i = 0; i < allLinks.length; i++) {
            var a = allLinks[i];
            var onclick = a.getAttribute('onclick') || '';
            var text = a.innerText.trim();
            if (onclick.indexOf('deltwjxpj') >= 0 || text === '删除暂存') {
                deleteLinks.push(a);
            }
        }

        log.i('找到 ' + deleteLinks.length + ' 个删除暂存按钮');

        if (deleteLinks.length === 0) {
            log.w('未找到删除暂存按钮，可能没有暂存数据');
            setStatus('未找到暂存数据');
            return;
        }

        GM_setValue('clear_pending', true);
        GM_setValue('clear_remaining', deleteLinks.length);

        log.i('点击第一个删除按钮，页面将刷新...');
        setStatus('删除中 (1/' + deleteLinks.length + ')');
        window.confirm = function () { return true; };
        deleteLinks[0].click();
    }

    function clearEvalDataContinue() {
        var remaining = GM_getValue('clear_remaining', 0);
        if (remaining <= 0) {
            log.i('所有暂存数据已清除');
            setStatus('清除完成');
            GM_setValue('clear_pending', false);
            return;
        }

        log.i('剩余 ' + remaining + ' 条，等待页面加载后继续...');
        setStatus('剩余 ' + remaining + ' 条，导航中...');

        function waitAndNavigate() {
            var doc = reportDoc();
            if (doc) {
                log.i('已在评教页面，继续删除');
                continueDelete();
                return;
            }

            log.i('不在评教页面，等待导航...');
            var dd = deskDoc();
            if (dd) {
                var s9 = dd.querySelector('#S9');
                if (s9) {
                    log.i('点击评教菜单 #S9');
                    s9.click();
                    sleep(5000).then(continueDelete);
                    return;
                }
            }

            document.querySelector('#header-apps').click();
            sleep(3000).then(waitAndNavigate);
        }

        function continueDelete() {
            var doc = reportDoc();
            if (!doc) {
                log.i('等待评教列表加载...');
                sleep(2000).then(waitAndNavigate);
                return;
            }

            var allLinks = doc.querySelectorAll("a");
            var nextBtn = null;

            for (var j = 0; j < allLinks.length; j++) {
                var onclick = allLinks[j].getAttribute('onclick') || '';
                if (onclick.indexOf('deltwjxpj') >= 0) {
                    nextBtn = allLinks[j];
                    break;
                }
            }

            if (!nextBtn) {
                log.i('未找到更多删除按钮，清除完成');
                setStatus('清除完成');
                GM_setValue('clear_pending', false);
                return;
            }

            var newRemaining = remaining - 1;
            GM_setValue('clear_remaining', newRemaining);

            log.i('点击删除按钮 (剩余 ' + newRemaining + ' 条)');
            setStatus('删除中 (剩余 ' + newRemaining + ' 条)');
            window.confirm = function () { return true; };
            nextBtn.click();
        }

        sleep(3000).then(waitAndNavigate);
    }

    function clearEvalDataContinue() {
        var remaining = GM_getValue('clear_remaining', 0);
        if (remaining <= 0) {
            log.i('所有暂存数据已清除');
            setStatus('清除完成');
            GM_setValue('clear_pending', false);
            return;
        }

        log.i('剩余 ' + remaining + ' 条，等待页面加载后继续...');
        setStatus('剩余 ' + remaining + ' 条，导航中...');

        function waitAndDelete() {
            if (remaining <= 0) {
                log.i('所有暂存数据已清除');
                setStatus('清除完成');
                GM_setValue('clear_pending', false);
                return;
            }

            var doc = reportDoc();
            if (!doc) {
                log.i('不在评教页面，尝试导航...');
                navigateToEval().then(function () {
                    return sleep(2000);
                }).then(waitAndDelete);
                return;
            }

            var allLinks = doc.querySelectorAll("a");
            var nextBtn = null;

            for (var j = 0; j < allLinks.length; j++) {
                var onclick = allLinks[j].getAttribute('onclick') || '';
                if (onclick.indexOf('deltwjxpj') >= 0) {
                    nextBtn = allLinks[j];
                    break;
                }
            }

            if (!nextBtn) {
                log.i('未找到更多删除按钮，清除完成');
                setStatus('清除完成');
                GM_setValue('clear_pending', false);
                return;
            }

            var newRemaining = remaining - 1;
            GM_setValue('clear_remaining', newRemaining);

            log.i('点击删除按钮 (剩余 ' + newRemaining + ' 条)');
            setStatus('删除中 (剩余 ' + newRemaining + ' 条)');
            window.confirm = function () { return true; };
            nextBtn.click();
        }

        sleep(3000).then(waitAndDelete);
    }

    function clearEvalDataContinue() {
        var remaining = GM_getValue('clear_remaining', 0);
        if (remaining <= 0) {
            log.i('所有暂存数据已清除');
            setStatus('清除完成');
            GM_setValue('clear_pending', false);
            return;
        }

        log.i('等待页面加载后继续删除...');
        setStatus('删除中 (' + (remaining) + ' 条剩余)');

        function tryDelete(i) {
            if (i >= 20) {
                log.w('等待页面加载超时');
                setStatus('页面加载超时');
                GM_setValue('clear_pending', false);
                return;
            }

            var doc = reportDoc();
            if (!doc) {
                log.i('等待评教列表加载... (' + (i + 1) + '/20)');
                sleep(1000).then(function () { tryDelete(i + 1); });
                return;
            }

            var allLinks = doc.querySelectorAll("a");
            var nextBtn = null;

            for (var j = 0; j < allLinks.length; j++) {
                var onclick = allLinks[j].getAttribute('onclick') || '';
                if (onclick.indexOf('deltwjxpj') >= 0) {
                    nextBtn = allLinks[j];
                    break;
                }
            }

            if (!nextBtn) {
                log.i('未找到更多删除按钮，清除完成');
                setStatus('清除完成');
                GM_setValue('clear_pending', false);
                return;
            }

            var newRemaining = remaining - 1;
            GM_setValue('clear_remaining', newRemaining);

            log.i('点击删除按钮 (剩余 ' + newRemaining + ' 条)');
            setStatus('删除中 (剩余 ' + newRemaining + ' 条)');
            window.confirm = function () { return true; };
            nextBtn.click();
        }

        sleep(2000).then(function () { tryDelete(0); });
    }

    createUI();
    updateButtons();
    updateLogVisibility();

    GM_registerMenuCommand('开始评教', function () { if (!state.running) startEval(); });
    GM_registerMenuCommand('停止', stopEval);
    GM_registerMenuCommand('暂停/继续', togglePause);
    GM_registerMenuCommand('显示/隐藏日志', toggleLog);
    GM_registerMenuCommand('清除评教状态', clearEvalData);
})();
