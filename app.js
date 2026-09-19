const KEYS = {
  years: "sp_rendicion_years_v3",
  resources: "sp_rendicion_resources_v3",
  ideas: "sp_rendicion_ideas_v3",
  settings: "sp_rendicion_settings_v3",
  customModules: "sp_rendicion_custom_modules_v3",
  moduleState: "sp_rendicion_module_state_v3",
  participations: "sp_rendicion_participations_v3"
};

const DEMO_ADMIN = { username: "admin", password: "SanPedro2026*" };

const DEFAULT_YEARS = [
  {
    year: 2025, status: "Publicada", progress: 92,
    description: "Edición central con balance de gestión, resultados, documentos, videos, respuestas y compromisos ciudadanos.",
    commitments: 24, metrics: { plan:92, projects:148, commitments:87, participation:36 }
  },
  {
    year: 2026, status: "En construcción", progress: 58,
    description: "Espacio de avances, evidencias, publicaciones preliminares y preparación de la siguiente audiencia pública.",
    commitments: 9, metrics: { plan:58, projects:74, commitments:61, participation:18 }
  },
  {
    year: 2027, status: "Programada", progress: 0,
    description: "Estructura preparada para incorporar la información y los recursos correspondientes a la nueva vigencia.",
    commitments: 0, metrics: { plan:0, projects:0, commitments:0, participation:0 }
  }
];

const DEFAULT_RESOURCES = [
  {id:"r1",year:2025,type:"informe",title:"Informe de Gestión y Rendición de Cuentas 2025",description:"Documento principal con resultados, ejecución, metas, retos y compromisos.",url:"#",meta:"84 páginas · 4.8 MB"},
  {id:"r2",year:2025,type:"presentacion",title:"Presentación de la Audiencia Pública",description:"Síntesis visual utilizada durante el ejercicio de diálogo ciudadano.",url:"#",meta:"42 diapositivas · 9.2 MB"},
  {id:"r3",year:2025,type:"video",title:"Transmisión de la Audiencia Pública",description:"Registro audiovisual completo de la jornada institucional.",url:"#",meta:"1 h 48 min"},
  {id:"r4",year:2025,type:"datos",title:"Base consolidada de indicadores",description:"Archivo estructurado para consulta, análisis y reutilización.",url:"#",meta:"12 hojas · 1.3 MB"},
  {id:"r5",year:2025,type:"compromiso",title:"Matriz de seguimiento a compromisos",description:"Responsables, fechas, avances y evidencias asociadas.",url:"#",meta:"24 compromisos"},
  {id:"r6",year:2025,type:"respuesta",title:"Preguntas y respuestas ciudadanas",description:"Consolidado de inquietudes y respuestas oficiales.",url:"#",meta:"18 respuestas"},
  {id:"r7",year:2026,type:"informe",title:"Informe preliminar de avance 2026",description:"Corte de seguimiento para preparar la nueva edición.",url:"#",meta:"Borrador"},
  {id:"r8",year:2026,type:"datos",title:"Seguimiento semestral de metas",description:"Consolidado demostrativo del avance de metas durante 2026.",url:"#",meta:"6 hojas"},
  {id:"r9",year:2027,type:"informe",title:"Espacio documental 2027",description:"Reserva para la incorporación futura de documentos.",url:"#",meta:"Programado"}
];

const DEFAULT_IDEAS = [
  {
    id:"i1",title:"Ruta segura para estudiantes",author:"Junta de Acción Comunal",location:"Zona urbana",
    category:"Infraestructura",description:"Mejorar señalización, iluminación y pasos seguros en los recorridos usados por estudiantes.",
    status:"analisis",response:"La propuesta fue remitida a Planeación e Infraestructura para revisión técnica.",votes:18,created:"2026-06-20"
  },
  {
    id:"i2",title:"Mercado campesino mensual",author:"Productores rurales",location:"Zona rural",
    category:"Desarrollo social",description:"Crear un espacio mensual para que productores locales ofrezcan sus productos directamente a la comunidad.",
    status:"aceptada",response:"La iniciativa será tenida en cuenta en la programación institucional del segundo semestre.",votes:31,created:"2026-06-11"
  },
  {
    id:"i3",title:"Recuperación de un parque barrial",author:"Colectivo juvenil",location:"Barrio El Centro",
    category:"Medio ambiente",description:"Jornada comunitaria para recuperar zonas verdes, mobiliario y pintura del parque.",
    status:"resuelta",response:"Se realizó una intervención inicial y se programó una segunda jornada de mantenimiento.",votes:22,created:"2026-05-27"
  },
  {
    id:"i4",title:"Talleres culturales itinerantes",author:"Grupo de madres comunitarias",location:"Corregimientos",
    category:"Cultura",description:"Llevar talleres de música, lectura y artes a diferentes sectores rurales del municipio.",
    status:"recibida",response:"La propuesta fue recibida y está pendiente de asignación a la dependencia competente.",votes:9,created:"2026-07-02"
  }
];

