const txt=document.getElementById('txt');
const statusBox=document.getElementById('status');
const interimBox=document.getElementById('interim');
const installPanel=document.getElementById('installPanel');
const copyNote=document.getElementById('copyNote');

const DRAFT_KEY='yaniv_voice_notes_v15_clearfix';
const CLEAR_FLAG='yaniv_voice_notes_clear_flag_v15';
const OLD_KEYS=[
  'yaniv_tracking_voice_text_v2',
  'yaniv_tracking_voice_text_v3',
  'yaniv_voice_notes_v11',
  'yaniv_voice_notes_v12_dedupe',
  'yaniv_voice_notes_v13_clearfix',
  'yaniv_voice_notes_v14_clearfix'
];

let recognition=null;
let recent=[];
let timer=null;
let copyTimer=null;
let promptEvent=null;

function show(el,msg){
  if(!el)return;
  const t=(msg||'').trim();
  el.hidden=!t;
  el.textContent=t;
}

function norm(s){
  return (s||'')
    .replace(/[.,!?;:()\-]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function words(s){
  const n=norm(s);
  return n?n.split(' ').filter(Boolean):[];
}

function removeAllAppDrafts(){
  OLD_KEYS.forEach(k=>localStorage.removeItem(k));
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith('yaniv_voice_notes_') || k.startsWith('yaniv_tracking_voice_text')){
      localStorage.removeItem(k);
    }
  });
  localStorage.removeItem(DRAFT_KEY);
}

function save(){
  if(!txt)return;
  localStorage.removeItem(CLEAR_FLAG);
  localStorage.setItem(DRAFT_KEY,txt.value||'');
}

function load(){
  if(!txt)return;
  if(localStorage.getItem(CLEAR_FLAG)==='1'){
    txt.value='';
    return;
  }
  txt.value=localStorage.getItem(DRAFT_KEY)||'';
}

function punct(s){
  let x=(s||'').replace(/\s+/g,' ').trim();
  if(!x)return '';

  const commands=[
    ['סימן שאלה','? '],
    ['סימן קריאה','! '],
    ['נקודה','. '],
    ['סוף משפט','. '],
    ['פסיק',', '],
    ['נקודתיים',': '],
    ['שורה חדשה','\n']
  ];
  for(const [a,b] of commands)x=x.replaceAll(a,b);

  const commaWords=['אבל','אולם','עם זאת','בנוסף','כמו כן','לעומת זאת','מצד שני','בכל זאת'];
  for(const w of commaWords){
    x=x.replace(new RegExp('([^.!?\\n,])\\s+'+w+'\\s+','g'),'$1, '+w+' ');
  }

  const openers=['יש להמשיך','יש לעקוב','יש ליצור קשר','מומלץ','נדרש','נדרשת','כדאי','חשוב','לסיכום','בהמשך'];
  for(const p of openers){
    x=x.replace(new RegExp('([^.!?\\n])\\s+'+p+'\\s+','g'),'$1. '+p+' ');
  }

  x=x
    .replace(/\s+([,.!?;:])/g,'$1')
    .replace(/([,.!?;:])([^\s\n])/g,'$1 $2')
    .replace(/([,.!?])\s*\1+/g,'$1')
    .replace(/,\s*\./g,'.')
    .replace(/\.\s*,/g,'.')
    .replace(/\s+/g,' ')
    .trim();

  if(x&&!/[.!?]$/.test(x))x+='.';
  return x;
}

function schedule(ms=700){
  clearTimeout(timer);
  timer=setTimeout(()=>{
    if(!txt||!txt.value.trim())return;
    const end=txt.selectionStart===txt.value.length&&txt.selectionEnd===txt.value.length;
    const fixed=punct(txt.value);
    if(fixed&&fixed!==txt.value){
      txt.value=fixed;
      if(end)txt.setSelectionRange(txt.value.length,txt.value.length);
      save();
    }
  },ms);
}

function onlyNew(current,spoken){
  const a=words(current);
  const b=words(spoken);
  if(!b.length)return '';

  const now=Date.now();
  const bn=b.join(' ');
  recent=recent.filter(x=>now-x.time<15000);

  if(recent.some(x=>x.text===bn))return '';

  const an=a.join(' ');
  const tail=a.slice(-Math.max(24,b.length+8)).join(' ');

  if(an.endsWith(bn)||tail.endsWith(bn))return '';

  let part=b;
  for(let k=Math.min(a.length,b.length,28);k>0;k--){
    if(a.slice(-k).join(' ')===b.slice(0,k).join(' ')){
      part=b.slice(k);
      break;
    }
  }

  return part.join(' ');
}

