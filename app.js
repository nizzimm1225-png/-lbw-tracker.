(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = {
    preview:$('preview'),trackingCanvas:$('trackingCanvas'),calibrationCanvas:$('calibrationCanvas'),trackInfo:$('trackInfo'),resultFlash:$('resultFlash'),resultMain:$('resultMain'),resultSub:$('resultSub'),calibrationHud:$('calibrationHud'),calStep:$('calStep'),calHelp:$('calHelp'),calAutoBtn:$('calAutoBtn'),calSaveBtn:$('calSaveBtn'),calResetBtn:$('calResetBtn'),calCancelBtn:$('calCancelBtn'),calibrateBtn:$('calibrateBtn'),cameraCard:document.querySelector('.camera-card'),cameraBtn:$('cameraBtn'),switchBtn:$('switchBtn'),trackBtn:$('trackBtn'),startOverBtn:$('startOverBtn'),markBallBtn:$('markBallBtn'),reviewOverBtn:$('reviewOverBtn'),endOverBtn:$('endOverBtn'),lbwMarkBtn:$('lbwMarkBtn'),resetOverBtn:$('resetOverBtn'),
    status:$('status'),camInfo:$('camInfo'),bufferInfo:$('bufferInfo'),modeBadge:$('modeBadge'),overNumber:$('overNumber'),ballCount:$('ballCount'),overClock:$('overClock'),ballStrip:$('ballStrip'),timelineDuration:$('timelineDuration'),overTimeline:$('overTimeline'),timelineMarkers:$('timelineMarkers'),qualitySelect:$('qualitySelect'),fpsSelect:$('fpsSelect'),ballColorSelect:$('ballColorSelect'),sensitivitySelect:$('sensitivitySelect'),handednessSelect:$('handednessSelect'),shotSelect:$('shotSelect'),autoDecisionSelect:$('autoDecisionSelect'),decisionSensitivity:$('decisionSensitivity'),calibrationStatus:$('calibrationStatus'),calDot:$('calDot'),calText:$('calText'),decisionStrip:$('decisionStrip'),savedOvers:$('savedOvers'),
    reviewDialog:$('reviewDialog'),reviewTitle:$('reviewTitle'),reviewPlayer:$('reviewPlayer'),reviewVideoWrap:$('reviewVideoWrap'),reviewTrackingCanvas:$('reviewTrackingCanvas'),reviewTrackBtn:$('reviewTrackBtn'),seedBallBtn:$('seedBallBtn'),clearTrailBtn:$('clearTrailBtn'),jumpRow:$('jumpRow'),reviewTimeline:$('reviewTimeline'),reviewTimelineMarkers:$('reviewTimelineMarkers'),reviewPlayhead:$('reviewPlayhead'),reviewTimeLabel:$('reviewTimeLabel'),slowBtn:$('slowBtn'),halfBtn:$('halfBtn'),normalBtn:$('normalBtn'),closeReviewBtn:$('closeReviewBtn')
  };

  let stream=null, recorder=null, facingMode='environment', mimeType='';
  let overActive=false, overStartedAt=0, overSequence=0, chunks=[], initChunk=null, balls=[], lbwMoments=[], autoResults=[];
  let clockTimer=null, db=null, reviewUrl=null, reviewMarks=[], reviewLbw=[], reviewDuration=0;
  let liveTracker=null, reviewTracker=null, trackingEnabled=true, reviewTrackingEnabled=true, decisionEngine=null, resultFlashTimer=null;
  let reviewItemId=null, reviewActiveBall=null, latestDelivery=null;
  const pro={
    metricSpeed:$('metricSpeed'),metricSpeedUnit:$('metricSpeedUnit'),metricSwing:$('metricSwing'),metricTurn:$('metricTurn'),metricDecision:$('metricDecision'),metricConfidence:$('metricConfidence'),
    arCanvas:$('arCanvas'),drsCanvas:$('drsCanvas'),sessionName:$('sessionName'),sessionMode:$('sessionMode'),pitchLength:$('pitchLength'),speedUnit:$('speedUnit'),sessionLabel:$('sessionLabel'),sessionSub:$('sessionSub'),
    summaryBalls:$('summaryBalls'),summarySpeed:$('summarySpeed'),summaryWides:$('summaryWides'),summaryLbw:$('summaryLbw'),pitchMapCanvas:$('pitchMapCanvas'),beehiveCanvas:$('beehiveCanvas'),speedChartCanvas:$('speedChartCanvas'),wagonCanvas:$('wagonCanvas'),
    filterResult:$('filterResult'),filterLength:$('filterLength'),filterLine:$('filterLine'),refreshAnalyticsBtn:$('refreshAnalyticsBtn'),exportDataBtn:$('exportDataBtn'),newSessionBtn:$('newSessionBtn'),clearSessionBtn:$('clearSessionBtn'),setupCalBtn:$('setupCalBtn'),
    quickCalBtn:$('quickCalBtn'),quickTrackBtn:$('quickTrackBtn'),quickReviewBtn:$('quickReviewBtn'),reviewSpeed:$('reviewSpeed'),reviewSwing:$('reviewSwing'),reviewTurn:$('reviewTurn'),reviewCall:$('reviewCall'),
    tagOutcome:$('tagOutcome'),tagIntent:$('tagIntent'),tagFootwork:$('tagFootwork'),tagLoft:$('tagLoft'),tagDirection:$('tagDirection'),saveTagsBtn:$('saveTagsBtn')
  };
  const SESSION_KEY='lbw-pro-session-settings-v1';
  function loadSessionSettings(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY)||'{}');if(s.name)pro.sessionName.value=s.name;if(s.mode)pro.sessionMode.value=s.mode;if(s.pitchLength)pro.pitchLength.value=s.pitchLength;if(s.speedUnit)pro.speedUnit.value=s.speedUnit;}catch(_){} updateSessionRibbon();}
  function saveSessionSettings(){const s={name:pro.sessionName.value.trim()||'Match Session',mode:pro.sessionMode.value,pitchLength:pro.pitchLength.value,speedUnit:pro.speedUnit.value};localStorage.setItem(SESSION_KEY,JSON.stringify(s));updateSessionRibbon();renderAnalytics();}
  function updateSessionRibbon(){if(!pro.sessionLabel)return;pro.sessionLabel.textContent=pro.sessionName.value.trim()||'Match Session';pro.sessionSub.textContent=`${pro.pitchLength.options[pro.pitchLength.selectedIndex]?.text||'22 yards'} · ${ui.handednessSelect?.value==='left'?'left':'right'}-handed striker · ${ui.autoDecisionSelect?.value==='on'?'decision assist on':'decision assist off'}`;pro.metricSpeedUnit.textContent=pro.speedUnit.value;}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function fmtSpeed(mph){if(!Number.isFinite(mph))return '—';return pro.speedUnit?.value==='kph'?`${Math.round(mph*1.60934)}`:`${Math.round(mph)}`;}
  function estimateDeliveryMetrics(pts){
    const usable=pts.filter(p=>Number.isFinite(p.u)&&p.u>-0.15&&p.u<1.25);if(usable.length<5)return {speedMph:null,swingCm:null,turnDeg:null,bounce:null,impact:null,release:null,length:'Unknown',line:'Unknown'};
    const first=usable[0],last=usable[usable.length-1],pitchM=Number(pro.pitchLength?.value||20.12);const dt=Math.max(.05,(last.t-first.t)/1000);const travel=Math.max(0,Math.min(1.15,Math.abs(last.u-first.u)))*pitchM;let speedMph=travel/dt*2.236936; if(!(speedMph>15&&speedMph<125))speedMph=null;
    let bounceIdx=Math.floor(usable.length*.66),best=-1;
    for(let i=2;i<usable.length-2;i++){const u=usable[i].u;if(u<.42||u>.92)continue;const curv=Math.abs((usable[i+1].y-2*usable[i].y+usable[i-1].y))*1000; if(curv>best){best=curv;bounceIdx=i;}}
    const bounce=usable[bounceIdx]||usable[Math.floor(usable.length*.7)];const pre=usable.slice(0,Math.max(3,bounceIdx+1));const preFit=linearFit(pre);let swingCm=null,turnDeg=null;
    if(preFit&&pre.length>=4){let dev=0;for(const q of pre)dev=Math.max(dev,Math.abs(q.lat-preFit.predict(q.u)));swingCm=dev*11.43;}
    if(preFit&&bounce&&last&&last.u>bounce.u+.03){const lateralM=(last.lat-preFit.predict(last.u))*.1143;const longitudinal=Math.max(.4,(last.u-bounce.u)*pitchM);turnDeg=Math.atan2(lateralM,longitudinal)*180/Math.PI;}
    const length=bounce.u>.88?'Yorker':bounce.u>.76?'Full':bounce.u>.60?'Good':'Short';
    const offPoint=(ui.handednessSelect?.value||'right')==='right'?calibration?.sL:calibration?.sR;const offSign=calibrationValid()?Math.sign(axisMetrics(offPoint)?.lat||1):1;const raw=bounce.lat||0;const line=Math.abs(raw)<.42?'Middle':raw*offSign>0?'Off':'Leg';
    return {speedMph,swingCm,turnDeg,bounce:{u:bounce.u,lat:bounce.lat,x:bounce.x,y:bounce.y},impact:{u:last.u,lat:last.lat,x:last.x,y:last.y},release:{u:first.u,lat:first.lat,x:first.x,y:first.y},length,line};
  }
  function compressTrajectory(pts){return pts.filter((_,i)=>i%2===0||i===pts.length-1).slice(-80).map(p=>({x:+p.x.toFixed(4),y:+p.y.toFixed(4),u:+p.u.toFixed(4),lat:+p.lat.toFixed(4),t:Math.round(p.t)}));}
  function updateLiveMetrics(delivery){if(!delivery)return;latestDelivery=delivery;const m=delivery.metrics||{};pro.metricSpeed.textContent=fmtSpeed(m.speedMph);pro.metricSwing.textContent=Number.isFinite(m.swingCm)?m.swingCm.toFixed(1):'—';pro.metricTurn.textContent=Number.isFinite(m.turnDeg)?Math.abs(m.turnDeg).toFixed(1):'—';pro.metricDecision.textContent=delivery.result||'—';pro.metricConfidence.textContent=delivery.confidence?`${Math.round(delivery.confidence*100)}% confidence`:'waiting';drawAR(delivery);}
  function appendAutoDelivery(r){const last=balls[balls.length-1];if(last&&Math.abs(last.offset-r.offset)<2.0)return;const b={number:balls.length+1,offset:r.offset,startOffset:r.startOffset,endOffset:r.endOffset,result:r.result,confidence:r.confidence,metrics:r.metrics,trajectory:r.trajectory,predictedLateral:r.predictedLateral,auto:true,tags:{}};balls.push(b);r.ballNumber=b.number;ui.ballCount.textContent=String(balls.length);renderBalls();updateLiveMetrics(b);renderAnalytics();}
  function drawAR(delivery){const cv=pro.arCanvas;if(!cv||!ui.preview.videoWidth)return;const w=ui.preview.videoWidth,h=ui.preview.videoHeight;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;}const c=cv.getContext('2d');c.clearRect(0,0,w,h);if(!delivery?.trajectory?.length)return;const pts=delivery.trajectory;c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle='rgba(255,92,80,.92)';c.lineWidth=Math.max(3,w/340);c.shadowBlur=10;c.shadowColor='rgba(255,80,65,.7)';c.stroke();const last=pts[pts.length-1];if(Number.isFinite(delivery.predictedLateral)&&calibrationValid()){const S=calibration.sM,ax=calibration.sM.x-calibration.bM.x,ay=calibration.sM.y-calibration.bM.y,L=Math.hypot(ax,ay)||1,nx=-ay/L,ny=ax/L;const half=axisMetrics(S)?.half||.02;const ex=(S.x+nx*delivery.predictedLateral*half)*w,ey=(S.y+ny*delivery.predictedLateral*half)*h;c.setLineDash([14,10]);c.beginPath();c.moveTo(last.x*w,last.y*h);c.lineTo(ex,ey);c.strokeStyle='rgba(255,214,102,.95)';c.lineWidth=Math.max(2,w/450);c.stroke();c.setLineDash([]);}c.restore();}
  async function analyticsDeliveries(){let saved=[];try{saved=await all();}catch(_){}return [...saved.flatMap(o=>o.balls||[]),...balls];}
  function filteredDeliveries(ds){return ds.filter(b=>(pro.filterResult.value==='all'||b.result===pro.filterResult.value)&&(pro.filterLength.value==='all'||b.metrics?.length===pro.filterLength.value)&&(pro.filterLine.value==='all'||b.metrics?.line===pro.filterLine.value));}
  function canvasBase(canvas){const dpr=Math.min(2,window.devicePixelRatio||1),cssW=canvas.clientWidth||canvas.width,cssH=canvas.clientHeight||canvas.height;if(canvas.width!==Math.round(cssW*dpr)||canvas.height!==Math.round(cssH*dpr)){canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr)}const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cssW,cssH);return {c,w:cssW,h:cssH};}
  function dotColour(r){return r==='LBW'?'#ff655f':r==='WIDE'?'#ffd666':r==='REVIEW'?'#70a7ff':'#5cf28a';}
  function drawPitchMap(ds){if(!pro.pitchMapCanvas)return;const {c,w,h}=canvasBase(pro.pitchMapCanvas);c.fillStyle='#0b2517';c.fillRect(w*.18,h*.05,w*.64,h*.9);c.strokeStyle='#dfe8e2';c.lineWidth=2;c.strokeRect(w*.18,h*.05,w*.64,h*.9);[.15,.85].forEach(y=>{c.beginPath();c.moveTo(w*.12,h*y);c.lineTo(w*.88,h*y);c.stroke()});c.strokeStyle='rgba(255,255,255,.25)';c.beginPath();c.moveTo(w/2,h*.05);c.lineTo(w/2,h*.95);c.stroke();ds.forEach(b=>{const p=b.metrics?.bounce;if(!p)return;const x=w/2+clamp(p.lat,-3,3)*(w*.095),y=h*(.95-clamp(p.u,0,1)*.80);c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fillStyle=dotColour(b.result);c.fill();c.strokeStyle='rgba(0,0,0,.45)';c.stroke()});c.fillStyle='#90a79b';c.font='11px -apple-system';c.fillText('Bowler',8,h-9);c.fillText('Striker',8,14);}
  function drawBeehive(ds){if(!pro.beehiveCanvas)return;const {c,w,h}=canvasBase(pro.beehiveCanvas);c.fillStyle='#08130f';c.fillRect(0,0,w,h);c.strokeStyle='#f3e8b1';c.lineWidth=5;const cx=w/2,base=h*.84,sh=h*.42,sw=w*.07;[-1,0,1].forEach(i=>{c.beginPath();c.moveTo(cx+i*sw,base);c.lineTo(cx+i*sw,base-sh);c.stroke()});c.lineWidth=3;c.beginPath();c.moveTo(cx-sw*1.25,base-sh);c.lineTo(cx+sw*1.25,base-sh);c.stroke();ds.forEach(b=>{const p=b.metrics?.impact;if(!p)return;const x=cx+clamp(p.lat,-3.2,3.2)*w*.10;const y=clamp((p.y||.45)*h,.08*h,.9*h);c.beginPath();c.arc(x,y,4,0,Math.PI*2);c.fillStyle=dotColour(b.result);c.fill()});}
  function drawSpeed(ds){if(!pro.speedChartCanvas)return;const {c,w,h}=canvasBase(pro.speedChartCanvas);c.fillStyle='#08130f';c.fillRect(0,0,w,h);const vals=ds.filter(b=>Number.isFinite(b.metrics?.speedMph)).slice(-30);if(!vals.length){c.fillStyle='#789083';c.font='12px -apple-system';c.fillText('Speed appears after tracked deliveries.',14,h/2);return;}const speeds=vals.map(b=>pro.speedUnit.value==='kph'?b.metrics.speedMph*1.60934:b.metrics.speedMph);const min=Math.max(0,Math.min(...speeds)-8),max=Math.max(...speeds)+8;c.strokeStyle='#30493d';c.lineWidth=1;for(let i=0;i<4;i++){const y=18+(h-38)*i/3;c.beginPath();c.moveTo(14,y);c.lineTo(w-12,y);c.stroke()}c.beginPath();speeds.forEach((v,i)=>{const x=14+(w-28)*(i/Math.max(1,speeds.length-1)),y=18+(h-38)*(1-(v-min)/(max-min));i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle='#5cf28a';c.lineWidth=3;c.stroke();c.fillStyle='#9eb1a6';c.font='10px -apple-system';c.fillText(`${Math.round(max)} ${pro.speedUnit.value}`,14,12);c.fillText(`${Math.round(min)} ${pro.speedUnit.value}`,14,h-7);}
  function drawWagon(ds){if(!pro.wagonCanvas)return;const {c,w,h}=canvasBase(pro.wagonCanvas),cx=w/2,cy=h/2,r=Math.min(w,h)*.42;c.fillStyle='#0c2919';c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);c.fill();c.strokeStyle='#385245';c.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*r,cy-Math.sin(a)*r);c.stroke()}let n=0;ds.forEach(b=>{const deg=Number(b.tags?.direction);if(!Number.isFinite(deg))return;n++;const a=(90-deg)*Math.PI/180,rr=r*(b.tags?.outcome==='6'?.95:b.tags?.outcome==='4'?.8:.6);c.beginPath();c.moveTo(cx,cy);c.lineTo(cx+Math.cos(a)*rr,cy-Math.sin(a)*rr);c.strokeStyle=b.tags?.loft==='Lofted'?'#ffd666':'#64e4ff';c.lineWidth=2.5;c.stroke()});if(!n){c.fillStyle='#8ba095';c.font='11px -apple-system';c.textAlign='center';c.fillText('Tag shot direction in review',cx,cy+4);}}
  async function renderAnalytics(){const allDs=await analyticsDeliveries(),ds=filteredDeliveries(allDs);pro.summaryBalls.textContent=allDs.length;const ss=allDs.map(b=>b.metrics?.speedMph).filter(Number.isFinite);const avg=ss.length?ss.reduce((a,b)=>a+b,0)/ss.length:null;pro.summarySpeed.textContent=avg?`${fmtSpeed(avg)} ${pro.speedUnit.value}`:'—';pro.summaryWides.textContent=allDs.filter(b=>b.result==='WIDE').length;pro.summaryLbw.textContent=allDs.filter(b=>b.result==='LBW').length;drawPitchMap(ds);drawBeehive(ds);drawSpeed(ds);drawWagon(ds);}
  function selectReviewBall(number){reviewActiveBall=reviewMarks.find(b=>Number(b.number)===Number(number))||null;const m=reviewActiveBall?.metrics||{};pro.reviewSpeed.textContent=reviewActiveBall?`${fmtSpeed(m.speedMph)} ${pro.speedUnit.value}`:'—';pro.reviewSwing.textContent=Number.isFinite(m.swingCm)?`${m.swingCm.toFixed(1)} cm`:'—';pro.reviewTurn.textContent=Number.isFinite(m.turnDeg)?`${Math.abs(m.turnDeg).toFixed(1)}°`:'—';pro.reviewCall.textContent=reviewActiveBall?.result||'—';pro.tagOutcome.value=reviewActiveBall?.tags?.outcome||'';pro.tagIntent.value=reviewActiveBall?.tags?.intent||'';pro.tagFootwork.value=reviewActiveBall?.tags?.footwork||'';pro.tagLoft.value=reviewActiveBall?.tags?.loft||'';pro.tagDirection.value=reviewActiveBall?.tags?.direction??'';drawDRSReview(reviewActiveBall);}
  function drawDRSReview(ball){const cv=pro.drsCanvas;if(!cv||!ui.reviewPlayer.videoWidth)return;const w=ui.reviewPlayer.videoWidth,h=ui.reviewPlayer.videoHeight;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}const c=cv.getContext('2d');c.clearRect(0,0,w,h);if(!ball?.trajectory?.length)return;c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();ball.trajectory.forEach((p,i)=>{const x=p.x*w,y=p.y*h;i?c.lineTo(x,y):c.moveTo(x,y)});c.strokeStyle='#ff3f32';c.lineWidth=Math.max(4,w/280);c.shadowBlur=9;c.shadowColor='#ff3f32';c.stroke();if(calibrationValid()&&Number.isFinite(ball.predictedLateral??ball.predictedLateral)){const last=ball.trajectory[ball.trajectory.length-1],S=calibration.sM,ax=S.x-calibration.bM.x,ay=S.y-calibration.bM.y,L=Math.hypot(ax,ay)||1,nx=-ay/L,ny=ax/L,half=axisMetrics(S)?.half||.02,pred=ball.predictedLateral;const ex=(S.x+nx*pred*half)*w,ey=(S.y+ny*pred*half)*h;c.setLineDash([12,10]);c.beginPath();c.moveTo(last.x*w,last.y*h);c.lineTo(ex,ey);c.strokeStyle='#ffd666';c.lineWidth=Math.max(3,w/420);c.stroke()}c.restore();}
  async function saveReviewTags(){if(!reviewActiveBall){setStatus('Choose a delivery in review before saving tags.');return;}reviewActiveBall.tags={outcome:pro.tagOutcome.value,intent:pro.tagIntent.value,footwork:pro.tagFootwork.value,loft:pro.tagLoft.value,direction:pro.tagDirection.value};const live=balls.find(b=>b.number===reviewActiveBall.number&&Math.abs((b.offset||0)-(reviewActiveBall.offset||0))<.1);if(live)live.tags={...reviewActiveBall.tags};if(reviewItemId){const item=await getItem(reviewItemId);if(item){const target=(item.balls||[]).find(b=>b.number===reviewActiveBall.number);if(target){target.tags={...reviewActiveBall.tags};await put(item);}}}setStatus(`Tags saved for Ball ${reviewActiveBall.number}.`);renderAnalytics();}
  async function exportSessionData(){const overs=await all();const safe=overs.map(({blob,...o})=>o);const payload={exportedAt:new Date().toISOString(),session:{name:pro.sessionName.value,mode:pro.sessionMode.value,pitchLength:Number(pro.pitchLength.value),speedUnit:pro.speedUnit.value},calibration:calibrationValid()?calibration:null,overs:safe,currentOver:overActive?{overNumber:overSequence,balls,autoResults}:null};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),file=new File([blob],`LBW-Tracker-${Date.now()}.json`,{type:'application/json'});try{if(navigator.canShare?.({files:[file]}))await navigator.share({title:'LBW Tracker session data',files:[file]});else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}catch(e){if(e.name!=='AbortError')setStatus(e.message)}}


  const isLandscape=()=>window.matchMedia('(orientation: landscape)').matches || innerWidth>innerHeight;
  function updateOrientationState(){
    if(stream && !overActive) ui.startOverBtn.disabled=false;
    if(ui.cameraCard&&ui.preview?.videoWidth&&ui.preview?.videoHeight){
      const portrait=ui.preview.videoHeight>ui.preview.videoWidth;
      ui.cameraCard.classList.toggle('portrait-stream',portrait);
      ui.cameraCard.classList.toggle('landscape-stream',!portrait);
      ui.cameraCard.style.aspectRatio=`${ui.preview.videoWidth}/${ui.preview.videoHeight}`;
    }
  }
  const DB_NAME='lbw-over-tracker-db', STORE='overs';

  const fmtTime = ms => { const s=Math.max(0,Math.floor(ms/1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
  const setStatus = msg => ui.status.textContent=msg;
  const setMode = (text,color='green') => { ui.modeBadge.textContent=text; ui.modeBadge.style.background=color==='red'?'var(--red)':color==='blue'?'var(--blue)':color==='amber'?'var(--amber)':'var(--green)'; ui.modeBadge.style.color=color==='blue'||color==='red'?'white':'#050505'; };
  const formatBytes = n => n<1048576?`${Math.round(n/1024)} KB`:`${(n/1048576).toFixed(1)} MB`;
  const formatDate = ms => new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(ms));
  const pickMimeType=()=>['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp8','video/webm'].find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t))||'';


  const CAL_KEY='lbwPitchCalibrationV3';
  const CAL_KEYS=['bL','bM','bR','sL','sM','sR','wL','wR'];
  const CAL_LABELS=['Bowler L','Bowler M','Bowler R','Striker L','Striker M','Striker R','Wide L','Wide R'];
  let calibration=null,calibrationDraft=[],calibrationMode=false,calDragIndex=-1,calPointerId=null;
  try{
    const saved=localStorage.getItem(CAL_KEY)||localStorage.getItem('lbwPitchCalibrationV2');
    if(saved)calibration=JSON.parse(saved);
  }catch(_){}
  const lerp=(a,b,t)=>a+(b-a)*t;
  function calPoint(name){return calibration?.[name]||null;}
  function calibrationArray(src=calibration){return CAL_KEYS.map(k=>src?.[k]).filter(Boolean).map(p=>({x:p.x,y:p.y}));}
  function arrayToCalibration(arr){const out={updatedAt:Date.now(),source:'adjusted'};CAL_KEYS.forEach((k,i)=>out[k]={x:arr[i].x,y:arr[i].y});return out;}
  function defaultCalibration(){
    return [
      {x:.39,y:.80},{x:.50,y:.80},{x:.61,y:.80},
      {x:.465,y:.30},{x:.50,y:.30},{x:.535,y:.30},
      {x:.34,y:.30},{x:.66,y:.30}
    ];
  }
  function calibrationValid(src=calibration){return src&&CAL_KEYS.every(k=>src[k]&&Number.isFinite(src[k].x)&&Number.isFinite(src[k].y));}
  function updateCalibrationStatus(){
    const ok=calibrationValid();
    ui.calDot?.classList.toggle('ok',ok);
    if(ui.calText)ui.calText.textContent=ok?'Pitch calibrated · auto decisions ready':'Pitch not calibrated · auto decisions disabled';
    if(ui.calibrateBtn)ui.calibrateBtn.textContent=ok?'EDIT CALIBRATION':'CALIBRATE';
    drawCalibrationGuide();
  }
  function canvasFit(canvas){const vw=ui.preview.videoWidth||1280,vh=ui.preview.videoHeight||720;if(canvas.width!==vw||canvas.height!==vh){canvas.width=vw;canvas.height=vh;}return {vw,vh};}
  function drawCalibrationGuide(){
    if(!ui.calibrationCanvas)return;
    const {vw,vh}=canvasFit(ui.calibrationCanvas),c=ui.calibrationCanvas.getContext('2d');
    c.clearRect(0,0,vw,vh);
    const pts=calibrationMode?calibrationDraft:(calibrationValid()?calibrationArray():[]);
    if(!pts.length)return;
    c.save();c.lineCap='round';c.lineJoin='round';
    const P=p=>[p.x*vw,p.y*vh];
    c.strokeStyle='rgba(52,199,89,.72)';c.lineWidth=Math.max(2,vw/600);c.setLineDash([10,8]);
    if(pts.length>=6){
      const [bL,bM,bR,sL,sM,sR]=pts;
      [[bL,sL],[bM,sM],[bR,sR]].forEach(pair=>{const a=P(pair[0]),b=P(pair[1]);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();});
      let a=P(bL),b=P(bR);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
      a=P(sL);b=P(sR);c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();
    }
    if(pts.length>=8){
      c.strokeStyle='rgba(255,214,10,.80)';
      const bM=pts[1],sM=pts[4],wL=pts[6],wR=pts[7];
      const axis={x:sM.x-bM.x,y:sM.y-bM.y},len=Math.hypot(axis.x,axis.y)||1,n={x:-axis.y/len,y:axis.x/len};
      [wL,wR].forEach(w=>{const a=P({x:w.x-n.x*.14,y:w.y-n.y*.14}),b=P({x:w.x+n.x*.14,y:w.y+n.y*.14});c.beginPath();c.moveTo(...a);c.lineTo(...b);c.stroke();});
    }
    pts.forEach((p,i)=>{
      const [x,y]=P(p),r=Math.max(8,Math.min(vw,vh)/70);
      c.setLineDash([]);c.beginPath();c.arc(x,y,r,0,Math.PI*2);
      c.fillStyle=i>=6?'#ffd60a':'#34c759';c.fill();
      c.lineWidth=Math.max(2,vw/700);c.strokeStyle=i===calDragIndex?'#ffffff':'rgba(0,0,0,.72)';c.stroke();
      c.fillStyle=i>=6?'#111':'#041008';c.font=`900 ${Math.max(12,Math.min(vw,vh)/55)}px -apple-system`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(i+1),x,y);
      c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle='rgba(255,255,255,.92)';c.font=`700 ${Math.max(10,Math.min(vw,vh)/70)}px -apple-system`;
      c.fillText(CAL_LABELS[i],x+r+4,y-r-2);
    });
    c.restore();
  }

  function frameLuma(){
    if(!ui.preview.videoWidth||!ui.preview.videoHeight)return null;
    const targetW=320,targetH=Math.max(180,Math.round(targetW*ui.preview.videoHeight/ui.preview.videoWidth));
    const cv=document.createElement('canvas');cv.width=targetW;cv.height=targetH;
    const cx=cv.getContext('2d',{willReadFrequently:true});cx.drawImage(ui.preview,0,0,targetW,targetH);
    const data=cx.getImageData(0,0,targetW,targetH).data,luma=new Float32Array(targetW*targetH);
    for(let i=0,j=0;i<data.length;i+=4,j++)luma[j]=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    return {w:targetW,h:targetH,luma};
  }
  function pxLuma(f,x,y){x=Math.max(0,Math.min(f.w-1,x|0));y=Math.max(0,Math.min(f.h-1,y|0));return f.luma[y*f.w+x];}
  function bestHorizontalLine(f,y0,y1){
    let bestY=Math.round((y0+y1)*f.h/2),best=-Infinity;
    const xa=Math.round(f.w*.18),xb=Math.round(f.w*.82);
    for(let y=Math.max(5,Math.round(y0*f.h));y<Math.min(f.h-5,Math.round(y1*f.h));y++){
      let score=0;
      for(let x=xa;x<xb;x+=2){
        const c=pxLuma(f,x,y),around=(pxLuma(f,x,y-4)+pxLuma(f,x,y+4))/2;
        score+=Math.max(0,c-around-5);
      }
      if(score>best){best=score;bestY=y;}
    }
    return {y:bestY/f.h,score:Math.max(0,best)};
  }
  function verticalPeaks(f,y0,y1){
    const scores=[],xa=Math.round(f.w*.18),xb=Math.round(f.w*.82),ya=Math.round(y0*f.h),yb=Math.round(y1*f.h);
    for(let x=xa;x<=xb;x++){
      let score=0;
      for(let y=ya;y<yb;y+=2){
        const c=pxLuma(f,x,y),side=(pxLuma(f,x-4,y)+pxLuma(f,x+4,y))/2;
        score+=Math.max(0,c-side-4);
      }
      scores.push({x,score});
    }
    const local=scores.filter((v,i,a)=>i>1&&i<a.length-2&&v.score>=a[i-1].score&&v.score>=a[i+1].score).sort((a,b)=>b.score-a.score);
    const picked=[];
    for(const p of local){
      if(picked.every(q=>Math.abs(q.x-p.x)>=3)){picked.push(p);if(picked.length>=14)break;}
    }
    return picked;
  }
  function chooseStumpTriplet(peaks,far=false){
    if(peaks.length<3)return null;
    const top=peaks.slice(0,10);let best=null,bestScore=-Infinity;
    for(let i=0;i<top.length;i++)for(let j=i+1;j<top.length;j++)for(let k=j+1;k<top.length;k++){
      const xs=[top[i],top[j],top[k]].sort((a,b)=>a.x-b.x),span=(xs[2].x-xs[0].x);
      const center=(xs[0].x+xs[2].x)/2,centerPenalty=Math.abs(center-160)*(far?.35:.16);
      const idealSpan=far?12:36,spanPenalty=Math.abs(span-idealSpan)*(far?.4:.18);
      const spacingPenalty=Math.abs((xs[1].x-xs[0].x)-(xs[2].x-xs[1].x))*.6;
      const sc=xs.reduce((a,p)=>a+p.score,0)-centerPenalty-spanPenalty-spacingPenalty;
      if(sc>bestScore){bestScore=sc;best=xs;}
    }
    return best;
  }
  function bestWideX(f,strikerY,side,stumpEdge){
    const y=Math.round(strikerY*f.h),xStart=side==='left'?Math.round(f.w*.12):Math.round(stumpEdge*f.w+8),xEnd=side==='left'?Math.round(stumpEdge*f.w-8):Math.round(f.w*.88);
    let bestX=side==='left'?f.w*.34:f.w*.66,best=-Infinity;
    for(let x=Math.max(5,xStart);x<Math.min(f.w-5,xEnd);x++){
      let score=0;
      for(let dy=-8;dy<=8;dy+=2){
        const c=pxLuma(f,x,y+dy),sideLum=(pxLuma(f,x-4,y+dy)+pxLuma(f,x+4,y+dy))/2;
        score+=Math.max(0,c-sideLum-3);
      }
      if(score>best){best=score;bestX=x;}
    }
    return bestX/f.w;
  }
  function autoDetectCalibration(){
    const f=frameLuma();
    if(!f)return {points:defaultCalibration(),confidence:.25};
    const nearLine=bestHorizontalLine(f,.58,.92),farLine=bestHorizontalLine(f,.16,.52);
    const near=chooseStumpTriplet(verticalPeaks(f,.50,.93),false);
    const far=chooseStumpTriplet(verticalPeaks(f,.10,.58),true);
    const d=defaultCalibration();
    const nearXs=near?near.map(p=>p.x/f.w):d.slice(0,3).map(p=>p.x);
    const farXs=far?far.map(p=>p.x/f.w):d.slice(3,6).map(p=>p.x);
    let bY=nearLine.y,sY=farLine.y;
    if(!(bY>.52&&bY<.95))bY=d[1].y;
    if(!(sY>.12&&sY<.56))sY=d[4].y;
    const sLeft=Math.min(...farXs),sRight=Math.max(...farXs);
    let wL=bestWideX(f,sY,'left',sLeft),wR=bestWideX(f,sY,'right',sRight);
    const stumpSpan=Math.max(.02,sRight-sLeft);
    if(wL>=sLeft-.02)wL=Math.max(.06,sLeft-stumpSpan*3.5);
    if(wR<=sRight+.02)wR=Math.min(.94,sRight+stumpSpan*3.5);
    const points=[
      {x:nearXs[0],y:bY},{x:nearXs[1],y:bY},{x:nearXs[2],y:bY},
      {x:farXs[0],y:sY},{x:farXs[1],y:sY},{x:farXs[2],y:sY},
      {x:wL,y:sY},{x:wR,y:sY}
    ];
    const confidence=Math.min(.88,.35+(near?.length===3?.20:0)+(far?.length===3?.20:0)+(nearLine.score>100?.06:0)+(farLine.score>100?.06:0));
    return {points,confidence};
  }
  function applyAutoCalibration(){
    const found=autoDetectCalibration();
    calibrationDraft=found.points;
    calDragIndex=-1;
    ui.calStep.textContent=`Auto-detected · ${Math.round(found.confidence*100)}% initial confidence`;
    ui.calHelp.textContent='Check all 8 markers. Drag any marker that is not exactly on the stump base or wide-line intersection, then tap SAVE POINTS.';
    drawCalibrationGuide();
    setStatus(`Calibration points auto-detected (${Math.round(found.confidence*100)}% initial confidence). Adjust before saving.`);
  }
  function startCalibration(){
    if(!stream){setStatus('Start the camera first.');return;}
    calibrationMode=true;calDragIndex=-1;calPointerId=null;
    liveTracker?.stop();
    ui.calibrationCanvas.classList.add('active');ui.calibrationHud.classList.add('show');
    if(calibrationValid()){
      calibrationDraft=calibrationArray();
      ui.calStep.textContent='Edit saved calibration';
      ui.calHelp.textContent='Drag any numbered marker to correct it. AUTO DETECT can replace all markers with a new camera-based estimate.';
    }else applyAutoCalibration();
    drawCalibrationGuide();setMode('CALIBRATE','blue');
  }
  function finishCalibration(){
    if(calibrationDraft.length!==8){setStatus('Calibration needs all 8 points. Tap AUTO DETECT or RESET DEFAULT first.');return;}
    calibration=arrayToCalibration(calibrationDraft);
    try{localStorage.setItem(CAL_KEY,JSON.stringify(calibration));}catch(_){}
    calibrationMode=false;calDragIndex=-1;calPointerId=null;
    ui.calibrationCanvas.classList.remove('active','dragging');ui.calibrationHud.classList.remove('show');
    updateCalibrationStatus();if(trackingEnabled)liveTracker?.start();
    setMode(overActive?'OVER LIVE':'CAMERA',overActive?'red':'green');
    setStatus('Calibration saved. Tap EDIT CALIBRATION at any time to correct a point later.');
  }
  function cancelCalibration(){
    calibrationMode=false;calDragIndex=-1;calPointerId=null;calibrationDraft=[];
    ui.calibrationCanvas.classList.remove('active','dragging');ui.calibrationHud.classList.remove('show');
    drawCalibrationGuide();if(trackingEnabled)liveTracker?.start();setMode(overActive?'OVER LIVE':'CAMERA',overActive?'red':'green');
  }
  function pointerToCal(e){
    const r=ui.calibrationCanvas.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};
  }
  function nearestCalIndex(p){
    if(!calibrationDraft.length)return -1;
    const r=ui.calibrationCanvas.getBoundingClientRect(),rx=28/Math.max(1,r.width),ry=28/Math.max(1,r.height);
    let best=-1,dist=Infinity;
    calibrationDraft.forEach((q,i)=>{const dx=(q.x-p.x)/rx,dy=(q.y-p.y)/ry,d=dx*dx+dy*dy;if(d<dist){dist=d;best=i;}});
    return dist<=1.7?best:-1;
  }
  function calibrationPointerDown(e){
    if(!calibrationMode)return;
    const p=pointerToCal(e),idx=nearestCalIndex(p);if(idx<0)return;
    calDragIndex=idx;calPointerId=e.pointerId;ui.calibrationCanvas.setPointerCapture?.(e.pointerId);ui.calibrationCanvas.classList.add('dragging');
    calibrationDraft[idx]=p;drawCalibrationGuide();
  }
  function calibrationPointerMove(e){
    if(!calibrationMode||calDragIndex<0||(calPointerId!==null&&e.pointerId!==calPointerId))return;
    calibrationDraft[calDragIndex]=pointerToCal(e);drawCalibrationGuide();
  }
  function calibrationPointerUp(e){
    if(calDragIndex<0)return;
    if(calPointerId===null||e.pointerId===calPointerId){calDragIndex=-1;calPointerId=null;ui.calibrationCanvas.classList.remove('dragging');drawCalibrationGuide();}
  }
  function axisMetrics(p){if(!calibrationValid())return null;const B=calibration.bM,S=calibration.sM,ax=S.x-B.x,ay=S.y-B.y,L2=ax*ax+ay*ay;if(L2<1e-6)return null;const u=((p.x-B.x)*ax+(p.y-B.y)*ay)/L2;const L=Math.sqrt(L2),nx=-ay/L,ny=ax/L;const C={x:B.x+ax*u,y:B.y+ay*u};const signed=(p.x-C.x)*nx+(p.y-C.y)*ny;const bHalf=Math.max(.001,Math.abs((calibration.bR.x-calibration.bL.x)*nx+(calibration.bR.y-calibration.bL.y)*ny)/2);const sHalf=Math.max(.001,Math.abs((calibration.sR.x-calibration.sL.x)*nx+(calibration.sR.y-calibration.sL.y)*ny)/2);const half=Math.max(.001,lerp(bHalf,sHalf,Math.max(0,Math.min(1,u))));return {u,lat:signed/half,nx,ny,half};}
  function wideLimits(){if(!calibrationValid())return null;const a=axisMetrics(calibration.wL),b=axisMetrics(calibration.wR);if(!a||!b)return null;return {min:Math.min(a.lat,b.lat),max:Math.max(a.lat,b.lat)};}
  function linearFit(points){if(points.length<3)return null;let su=0,sl=0,suu=0,sul=0;for(const q of points){su+=q.u;sl+=q.lat;suu+=q.u*q.u;sul+=q.u*q.lat;}const n=points.length,d=n*suu-su*su;if(Math.abs(d)<1e-7)return null;const m=(n*sul-su*sl)/d,b=(sl-m*su)/n;let err=0;for(const q of points){const e=q.lat-(m*q.u+b);err+=e*e;}return {m,b,rmse:Math.sqrt(err/n),predict:u=>m*u+b};}
  function showAutoResult(result,confidence,detail=''){if(!ui.resultFlash)return;clearTimeout(resultFlashTimer);ui.resultMain.textContent=result;ui.resultSub.textContent=`AUTO ASSIST · ${Math.round(confidence*100)}%${detail?' · '+detail:''}`;ui.resultFlash.className=`result-flash show ${result.toLowerCase()}`;resultFlashTimer=setTimeout(()=>ui.resultFlash.className='result-flash',2200);}
  function renderDecisionStrip(){if(!ui.decisionStrip)return;ui.decisionStrip.innerHTML=autoResults.slice(-8).map((r,i)=>`<span class="decision-chip ${r.result}">${r.result} · ${Math.round(r.confidence*100)}%</span>`).join('');}
  class DecisionEngine{
    constructor(){this.points=[];this.lastAcceptedAt=0;this.cooldownUntil=0;}
    reset(){this.points=[];this.lastAcceptedAt=0;}
    onPoint(p){if(!overActive||ui.autoDecisionSelect?.value!=='on'||!calibrationValid())return;const m=axisMetrics(p);if(!m||m.u<-.3||m.u>1.4||Math.abs(m.lat)>12)return;this.points.push({...p,...m});this.points=this.points.filter(q=>p.t-q.t<3300).slice(-90);this.lastAcceptedAt=p.t;}
    onLost(now){if(!overActive||now<this.cooldownUntil||ui.autoDecisionSelect?.value!=='on'||!calibrationValid())return;if(this.points.length<6)return;const pts=this.points.slice();this.points=[];const us=pts.map(p=>p.u),minU=Math.min(...us),maxU=Math.max(...us);if(maxU<.55||maxU-minU<.20)return;const lastFit=linearFit(pts.slice(-Math.min(14,pts.length)));if(!lastFit)return;const pred=lastFit.predict(1),limits=wideLimits(),meanConf=pts.reduce((a,p)=>a+(p.confidence||.5),0)/pts.length,progress=clamp((maxU-.42)/.55,0,1),fitScore=clamp(1-lastFit.rmse/1.5,0,1);let confidence=clamp(.38*meanConf+.32*progress+.30*fitScore,.25,.97);const threshold=ui.decisionSensitivity?.value==='strict'?.72:.60;let result='NOTHING',detail='';const impactLat=pts[pts.length-1].lat,handed=ui.handednessSelect?.value||'right',offPoint=handed==='right'?calibration.sL:calibration.sR,offSign=Math.sign(axisMetrics(offPoint)?.lat||1),impactInLine=Math.abs(impactLat)<=1.12,impactOutsideOff=(impactLat*offSign)>1.12,impactEligible=impactInLine||(ui.shotSelect?.value==='noshot'&&impactOutsideOff);
      if(limits&&(pred<limits.min||pred>limits.max)){result='WIDE';detail='outside calibrated wide corridor';}
      else if(Math.abs(pred)<=1.08&&impactEligible){result='LBW';detail='wicket corridor · impact estimate eligible · review advised';confidence*=.84;}
      else{result='NOTHING';detail=Math.abs(pred)>1.08?'projected clear of wicket':'LBW impact condition not met';}
      if(confidence<threshold){result='REVIEW';detail='low-confidence trajectory';}
      const offset=(performance.now()-overStartedAt)/1000,metrics=estimateDeliveryMetrics(pts),entry={offset,startOffset:Math.max(0,(pts[0].t-overStartedAt)/1000),endOffset:Math.max(0,(pts[pts.length-1].t-overStartedAt)/1000),result,confidence,predictedLateral:pred,detail,handedness,shot:ui.shotSelect?.value||'shot',metrics,trajectory:compressTrajectory(pts)};
      autoResults.push(entry);appendAutoDelivery(entry);renderDecisionStrip();renderLiveTimeline(offset);showAutoResult(result,confidence,`${metrics.speedMph?fmtSpeed(metrics.speedMph)+' '+pro.speedUnit.value+' · ':''}${detail}`);setStatus(`${result} · ${Math.round(confidence*100)}% decision assist. ${detail}`);this.cooldownUntil=now+1400;
    }
  }
  decisionEngine=new DecisionEngine();

  class BallTracker {
    constructor(video,overlay,statusEl=null,hooks={}){
      this.video=video;this.overlay=overlay;this.statusEl=statusEl;this.analysis=document.createElement('canvas');this.ctx=this.analysis.getContext('2d',{willReadFrequently:true});this.octx=overlay.getContext('2d');
      this.running=false;this.prev=null;this.trail=[];this.last=null;this.seed=null;this.lastFrameAt=0;this.misses=0;this.confidence=0;this.raf=0;this.hooks=hooks||{};this.lostFired=false;
      this.boundLoop=t=>this.loop(t);
      overlay.addEventListener('pointerdown',e=>this.seedFromPointer(e));
    }
    settings(){return {colour:ui.ballColorSelect?.value||'auto',sensitivity:ui.sensitivitySelect?.value||'medium'};}
    start(){if(this.running)return;this.running=true;this.overlay.classList.remove('off');this.reset(false);this.raf=requestAnimationFrame(this.boundLoop);}
    stop(){this.running=false;cancelAnimationFrame(this.raf);this.overlay.classList.add('off');this.clearOverlay();if(this.statusEl){this.statusEl.textContent='Ball track off';this.statusEl.className='pill tracker-pill off';}}
    reset(clearSeed=true){this.prev=null;this.trail=[];this.last=null;this.misses=0;this.confidence=0;if(clearSeed)this.seed=null;this.clearOverlay();}
    clearTrail(){this.trail=[];this.last=null;this.seed=null;this.misses=0;this.clearOverlay();}
    clearOverlay(){const c=this.overlay;if(c.width&&c.height)this.octx.clearRect(0,0,c.width,c.height);}
    seedFromPointer(e){
      if(!this.running)return;const r=this.overlay.getBoundingClientRect();if(!r.width||!r.height)return;
      const fx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),fy=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
      this.seed={fx,fy,until:performance.now()+1800};this.last={x:fx,y:fy,t:performance.now()};this.trail=[];this.overlay.classList.remove('seed-mode');this.updateStatus('LOCK SEED',1,'locked');
    }
    updateStatus(text,conf=0,state='searching'){
      if(!this.statusEl)return;this.statusEl.textContent=conf?`${text} ${Math.round(conf*100)}%`:text;this.statusEl.className=`pill tracker-pill ${state}`;
    }
    loop(now){
      if(!this.running)return;
      if(this.video.readyState>=2 && !this.video.paused && now-this.lastFrameAt>60){this.lastFrameAt=now;try{this.process(now);}catch(_){}}
      this.draw(now);this.raf=requestAnimationFrame(this.boundLoop);
    }
    process(now){
      const vw=this.video.videoWidth||0,vh=this.video.videoHeight||0;if(!vw||!vh)return;
      const aw=240,ah=Math.max(100,Math.round(aw*vh/vw));if(this.analysis.width!==aw||this.analysis.height!==ah){this.analysis.width=aw;this.analysis.height=ah;this.prev=null;}
      this.ctx.drawImage(this.video,0,0,aw,ah);const img=this.ctx.getImageData(0,0,aw,ah),d=img.data;
      if(!this.prev){this.prev=new Uint8ClampedArray(d);return;}
      const prev=this.prev,step=2,gw=Math.floor(aw/step),gh=Math.floor(ah/step),mask=new Uint8Array(gw*gh),scores=new Float32Array(gw*gh);
      const cfg=this.settings(),motionThreshold=cfg.sensitivity==='high'?32:cfg.sensitivity==='low'?58:44;
      const yMin=Math.floor(gh*.08),yMax=Math.ceil(gh*.92),xMin=Math.floor(gw*.025),xMax=Math.ceil(gw*.975);
      for(let gy=yMin;gy<yMax;gy++)for(let gx=xMin;gx<xMax;gx++){
        const x=gx*step+1,y=gy*step+1,pi=(y*aw+x)*4,r=d[pi],g=d[pi+1],b=d[pi+2];
        const diff=(Math.abs(r-prev[pi])+Math.abs(g-prev[pi+1])+Math.abs(b-prev[pi+2]))/3;if(diff<motionThreshold)continue;
        const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=.299*r+.587*g+.114*b;
        const isWhite=lum>135 && (max-min)<88;
        const isRed=r>90 && r>g*1.22 && r>b*1.12 && r-((g+b)/2)>28;
        const colourOK=cfg.colour==='white'?isWhite:cfg.colour==='red'?isRed:(isWhite||isRed);
        if(!colourOK)continue;
        const idx=gy*gw+gx;mask[idx]=1;scores[idx]=diff+(isRed?32:20);
      }
      const seen=new Uint8Array(mask.length),components=[];
      const dirs=[-1,1,-gw,gw,-gw-1,-gw+1,gw-1,gw+1];
      for(let idx=0;idx<mask.length;idx++){
        if(!mask[idx]||seen[idx])continue;const q=[idx];seen[idx]=1;let qi=0,n=0,sumX=0,sumY=0,sumS=0,minX=1e9,maxX=-1,minY=1e9,maxY=-1;
        while(qi<q.length && n<120){const cur=q[qi++],cy=Math.floor(cur/gw),cx=cur-cy*gw;n++;sumX+=cx;sumY+=cy;sumS+=scores[cur];minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
          for(const delta of dirs){const ni=cur+delta;if(ni<0||ni>=mask.length||seen[ni]||!mask[ni])continue;const ny=Math.floor(ni/gw),nx=ni-ny*gw;if(Math.abs(nx-cx)>1||Math.abs(ny-cy)>1)continue;seen[ni]=1;q.push(ni);}
        }
        const bw=maxX-minX+1,bh=maxY-minY+1;if(n<1||n>55||bw>14||bh>14)continue;
        const fx=((sumX/n)*step+1)/aw,fy=((sumY/n)*step+1)/ah,compact=n/(bw*bh),base=(sumS/n)+Math.min(n,14)*1.6+compact*18;
        components.push({fx,fy,n,bw,bh,base});
      }
      this.prev.set(d);
      if(!components.length){this.miss(now);return;}
      const anchor=this.seed&&this.seed.until>now?{x:this.seed.fx,y:this.seed.fy}:this.last;
      let best=null,bestScore=-1e9;
      for(const c of components){let sc=c.base;if(anchor){const dx=c.fx-anchor.x,dy=c.fy-anchor.y,dist=Math.hypot(dx,dy);sc+=Math.max(-40,55-dist*185);if(dist>.48)sc-=70;}else{sc+=18*(1-Math.abs(c.fy-.5));}
        if(sc>bestScore){best=c;bestScore=sc;}
      }
      if(!best||bestScore<48){this.miss(now);return;}
      const p={x:best.fx,y:best.fy,t:now,confidence:Math.max(.25,Math.min(.98,(bestScore-35)/95))};this.last=p;this.misses=0;this.lostFired=false;this.confidence=p.confidence;this.trail.push(p);this.trail=this.trail.filter(x=>now-x.t<1500).slice(-28);this.updateStatus('BALL',p.confidence,'locked');try{this.hooks.onPoint?.(p);}catch(_){}
    }
    miss(now){this.misses++;this.trail=this.trail.filter(x=>now-x.t<1300);if(this.misses>9&&!this.lostFired){this.lostFired=true;try{this.hooks.onLost?.(now);}catch(_){}}if(this.misses>11)this.last=null;this.updateStatus('SEARCHING',0,'searching');}
    draw(now){
      const vw=this.video.videoWidth||1280,vh=this.video.videoHeight||720;if(this.overlay.width!==vw||this.overlay.height!==vh){this.overlay.width=vw;this.overlay.height=vh;}
      const c=this.octx;c.clearRect(0,0,vw,vh);const pts=this.trail.filter(p=>now-p.t<1500);if(!pts.length){if(this.seed&&this.seed.until>now){c.strokeStyle='#ffd60a';c.lineWidth=Math.max(3,vw/420);c.beginPath();c.arc(this.seed.fx*vw,this.seed.fy*vh,Math.max(9,vw/110),0,Math.PI*2);c.stroke();}return;}
      c.save();c.lineCap='round';c.lineJoin='round';c.shadowBlur=Math.max(6,vw/170);c.shadowColor='rgba(57,255,136,.75)';
      c.beginPath();pts.forEach((p,i)=>{const x=p.x*vw,y=p.y*vh;i?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle='rgba(57,255,136,.88)';c.lineWidth=Math.max(3,vw/360);c.stroke();
      pts.forEach((p,i)=>{const age=Math.max(0,1-(now-p.t)/1500);c.beginPath();c.arc(p.x*vw,p.y*vh,Math.max(3,vw/420)*(.65+age*.55),0,Math.PI*2);c.fillStyle=`rgba(57,255,136,${.25+.7*age})`;c.fill();});
      const last=pts[pts.length-1];c.beginPath();c.arc(last.x*vw,last.y*vh,Math.max(8,vw/140),0,Math.PI*2);c.strokeStyle='#ffffff';c.lineWidth=Math.max(2,vw/600);c.stroke();c.beginPath();c.arc(last.x*vw,last.y*vh,Math.max(5,vw/210),0,Math.PI*2);c.fillStyle='#39ff88';c.fill();
      if(pts.length>=4){const a=pts[Math.max(0,pts.length-4)],b=last,dt=Math.max(1,b.t-a.t),vx=(b.x-a.x)/dt,vy=(b.y-a.y)/dt,look=230;let ex=b.x+vx*look,ey=b.y+vy*look;const scale=Math.min(1,.32/Math.max(Math.abs(ex-b.x),Math.abs(ey-b.y),.001));ex=b.x+(ex-b.x)*scale;ey=b.y+(ey-b.y)*scale;c.setLineDash([12,10]);c.beginPath();c.moveTo(b.x*vw,b.y*vh);c.lineTo(ex*vw,ey*vh);c.strokeStyle='rgba(255,214,10,.85)';c.lineWidth=Math.max(2,vw/520);c.stroke();c.setLineDash([]);}
      c.restore();
    }
  }

  function setLiveTracking(on){
    trackingEnabled=!!on;if(!liveTracker&&ui.preview&&ui.trackingCanvas)liveTracker=new BallTracker(ui.preview,ui.trackingCanvas,ui.trackInfo,{onPoint:p=>decisionEngine?.onPoint(p),onLost:n=>decisionEngine?.onLost(n)});
    if(trackingEnabled&&stream){liveTracker.start();ui.trackBtn.textContent='BALL TRACK ON';ui.trackBtn.classList.add('primary');ui.trackBtn.classList.remove('secondary');}
    else{liveTracker?.stop();ui.trackBtn.textContent='BALL TRACK OFF';ui.trackBtn.classList.remove('primary');ui.trackBtn.classList.add('secondary');}
  }
  function setReviewTracking(on){
    reviewTrackingEnabled=!!on;if(!reviewTracker&&ui.reviewPlayer&&ui.reviewTrackingCanvas)reviewTracker=new BallTracker(ui.reviewPlayer,ui.reviewTrackingCanvas,null);
    if(reviewTrackingEnabled){reviewTracker.start();ui.reviewTrackBtn.textContent='TRACK ON';ui.reviewTrackBtn.classList.add('primary');ui.reviewTrackBtn.classList.remove('secondary');}
    else{reviewTracker?.stop();ui.reviewTrackBtn.textContent='TRACK OFF';ui.reviewTrackBtn.classList.remove('primary');ui.reviewTrackBtn.classList.add('secondary');}
  }

  function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
  function put(v){return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  function del(id){return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});}
  function all(){return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const r=tx.objectStore(STORE).getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});}

  async function startCamera(){
    if(stream){await stopCamera();return;}
    if(!window.isSecureContext){setStatus('Camera needs HTTPS. Open the published GitHub Pages URL.');return;}
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setStatus('Current Safari camera recording APIs are required.');return;}
    try{
      const q=Number(ui.qualitySelect.value),fps=Number(ui.fpsSelect.value),portrait=!isLandscape();
      const longSide=q===1080?1920:1280,shortSide=q===1080?1080:720;
      stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facingMode},width:{ideal:portrait?shortSide:longSide},height:{ideal:portrait?longSide:shortSide},frameRate:{ideal:fps,max:fps}}});
      ui.preview.srcObject=stream;await ui.preview.play();
      const settings=stream.getVideoTracks()[0]?.getSettings?.()||{};
      ui.camInfo.textContent=`${settings.width||ui.preview.videoWidth||''}×${settings.height||ui.preview.videoHeight||''}${settings.frameRate?' · '+Math.round(settings.frameRate)+'fps':''}`;
      updateOrientationState();
      ui.cameraBtn.textContent='Stop Camera';ui.switchBtn.disabled=false;ui.trackBtn.disabled=false;ui.calibrateBtn.disabled=false;ui.startOverBtn.disabled=false;setLiveTracking(trackingEnabled);updateCalibrationStatus();setMode('CAMERA');
      setStatus(calibrationValid()?'Camera ready in portrait or landscape. Check EDIT CALIBRATION if the phone/tripod moved.':'Camera ready. Tap CALIBRATE: AUTO DETECT will suggest the 8 pitch points, then drag any incorrect marker and save.');
    }catch(e){setStatus(`Camera could not start: ${e.message}. Check Safari camera permission.`);}
  }

  async function stopCamera(){
    if(overActive) endOver(false);
    if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch(_){}}
    recorder=null;liveTracker?.stop();if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;ui.preview.srcObject=null;
    clearInterval(clockTimer);ui.cameraBtn.textContent='Start Camera';ui.switchBtn.disabled=true;ui.trackBtn.disabled=true;ui.calibrateBtn.disabled=true;ui.startOverBtn.disabled=true;disableOverControls();ui.camInfo.textContent='Camera off';setMode('READY');setStatus('Camera stopped.');
  }

  function disableOverControls(){ui.markBallBtn.disabled=true;ui.reviewOverBtn.disabled=true;ui.endOverBtn.disabled=true;ui.lbwMarkBtn.disabled=true;ui.resetOverBtn.disabled=true;}

  function createRecorder(){
    mimeType=pickMimeType();const opts={videoBitsPerSecond:Number(ui.qualitySelect.value)===1080?5_000_000:3_000_000};if(mimeType)opts.mimeType=mimeType;
    try{return new MediaRecorder(stream,opts);}catch(_){delete opts.videoBitsPerSecond;return mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);}
  }

  async function startOver(){
    if(!stream)return;
    if(overActive&&!confirm('Reset the current over buffer and start a new over?'))return;
    if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch(_){}}
    overActive=true;overStartedAt=performance.now();overSequence+=1;chunks=[];initChunk=null;balls=[];lbwMoments=[];autoResults=[];decisionEngine?.reset();renderDecisionStrip();liveTracker?.reset();
    recorder=createRecorder();mimeType=recorder.mimeType||mimeType||'video/mp4';
    recorder.ondataavailable=e=>{if(!e.data||!e.data.size)return;if(!initChunk)initChunk=e.data;chunks.push({blob:e.data,at:performance.now()});updateClock();};
    recorder.onerror=e=>setStatus(`Recorder error: ${e.error?.message||'unknown error'}`);
    recorder.start(1000);
    ui.overNumber.textContent=String(overSequence);ui.ballCount.textContent='0';ui.timelineDuration.textContent='00:00';renderBalls();
    ui.startOverBtn.textContent='START NEXT OVER';ui.markBallBtn.disabled=false;ui.reviewOverBtn.disabled=false;ui.endOverBtn.disabled=false;ui.lbwMarkBtn.disabled=false;ui.resetOverBtn.disabled=false;
    setMode('OVER LIVE','red');setStatus(calibrationValid()?'Over buffer running. Auto decision assist is armed; mark each completed delivery for the timeline.':'Over buffer running, but auto decisions need CALIBRATE first.');
    clearInterval(clockTimer);clockTimer=setInterval(updateClock,500);updateClock();
  }

  function updateClock(){if(!overActive)return;const elapsed=performance.now()-overStartedAt;ui.overClock.textContent=fmtTime(elapsed);ui.bufferInfo.textContent=`Over ${fmtTime(elapsed)}`;ui.timelineDuration.textContent=fmtTime(elapsed);renderLiveTimeline(elapsed/1000);}

  function markBall(){
    if(!overActive)return;const offset=(performance.now()-overStartedAt)/1000,last=balls[balls.length-1];if(last&&offset-last.offset<2.2){setStatus(`Ball ${last.number} was already captured automatically. Use review if you need to inspect it.`);return;}const recent=[...autoResults].reverse().find(r=>!r.ballNumber&&offset-r.offset>=0&&offset-r.offset<8);const ball={number:balls.length+1,offset,result:recent?.result||'REVIEW',confidence:recent?.confidence||null,metrics:recent?.metrics||null,trajectory:recent?.trajectory||[],predictedLateral:recent?.predictedLateral,auto:false,tags:{}};if(recent)recent.ballNumber=ball.number;balls.push(ball);ui.ballCount.textContent=String(balls.length);renderBalls();updateLiveMetrics(ball);renderAnalytics();setStatus(`Ball ${balls.length} marked manually at ${fmtTime(offset*1000)}.`);
  }
  function markLBW(){if(!overActive)return;const offset=(performance.now()-overStartedAt)/1000;lbwMoments.push(offset);renderLiveTimeline(offset);setStatus(`LBW moment marked at ${fmtTime(offset*1000)}. Tap the red diamond or REVIEW OVER to inspect it.`);}

  function renderBalls(){
    if(!balls.length){ui.ballStrip.innerHTML='<span class="meta">No deliveries captured yet.</span>';} else ui.ballStrip.innerHTML=balls.map(b=>`<button class="ball-chip result-${b.result||'REVIEW'}" data-ball="${b.number}">B${b.number} · ${b.result||'REVIEW'}${b.metrics?.speedMph?' · '+fmtSpeed(b.metrics.speedMph):''}</button>`).join('');renderLiveTimeline(overActive?(performance.now()-overStartedAt)/1000:0);
  }

  const pct=(value,total)=>total>0?Math.max(1,Math.min(99,(value/total)*100)):1;
  const ballSeekTime=b=>Math.max(0,(b?.offset||0)-6);

  function renderLiveTimeline(totalSeconds){
    const total=Math.max(totalSeconds,1);
    const markers=[];
    balls.forEach(b=>markers.push(`<button class="timeline-marker" style="left:${pct(b.offset,total)}%" data-ball="${b.number}" title="Ball ${b.number} at ${fmtTime(b.offset*1000)}">${b.number}</button>`));
    lbwMoments.forEach((t,i)=>markers.push(`<button class="timeline-marker lbw" style="left:${pct(t,total)}%" data-lbw="${i}" title="LBW ${i+1} at ${fmtTime(t*1000)}">LBW</button>`));autoResults.forEach((r,i)=>markers.push(`<span class="decision-chip ${r.result}" style="position:absolute;top:42px;left:${pct(r.offset,total)}%;transform:translateX(-50%);padding:3px 5px;z-index:5" title="${r.result} ${Math.round(r.confidence*100)}%">${r.result}</span>`));
    ui.timelineMarkers.innerHTML=markers.join('');
  }

  function renderReviewTimeline(){
    const duration=reviewDuration||ui.reviewPlayer.duration||1;
    const markers=[];
    reviewMarks.forEach(b=>markers.push(`<button class="timeline-marker" style="left:${pct(b.offset,duration)}%" data-review-time="${ballSeekTime(b)}" data-review-ball="${b.number}" title="Replay Ball ${b.number}">${b.number}</button>`));
    reviewLbw.forEach((t,i)=>markers.push(`<button class="timeline-marker lbw" style="left:${pct(t,duration)}%" data-review-time="${Math.max(0,t-6)}" data-review-lbw="${i}" title="Replay LBW ${i+1}">LBW</button>`));
    ui.reviewTimelineMarkers.innerHTML=markers.join('');
    updateReviewPlayhead();
  }

  function updateReviewPlayhead(){
    const duration=ui.reviewPlayer.duration||reviewDuration||1;
    const now=Number.isFinite(ui.reviewPlayer.currentTime)?ui.reviewPlayer.currentTime:0;
    ui.reviewPlayhead.style.left=`${Math.max(0,Math.min(100,(now/duration)*100))}%`;
    ui.reviewTimeLabel.textContent=`${fmtTime(now*1000)} / ${fmtTime(duration*1000)}`;
    let active=null;
    reviewMarks.forEach(b=>{if(now>=ballSeekTime(b))active=b.number;});
    ui.reviewTimelineMarkers.querySelectorAll('[data-review-ball]').forEach(el=>el.classList.toggle('review-active',Number(el.dataset.reviewBall)===active));
  }

  function currentBlob(){
    const parts=chunks.map(c=>c.blob);if(initChunk&&parts[0]!==initChunk)parts.unshift(initChunk);return parts.length?new Blob(parts,{type:mimeType||parts[0].type||'video/mp4'}):null;
  }

  async function reviewCurrentOver(){
    if(!overActive||!chunks.length){setStatus('Wait a moment for the over buffer to contain video.');return;}
    if(recorder?.state==='recording'&&recorder.requestData){try{recorder.requestData();await new Promise(r=>setTimeout(r,120));}catch(_){}}
    const blob=currentBlob();if(!blob)return;
    openReview(blob,balls,lbwMoments,`Over ${overSequence} · LIVE`,(performance.now()-overStartedAt)/1000);
    setStatus('Review opened. Recording continues behind the review screen; close it to return to live view.');
  }

  function openReview(blob,ballMarks,lbw,title,durationHint=0,itemId=null){
    if(reviewUrl)URL.revokeObjectURL(reviewUrl);
    reviewUrl=URL.createObjectURL(blob);ui.reviewPlayer.src=reviewUrl;ui.reviewPlayer.playbackRate=1;
    reviewMarks=[...(ballMarks||[])];reviewLbw=[...(lbw||[])];reviewDuration=durationHint||0;reviewItemId=itemId;ui.reviewTitle.textContent=title||'Over review';
    const jumps=[];reviewMarks.forEach(b=>jumps.push(`<button data-time="${ballSeekTime(b)}">Ball ${b.number}</button>`));reviewLbw.forEach((t,i)=>jumps.push(`<button data-time="${Math.max(0,t-6)}">LBW ${i+1}</button>`));
    ui.jumpRow.innerHTML=jumps.length?jumps.join(''):`<span class="meta">No delivery markers in this over.</span>`;
    ui.reviewDialog.showModal();setReviewTracking(reviewTrackingEnabled);reviewTracker?.reset();renderReviewTimeline();selectReviewBall(reviewMarks[0]?.number||null);
  }

  async function endOver(save=true){
    if(!overActive)return;
    overActive=false;clearInterval(clockTimer);
    if(recorder&&recorder.state!=='inactive'){
      await new Promise(resolve=>{const old=recorder.onstop;recorder.onstop=e=>{if(old)old(e);resolve();};try{recorder.stop();}catch(_){resolve();}});
    }
    const blob=currentBlob();const duration=(performance.now()-overStartedAt)/1000;
    if(save&&blob){
      const item={id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,createdAt:Date.now(),sessionName:pro.sessionName?.value||'Match Session',sessionMode:pro.sessionMode?.value||'match',overNumber:overSequence,duration,balls:[...balls],lbwMoments:[...lbwMoments],autoResults:[...autoResults],calibration:calibrationValid()?calibration:null,mimeType:blob.type,size:blob.size,blob};
      try{await put(item);setStatus(`Over ${overSequence} saved locally (${formatBytes(blob.size)}). Start the next over to reset the live buffer.`);await renderSaved();}catch(e){setStatus(`Could not save the over: ${e.message}`);}
    }else setStatus('Over ended. Start the next over to reset the buffer.');
    recorder=null;disableOverControls();ui.startOverBtn.disabled=false;ui.startOverBtn.textContent='START NEXT OVER';setMode('OVER ENDED','amber');
  }

  function resetOver(){if(!overActive)return;if(confirm('Clear this over buffer and immediately restart it?'))startOver();}

  async function renderSaved(){
    const items=(await all()).sort((a,b)=>b.createdAt-a.createdAt);if(!items.length){ui.savedOvers.innerHTML='<div class="empty">No overs saved yet.</div>';return;}
    ui.savedOvers.innerHTML=items.map(i=>{const d=Math.max(i.duration||1,1);const ballDots=(i.balls||[]).map(b=>`<span class="saved-dot" style="left:${pct(b.offset,d)}%" title="Ball ${b.number}"></span>`).join('');const lbwDots=(i.lbwMoments||[]).map(t=>`<span class="saved-dot lbw" style="left:${pct(t,d)}%"></span>`).join('');return `<article class="saved-card" data-id="${i.id}"><div class="saved-head"><div><div class="saved-title">${i.sessionName||'Session'} · Over ${i.overNumber}</div><div class="meta">${formatDate(i.createdAt)} · ${fmtTime(i.duration*1000)} · ${i.balls?.length||0} balls · ${(i.autoResults||[]).map(r=>r.result).join(' / ')||'no auto results'} · ${formatBytes(i.size||0)}</div></div></div><div class="saved-mini-timeline">${ballDots}${lbwDots}</div><div class="saved-actions"><button class="secondary" data-action="play">Review timeline</button><button class="secondary" data-action="share">Share</button><button class="danger" data-action="delete">Delete</button></div></article>`;}).join('');
  }

  async function getItem(id){return (await all()).find(x=>x.id===id);}
  async function shareItem(item){
    const ext=(item.mimeType||'').includes('webm')?'webm':'mp4';const f=new File([item.blob],`LBW-Over-${item.overNumber}.${ext}`,{type:item.mimeType||item.blob.type});
    try{if(navigator.canShare?.({files:[f]}))await navigator.share({title:`LBW Over ${item.overNumber}`,files:[f]});else throw new Error('File sharing is not available here.');}catch(e){if(e.name!=='AbortError')setStatus(e.message);}
  }

  ui.calibrateBtn.addEventListener('click',startCalibration);
  ui.calibrationCanvas.addEventListener('pointerdown',calibrationPointerDown);
  ui.calibrationCanvas.addEventListener('pointermove',calibrationPointerMove);
  ui.calibrationCanvas.addEventListener('pointerup',calibrationPointerUp);
  ui.calibrationCanvas.addEventListener('pointercancel',calibrationPointerUp);
  ui.calAutoBtn.addEventListener('click',applyAutoCalibration);
  ui.calSaveBtn.addEventListener('click',finishCalibration);
  ui.calResetBtn.addEventListener('click',()=>{calibrationDraft=defaultCalibration();calDragIndex=-1;ui.calStep.textContent='Default calibration loaded';ui.calHelp.textContent='Drag all markers onto the real stump bases and wide-line intersections, then SAVE POINTS.';drawCalibrationGuide();});
  ui.calCancelBtn.addEventListener('click',cancelCalibration);ui.cameraBtn.addEventListener('click',startCamera);
  ui.trackBtn.addEventListener('click',()=>setLiveTracking(!trackingEnabled));
  ui.switchBtn.addEventListener('click',async()=>{facingMode=facingMode==='environment'?'user':'environment';if(stream){await stopCamera();await startCamera();}});
  ui.startOverBtn.addEventListener('click',startOver);ui.markBallBtn.addEventListener('click',markBall);ui.reviewOverBtn.addEventListener('click',reviewCurrentOver);ui.endOverBtn.addEventListener('click',()=>endOver(true));ui.lbwMarkBtn.addEventListener('click',markLBW);ui.resetOverBtn.addEventListener('click',resetOver);
  const reviewBallFromLive=async number=>{const mark=balls[Number(number)-1];if(!mark)return;await reviewCurrentOver();setTimeout(()=>{try{ui.reviewPlayer.currentTime=ballSeekTime(mark);ui.reviewPlayer.play().catch(()=>{});}catch(_){}},180);};
  ui.ballStrip.addEventListener('click',e=>{const b=e.target.closest('[data-ball]');if(b)reviewBallFromLive(b.dataset.ball);});
  ui.timelineMarkers.addEventListener('click',e=>{const ball=e.target.closest('[data-ball]');if(ball){reviewBallFromLive(ball.dataset.ball);return;}const lbw=e.target.closest('[data-lbw]');if(lbw){const t=lbwMoments[Number(lbw.dataset.lbw)];reviewCurrentOver().then(()=>setTimeout(()=>{if(Number.isFinite(t))ui.reviewPlayer.currentTime=Math.max(0,t-6);},180));}});
  ui.jumpRow.addEventListener('click',e=>{const b=e.target.closest('[data-time]');if(b){ui.reviewPlayer.currentTime=Number(b.dataset.time)||0;const txt=(b.textContent||'').match(/Ball\s+(\d+)/i);if(txt)selectReviewBall(txt[1]);ui.reviewPlayer.play().catch(()=>{});}});
  ui.reviewTimelineMarkers.addEventListener('click',e=>{const b=e.target.closest('[data-review-time]');if(b){ui.reviewPlayer.currentTime=Number(b.dataset.reviewTime)||0;selectReviewBall(b.dataset.reviewBall||null);ui.reviewPlayer.play().catch(()=>{});}});
  ui.reviewPlayer.addEventListener('loadedmetadata',()=>{if(Number.isFinite(ui.reviewPlayer.duration))reviewDuration=ui.reviewPlayer.duration;if(ui.reviewVideoWrap&&ui.reviewPlayer.videoWidth&&ui.reviewPlayer.videoHeight)ui.reviewVideoWrap.style.aspectRatio=`${ui.reviewPlayer.videoWidth}/${ui.reviewPlayer.videoHeight}`;renderReviewTimeline();drawDRSReview(reviewActiveBall);});
  ui.reviewPlayer.addEventListener('timeupdate',updateReviewPlayhead);
  ui.reviewPlayer.addEventListener('seeking',()=>reviewTracker?.reset(false));
  ui.reviewPlayer.addEventListener('play',()=>{if(reviewTrackingEnabled)reviewTracker?.start();});
  ui.ballColorSelect.addEventListener('change',()=>{liveTracker?.reset(false);reviewTracker?.reset(false);});
  ui.sensitivitySelect.addEventListener('change',()=>{liveTracker?.reset(false);reviewTracker?.reset(false);});
  ui.slowBtn.addEventListener('click',()=>ui.reviewPlayer.playbackRate=.25);ui.halfBtn.addEventListener('click',()=>ui.reviewPlayer.playbackRate=.5);ui.normalBtn.addEventListener('click',()=>ui.reviewPlayer.playbackRate=1);
  ui.reviewTrackBtn.addEventListener('click',()=>setReviewTracking(!reviewTrackingEnabled));ui.seedBallBtn.addEventListener('click',()=>{if(!reviewTrackingEnabled)setReviewTracking(true);ui.reviewTrackingCanvas.classList.add('seed-mode');setStatus('Replay seed mode: tap directly on the ball in the video, then press Play.');});ui.clearTrailBtn.addEventListener('click',()=>reviewTracker?.clearTrail());
  ui.closeReviewBtn.addEventListener('click',()=>{ui.reviewPlayer.pause();ui.reviewTrackingCanvas.classList.remove('seed-mode');reviewTracker?.stop();ui.reviewDialog.close();reviewMarks=[];reviewLbw=[];reviewItemId=null;reviewActiveBall=null;});
  ui.savedOvers.addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const id=b.closest('[data-id]')?.dataset.id,item=id?await getItem(id):null;if(!item)return;if(b.dataset.action==='play')openReview(item.blob,item.balls||[],item.lbwMoments||[],`Over ${item.overNumber}`,item.duration||0,item.id);if(b.dataset.action==='share')await shareItem(item);if(b.dataset.action==='delete'&&confirm('Delete this saved over from this iPhone?')){await del(id);await renderSaved();}});
  document.querySelectorAll('.bottom-nav button[data-scroll]').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById(btn.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('nav-active',x===btn));}));
  [pro.sessionName,pro.sessionMode,pro.pitchLength,pro.speedUnit].forEach(el=>el?.addEventListener('change',saveSessionSettings));pro.sessionName?.addEventListener('blur',saveSessionSettings);ui.handednessSelect?.addEventListener('change',updateSessionRibbon);ui.autoDecisionSelect?.addEventListener('change',updateSessionRibbon);
  [pro.filterResult,pro.filterLength,pro.filterLine].forEach(el=>el?.addEventListener('change',renderAnalytics));pro.refreshAnalyticsBtn?.addEventListener('click',renderAnalytics);pro.exportDataBtn?.addEventListener('click',exportSessionData);pro.saveTagsBtn?.addEventListener('click',saveReviewTags);
  pro.quickCalBtn?.addEventListener('click',()=>ui.calibrateBtn.click());pro.quickTrackBtn?.addEventListener('click',()=>ui.trackBtn.click());pro.quickReviewBtn?.addEventListener('click',()=>ui.reviewOverBtn.click());pro.setupCalBtn?.addEventListener('click',()=>ui.calibrateBtn.click());
  pro.newSessionBtn?.addEventListener('click',()=>{pro.sessionName.value=`Session ${new Date().toLocaleDateString()}`;saveSessionSettings();document.getElementById('setupAnchor')?.scrollIntoView({behavior:'smooth'});});
  pro.clearSessionBtn?.addEventListener('click',async()=>{if(!confirm('Delete all saved overs and analytics from this iPhone?'))return;const items=await all();for(const i of items)await del(i.id);balls=[];autoResults=[];renderBalls();await renderSaved();await renderAnalytics();setStatus('Session library cleared. Calibration was kept.');});
  window.addEventListener('orientationchange',()=>setTimeout(()=>{updateOrientationState();drawCalibrationGuide();},150));window.addEventListener('resize',()=>{updateOrientationState();drawCalibrationGuide();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&overActive)setStatus('Keep LBW Tracker visible while the over is recording.');});
  window.addEventListener('beforeunload',()=>{liveTracker?.stop();reviewTracker?.stop();if(stream)stream.getTracks().forEach(t=>t.stop());});

  (async()=>{loadSessionSettings();updateOrientationState();updateCalibrationStatus();renderDecisionStrip();try{db=await openDB();await renderSaved();await renderAnalytics();}catch(e){setStatus(`Local storage unavailable: ${e.message}`);}if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});})();
})();