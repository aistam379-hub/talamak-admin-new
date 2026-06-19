/* ============================================================
   طلبك تم — صندوق وارد الأدمن (الدردشات اللحظية مع الزوّار)
   مستقلّ: يحقن واجهته بنفسه. يعتمد على supabaseClient من admin-app.js.
   يتطلّب أن يكون المستخدم كادراً (is_staff): admin أو manager.
   ============================================================ */
(function () {
  'use strict';
  if (typeof supabaseClient === 'undefined') { console.error('[admin-chat] supabaseClient غير محمّل'); return; }

  var sb = supabaseClient;
  var _staff = null;       // الأدمن الحالي
  var _staffName = 'فريق الدعم'; // اسم الأدمن (يظهر للزائر)
  var _convs = [];         // قائمة المحادثات
  var _conv = null;        // المحادثة المفتوحة
  var _msgChannel = null;  // اشتراك رسائل المحادثة المفتوحة
  var _listChannel = null; // اشتراك عام لتحديث القائمة/العدّاد
  var _rt = null;          // قناة البثّ (كتابة/جلسة)
  var _aiLastTyped = 0;    // تحديد معدّل بثّ الكتابة
  var _aiTypingHide = null;

  /* ---------- 1) الأنماط (متوافقة مع الثيم الداكن/الفاتح) ---------- */
  var css = ''
    + '.ai-panel{display:flex;flex-direction:row;direction:rtl;font-family:inherit;height:calc(100vh - 96px);min-height:460px;background:var(--card);border:1px solid var(--border);border-radius:18px;overflow:hidden;box-shadow:var(--shadow-sm)}'
    + '@media(max-width:1023px){.ai-panel{height:calc(100vh - 130px)}}'
    + '@media(max-width:700px){.ai-list.hide{display:none}.ai-thread{display:none}.ai-thread.show{display:flex}}'
    + '.ai-list{width:340px;flex-shrink:0;background:var(--card);border-left:1px solid var(--border);display:flex;flex-direction:column}'
    + '@media(max-width:700px){.ai-list{width:100%}}'
    + '.ai-list-head{padding:15px 16px 12px;border-bottom:1px solid var(--border)}'
    + '.ai-list-head .row1{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}'
    + '.ai-list-head h3{margin:0;font-size:1.08rem;font-weight:900;color:var(--text);display:flex;align-items:center;gap:8px}'
    + '.ai-list-head h3 svg{width:20px;height:20px;color:var(--primary)}'
    + '.ai-unread-pill{background:var(--primary);color:#fff;font-size:.72rem;font-weight:800;padding:3px 10px;border-radius:20px;min-width:24px;text-align:center;display:none}'
    + '.ai-unread-pill.show{display:inline-block}'
    + '.ai-search{position:relative}'
    + '.ai-search svg{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted);pointer-events:none}'
    + '.ai-search input{width:100%;padding:10px 36px 10px 12px;border:1.5px solid var(--border-2);border-radius:12px;background:var(--input-bg);color:var(--text);font-family:inherit;font-size:.85rem;outline:none;transition:border-color .15s}'
    + '.ai-search input:focus{border-color:var(--primary)}'
    + '.ai-convs{flex:1;overflow-y:auto;padding:7px}'
    + '.ai-conv{padding:11px 12px;border-radius:13px;cursor:pointer;display:flex;gap:11px;align-items:center;transition:background .12s;margin-bottom:2px}'
    + '.ai-conv:hover{background:var(--hover)}.ai-conv.active{background:var(--primary-lt)}'
    + '.ai-conv .av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dk));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.05rem;flex-shrink:0}'
    + '.ai-conv .mn{flex:1;min-width:0}'
    + '.ai-conv .nm{font-weight:800;color:var(--text);font-size:.92rem;display:flex;justify-content:space-between;align-items:center;gap:6px}'
    + '.ai-conv .nm .tm{font-size:.66rem;color:var(--muted);font-weight:600;flex-shrink:0}'
    + '.ai-conv .sub{font-size:.79rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;display:flex;align-items:center;gap:6px}'
    + '.ai-conv .sub .txt{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.ai-conv .badge{background:var(--rose);color:#fff;font-size:.66rem;font-weight:800;min-width:19px;height:19px;border-radius:10px;display:none;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0;margin-right:auto}'
    + '.ai-conv .badge.show{display:inline-flex}'
    + '.ai-empty{margin:auto;text-align:center;color:var(--muted);font-size:.85rem;padding:30px 20px;display:flex;flex-direction:column;align-items:center;gap:10px}'
    + '.ai-empty svg{width:44px;height:44px;color:var(--s300)}'
    + '.ai-thread{flex:1;display:flex;flex-direction:column;background:var(--bg)}'
    + '.ai-thread-head{display:flex;align-items:center;gap:11px;padding:11px 14px;background:var(--card);border-bottom:1px solid var(--border)}'
    + '.ai-thread-head .bk{background:none;border:none;color:var(--muted);cursor:pointer;display:none;padding:2px}'
    + '.ai-thread-head .bk svg{width:24px;height:24px}'
    + '@media(max-width:700px){.ai-thread-head .bk{display:block}}'
    + '.ai-thread-head .hav{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--primary-dk));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}'
    + '.ai-thread-head .ti{flex:1;min-width:0}'
    + '.ai-thread-head .ti .t{font-weight:800;color:var(--text);font-size:.96rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ai-thread-head .ti .s{font-size:.74rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ai-thead-btn{background:none;border:1px solid var(--border-2);color:var(--muted);cursor:pointer;border-radius:11px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}'
    + '.ai-thead-btn svg{width:18px;height:18px}'
    + '.ai-thead-btn.prof:hover{background:var(--primary-lt);color:var(--primary);border-color:var(--primary)}'
    + '.ai-thead-btn.end:hover{background:var(--rose-lt);color:var(--rose);border-color:var(--rose)}'
    + '.ai-body{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:8px}'
    + '.ai-bubble{max-width:74%;padding:10px 13px;font-size:.9rem;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 2px rgba(15,23,42,.06);animation:aiPop .16s ease}'
    + '@keyframes aiPop{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}'
    + '.ai-bubble.me{align-self:flex-start;background:var(--primary);color:#fff;border-radius:14px 14px 4px 14px}'
    + '.ai-bubble.them{align-self:flex-end;background:var(--card);color:var(--text);border:1px solid var(--border);border-radius:14px 14px 14px 4px}'
    + '.ai-bubble .time{display:block;font-size:.62rem;opacity:.7;margin-top:3px}'
    + '.ai-sysline{align-self:center;background:var(--hover);color:var(--muted);font-size:.72rem;font-weight:700;padding:4px 12px;border-radius:18px;margin:3px 0}'
    + '.ai-datesep{align-self:center;color:var(--muted);font-size:.7rem;font-weight:700;margin:6px 0;background:var(--hover);padding:3px 13px;border-radius:14px}'
    + '.ai-typing{align-self:flex-end;background:var(--card);border:1px solid var(--border);border-radius:14px 14px 14px 4px;padding:11px 14px;display:none}'
    + '.ai-typing.show{display:flex;gap:4px;align-items:center}'
    + '.ai-typing span{width:7px;height:7px;border-radius:50%;background:var(--s300);animation:aiTy 1.2s infinite}'
    + '.ai-typing span:nth-child(2){animation-delay:.2s}.ai-typing span:nth-child(3){animation-delay:.4s}'
    + '@keyframes aiTy{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}'
    + '.ai-foot{display:flex;gap:8px;padding:12px;background:var(--card);border-top:1px solid var(--border)}'
    + '.ai-foot input{flex:1;padding:12px 16px;border:1.5px solid transparent;border-radius:24px;font-size:.92rem;font-family:inherit;outline:none;background:var(--hover);color:var(--text)}'
    + '.ai-foot input:focus{background:var(--input-bg);border-color:var(--primary)}'
    + '.ai-foot button{flex-shrink:0;width:46px;height:46px;border-radius:50%;border:none;background:var(--primary);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s}'
    + '.ai-foot button:hover{background:var(--primary-dk)}.ai-foot button svg{width:20px;height:20px}'
    + '.ai-pick{margin:auto;text-align:center;color:var(--muted);font-size:.9rem;padding:24px;display:flex;flex-direction:column;align-items:center;gap:12px}'
    + '.ai-pick svg{width:54px;height:54px;color:var(--s300)}'
    + '.ai-adcard{display:flex;gap:12px;align-items:center;background:var(--card-2);border:1px solid var(--border);border-radius:14px;padding:10px;margin-bottom:10px}'
    + '.ai-adcard img{width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0}'
    + '.ai-adcard .noimg{width:60px;height:60px;border-radius:10px;background:var(--hover);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);flex-shrink:0}'
    + '.ai-adcard-info{overflow:hidden;flex:1}'
    + '.ai-adcard .t{font-weight:800;color:var(--text);font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ai-adcard .p{color:var(--primary);font-weight:800;font-size:.85rem;margin-top:2px}'
    + '.ai-adcard .r{font-size:.7rem;color:var(--muted);margin-top:2px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- 2) DOM ---------- */
  var panel = document.createElement('div');
  panel.className = 'ai-panel'; panel.id = 'aiPanel';
  var icMail = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var icSearch = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
  var icProf = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var icEnd = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  var icBack = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg>';
  var icSend = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  panel.innerHTML = ''
    + '<div class="ai-list" id="aiList">'
    + '  <div class="ai-list-head">'
    + '    <div class="row1"><h3>' + icMail + 'المحادثات</h3><span class="ai-unread-pill" id="aiUnreadPill">0</span></div>'
    + '    <div class="ai-search">' + icSearch + '<input id="aiSearch" placeholder="ابحث باسم أو بريد العميل..." oninput="window._aiFilter(this.value)"></div>'
    + '  </div>'
    + '  <div class="ai-convs" id="aiConvs"></div>'
    + '</div>'
    + '<div class="ai-thread" id="aiThread">'
    + '  <div class="ai-thread-head"><button class="bk" onclick="window._aiBackList()">' + icBack + '</button>'
    + '    <div class="hav" id="aiThreadAv" style="display:none"></div>'
    + '    <div class="ti"><div class="t" id="aiThreadTitle">اختر محادثة</div><div class="s" id="aiThreadSub"></div></div>'
    + '    <button class="ai-thead-btn prof" id="aiProfBtn" onclick="window._aiOpenProfile()" title="ملف العميل" style="display:none">' + icProf + '</button>'
    + '    <button class="ai-thead-btn end" id="aiEndBtn" onclick="window._aiEndSession()" title="إنهاء الجلسة وحذف المحادثة" style="display:none">' + icEnd + '</button></div>'
    + '  <div class="ai-body" id="aiBody"><div class="ai-pick">' + icMail + '<div>اختر محادثة من القائمة للبدء بالردّ</div></div></div>'
    + '  <div class="ai-foot"><input id="aiInput" placeholder="اكتب ردّك..." oninput="window._aiTyping&&window._aiTyping()" onkeydown="if(event.key===\'Enter\')window._aiSend()"><button onclick="window._aiSend()" title="إرسال">' + icSend + '</button></div>'
    + '</div>';
  (document.getElementById('sectionInbox') || document.body).appendChild(panel);

  /* ---------- 3) أدوات ---------- */
  var _search = '';
  var _lastMsgDay = '';
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function fmtTime(ts) { try { var d = new Date(ts), n = new Date(); if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('ar', { day: 'numeric', month: 'numeric' }); } catch (e) { return ''; } }
  function fmtClock(ts) { try { return new Date(ts).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function fmtDay(ts) { try { var d = new Date(ts), n = new Date(); if (d.toDateString() === n.toDateString()) return 'اليوم'; var y = new Date(n); y.setDate(n.getDate() - 1); if (d.toDateString() === y.toDateString()) return 'أمس'; return d.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function avInit(name) { name = (name || '').trim(); return name ? name.charAt(0).toUpperCase() : '؟'; }

  /* ---------- البثّ المشترك مع الزائر (كتابة + جلسة) ---------- */
  function aiJoinRT(convId) {
    if (_rt) { sb.removeChannel(_rt); _rt = null; }
    _rt = sb.channel('rt-' + convId, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, function (p) { if (p.payload && p.payload.role === 'user') aiShowTyping(); })
      .on('broadcast', { event: 'hello' }, function () { aiSendSession('start'); }) // العميل دخل بعدنا → أبلغه ببدء الجلسة
      .subscribe(function (status) { if (status === 'SUBSCRIBED') aiSendSession('start'); });
  }
  function aiSendSession(action) { if (_rt) _rt.send({ type: 'broadcast', event: 'session', payload: { action: action, name: _staffName } }); }
  window._aiTyping = function () {
    var now = Date.now();
    if (_rt && now - _aiLastTyped > 1400) { _aiLastTyped = now; _rt.send({ type: 'broadcast', event: 'typing', payload: { role: 'admin', name: _staffName } }); }
  };
  function aiShowTyping() {
    var body = document.getElementById('aiBody'); if (!body) return;
    var t = document.getElementById('aiTyping');
    if (!t) { t = document.createElement('div'); t.id = 'aiTyping'; t.className = 'ai-typing'; t.innerHTML = '<span></span><span></span><span></span>'; }
    body.appendChild(t); t.classList.add('show'); body.scrollTop = body.scrollHeight;
    clearTimeout(_aiTypingHide); _aiTypingHide = setTimeout(function () { if (t) t.classList.remove('show'); }, 2600);
  }

  /* ---------- 4) العدّاد العام + الاشتراك ---------- */
  async function refreshBadge() {
    try {
      var r = await sb.from('messages').select('id', { count: 'exact', head: true }).eq('sender_role', 'user').eq('read', false);
      var n = r.count || 0;
      var b = document.getElementById('navInboxCount');
      if (b) { b.textContent = n; b.style.display = n > 0 ? 'inline-block' : 'none'; }
    } catch (e) {}
  }
  function aiPing() { try { var c = new (window.AudioContext || window.webkitAudioContext)(); var o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'sine'; o.frequency.value = 760; g.gain.setValueAtTime(.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(.16, c.currentTime + .01); g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + .28); o.start(); o.stop(c.currentTime + .29); } catch (e) {} }
  function subscribeList() {
    if (_listChannel) return;
    _listChannel = sb.channel('ai-all-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (payload) {
        var m = payload.new;
        if (m.sender_role === 'user') {
          refreshBadge();
          if (document.getElementById('aiPanel').classList.contains('show')) loadConversations();
          // إشعار فوري للأدمن (ما لم يكن يشاهد المحادثة نفسها)
          if (!(_conv && m.conversation_id === _conv.id)) {
            window.uiToast && window.uiToast('رسالة جديدة من ' + (m.sender_name || 'عميل'), 'info');
            aiPing();
          }
        }
      }).subscribe();
  }

  /* ---------- 5) قائمة المحادثات ---------- */
  var _unread = {};
  async function loadConversations() {
    var box = document.getElementById('aiConvs');
    var r = await sb.from('conversations').select('*').order('last_message_at', { ascending: false }).limit(200);
    if (r.error) { box.innerHTML = '<div class="ai-empty"><div>تعذّر التحميل</div><div style="font-size:.75rem">' + esc(r.error.message) + '</div></div>'; return; }
    _convs = r.data || [];
    _unread = {};
    try {
      var u = await sb.from('messages').select('conversation_id').eq('sender_role', 'user').eq('read', false);
      (u.data || []).forEach(function (x) { _unread[x.conversation_id] = (_unread[x.conversation_id] || 0) + 1; });
    } catch (e) {}
    renderConvs();
  }
  function renderConvs() {
    var box = document.getElementById('aiConvs');
    if (!box) return;
    // إجمالي غير المقروء على الرأس
    var totalUnread = 0; for (var k in _unread) totalUnread += _unread[k];
    var pill = document.getElementById('aiUnreadPill');
    if (pill) { pill.textContent = totalUnread; pill.className = 'ai-unread-pill' + (totalUnread > 0 ? ' show' : ''); }
    var icEmpty = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    if (!_convs.length) { box.innerHTML = '<div class="ai-empty">' + icEmpty + '<div>لا توجد محادثات بعد</div></div>'; return; }
    var q = _search.trim().toLowerCase();
    var list = _convs.filter(function (c) {
      if (!q) return true;
      return (c.user_name || '').toLowerCase().indexOf(q) > -1
        || (c.user_email || '').toLowerCase().indexOf(q) > -1
        || (c.subject || '').toLowerCase().indexOf(q) > -1;
    });
    if (!list.length) { box.innerHTML = '<div class="ai-empty">' + icEmpty + '<div>لا نتائج مطابقة للبحث</div></div>'; return; }
    box.innerHTML = list.map(function (c) {
      var name = c.user_name || c.user_email || 'زائر';
      var subj = c.subject ? ('بخصوص: ' + c.subject) : (c.user_email || 'محادثة عامة');
      var n = _unread[c.id] || 0;
      return '<div class="ai-conv' + (_conv && _conv.id === c.id ? ' active' : '') + '" onclick="window._aiOpen(' + c.id + ')">'
        + '<div class="av">' + esc(avInit(name)) + '</div>'
        + '<div class="mn">'
        + '<div class="nm"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(name) + '</span><span class="tm">' + fmtTime(c.last_message_at || c.created_at) + '</span></div>'
        + '<div class="sub"><span class="txt">' + esc(subj) + '</span><span class="badge' + (n > 0 ? ' show' : '') + '">' + (n > 99 ? '99+' : n) + '</span></div>'
        + '</div></div>';
    }).join('');
  }
  window._aiFilter = function (v) { _search = v || ''; renderConvs(); };

  /* ---------- 6) المحادثة ---------- */
  function adCardHtml(ad) {
    var img = (ad.images && ad.images.length) ? ad.images[0] : '';
    return '<div class="ai-adcard">'
      + (img ? '<img src="' + esc(img) + '" alt="">' : '<div class="noimg">لا صورة</div>')
      + '<div class="ai-adcard-info">'
      + '<div class="t">' + esc(ad.title || 'إعلان') + '</div>'
      + (ad.price ? '<div class="p">' + Number(ad.price).toLocaleString('en-US') + ' ل.س</div>' : '')
      + (ad.ref ? '<div class="r">رمز: ' + esc(ad.ref) + '</div>' : '')
      + '</div></div>';
  }
  function renderMsg(m) {
    var body = document.getElementById('aiBody');
    // فاصل تاريخ عند تغيّر اليوم
    var dayKey = m.created_at ? new Date(m.created_at).toDateString() : '';
    if (dayKey && dayKey !== _lastMsgDay) {
      _lastMsgDay = dayKey;
      var sep = document.createElement('div');
      sep.className = 'ai-datesep';
      sep.textContent = fmtDay(m.created_at);
      body.appendChild(sep);
    }
    var div = document.createElement('div');
    div.className = 'ai-bubble ' + (m.sender_role === 'admin' ? 'me' : 'them');
    div.innerHTML = esc(m.body) + '<span class="time">' + fmtClock(m.created_at) + '</span>';
    body.appendChild(div);
    var t = document.getElementById('aiTyping'); if (t) body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }
  async function markRead(convId) {
    try { await sb.from('messages').update({ read: true }).eq('conversation_id', convId).eq('sender_role', 'user').eq('read', false); } catch (e) {}
    refreshBadge();
  }
  function subscribeThread(convId) {
    if (_msgChannel) { sb.removeChannel(_msgChannel); _msgChannel = null; }
    _msgChannel = sb.channel('ai-thread-' + convId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId },
        function (payload) {
          var m = payload.new;
          if (m.sender_role === 'admin') return; // ردّي معروض مسبقاً
          renderMsg(m); markRead(convId);
        }).subscribe();
  }
  window._aiOpen = async function (convId) {
    _conv = _convs.find(function (c) { return c.id === convId; });
    if (!_conv) return;
    var nm = _conv.user_name || _conv.user_email || 'زائر';
    document.getElementById('aiThreadTitle').textContent = nm;
    document.getElementById('aiThreadSub').textContent = (_conv.subject ? 'بخصوص: ' + _conv.subject : '') + (_conv.user_email ? (_conv.subject ? '  •  ' : '') + _conv.user_email : '');
    var avEl = document.getElementById('aiThreadAv'); if (avEl) { avEl.textContent = avInit(nm); avEl.style.display = 'flex'; }
    document.getElementById('aiList').classList.add('hide');
    document.getElementById('aiThread').classList.add('show');
    document.getElementById('aiEndBtn').style.display = 'flex';
    document.getElementById('aiProfBtn').style.display = 'flex';
    _unread[convId] = 0;
    var body = document.getElementById('aiBody'); body.innerHTML = ''; _lastMsgDay = '';
    // بطاقة الإعلان المرتبط بالمحادثة أعلى الرسائل
    if (_conv.ad_id != null) {
      try {
        var ar = await sb.from('ads').select('id,title,price,images,ref').eq('id', _conv.ad_id).maybeSingle();
        if (ar.data) body.innerHTML = adCardHtml(ar.data);
      } catch (e) {}
    }
    var r = await sb.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: true });
    if (r.error) { body.innerHTML += '<div class="ai-pick">تعذّر تحميل الرسائل</div>'; }
    else if (!r.data.length) { body.innerHTML += '<div class="ai-pick" style="margin:14px auto">لا رسائل بعد — اكتب ردّك بالأسفل</div>'; }
    else r.data.forEach(renderMsg);
    subscribeThread(convId);
    aiJoinRT(convId);          // بثّ "تم بدء الجلسة" + استقبال كتابة الزائر
    markRead(convId);
    loadConversations();
    setTimeout(function () { document.getElementById('aiInput').focus(); }, 100);
  };
  window._aiBackList = function () {
    document.getElementById('aiThread').classList.remove('show');
    document.getElementById('aiList').classList.remove('hide');
    document.getElementById('aiEndBtn').style.display = 'none';
    document.getElementById('aiProfBtn').style.display = 'none';
    if (_rt) { sb.removeChannel(_rt); _rt = null; }
  };
  // إعادة لوحة المحادثة لحالتها الفارغة (مهمّ على سطح المكتب حيث لا تُخفى اللوحة)
  function resetThread() {
    var b = document.getElementById('aiBody'); if (b) b.innerHTML = '<div class="ai-pick">' + icMail + '<div>اختر محادثة من القائمة للبدء بالردّ</div></div>';
    var t = document.getElementById('aiThreadTitle'); if (t) t.textContent = 'اختر محادثة';
    var s = document.getElementById('aiThreadSub'); if (s) s.textContent = '';
    var av = document.getElementById('aiThreadAv'); if (av) av.style.display = 'none';
    var eb = document.getElementById('aiEndBtn'); if (eb) eb.style.display = 'none';
    var pb = document.getElementById('aiProfBtn'); if (pb) pb.style.display = 'none';
    _conv = null; _lastMsgDay = '';
  }
  window._aiEndSession = async function () {
    if (!_conv) return;
    if (!(await window.uiConfirm('سيتم إنهاء الجلسة وحذف هذه المحادثة نهائياً.', { title: 'إنهاء الجلسة', okText: 'إنهاء وحذف', danger: true }))) return;
    var id = _conv.id;
    aiSendSession('end');      // أبلغ الزائر "تم إنهاء الجلسة" قبل الحذف
    await new Promise(function (r) { setTimeout(r, 300); }); // امهل البثّ ليصل للعميل قبل حذف القناة
    var r = await sb.from('conversations').delete().eq('id', id);
    if (r.error) { window.uiToast('تعذّر الحذف: ' + r.error.message, 'error'); return; }
    if (_msgChannel) { sb.removeChannel(_msgChannel); _msgChannel = null; }
    if (_rt) { sb.removeChannel(_rt); _rt = null; }
    delete _unread[id];
    _convs = _convs.filter(function (c) { return c.id !== id; });
    resetThread();             // أفرغ لوحة المحادثة (لا تبقى مفتوحة على سطح المكتب)
    window._aiBackList();
    renderConvs();
    loadConversations();
    refreshBadge();
    window.uiToast && window.uiToast('تم إنهاء الجلسة وحذف المحادثة', 'success');
  };
  window._aiSend = async function () {
    var inp = document.getElementById('aiInput'); var text = inp.value.trim();
    if (!text || !_conv || !_staff) return;
    inp.value = '';
    renderMsg({ sender_role: 'admin', body: text, created_at: new Date().toISOString() });
    var r = await sb.from('messages').insert({ conversation_id: _conv.id, sender_id: _staff.id, sender_role: 'admin', body: text, sender_name: _staffName });
    if (r.error) { window.uiToast('تعذّر الإرسال: ' + r.error.message, 'error'); return; }
    try { await sb.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', _conv.id); } catch (e) {}
  };

  /* ---------- 7) فتح/إغلاق ---------- */
  window._aiLoad = async function () {
    if (!_staff) { var s = await sb.auth.getUser(); _staff = s.data ? s.data.user : null; }
    if (!_staff) return;
    loadConversations();
  };
  window._aiOpenUser = async function (userId) {
    await loadConversations();
    var c = _convs.find(function (x) { return x.user_id === userId; });
    if (c) window._aiOpen(c.id);
    else window.uiToast('لا توجد محادثات لهذا العميل بعد', 'info');
  };
  window._aiOpenProfile = function () {
    if (_conv && window.openCustomerProfile) window.openCustomerProfile(_conv.user_email || '');
  };

  /* ---------- 8) تشغيل ---------- */
  async function loadStaffName() {
    if (!_staff) return;
    try {
      var pr = await sb.from('profiles').select('full_name').eq('user_id', _staff.id).maybeSingle();
      _staffName = (pr.data && pr.data.full_name) || (_staff.user_metadata && _staff.user_metadata.full_name) || 'فريق الدعم';
    } catch (e) { _staffName = (_staff.user_metadata && _staff.user_metadata.full_name) || 'فريق الدعم'; }
  }
  sb.auth.getUser().then(function (s) {
    _staff = s.data ? s.data.user : null;
    if (_staff) { loadStaffName(); refreshBadge(); subscribeList(); }
  });
  sb.auth.onAuthStateChange(function (e, session) {
    _staff = session ? session.user : null;
    if (_staff) { loadStaffName(); refreshBadge(); subscribeList(); }
  });
})();