const DEFAULT_COMMITMENTS = [
  {code:"2025-01",title:"Publicar la base consolidada de indicadores.",owner:"Planeación institucional",progress:100,status:"completed",date:"30 de junio de 2026"},
  {code:"2025-02",title:"Fortalecer el seguimiento a solicitudes ciudadanas.",owner:"Atención al ciudadano",progress:74,status:"progress",date:"Septiembre de 2026"},
  {code:"2025-03",title:"Incorporar nuevos conjuntos de datos abiertos.",owner:"Tecnología y comunicaciones",progress:28,status:"pending",date:"Diciembre de 2026"}
];

const DEFAULT_SETTINGS = {
  preset:"municipal",
  primary:"#0a2d6a", secondary:"#1670a9", accent:"#f0bd17",
  background:"#f6f7f8", text:"#172033", font:"century", fontScale:100, radius:4,
  secondaryLogo:"assets/marca-san-pedro-color.png"
};

const DEFAULT_MODULE_STATE = [
  {id:"years",name:"Vigencias",visible:true},
  {id:"resources",name:"Centro de recursos",visible:true},
  {id:"observatory",name:"Observatorio de resultados",visible:true},
  {id:"ideas",name:"Laboratorio de ideas",visible:true},
  {id:"commitments",name:"Compromisos",visible:true},
  {id:"story",name:"Historia principal",visible:true},
  {id:"participation",name:"Participación",visible:true}
];

