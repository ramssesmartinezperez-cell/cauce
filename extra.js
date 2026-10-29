/* Cauce · Confirmación de la comunidad: cualquiera puede decir "ya está solucionado" (con foto) o "sigue igual".
   Con 3 confirmaciones de celulares distintos, el servidor marca el reporte como resuelto. */
(function(){
  const NECESARIAS=3;
  let CONF={};
  const st=document.createElement("style");
  st.textContent=`.conf{margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.07);display:flex;flex-direction:column;gap:8px}
.conf .cuenta{font-size:13.5px;color:var(--dim)}
.conf .cuenta b{color:var(--ink)}
.conf .meter{height:6px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden}
.conf .meter i{display:block;height:100%;background:var(--green)}
.conf .botones{display:flex;flex-wrap:wrap;gap:6px}
.conf .despues{display:flex;gap:6px;flex-wrap:wrap}
.conf .despues figure{margin:0;display:flex;flex-direction:column;gap:2px}
.conf .despues img{width:96px;height:72px;object-fit:cover;border-radius:10px;background:rgba(255,255,255,.08)}
.conf .despues figcaption{font-size:11.5px;color:var(--dim)}
.conf .aviso{font-size:13.5px;margin:0}`;
  document.head.appendChild(st);

  async function loadConf(){
    if(!sb) return;
    const {data,error}=await sb.from("confirmaciones").select("registro_id,tipo,foto,autor,creado").order("creado",{ascending:true}).limit(5000);
    if(error) return;
    CONF={};
    data.forEach(c=>{ const e=CONF[c.registro_id]||={res:[],sig:[]}; (c.tipo==="resuelto"?e.res:e.sig).push(c); });
  }
  const _loadAll=loadAll;
  loadAll=async function(){ await loadConf(); return _loadAll(); };

  function urlFoto(p){ return sb.storage.from("fotos").getPublicUrl(p).data.publicUrl; }
  function aviso(box,t,ok){ let p=box.querySelector(".aviso"); if(!p){ p=document.createElement("p"); p.className="aviso"; box.appendChild(p); }
    p.textContent=t; p.style.color=ok?"#d7ffe7":"#ffe0e0"; }
  function errorTexto(err){ const m=(err&&err.message)||""; return m.startsWith("CAUCE: ")?m.slice(7):"No se pudo guardar. Revisa tu internet e inténtalo otra vez."; }

  async function opinar(r,tipo,box,btns){
    btns.forEach(b=>b.disabled=true);
    try{
      const fila={registro_id:r.id,tipo};
      if(tipo==="resuelto"){
        const archivo=await new Promise(res=>{ const inp=document.createElement("input"); inp.type="file"; inp.accept="image/*"; inp.setAttribute("capture","environment");
          inp.onchange=()=>res(inp.files[0]||null); inp.addEventListener("cancel",()=>res(null)); inp.click(); setTimeout(()=>{ if(!inp.files.length) res(null); },120000); });
        if(!archivo){ aviso(box,"Toma una foto de cómo quedó para confirmar.",false); btns.forEach(b=>b.disabled=false); return; }
        if(!/^image\//.test(archivo.type)){ aviso(box,"Solo se pueden subir fotos.",false); btns.forEach(b=>b.disabled=false); return; }
        aviso(box,"Subiendo foto…",true);
        const blob=await compress(archivo); const path=`${myId}/despues-${Date.now()}.jpg`;
        const up=await sb.storage.from("fotos").upload(path,blob,{contentType:"image/jpeg",upsert:false}); if(up.error) throw up.error;
        fila.foto=path;
      }
      const {error}=await sb.from("confirmaciones").insert(fila); if(error) throw error;
      await loadAll();
    }catch(err){ aviso(box,errorTexto(err),false); btns.forEach(b=>b.disabled=false); }
  }

  function decorar(){
    const items=[...document.querySelectorAll("#list li.item")];
    if(!items.length) return;
    let shown=regs.filter(isProb).filter(r=>filtro==="todas"?(isEditor||r.estado!=="falso"):filtro==="reparada"?r.estado==="reparada":(r.estado==="pendiente"||r.estado==="reparacion"));
    if(catF==="fuera") shown=shown.filter(r=>r.lugar==="fuera"); else if(catF!=="todas") shown=shown.filter(r=>catOf(r)===catF);
    items.forEach((li,i)=>{
      const r=shown[i]; if(!r||r.estado==="falso") return;
      const c=CONF[r.id]||{res:[],sig:[]};
      const box=document.createElement("div"); box.className="conf";
      const abierto=r.estado==="pendiente"||r.estado==="reparacion";
      const cuenta=document.createElement("div"); cuenta.className="cuenta";
      if(abierto){
        cuenta.innerHTML=`<b>${Math.min(c.res.length,NECESARIAS)} de ${NECESARIAS}</b> confirman que ya está solucionado`+(c.sig.length?` · ${c.sig.length} dice${c.sig.length>1?"n":""} que sigue igual`:"");
        const m=document.createElement("div"); m.className="meter"; m.innerHTML=`<i style="width:${Math.min(100,c.res.length/NECESARIAS*100)}%"></i>`;
        box.append(cuenta,m);
      } else if(c.res.length){
        cuenta.innerHTML=`<b>Resuelto</b>: lo confirmaron ${c.res.length} personas con foto`; box.append(cuenta);
      }
      if(c.res.length){
        const d=document.createElement("div"); d.className="despues";
        c.res.slice(0,3).forEach(x=>{ if(!x.foto) return; const f=document.createElement("figure"); const im=document.createElement("img");
          im.loading="lazy"; im.alt="Foto de cómo quedó "+r.zona; im.src=urlFoto(x.foto); im.onerror=()=>f.remove();
          const cap=document.createElement("figcaption"); cap.textContent="Después"; f.append(im,cap); d.appendChild(f); });
        if(d.children.length) box.appendChild(d);
      }
      if(abierto&&myId){
        const yaOpino=c.res.concat(c.sig).some(x=>x.autor===myId);
        if(r.autor===myId){ aviso(box,"Es tu reporte: deja que otros confirmen cuando quede arreglado.",true); box.querySelector(".aviso").style.color="var(--dim)"; }
        else if(yaOpino){ aviso(box,"Ya diste tu opinión sobre este reporte. Gracias.",true); }
        else {
          const bx=document.createElement("div"); bx.className="botones";
          const b1=document.createElement("button"); b1.type="button"; b1.className="btn small"; b1.textContent="Ya está solucionado (con foto)";
          const b2=document.createElement("button"); b2.type="button"; b2.className="btn small"; b2.textContent="Sigue igual";
          b1.onclick=()=>opinar(r,"resuelto",box,[b1,b2]); b2.onclick=()=>opinar(r,"sigue",box,[b1,b2]);
          bx.append(b1,b2); box.appendChild(bx);
        }
      }
      if(box.children.length) li.querySelector("div").appendChild(box);
    });
  }
  const _render=render;
  render=function(){ _render(); try{ decorar(); }catch(e){ console.error(e); } };

  const intro=document.querySelector("#view-reportes .intro");
  if(intro) intro.textContent="Si ves que ya lo arreglaron, confírmalo con una foto. Con 3 confirmaciones queda resuelto. Los maestros también pueden marcarlo.";

  const espera=setInterval(()=>{
    if(!sb||!db) return; clearInterval(espera);
    loadAll();
    sb.channel("cauce-conf").on("postgres_changes",{event:"*",schema:"public",table:"confirmaciones"},()=>{ clearTimeout(window.__confT); window.__confT=setTimeout(loadAll,400); }).subscribe();
  },300);
})();