function appendFinal(spoken){
  if(!txt)return;
  const part=onlyNew(txt.value,spoken);
  if(!part)return;

  if(txt.value&&!txt.value.endsWith(' ')&&!txt.value.endsWith('\n'))txt.value+=' ';
  txt.value+=part;

  recent.push({text:norm(part),time:Date.now()});
  save();
  schedule(650);
}

function initSpeech(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    show(statusBox,'הדפדפן לא תומך בהכתבה. מומלץ Chrome או Edge.');
    return false;
  }

  recognition=new SR();
  recognition.lang='he-IL';
  recognition.continuous=true;
  recognition.interimResults=true;
  recognition.maxAlternatives=1;

  recognition.onstart=()=>{
    recent=[];
    document.body.classList.add('listening');
    show(statusBox,'');
  };

  recognition.onend=()=>{
    document.body.classList.remove('listening');
    if(interimBox)interimBox.textContent='';
    schedule(100);
  };

  recognition.onerror=e=>{
    document.body.classList.remove('listening');
    if(e.error==='not-allowed')show(statusBox,'המיקרופון חסום. אשר הרשאת מיקרופון בדפדפן.');
    else if(e.error==='no-speech')show(statusBox,'לא נקלט דיבור. נסה לדבר ברור יותר.');
    else if(e.error==='network')show(statusBox,'בעיית רשת בזיהוי הדיבור.');
  };

  recognition.onresult=e=>{
    let mid='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const s=(e.results[i][0]&&e.results[i][0].transcript||'').trim();
      if(!s)continue;
      if(e.results[i].isFinal)appendFinal(s);
      else mid+=s+' ';
    }
    if(interimBox)interimBox.textContent=mid;
  };

  return true;
}

function startDictation(){
  localStorage.removeItem(CLEAR_FLAG);
  if(!recognition&&!initSpeech())return;
  try{recognition.start();}
  catch(e){show(statusBox,'ההכתבה כבר פעילה.');}
}

function stopDictation(){
  document.body.classList.remove('listening');
  if(recognition){
    try{recognition.stop();}
    catch(e){}
  }
  if(interimBox)interimBox.textContent='';
  schedule(100);
}

function restoreDraft(){
  localStorage.removeItem(CLEAR_FLAG);
  load();
  schedule(50);
}

function clearText(){
  if(!txt)return;
  if(confirm('לנקות את כל הטקסט?')){
    txt.value='';
    recent=[];
    clearTimeout(timer);
    removeAllAppDrafts();
    localStorage.setItem(CLEAR_FLAG,'1');
    show(statusBox,'הטקסט נוקה ולא יחזור בפתיחה מחדש.');
    show(copyNote,'');
    if(interimBox)interimBox.textContent='';
  }
}

function note(t){
  if(copyNote){
    copyNote.hidden=false;
    copyNote.textContent=t;
    clearTimeout(copyTimer);
    copyTimer=setTimeout(()=>show(copyNote,''),2500);
  }else{
    show(statusBox,t);
  }
}

async function copyText(){
  if(txt){
    txt.value=punct(txt.value);
    save();
  }
  try{
    await navigator.clipboard.writeText(txt.value||'');
    note('הטקסט הועתק');
  }catch(e){
    if(txt){
      txt.select();
      document.execCommand('copy');
    }
    note('הטקסט סומן להעתקה');
  }
}

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  promptEvent=e;
  if(installPanel)installPanel.hidden=false;
});

window.addEventListener('appinstalled',()=>{
  promptEvent=null;
  if(installPanel)installPanel.hidden=true;
});

async function installApp(){
  if(promptEvent){
    const p=promptEvent;
    promptEvent=null;
    p.prompt();
    await p.userChoice.catch(()=>{});
  }else if(installPanel){
    installPanel.hidden=false;
  }
}

async function checkForUpdates(){
  if(navigator.serviceWorker){
    const regs=await navigator.serviceWorker.getRegistrations();
    regs.forEach(r=>r.update());
  }
}

if(txt){
  load();
  txt.addEventListener('input',()=>{
    if(txt.value.trim()){
      save();
      schedule();
    }
  });
  txt.addEventListener('blur',()=>schedule(20));
}

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

