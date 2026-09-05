(function(){
'use strict';
var deferredPrompt=null,installBtn=null;
function isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true}
function appStatus(m){if(typeof status==='function')status(m)}
function ensureDialog(){
 var d=document.getElementById('pwaInstallDialog');if(d)return d;
 d=document.createElement('dialog');d.id='pwaInstallDialog';
 d.innerHTML='<div class="installCard"><div class="dialogHead"><div><small>APPLICATION</small><h2>Installer MPC Studio</h2></div><button id="pwaInstallClose" type="button">✕</button></div><div class="installHero"><img src="icons/icon-192.png" width="82" height="82" alt=""><div><b>MPC Studio</b><span>Boîte à rythmes · Sampling · Séquençage</span></div></div><div id="pwaInstallInstructions" class="installInstructions"></div><button id="pwaNativeInstall" type="button" class="installPrimary">INSTALLER MAINTENANT</button></div>';
 document.body.appendChild(d);
 d.querySelector('#pwaInstallClose').onclick=function(){d.close()};
 d.querySelector('#pwaNativeInstall').onclick=triggerInstall;
 return d;
}
function instructions(){
 var ua=navigator.userAgent||'',ios=/iPad|iPhone|iPod/.test(ua),android=/Android/.test(ua);
 if(ios)return '<b>Sur iPhone/iPad :</b><ol><li>Ouvre le menu <b>Partager</b> de Safari.</li><li>Choisis <b>Sur l’écran d’accueil</b>.</li><li>Appuie sur <b>Ajouter</b>.</li></ol>';
 if(android)return '<b>Sur Android :</b><ol><li>Appuie sur <b>INSTALLER MAINTENANT</b> si proposé.</li><li>Sinon ouvre le menu <b>⋮</b> du navigateur.</li><li>Choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</li></ol>';
 return '<b>Sur ordinateur :</b><ol><li>Utilise <b>INSTALLER MAINTENANT</b> si proposé.</li><li>Sinon ouvre le menu du navigateur et choisis <b>Installer MPC Studio</b>.</li></ol>';
}
function refresh(){
 if(!installBtn)installBtn=document.getElementById('installPwaBtn');if(!installBtn)return;
 if(isStandalone()){installBtn.hidden=true;return}
 installBtn.hidden=false;installBtn.textContent=deferredPrompt?'⬇ INSTALLER L’APPLICATION':'📲 INSTALLATION PWA';
}
async function triggerInstall(){
 if(isStandalone()){appStatus('MPC Studio est déjà installé');return}
 if(deferredPrompt){
  deferredPrompt.prompt();var choice=await deferredPrompt.userChoice;
  appStatus(choice&&choice.outcome==='accepted'?'Installation de MPC Studio acceptée':'Installation annulée');
  deferredPrompt=null;refresh();var d=document.getElementById('pwaInstallDialog');if(d&&d.open)d.close();return;
 }
 openInstallUi();
}
function openInstallUi(){
 if(deferredPrompt){triggerInstall();return}
 var d=ensureDialog();d.querySelector('#pwaInstallInstructions').innerHTML=instructions();d.querySelector('#pwaNativeInstall').hidden=true;if(!d.open)d.showModal();
}
function applyShortcutMode(){
 var mode=new URLSearchParams(location.search).get('mode');if(!mode)return;
 var b=document.querySelector('.bigModes button[data-mode="'+mode.replace(/[^a-z-]/gi,'')+'"]');if(b)b.click();
}
function connectivity(){
 function update(){document.body.classList.toggle('offline',!navigator.onLine);if(!navigator.onLine)appStatus('Mode hors ligne · les fonctions locales restent disponibles')}
 window.addEventListener('online',update);window.addEventListener('offline',update);update();
}
async function swUpdate(){
 if(!('serviceWorker'in navigator))return;
 try{var reg=await navigator.serviceWorker.ready;if(reg.waiting)appStatus('Mise à jour PWA prête');reg.addEventListener('updatefound',function(){var w=reg.installing;if(!w)return;w.addEventListener('statechange',function(){if(w.state==='installed'&&navigator.serviceWorker.controller)appStatus('Nouvelle version installée · active au prochain lancement')})})}catch(e){}
}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;refresh()});
window.addEventListener('appinstalled',function(){deferredPrompt=null;refresh();appStatus('MPC Studio est installé sur cet appareil')});
document.addEventListener('DOMContentLoaded',function(){installBtn=document.getElementById('installPwaBtn');if(installBtn)installBtn.onclick=openInstallUi;refresh();applyShortcutMode();connectivity();swUpdate();setTimeout(refresh,1200)});
window.MPCPWA={install:openInstallUi,isStandalone:isStandalone};
})();