let years = loadArray(KEYS.years, DEFAULT_YEARS);
let resources = loadArray(KEYS.resources, DEFAULT_RESOURCES);
let ideas = loadArray(KEYS.ideas, DEFAULT_IDEAS);
let customModules = loadArray(KEYS.customModules, []);
let moduleState = loadArray(KEYS.moduleState, DEFAULT_MODULE_STATE);
let settings = loadObject(KEYS.settings, DEFAULT_SETTINGS);
let selectedYear = Number(years[0]?.year || 2025);
let isAdmin = sessionStorage.getItem("sp_admin_session") === "1";
let toastTimer;

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function loadArray(key,fallback){
  try{const parsed=JSON.parse(localStorage.getItem(key));return Array.isArray(parsed)?parsed:clone(fallback)}catch{return clone(fallback)}
}
function loadObject(key,fallback){
  try{const parsed=JSON.parse(localStorage.getItem(key));return parsed&&typeof parsed==="object"?{...clone(fallback),...parsed}:clone(fallback)}catch{return clone(fallback)}
}
function saveAll(){
  localStorage.setItem(KEYS.years,JSON.stringify(years));
  localStorage.setItem(KEYS.resources,JSON.stringify(resources));
  localStorage.setItem(KEYS.ideas,JSON.stringify(ideas));
  localStorage.setItem(KEYS.customModules,JSON.stringify(customModules));
  localStorage.setItem(KEYS.moduleState,JSON.stringify(moduleState));
  localStorage.setItem(KEYS.settings,JSON.stringify(settings));
}
function escapeHTML(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function safeUrl(value){
  const url=String(value||"#").trim();
  return /^(https?:\/\/|#|\/)/i.test(url)?url:"#";
}
function openModal(id){const modal=document.getElementById(id);if(modal&&!modal.open)modal.showModal()}
function closeModal(id){const modal=document.getElementById(id);if(modal?.open)modal.close()}
function toast(message){
  const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);
}
function getYear(year){return years.find(item=>Number(item.year)===Number(year))}
function countResources(year,type){return resources.filter(item=>(!year||Number(item.year)===Number(year))&&(!type||item.type===type)).length}
function typeLabel(type){return ({informe:"Informe",presentacion:"Presentación",video:"Video",datos:"Datos",compromiso:"Seguimiento",respuesta:"Respuesta"})[type]||"Documento"}
function typeIcon(type){return ({informe:"PDF",presentacion:"PPT",video:"VID",datos:"XLS",compromiso:"SEG",respuesta:"FAQ"})[type]||"DOC"}
function statusLabel(status){return ({recibida:"Recibida",analisis:"En análisis",aceptada:"Se tendrá en cuenta",resuelta:"Resuelta"})[status]||status}
function statusClass(status){return ({recibida:"pending",analisis:"progress",aceptada:"progress",resuelta:"completed"})[status]||"pending"}

function applySettings(){
  const root=document.documentElement;
  root.style.setProperty("--primary",settings.primary);
  root.style.setProperty("--secondary",settings.secondary);
  root.style.setProperty("--accent",settings.accent);
  root.style.setProperty("--background",settings.background);
  root.style.setProperty("--text",settings.text);
  root.style.setProperty("--font-scale",Number(settings.fontScale)/100);
  root.style.setProperty("--radius",`${settings.radius}px`);
  const fontMap={
    century:'"Century Gothic","CenturyGothic","AppleGothic","URW Gothic L","Trebuchet MS",Arial,sans-serif',
    arial:'Arial,Helvetica,sans-serif',
    georgia:'Georgia,"Times New Roman",serif'
  };
  root.style.setProperty("--font-family",fontMap[settings.font]||fontMap.century);
  document.getElementById("secondaryBrand").src=settings.secondaryLogo;
  syncAppearanceControls();
}

function applyPreset(preset){
  const presets={
    municipal:{primary:"#0a2d6a",secondary:"#1670a9",accent:"#f0bd17",background:"#f6f7f8",text:"#172033",secondaryLogo:"assets/marca-san-pedro-color.png"},
    colorful:{primary:"#0a2d6a",secondary:"#0f67a5",accent:"#f0bd17",background:"#f7f8fa",text:"#131d31",secondaryLogo:"assets/marca-san-pedro-color.png"},
    purple:{primary:"#751558",secondary:"#4c0d3a",accent:"#d7a94c",background:"#f7f2f6",text:"#261620",secondaryLogo:"assets/marca-san-pedro-morada.png"}
  };
  settings={...settings,...presets[preset],preset};
  saveAll();applySettings();toast("Tema aplicado.");
}

function syncAppearanceControls(){
  const map={settingPrimary:"primary",settingSecondary:"secondary",settingAccent:"accent",settingBackground:"background",settingText:"text"};
  Object.entries(map).forEach(([id,key])=>{const el=document.getElementById(id);if(el)el.value=settings[key]});
  if(document.getElementById("settingFont"))document.getElementById("settingFont").value=settings.font;
  if(document.getElementById("settingFontScale")){
    document.getElementById("settingFontScale").value=settings.fontScale;
    document.getElementById("fontScaleOutput").value=`${settings.fontScale}%`;
  }
  if(document.getElementById("settingRadius")){
    document.getElementById("settingRadius").value=settings.radius;
    document.getElementById("radiusOutput").value=`${settings.radius} px`;
  }
}

function renderYearOptions(){
  const ids=["heroYearSelector","resourceYearFilter","participationYear","adminResourceYear"];
  ids.forEach(id=>{
    const select=document.getElementById(id);if(!select)return;
    const all=id==="resourceYearFilter";
    const current=select.value;
    select.innerHTML=all?'<option value="all">Todas las vigencias</option>':"";
    years.sort((a,b)=>Number(a.year)-Number(b.year)).forEach(item=>{
      const option=document.createElement("option");option.value=item.year;option.textContent=item.year;select.appendChild(option);
    });
    if([...select.options].some(o=>o.value===current))select.value=current;
  });
  document.getElementById("heroYearSelector").value=selectedYear;
}

function renderYears(){
  const switcher=document.getElementById("yearSwitcher");
  const grid=document.getElementById("yearsGrid");
  switcher.innerHTML="";
  grid.innerHTML="";
  years.sort((a,b)=>Number(a.year)-Number(b.year)).forEach(item=>{
    const tab=document.createElement("button");
    tab.className=Number(item.year)===selectedYear?"active":"";
    tab.textContent=item.year;
    tab.addEventListener("click",()=>selectYear(item.year));
    switcher.appendChild(tab);

    const card=document.createElement("article");
    card.className="year-card reveal visible";
    card.innerHTML=`
      <div class="year-card__top"><strong>${item.year}</strong><span>${escapeHTML(item.status)}</span></div>
      <p>${escapeHTML(item.description)}</p>
      <div class="year-card__stats">
        <div><strong>${item.progress}%</strong><span>avance</span></div>
        <div><strong>${countResources(item.year)}</strong><span>recursos</span></div>
        <div><strong>${item.commitments}</strong><span>compromisos</span></div>
      </div>
      <button class="text-action" data-open-year="${item.year}">Abrir edición →</button>`;
    grid.appendChild(card);
  });
}

function selectYear(year){
  const item=getYear(year);if(!item)return;
  selectedYear=Number(year);
  document.querySelectorAll("#yearSwitcher button").forEach(btn=>btn.classList.toggle("active",Number(btn.textContent)===selectedYear));
  document.getElementById("heroYearSelector").value=selectedYear;
  document.getElementById("heroProgress").textContent=`${item.progress}%`;
  document.getElementById("heroProgressRing").style.background=`conic-gradient(var(--accent) 0deg,var(--accent) ${item.progress*3.6}deg,#e5e9ef ${item.progress*3.6}deg)`;
  document.getElementById("heroYearTitle").textContent=`Rendición de Cuentas ${item.year}`;
  document.getElementById("heroYearDescription").textContent=item.description;
  document.getElementById("heroYearDocuments").textContent=countResources(item.year);
  document.getElementById("heroYearVideos").textContent=countResources(item.year,"video");
  document.getElementById("heroYearCommitments").textContent=item.commitments;
  document.getElementById("indicatorPlan").textContent=`${item.metrics.plan}%`;
  document.getElementById("indicatorProjects").textContent=item.metrics.projects;
  document.getElementById("indicatorCommitments").textContent=`${item.metrics.commitments}%`;
  document.getElementById("indicatorParticipation").textContent=item.metrics.participation;
}

function openYear(year){
  const item=getYear(year);if(!item)return;
  const yearResources=resources.filter(r=>Number(r.year)===Number(year));
  document.getElementById("genericModalContent").innerHTML=`
    <div class="year-modal-hero">
      <span class="overline" style="color:var(--accent)">${escapeHTML(item.status).toUpperCase()}</span>
      <h2>Rendición de Cuentas ${item.year}</h2>
      <p>${escapeHTML(item.description)}</p>
      <div class="year-modal-stats">
        <div><strong>${item.progress}%</strong><span>Avance general</span></div>
        <div><strong>${yearResources.length}</strong><span>Recursos</span></div>
        <div><strong>${countResources(item.year,"video")}</strong><span>Videos</span></div>
        <div><strong>${item.commitments}</strong><span>Compromisos</span></div>
      </div>
    </div>
    <div class="year-modal-body">
      <h3>Recursos de la vigencia</h3>
      <div class="resource-list">
        ${yearResources.length?yearResources.map(resourceRow).join(""):"<p>No hay recursos registrados todavía.</p>"}
      </div>
    </div>`;
  openModal("genericModal");
}

function resourceRow(item){
  return `<article class="resource-row">
    <span class="resource-row__icon">${typeIcon(item.type)}</span>
    <div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description)}</p><small>${item.year} · ${typeLabel(item.type)} · ${escapeHTML(item.meta||"Recurso digital")}</small></div>
    <a href="${safeUrl(item.url)}" ${item.url!=="#"?'target="_blank" rel="noopener"':""}>↗</a>
  </article>`;
}

function openResources(category,filteredList){
  const list=filteredList||resources.filter(r=>category==="all"||r.type===category);
  document.getElementById("resourceModalContent").innerHTML=`
    <div class="resource-modal-head">
      <div><span class="overline">CENTRO DE RECURSOS</span><h2>${category==="all"?"Resultados de búsqueda":typeLabel(category)}</h2><p>${list.length} recurso(s) disponible(s).</p></div>
      <strong>${list.length}</strong>
    </div>
    <div class="resource-list">${list.length?list.map(resourceRow).join(""):'<p>No se encontraron recursos con los filtros seleccionados.</p>'}</div>`;
  openModal("resourceModal");
}

function renderIdeas(){
  const statuses=[
    {id:"recibida",label:"Recibidas"},
    {id:"analisis",label:"En análisis"},
    {id:"aceptada",label:"Se tendrán en cuenta"},
    {id:"resuelta",label:"Resueltas"}
  ];
  const board=document.getElementById("ideaBoard");
  board.innerHTML=statuses.map(status=>{
    const items=ideas.filter(i=>i.status===status.id);
    return `<section class="idea-column">
      <div class="idea-column__title"><span>${status.label}</span><b>${items.length}</b></div>
      ${items.map(idea=>`<article class="idea-card" data-idea-id="${idea.id}">
        <div class="idea-card__meta"><span>${escapeHTML(idea.category)}</span><time>${escapeHTML(idea.created)}</time></div>
        <h3>${escapeHTML(idea.title)}</h3>
        <p>${escapeHTML(idea.description)}</p>
        <div class="idea-card__footer"><span>${escapeHTML(idea.location)}</span><b>♥ ${idea.votes}</b></div>
      </article>`).join("")}
    </section>`;
  }).join("");
  updateIdeaSummary();
  renderAdminIdeas();
}

function updateIdeaSummary(){
  document.getElementById("ideasTotal").textContent=ideas.length;
  document.getElementById("ideasAnalysis").textContent=ideas.filter(i=>i.status==="analisis").length;
  document.getElementById("ideasAccepted").textContent=ideas.filter(i=>i.status==="aceptada").length;
  document.getElementById("ideasResolved").textContent=ideas.filter(i=>i.status==="resuelta").length;
  document.getElementById("heroIdeasCount").textContent=ideas.length;
}

function openIdea(id){
  const idea=ideas.find(i=>i.id===id);if(!idea)return;
  document.getElementById("ideaModalContent").innerHTML=`
    <div class="idea-detail">
      <aside class="idea-detail__status">
        <span class="overline">ESTADO ACTUAL</span>
        <strong>${statusLabel(idea.status)}</strong>
        <p>${escapeHTML(idea.category)} · ${escapeHTML(idea.location)}</p>
        <p>Presentada por: <b>${escapeHTML(idea.author)}</b></p>
        <p>Fecha: ${escapeHTML(idea.created)}</p>
      </aside>
      <div>
        <span class="overline">IDEA CIUDADANA</span>
        <h2>${escapeHTML(idea.title)}</h2>
        <p>${escapeHTML(idea.description)}</p>
        <div class="official-response"><span>RESPUESTA INSTITUCIONAL</span><p>${escapeHTML(idea.response)}</p></div>
        <div class="idea-actions">
          <button class="primary-action" data-support-idea="${idea.id}">♥ Apoyar idea (${idea.votes})</button>
          ${isAdmin?`<button class="secondary-action" style="color:var(--primary);border-color:var(--line)" data-admin-edit-idea="${idea.id}">Gestionar respuesta</button>`:""}
        </div>
      </div>
    </div>`;
  openModal("ideaModal");
}

function renderCommitments(){
  const grid=document.getElementById("commitmentsGrid");
  grid.innerHTML=DEFAULT_COMMITMENTS.map(item=>`
    <article class="commitment-card reveal visible">
      <div class="commitment-card__top"><span class="commitment-status status-${item.status}">${item.progress===100?"Cumplido":item.progress>30?"En ejecución":"Pendiente"}</span><b>${item.code}</b></div>
      <h3>${escapeHTML(item.title)}</h3>
      <p>Responsable: ${escapeHTML(item.owner)}</p>
      <div class="mini-progress"><span style="width:${item.progress}%"></span></div>
      <small>${item.progress}% · ${escapeHTML(item.date)}</small>
    </article>`).join("");
}

function renderCustomModules(){
  const area=document.getElementById("customModuleArea");
  area.innerHTML=customModules.map(module=>`
    <section class="custom-module" data-custom-module="${module.id}">
      <div class="shell custom-module__card">
        <div><span class="overline" style="color:var(--accent)">MÓDULO PERSONALIZADO</span><h2>${escapeHTML(module.title)}</h2><p>${escapeHTML(module.subtitle)}</p></div>
        <button class="primary-action" data-custom-open="${module.id}">${escapeHTML(module.button)}</button>
      </div>
    </section>`).join("");
  renderCustomModuleManager();
}

function renderModuleManager(){
  const holder=document.getElementById("moduleManager");
  holder.innerHTML=moduleState.map((module,index)=>`
    <div class="module-manager-row">
      <input type="checkbox" data-module-visible="${module.id}" ${module.visible?"checked":""}>
      <strong>${escapeHTML(module.name)}</strong>
      <div class="module-manager-row__actions">
        <button data-module-up="${module.id}" ${index===0?"disabled":""}>↑</button>
        <button data-module-down="${module.id}" ${index===moduleState.length-1?"disabled":""}>↓</button>
      </div>
    </div>`).join("");
}

function applyModuleState(){
  const stack=document.getElementById("moduleStack");
  moduleState.forEach(module=>{
    const section=stack.querySelector(`[data-module="${module.id}"]`);
    if(section){
      section.classList.toggle("is-hidden",!module.visible);
      stack.appendChild(section);
    }
  });
  renderModuleManager();
}

function renderCustomModuleManager(){
  const holder=document.getElementById("customModuleManager");if(!holder)return;
  holder.innerHTML=customModules.length?customModules.map(module=>`
    <div class="custom-manager-row"><strong>${escapeHTML(module.title)}</strong><button data-delete-custom="${module.id}">Eliminar</button></div>`).join(""):"<p>No hay módulos personalizados.</p>";
}

function renderAdminIdeas(){
  const holder=document.getElementById("adminIdeasList");if(!holder)return;
  holder.innerHTML=ideas.map(idea=>`
    <div class="admin-idea-row">
      <div><strong>${escapeHTML(idea.title)}</strong><small>${statusLabel(idea.status)} · ${escapeHTML(idea.location)}</small></div>
      <button data-admin-edit-idea="${idea.id}">Gestionar</button>
    </div>`).join("");
}

function openIdeaAdmin(id){
  const idea=ideas.find(i=>i.id===id);if(!idea)return;
  document.getElementById("ideaAdminContent").innerHTML=`
    <span class="overline">GESTIÓN INSTITUCIONAL</span>
    <h2>${escapeHTML(idea.title)}</h2>
    <form class="modal-form" id="ideaAdminForm" data-idea="${idea.id}">
      <label>Estado
        <select name="status">
          <option value="recibida" ${idea.status==="recibida"?"selected":""}>Recibida</option>
          <option value="analisis" ${idea.status==="analisis"?"selected":""}>En análisis</option>
          <option value="aceptada" ${idea.status==="aceptada"?"selected":""}>Se tendrá en cuenta</option>
          <option value="resuelta" ${idea.status==="resuelta"?"selected":""}>Resuelta</option>
        </select>
      </label>
      <label>Respuesta institucional<textarea name="response" rows="6" required>${escapeHTML(idea.response)}</textarea></label>
      <button class="primary-action">Guardar respuesta</button>
    </form>`;
  openModal("ideaAdminModal");
}

function updateCounts(){
  document.getElementById("heroYearCount").textContent=years.length;
  document.getElementById("heroResourceCount").textContent=resources.length;
  document.getElementById("heroIdeasCount").textContent=ideas.length;
}

function renderAll(){
  renderYearOptions();renderYears();selectYear(selectedYear);renderIdeas();renderCommitments();
  renderCustomModules();applyModuleState();updateCounts();syncAppearanceControls();
}

function openIndicator(key){
  const content={
    plan:["Cumplimiento del plan","Muestra el avance consolidado de las metas estratégicas de la vigencia seleccionada."],
    projects:["Proyectos ejecutados","Agrupa proyectos terminados, en operación o con entregables verificables."],
    commitments:["Compromisos atendidos","Representa la gestión de compromisos derivados de audiencias y participación ciudadana."],
    participation:["Espacios participativos","Incluye mesas, talleres, audiencias, consultas y encuentros con la comunidad."]
  }[key];
  document.getElementById("genericModalContent").innerHTML=`<span class="overline">DETALLE DEL INDICADOR</span><h2>${content[0]}</h2><p>${content[1]}</p>`;
  openModal("genericModal");
}

function searchPortal(query){
  const q=query.toLowerCase().trim();
  const results=[];
  years.filter(y=>`${y.year} ${y.status} ${y.description}`.toLowerCase().includes(q)).forEach(y=>results.push({kind:"year",id:y.year,title:`Rendición de Cuentas ${y.year}`,meta:y.status}));
  resources.filter(r=>`${r.title} ${r.description} ${r.year} ${r.type}`.toLowerCase().includes(q)).forEach(r=>results.push({kind:"resource",id:r.id,title:r.title,meta:`${r.year} · ${typeLabel(r.type)}`}));
  ideas.filter(i=>`${i.title} ${i.description} ${i.category} ${i.location}`.toLowerCase().includes(q)).forEach(i=>results.push({kind:"idea",id:i.id,title:i.title,meta:`Idea · ${statusLabel(i.status)}`}));
  const holder=document.getElementById("searchResults");
  if(!q){holder.innerHTML='<p class="notice">Busque una vigencia, documento, idea ciudadana o tema.</p>';return}
  holder.innerHTML=results.length?results.map(r=>`<button class="search-result" data-search-kind="${r.kind}" data-search-id="${r.id}"><span><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.meta)}</small></span><b>→</b></button>`).join(""):'<p class="notice">No se encontraron resultados.</p>';
}

function switchAdminTab(tab){
  document.querySelectorAll(".admin-nav").forEach(btn=>btn.classList.toggle("active",btn.dataset.adminTab===tab));
  document.querySelectorAll(".admin-tab").forEach(panel=>panel.classList.toggle("active",panel.dataset.adminPanel===tab));
  const titles={appearance:"Apariencia",modules:"Módulos",content:"Contenido",ideas:"Ideas ciudadanas",backup:"Respaldo"};
  document.getElementById("adminTabTitle").textContent=titles[tab]||"Administración";
}

document.addEventListener("click",event=>{
  const close=event.target.closest("[data-close-modal]");if(close)closeModal(close.dataset.closeModal);
  if(event.target.closest("[data-close-drawer]"))document.getElementById("accessibilityDrawer").classList.remove("open");

  const yearButton=event.target.closest("[data-open-year]");if(yearButton)openYear(yearButton.dataset.openYear);
  const resourceButton=event.target.closest("[data-resource-category]");if(resourceButton)openResources(resourceButton.dataset.resourceCategory);
  const ideaCard=event.target.closest("[data-idea-id]");if(ideaCard)openIdea(ideaCard.dataset.ideaId);
  const indicator=event.target.closest("[data-indicator]");if(indicator)openIndicator(indicator.dataset.indicator);

  const support=event.target.closest("[data-support-idea]");
  if(support){
    const idea=ideas.find(i=>i.id===support.dataset.supportIdea);
    if(idea){idea.votes+=1;saveAll();renderIdeas();openIdea(idea.id);toast("Apoyo registrado.");}
  }

  const adminIdea=event.target.closest("[data-admin-edit-idea]");
  if(adminIdea){
    if(!isAdmin){toast("Debe iniciar sesión como administrador.");return}
    closeModal("ideaModal");openIdeaAdmin(adminIdea.dataset.adminEditIdea);
  }

  const customOpen=event.target.closest("[data-custom-open]");
  if(customOpen){
    const module=customModules.find(m=>m.id===customOpen.dataset.customOpen);
    if(module){document.getElementById("genericModalContent").innerHTML=`<span class="overline">MÓDULO ESPECIAL</span><h2>${escapeHTML(module.title)}</h2><p>${escapeHTML(module.content)}</p>`;openModal("genericModal")}
  }

  const scroll=event.target.closest("[data-scroll-target]");if(scroll)document.querySelector(scroll.dataset.scrollTarget)?.scrollIntoView({behavior:"smooth"});

  const story=event.target.closest("[data-story]");
  if(story){
    const stories={
      main:["Información pública que se puede comprender","La portada editorial permite resumir resultados, conectar documentos y presentar la gestión con una narrativa más cercana."],
      transparency:["Cómo se organizan y verifican los datos","Cada cifra puede vincularse con su fuente, dependencia responsable, vigencia, documento y evidencia."],
      participation:["Cómo se responden las inquietudes ciudadanas","Las preguntas y propuestas pueden quedar vinculadas a una respuesta oficial y a un estado de seguimiento."],
      future:["Cómo crecerá el archivo","El sistema está preparado para agregar nuevas vigencias, recursos y módulos sin rediseñar el portal."]
    }[story.dataset.story];
    document.getElementById("genericModalContent").innerHTML=`<span class="overline">HISTORIA DESTACADA</span><h2>${stories[0]}</h2><p>${stories[1]}</p>`;openModal("genericModal");
  }

  const adminTab=event.target.closest("[data-admin-tab]");if(adminTab)switchAdminTab(adminTab.dataset.adminTab);
  const preset=event.target.closest("[data-theme-preset]");if(preset)applyPreset(preset.dataset.themePreset);

  const visible=event.target.closest("[data-module-visible]");
  if(visible){const module=moduleState.find(m=>m.id===visible.dataset.moduleVisible);if(module){module.visible=visible.checked;saveAll();applyModuleState()}}

  const up=event.target.closest("[data-module-up]");
  if(up){const idx=moduleState.findIndex(m=>m.id===up.dataset.moduleUp);if(idx>0){[moduleState[idx-1],moduleState[idx]]=[moduleState[idx],moduleState[idx-1]];saveAll();applyModuleState()}}
  const down=event.target.closest("[data-module-down]");
  if(down){const idx=moduleState.findIndex(m=>m.id===down.dataset.moduleDown);if(idx>=0&&idx<moduleState.length-1){[moduleState[idx+1],moduleState[idx]]=[moduleState[idx],moduleState[idx+1]];saveAll();applyModuleState()}}

  const deleteCustom=event.target.closest("[data-delete-custom]");
  if(deleteCustom){customModules=customModules.filter(m=>m.id!==deleteCustom.dataset.deleteCustom);saveAll();renderCustomModules();toast("Módulo eliminado.")}

  const searchResult=event.target.closest("[data-search-kind]");
  if(searchResult){
    closeModal("searchModal");
    if(searchResult.dataset.searchKind==="year")openYear(searchResult.dataset.searchId);
    if(searchResult.dataset.searchKind==="idea")openIdea(searchResult.dataset.searchId);
    if(searchResult.dataset.searchKind==="resource"){
      const r=resources.find(x=>x.id===searchResult.dataset.searchId);if(r)openResources("all",[r]);
    }
  }
});

document.getElementById("heroYearSelector").addEventListener("change",e=>selectYear(e.target.value));
document.getElementById("openSelectedYear").addEventListener("click",()=>openYear(selectedYear));

document.getElementById("openFilteredResources").addEventListener("click",()=>{
  const q=document.getElementById("resourceSearch").value.toLowerCase().trim();
  const y=document.getElementById("resourceYearFilter").value;
  const type=document.getElementById("resourceTypeFilter").value;
  const list=resources.filter(r=>(!q||`${r.title} ${r.description}`.toLowerCase().includes(q))&&(y==="all"||Number(r.year)===Number(y))&&(type==="all"||r.type===type));
  openResources("all",list);
});

document.getElementById("openIdeaForm").addEventListener("click",()=>openModal("ideaFormModal"));
document.getElementById("ideaForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);
  ideas.unshift({
    id:`i${Date.now()}`,title:form.get("title"),author:form.get("author"),location:form.get("location"),
    category:form.get("category"),description:form.get("description"),status:"recibida",
    response:"La propuesta fue recibida y está pendiente de revisión institucional.",votes:0,
    created:new Date().toISOString().slice(0,10)
  });
  saveAll();renderIdeas();event.target.reset();closeModal("ideaFormModal");toast("Idea publicada en el tablero.");
});