window.startDictation=startDictation;
window.stopDictation=stopDictation;
window.copyText=copyText;
window.restoreDraft=restoreDraft;
window.clearText=clearText;
window.installApp=installApp;
window.checkForUpdates=checkForUpdates;


// >>> YANIV_CLEAR_FINAL_OVERRIDE >>>
// Updated: 20260508-150512
// Purpose: make "נקה הכל" permanent, so old drafts do not return after cleaning.
// This override keeps the dictation duplicate guard intact.
(function(){
  const CLEAR_FINAL_FLAG = 'yaniv_clear_text_final_flag_v1';

  function removeAllVoiceDrafts(){
    try {
      Object.keys(localStorage).forEach(function(k){
        if(k.indexOf('yaniv_voice_notes_') === 0 || k.indexOf('yaniv_tracking_voice_text') === 0){
          localStorage.removeItem(k);
        }
      });
    } catch(e) {}
  }

  function setSmallStatus(msg){
    const status = document.getElementById('status');
    if(status){
      status.hidden = !msg;
      status.textContent = msg || '';
    }
  }

  const textarea = document.getElementById('txt');

  if(textarea && localStorage.getItem(CLEAR_FINAL_FLAG) === '1'){
    textarea.value = '';
  }

  if(textarea){
    textarea.addEventListener('input', function(){
      if(textarea.value && textarea.value.trim()) localStorage.removeItem(CLEAR_FINAL_FLAG);
    }, true);
  }

  const previousRestore = window.restoreDraft;
  window.restoreDraft = function(){
    localStorage.removeItem(CLEAR_FINAL_FLAG);
    if(typeof previousRestore === 'function') return previousRestore();
  };

  window.clearText = function(){
    const t = document.getElementById('txt');
    const interim = document.getElementById('interim');
    const copyNote = document.getElementById('copyNote');

    if(!t) return;

    if(confirm('לנקות את כל הטקסט?')){
      t.value = '';
      removeAllVoiceDrafts();
      localStorage.setItem(CLEAR_FINAL_FLAG, '1');

      if(interim) interim.textContent = '';
      if(copyNote){
        copyNote.hidden = true;
        copyNote.textContent = '';
      }

      setSmallStatus('הטקסט נוקה ולא יחזור בפתיחה מחדש.');
      t.focus();
    }
  };
})();
// <<< YANIV_CLEAR_FINAL_OVERRIDE <<<


