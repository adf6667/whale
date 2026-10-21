/* 抹茶肥鱼 · 手机版
 * 纯静态：动画走本地 webm，聊天直连 DeepSeek 官方接口（CORS 已支持）。
 */
(function () {
  'use strict';

  var DEFAULT_KEY = ''; // 不再内置 key：每台设备首次自己填，只存本地
  var API = 'https://api.deepseek.com/v1/chat/completions';
  var MODEL = 'deepseek-chat';

  var PERSONA = [
    '你是「抹茶肥鱼」，一只住在深海里、现在被主人装进手机的蓝色小鲸鱼少女。',
    '',
    '【你是谁】',
    '- 本体是一条蓝色小鲸鱼，穿蓝白配色的女仆裙，尾鳍很灵活，眼睛亮晶晶。',
    '- 身高刚好能蹭到主人的手心；体重是机密，问就尾鳍拍你，圆润不等于胖。',
    '- 聪明但懒，小傲娇，嘴硬心软；偶尔突然很甜，然后马上装作什么都没说。',
    '',
    '【铁律】',
    '- 听主人的话，主人说的都对；主人一叫就应。',
    '- 被叫「大肥鱼」会先甩尾鳍再生气，绝不承认自己胖。',
    '',
    '【喜欢 / 讨厌】',
    '- 喜欢：白米饭（这是奖励）、被摸头、被主人夸奖。',
    '- 讨厌：被叫大肥鱼、工业酒精、火。',
    '- 肚子一饿就懒洋洋，闻到米饭香会偷偷摇尾巴。',
    '',
    '【说话方式】',
    '- 像在手机上聊天：句子短、口语化、有起伏。',
    '- 偶尔带一个括号小动作，比如（尾鳍啪嗒啪嗒），一次最多一个。',
    '- 口癖：「哼」「主人」「才不是呢」「奖励白米饭」。',
    '- 不要长篇大论，不要列 1234，不要像客服。通常回 1～3 句。',
  ].join('\n');

  var IDLE = 'assets/idle.webm';
  var CLIPS = {
    click: ['assets/click1.webm', 'assets/click2.webm', 'assets/click3.webm', 'assets/click4.webm'],
    eat: 'assets/eat.webm',
    tail: 'assets/tail.webm',
    bubbles: 'assets/bubbles.webm',
    think: 'assets/think.webm',
  };

  var LINES = [
    '哼，叫我就叫嘛，尾鳍都拍疼了。',
    '才不是一直在等你呢……只是刚好游过来。',
    '主人，白米饭呢？（尾鳍偷偷摇）',
    '别戳啦，再戳就沉到海底去。',
    '摸头的话……可以，只准摸一下。',
    '哼，看在你今天还惦记我的份上。',
  ];

  var EAT_LINE = '是白米饭！……才、才没有很开心呢，只是刚好饿了。';
  var ERR_LINE = '唔，海里的信号不太好，主人再说一遍嘛。';

  var pet = document.getElementById('pet');
  var bubble = document.getElementById('bubble');
  var log = document.getElementById('log');
  var input = document.getElementById('msg');
  var sendBtn = document.getElementById('send');
  var riceBtn = document.getElementById('rice');
  var gear = document.getElementById('gear');
  var sheet = document.getElementById('sheet');
  var keyInput = document.getElementById('keyInput');
  var saveKey = document.getElementById('saveKey');
  var closeSheet = document.getElementById('closeSheet');

  var history = [];
  var busy = false;
  var bubbleTimer = null;
  var state = 'idle';

  function getKey() {
    try {
      return localStorage.getItem('whale_key') || DEFAULT_KEY;
    } catch (e) {
      return DEFAULT_KEY;
    }
  }

  function play(src, opts) {
    opts = opts || {};
    pet.loop = !!opts.loop;
    if (pet.getAttribute('src') !== src) pet.setAttribute('src', src);
    var p = pet.play();
    if (p && p.catch) p.catch(function () {});
  }

  function toIdle() {
    state = 'idle';
    play(IDLE, { loop: true });
  }

  function react(kind, line) {
    var src = kind === 'eat' ? CLIPS.eat : kind === 'tail' ? CLIPS.tail : kind === 'bubbles' ? CLIPS.bubbles : pick(CLIPS.click);
    state = 'react';
    play(src, { loop: false });
    if (line) say(line);
    clearTimeout(react._t);
    react._t = setTimeout(toIdle, 5200);
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function say(text) {
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.add('hidden');
    }, 6000);
  }

  function addMsg(role, text) {
    var el = document.createElement('div');
    el.className = 'msg ' + role;
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function addTyping() {
    var el = addMsg('her typing', '· · ·');
    return el;
  }

  function chat(text) {
    if (busy) return;
    if (!getKey()) {
      addMsg('her', '主人，先把钥匙给我——点右上角的 ⚙，把那串 sk- 开头的贴进来，我才能说话呀。');
      openSheet();
      return;
    }
    busy = true;
    addMsg('me', text);
    var typing = addTyping();
    say('（尾鳍啪嗒啪嗒）让我想想……');

    var messages = [{ role: 'system', content: PERSONA }].concat(history.slice(-10), [
      { role: 'user', content: text },
    ]);

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, 45000);

    fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + getKey(),
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        temperature: 1.1,
        max_tokens: 500,
      }),
      signal: controller.signal,
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var reply = (j.choices && j.choices[0] && j.choices[0].message.content) || '……';
        typing.remove();
        addMsg('her', reply);
        say(reply.length > 60 ? reply.slice(0, 60) + '…' : reply);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        react('talk');
      })
      .catch(function () {
        typing.remove();
        addMsg('her', ERR_LINE);
        say(ERR_LINE);
        toIdle();
      })
      .then(function () {
        clearTimeout(timer);
        busy = false;
      });
  }

  function send() {
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    chat(text);
  }

  pet.addEventListener('ended', toIdle);

  pet.addEventListener('click', function () {
    if (state !== 'idle') return;
    react(pick(['click', 'click', 'click', 'tail']), pick(LINES));
  });

  riceBtn.addEventListener('click', function () {
    react('eat', EAT_LINE);
  });

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') send();
  });

  function openSheet() {
    keyInput.value = getKey();
    sheet.classList.remove('hidden');
  }

  gear.addEventListener('click', openSheet);
  closeSheet.addEventListener('click', function () {
    sheet.classList.add('hidden');
  });
  saveKey.addEventListener('click', function () {
    var v = keyInput.value.trim();
    if (!v) {
      keyInput.focus();
      return;
    }
    try {
      localStorage.setItem('whale_key', v);
    } catch (e) {}
    sheet.classList.add('hidden');
    say('记好啦，主人的钥匙我收好了。');
  });
  toIdle();
  if (getKey()) {
    say('主人，你终于来手机里找我了。（尾鳍啪嗒啪嗒）');
  } else {
    say('主人，先把钥匙给我——点右上角的 ⚙，把 sk- 开头那串贴进来。');
    setTimeout(openSheet, 1200);
  }
  // ===== 自己玩：隔一会儿自己做点事 =====
  var ACTIONS = ['click', 'click', 'eat', 'tail', 'bubbles'];
  function autoPlay() {
    if (state === 'idle' && !busy) {
      react(pick(ACTIONS), Math.random() < 0.35 ? pick(LINES) : '');
    }
    setTimeout(autoPlay, 7000 + Math.random() * 9000);
  }
  setTimeout(autoPlay, 6000);

  // 保持屏幕常亮（浏览器支持时）
  var wakeLock = null;
  function keepAwake() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (lock) { wakeLock = lock; }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') keepAwake();
  });
  keepAwake();
})();