document.addEventListener("submit",event=>{
  if(event.target.id==="ideaAdminForm"){
    event.preventDefault();const form=new FormData(event.target);const idea=ideas.find(i=>i.id===event.target.dataset.idea);
    if(idea){idea.status=form.get("status");idea.response=form.get("response");saveAll();renderIdeas();closeModal("ideaAdminModal");toast("Respuesta institucional actualizada.")}
  }
});

document.getElementById("participationForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);
  const existing=loadArray(KEYS.participations,[]);
  existing.push({id:Date.now(),...Object.fromEntries(form),created:new Date().toISOString()});
  localStorage.setItem(KEYS.participations,JSON.stringify(existing));event.target.reset();toast("Participación registrada localmente.");
});
document.getElementById("newsletterForm").addEventListener("submit",event=>{event.preventDefault();event.target.reset();toast("Suscripción registrada en la demostración.")});

document.getElementById("openAdminLogin").addEventListener("click",()=>{
  if(isAdmin)openModal("adminPanel");else openModal("loginModal");
});
document.getElementById("loginForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);
  if(form.get("username")===DEMO_ADMIN.username&&form.get("password")===DEMO_ADMIN.password){
    isAdmin=true;sessionStorage.setItem("sp_admin_session","1");event.target.reset();closeModal("loginModal");openModal("adminPanel");toast("Sesión administrativa iniciada.");
  }else toast("Credenciales incorrectas.");
});
document.getElementById("adminLogout").addEventListener("click",()=>{isAdmin=false;sessionStorage.removeItem("sp_admin_session");closeModal("adminPanel");toast("Sesión cerrada.")});