// >>> YANIV_SMART_PUNCTUATION_V2 >>>
// Updated: 20260508-174506
// Smarter Hebrew punctuation override.
// Keeps the existing dictation duplicate guard and clear-text fixes.
// Improves automatic question detection: "מה נשמע" => "מה נשמע?"
(function(){
  function cleanSpaces(s){
    return (s || '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[־–—]/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function applySpokenCommands(x){
    const commands = [
      ['סימן שאלה', '? '],
      ['שאלה סימן', '? '],
      ['סימן קריאה', '! '],
      ['נקודה', '. '],
      ['סוף משפט', '. '],
      ['פסיק', ', '],
      ['נקודתיים', ': '],
      ['שורה חדשה', '\n'],
      ['סעיף חדש', '\n']
    ];
    for(const pair of commands){
      x = x.replaceAll(pair[0], pair[1]);
    }
    return x;
  }

  function looksLikeQuestion(sentence){
    const s = cleanSpaces(sentence)
      .replace(/[,.!?:;]+$/g, '')
      .trim();

    if(!s) return false;

    const directQuestionPhrases = [
      'מה נשמע',
      'מה שלומך',
      'מה שלומכם',
      'מה שלומכן',
      'מה קורה',
      'מה העניינים',
      'איך הולך',
      'איך היה',
      'איך אפשר',
      'האם אפשר',
      'אפשר בבקשה',
      'אפשר לדעת',
      'אתה יכול',
      'את יכולה',
      'אתם יכולים',
      'אתן יכולות',
      'יש אפשרות',
      'יש מצב'
    ];

    for(const phrase of directQuestionPhrases){
      if(s.includes(phrase)) return true;
    }

    const questionStarts = [
      'מה ',
      'מי ',
      'מתי ',
      'איפה ',
      'היכן ',
      'לאן ',
      'מאיפה ',
      'איך ',
      'למה ',
      'מדוע ',
      'כמה ',
      'איזה ',
      'איזו ',
      'אילו ',
      'האם ',
      'אפשר ',
      'ניתן ',
      'צריך ',
      'כדאי '
    ];

    for(const start of questionStarts){
      if(s.startsWith(start)) return true;
    }

    const embeddedQuestion = /(^|\s)(מה|מי|מתי|איפה|היכן|לאן|איך|למה|מדוע|כמה|האם|אפשר)\s+/.test(s);
    const hasQuestionTone = /(נכון|בסדר|טוב|כן|לא)$/.test(s) && /\b(זה|אפשר|כדאי|צריך|נראה)\b/.test(s);

    return embeddedQuestion || hasQuestionTone;
  }

  function smartEnd(sentence){
    let s = cleanSpaces(sentence);
    if(!s) return '';

    if(/[.!?]$/.test(s)) return s;

    if(looksLikeQuestion(s)) return s + '?';

    return s + '.';
  }

  function splitNaturalClauses(x){
    const breakBefore = [
      'יש להמשיך',
      'יש לעקוב',
      'יש ליצור קשר',
      'יש לשים לב',
      'מומלץ',
      'נדרש',
      'נדרשת',
      'כדאי',
      'חשוב',
      'לסיכום',
      'בהמשך'
    ];

    for(const p of breakBefore){
      x = x.replace(new RegExp('([^.!?\\n])\\s+' + p + '\\s+', 'g'), '$1. ' + p + ' ');
    }

    const commaWords = ['אבל','אולם','עם זאת','בנוסף','כמו כן','לעומת זאת','מצד שני','בכל זאת'];
    for(const w of commaWords){
      x = x.replace(new RegExp('([^.!?\\n,])\\s+' + w + '\\s+', 'g'), '$1, ' + w + ' ');
    }

    return x;
  }

  window.punct = function(s){
    let x = cleanSpaces(s);
    if(!x) return '';

    x = applySpokenCommands(x);
    x = splitNaturalClauses(x);

    x = x
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([,.!?;:])([^\s\n])/g, '$1 $2')
      .replace(/([,.!?])\s*\1+/g, '$1')
      .replace(/,\s*\./g, '.')
      .replace(/\.\s*,/g, '.')
      .replace(/\s+/g, ' ')
      .trim();

    // If text already contains sentence boundaries, only repair the final unfinished part.
    const parts = x.split(/(?<=[.!?])\s+/).filter(Boolean);
    if(parts.length > 1){
      const last = parts.pop();
      parts.push(smartEnd(last));
      return parts.join(' ');
    }

    return smartEnd(x);
  };

  // Also replace global function binding when the original script defined punct as a function declaration.
  try {
    punct = window.punct;
  } catch(e) {}

})();
// <<< YANIV_SMART_PUNCTUATION_V2 <<<
// >>> YANIV_COPY_FEEDBACK_ULTRA_SAFE >>>
// Updated: 20260508-182154
// UX-only wrapper: after copy, show small bottom confirmation.
// Existing copyText is called first and remains the source of truth.
(function(){
  const previousCopyText = window.copyText;

  function showCopyToast(){
    const box = document.getElementById('copyNote');
    if(!box) return;

    box.hidden = false;
    box.textContent = 'הטקסט הועתק';

    clearTimeout(window.__yanivCopyToastTimer);
    window.__yanivCopyToastTimer = setTimeout(function(){
      box.hidden = true;
      box.textContent = '';
    }, 2200);
  }

  window.copyText = async function(){
    if(typeof previousCopyText === 'function') {
      await previousCopyText();
      showCopyToast();
      return;
    }

    const t = document.getElementById('txt');
    if(t) {
      try {
        await navigator.clipboard.writeText(t.value || '');
      } catch(e) {
        t.select();
        document.execCommand('copy');
      }
    }
    showCopyToast();
  };
})();
// <<< YANIV_COPY_FEEDBACK_ULTRA_SAFE <<<


