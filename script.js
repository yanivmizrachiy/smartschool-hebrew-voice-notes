const txt=document.getElementById('txt');
const statusBox=document.getElementById('status');
const interimBox=document.getElementById('interim');
const installPanel=document.getElementById('installPanel');
const copyNote=document.getElementById('copyNote');

const DRAFT_KEY='yaniv_voice_notes_v12_dedupe';
const OLD_KEYS=['yaniv_tracking_voice_text_v2','yaniv_tracking_voice_text_v3','yaniv_voice_notes_v11'];
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

function save(){
  if(txt)localStorage.setItem(DRAFT_KEY,txt.value||'');
}

function load(){
  if(!txt)return;
  txt.value=localStorage.getItem(DRAFT_KEY)||OLD_KEYS.map(k=>localStorage.getItem(k)).find(Boolean)||'';
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
  load();
  schedule(50);
}

function clearText(){
  if(txt&&confirm('לנקות את כל הטקסט?')){
    txt.value='';
    recent=[];
    localStorage.removeItem(DRAFT_KEY);
    show(statusBox,'');
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
    save();
    schedule();
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