document.getElementById("applyColors").addEventListener("click",()=>{
  settings.primary=document.getElementById("settingPrimary").value;
  settings.secondary=document.getElementById("settingSecondary").value;
  settings.accent=document.getElementById("settingAccent").value;
  settings.background=document.getElementById("settingBackground").value;
  settings.text=document.getElementById("settingText").value;
  saveAll();applySettings();toast("Colores actualizados.");
});
document.getElementById("settingFont").addEventListener("change",e=>{settings.font=e.target.value;saveAll();applySettings()});
document.getElementById("settingFontScale").addEventListener("input",e=>{settings.fontScale=Number(e.target.value);document.getElementById("fontScaleOutput").value=`${e.target.value}%`;saveAll();applySettings()});
document.getElementById("settingRadius").addEventListener("input",e=>{settings.radius=Number(e.target.value);document.getElementById("radiusOutput").value=`${e.target.value} px`;saveAll();applySettings()});

document.getElementById("customModuleForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);
  customModules.push({id:`m${Date.now()}`,title:form.get("title"),subtitle:form.get("subtitle"),button:form.get("button"),content:form.get("content")});
  saveAll();renderCustomModules();event.target.reset();toast("Módulo creado.");
});
document.getElementById("adminYearForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);const year=Number(form.get("year"));
  if(getYear(year)){toast("La vigencia ya existe.");return}
  years.push({year,status:form.get("status"),progress:Number(form.get("progress")),description:form.get("description"),commitments:0,metrics:{plan:Number(form.get("progress")),projects:0,commitments:0,participation:0}});
  selectedYear=year;saveAll();renderAll();event.target.reset();toast(`Vigencia ${year} creada.`);
});
document.getElementById("adminResourceForm").addEventListener("submit",event=>{
  event.preventDefault();const form=new FormData(event.target);
  resources.unshift({id:`r${Date.now()}`,title:form.get("title"),year:Number(form.get("year")),type:form.get("type"),description:form.get("description"),url:form.get("url")||"#",meta:"Recurso agregado desde el panel"});
  saveAll();renderAll();event.target.reset();toast("Recurso agregado.");
});