// >>> YANIV_RULES_SYNC_AUDIT_MARKER >>>
// Updated: 20260510-084450
// Purpose: repository consistency marker only.
// Canonical app name: דבר - העתק -- הדבק
// Canonical manager banner: מנוהל ע"י יניב רז
// Permanent update button: NO.
// Temporary pending-update button: YES, only when update waits.
// This marker does not override app behavior.
// <<< YANIV_RULES_SYNC_AUDIT_MARKER <<<
// >>> YANIV_MINIMAL_STABLE_UPDATE_MANAGER >>>
// Updated: 20260510-100432
// Minimal stability patch:
// - No reload while recording.
// - No aggressive repeated update checks.
// - Temporary update button only when update waits.
// - Does not change dictation, punctuation, clear, copy, or premium UI.
(function(){
  let deferredPrompt = null;
  let waitingWorker = null;
  let checking = false;
  let recording = false;
  let lastCheck = 0;

  function byId(id) { return document.getElementById(id); }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function hideInstall() {
    const p = byId('installPanel');
    if(p) p.hidden = true;
  }

  function showInstall() {
    if(isStandalone()) return;
    const p = byId('installPanel');
    if(p) p.hidden = false;
  }

  function hideUpdate() {
    const p = byId('updatePanel');
    if(p) p.hidden = true;
  }

  function showUpdate(worker) {
    waitingWorker = worker || waitingWorker;
    const p = byId('updatePanel');
    if(p) p.hidden = false;
  }

  function status(msg) {
    const s = byId('status');
    if(s) {
      s.hidden = !msg;
      s.textContent = msg || '';
    }
  }

  async function calmUpdateCheck(reason) {
    if(!('serviceWorker' in navigator)) return;
    if(recording || document.body.classList.contains('listening')) return;

    const now = Date.now();
    if(checking) return;
    if(reason !== 'manual' && now - lastCheck < 120000) return;

    checking = true;
    lastCheck = now;

    try {
      const reg = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });

      if(reg.waiting && navigator.serviceWorker.controller) {
        showUpdate(reg.waiting);
      }

      reg.addEventListener('updatefound', function(){
        const worker = reg.installing;
        if(!worker) return;
        worker.addEventListener('statechange', function(){
          if(worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdate(worker);
          }
        });
      });

      try { await reg.update(); } catch(e) {}
    } catch(e) {
      // Silent. App must keep working even if update check fails.
    } finally {
      checking = false;
    }
  }

  window.applyPendingUpdate = function(){
    const t = byId('txt');
    if(t && t.value) {
      try { localStorage.setItem('yaniv_voice_notes_pending_update_backup', t.value); } catch(e) {}
    }

    if(waitingWorker) {
      status('מעדכן את האפליקציה...');
      waitingWorker.postMessage({type:'SKIP_WAITING'});
      setTimeout(function(){ location.reload(); }, 900);
    } else {
      location.reload();
    }
  };

  window.checkForUpdates = function(){
    return calmUpdateCheck('manual');
  };

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    showInstall();
  });

  window.addEventListener('appinstalled', function(){
    deferredPrompt = null;
    document.body.classList.add('installed');
    hideInstall();
  });

  window.installApp = async function(){
    if(isStandalone()) {
      hideInstall();
      return;
    }

    if(!deferredPrompt) {
      showInstall();
      status('אם לא מופיעה התקנה, פתח את תפריט הדפדפן ובחר הוסף למסך הבית.');
      return;
    }

    const p = deferredPrompt;
    deferredPrompt = null;
    p.prompt();

    try {
      const result = await p.userChoice;
      if(result && result.outcome === 'accepted') hideInstall();
    } catch(e) {}
  };

  const oldStart = window.startDictation;
  window.startDictation = function(){
    recording = true;
    hideUpdate();
    status('מקשיב...');
    if(typeof oldStart === 'function') return oldStart();
  };

  const oldStop = window.stopDictation;
  window.stopDictation = function(){
    recording = false;
    if(typeof oldStop === 'function') return oldStop();
  };

  window.addEventListener('load', function(){
    document.title = 'דבר - העתק -- הדבק';

    const h1 = document.querySelector('h1');
    if(h1) h1.textContent = 'דבר - העתק -- הדבק';

    const banner = document.querySelector('.manager-banner');
    if(banner) banner.textContent = 'מנוהל ע"י יניב רז';

    if(isStandalone()) {
      document.body.classList.add('installed');
      hideInstall();
    }

    hideUpdate();

    setTimeout(function(){
      calmUpdateCheck('load');
    }, 5000);
  });

  document.addEventListener('visibilitychange', function(){
    if(!document.hidden && !recording) {
      setTimeout(function(){ calmUpdateCheck('visible'); }, 3000);
    }
  });
})();
// <<< YANIV_MINIMAL_STABLE_UPDATE_MANAGER <<<


// >>> YANIV_SINGLE_UPDATE_MANAGER_AUDIT >>>
// Updated: 20260510-100757
// Repository consistency marker only.
// Active update manager: YANIV_MINIMAL_STABLE_UPDATE_MANAGER.
// Removed obsolete duplicate update managers.
// This marker does not override app behavior.
// <<< YANIV_SINGLE_UPDATE_MANAGER_AUDIT <<<
