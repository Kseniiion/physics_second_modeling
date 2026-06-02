const MU = 1;
const canvas = document.getElementById('rings');
const ctx = canvas.getContext('2d');
const chart = document.getElementById('chart');
const cctx = chart.getContext('2d');

function nmToRgb(wavelength){
  let r=0,g=0,b=0;
  const wl=wavelength;
  if(wl>=380&&wl<440){r=-(wl-440)/(440-380); b=1;}
  else if(wl<490){g=(wl-440)/(490-440); b=1;}
  else if(wl<510){g=1; b=-(wl-510)/(510-490);}
  else if(wl<580){r=(wl-510)/(580-510); g=1;}
  else if(wl<645){r=1; g=-(wl-645)/(645-580);}
  else if(wl<=780){r=1;}
  let factor=1;
  if(wl<420) factor=0.3+0.7*(wl-380)/(420-380);
  else if(wl>700) factor=0.3+0.7*(780-wl)/(780-700);
  return [Math.pow(r*factor,0.8),Math.pow(g*factor,0.8),Math.pow(b*factor,0.8)];
}

function gaussian(x, mu, sigma){
  if(sigma<=0) return x===mu?1:0;
  return Math.exp(-0.5*((x-mu)/sigma)**2);
}

function getParams(){
  return {
    R: +document.getElementById('R').value,
    lambda0: +document.getElementById('lambda0').value,
    width: +document.getElementById('width').value,
    viewSize: +document.getElementById('viewSize').value,
    components: Math.max(1, +document.getElementById('components').value|0),
    mode: document.getElementById('mode').value
  };
}

function spectrum(lambda0,width,components){
  if(width<=0 || components<=1) return [{lambda:lambda0, weight:1, rgb:nmToRgb(lambda0)}];
  const arr=[];
  const sigma=width/2.355;
  const start=Math.max(380,lambda0-width*1.5);
  const end=Math.min(780,lambda0+width*1.5);
  let sum=0;
  for(let i=0;i<components;i++){
    const lambda=start+(end-start)*i/(components-1);
    const w=gaussian(lambda,lambda0,sigma);
    sum+=w; arr.push({lambda, weight:w, rgb:nmToRgb(lambda)});
  }
  arr.forEach(s=>s.weight/=sum);
  return arr;
}

function intensityFor(rMeters, p, spec){
  const t = rMeters*rMeters/(2*p.R);
  let R=0,G=0,B=0,total=0;
  for(const s of spec){
    const lambda=s.lambda*1e-9;
    let I=(1-Math.cos(4*Math.PI*t/lambda))/2;
    if(p.mode==='transmitted') I=1-I;
    R += s.rgb[0]*I*s.weight;
    G += s.rgb[1]*I*s.weight;
    B += s.rgb[2]*I*s.weight;
    total += I*s.weight;
  }
  return {rgb:[R,G,B], scalar:total};
}

function drawRings(){
  const p=getParams();
  const spec=spectrum(p.lambda0,p.width,p.components);
  const w=canvas.width,h=canvas.height,cx=w/2,cy=h/2;
  const maxR=(p.viewSize*1e-3)/2;
  const img=ctx.createImageData(w,h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const dx=x-cx,dy=y-cy;
    const rr=Math.sqrt(dx*dx+dy*dy)/(w/2)*maxR;
    const val=intensityFor(rr,p,spec).rgb;
    const k=(y*w+x)*4;
    img.data[k]=Math.min(255,Math.round(255*val[0]));
    img.data[k+1]=Math.min(255,Math.round(255*val[1]));
    img.data[k+2]=Math.min(255,Math.round(255*val[2]));
    img.data[k+3]=255;
  }
  ctx.putImageData(img,0,0);
  drawChart(p,spec,maxR);
}

function drawChart(p,spec,maxR){
  const w=chart.width,h=chart.height;

  cctx.clearRect(0,0,w,h);

  cctx.fillStyle='#05070d';
  cctx.fillRect(0,0,w,h);

  const pad=45;

  cctx.strokeStyle='#64748b';
  cctx.lineWidth=1;

  cctx.beginPath();
  cctx.moveTo(pad,pad);
  cctx.lineTo(pad,h-pad);
  cctx.lineTo(w-pad,h-pad);
  cctx.stroke();

  cctx.fillStyle='#cbd5e1';
  cctx.font='14px Arial';

  cctx.fillText('I/I0',10,pad+5);
  cctx.fillText('r, мм',w-pad-35,h-12);

  const points=2000;

  const data=[];

  for(let i=0;i<points;i++){
    const r=maxR*i/(points-1);
    const I=intensityFor(r,p,spec).scalar;
    data.push({r,I});
  }

  cctx.strokeStyle='#e2e8f0';
  cctx.lineWidth=2;
  cctx.beginPath();

  data.forEach((pnt,i)=>{
    const x=pad+(w-2*pad)*i/(points-1);
    const y=h-pad-(h-2*pad)*pnt.I;

    if(i===0) cctx.moveTo(x,y);
    else cctx.lineTo(x,y);
  });

  cctx.stroke();

  // поиск максимумов
  const maxima=[];

  for(let i=1;i<data.length-1;i++){

    if(
      data[i].I > data[i-1].I &&
      data[i].I > data[i+1].I
    ){
      maxima.push({
        index:i,
        r:data[i].r,
        I:data[i].I
      });

      if(maxima.length===5) break;
    }
  }

  cctx.fillStyle='#ff5555';

  maxima.forEach((m,n)=>{

    const x=pad+(w-2*pad)*m.index/(points-1);

    const y=h-pad-(h-2*pad)*m.I;

    cctx.beginPath();
    cctx.arc(x,y,4,0,2*Math.PI);
    cctx.fill();

    cctx.fillText(
      `${(m.r*1000).toFixed(3)} мм`,
      x+6,
      y-6
    );
  });

  cctx.fillStyle='#94a3b8';

  cctx.fillText(
    (maxR*1000).toFixed(2),
    w-pad-20,
    h-pad+20
  );

  cctx.fillText(
    '0',
    pad-5,
    h-pad+20
  );
}

document.getElementById('redraw').addEventListener('click',drawRings);
for(const el of document.querySelectorAll('input,select')) el.addEventListener('input',drawRings);
drawRings();