document.getElementById("exportConfiguration").addEventListener("click",()=>{
  const data={years,resources,ideas,customModules,moduleState,settings,exportedAt:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);
  const link=document.createElement("a");link.href=url;link.download="respaldo-rendicion-san-pedro.json";link.click();URL.revokeObjectURL(url);toast("Respaldo descargado.");
});
document.getElementById("resetPortal").addEventListener("click",()=>{
  if(!confirm("¿Restablecer toda la demostración local?"))return;
  Object.values(KEYS).forEach(key=>localStorage.removeItem(key));
  years=clone(DEFAULT_YEARS);resources=clone(DEFAULT_RESOURCES);ideas=clone(DEFAULT_IDEAS);customModules=[];moduleState=clone(DEFAULT_MODULE_STATE);settings=clone(DEFAULT_SETTINGS);selectedYear=2025;
  saveAll();applySettings();renderAll();toast("Portal restablecido.");
});

document.getElementById("openSearch").addEventListener("click",()=>{openModal("searchModal");document.getElementById("globalSearch").value="";searchPortal("");setTimeout(()=>document.getElementById("globalSearch").focus(),100)});
document.getElementById("globalSearch").addEventListener("input",e=>searchPortal(e.target.value));

document.getElementById("accessibilityToggle").addEventListener("click",()=>document.getElementById("accessibilityDrawer").classList.toggle("open"));
document.getElementById("increaseFont").addEventListener("click",()=>{settings.fontScale=Math.min(125,Number(settings.fontScale)+5);saveAll();applySettings()});
document.getElementById("decreaseFont").addEventListener("click",()=>{settings.fontScale=Math.max(80,Number(settings.fontScale)-5);saveAll();applySettings()});
document.getElementById("toggleContrast").addEventListener("click",()=>document.body.classList.toggle("high-contrast"));
document.getElementById("toggleMotion").addEventListener("click",()=>document.body.classList.toggle("reduce-motion"));
document.getElementById("resetAccessibility").addEventListener("click",()=>{document.body.classList.remove("high-contrast","reduce-motion");settings.fontScale=100;saveAll();applySettings()});

const mobileMenu=document.getElementById("mobileMenu"),mainNavigation=document.getElementById("mainNavigation");
mobileMenu.addEventListener("click",()=>mainNavigation.classList.toggle("open"));
mainNavigation.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>mainNavigation.classList.remove("open")));

document.querySelectorAll("dialog").forEach(dialog=>dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close()}));
document.getElementById("backTop").addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));
window.addEventListener("scroll",()=>{
  const max=document.documentElement.scrollHeight-innerHeight;
  document.getElementById("readingProgress").style.width=`${max>0?scrollY/max*100:0}%`;
  document.getElementById("backTop").classList.toggle("visible",scrollY>650);
});
document.getElementById("currentYear").textContent=new Date().getFullYear();

const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting)entry.target.classList.add("visible")}),{threshold:.08});
document.querySelectorAll(".reveal").forEach(el=>revealObserver.observe(el));

applySettings();renderAll();
