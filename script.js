const STORAGE_KEYS = {
  years: "rendicion_years_v2",
  resources: "rendicion_resources_v2",
  welcome: "rendicion_welcome_hidden_v2",
  accessibility: "rendicion_accessibility_v2"
};

const defaultYears = [
  {
    year: 2025,
    status: "PUBLICADA",
    description: "Consulte el informe central, la presentación pública, los anexos técnicos, las respuestas ciudadanas y el seguimiento a compromisos.",
    progress: 92,
    videos: 6,
    commitments: 24,
    metrics: { plan: 92, projects: 148, commitments: 87, participation: 36 },
    highlights: ["Balance de gestión", "Ejecución y resultados", "Compromisos ciudadanos"]
  },
  {
    year: 2026,
    status: "EN CONSTRUCCIÓN",
    description: "Espacio para avances periódicos, evidencias, noticias, documentos preliminares y seguimiento a la preparación de la siguiente audiencia.",
    progress: 58,
    videos: 2,
    commitments: 9,
    metrics: { plan: 58, projects: 74, commitments: 61, participation: 18 },
    highlights: ["Avance semestral", "Construcción del informe", "Agenda de participación"]
  },
  {
    year: 2027,
    status: "PROGRAMADA",
    description: "Estructura preparada para incorporar la información, indicadores, documentos, videos y compromisos correspondientes a la vigencia.",
    progress: 0,
    videos: 0,
    commitments: 0,
    metrics: { plan: 0, projects: 0, commitments: 0, participation: 0 },
    highlights: ["Espacio reservado", "Carga futura de recursos", "Configuración escalable"]
  }
];

const defaultResources = [
  {
    id: "r1", year: 2025, type: "informe", status: "publicado",
    title: "Informe de Gestión y Rendición de Cuentas",
    description: "Documento principal con resultados, ejecución, metas, retos y compromisos de la vigencia.",
    meta: "84 páginas · 4.8 MB", url: "#"
  },
  {
    id: "r2", year: 2025, type: "presentacion", status: "publicado",
    title: "Presentación de la Audiencia Pública",
    description: "Síntesis visual utilizada durante la jornada institucional de diálogo ciudadano.",
    meta: "42 diapositivas · 9.2 MB", url: "#"
  },
  {
    id: "r3", year: 2025, type: "video", status: "publicado",
    title: "Transmisión de la Audiencia Pública",
    description: "Registro audiovisual completo del ejercicio de Rendición de Cuentas.",
    meta: "1 h 48 min · Streaming", url: "#"
  },
  {
    id: "r4", year: 2025, type: "datos", status: "publicado",
    title: "Base consolidada de indicadores",
    description: "Archivo estructurado para consulta, análisis, verificación y reutilización.",
    meta: "12 hojas · 1.3 MB", url: "#"
  },
  {
    id: "r5", year: 2025, type: "anexo", status: "publicado",
    title: "Anexos técnicos y evidencias",
    description: "Soportes complementarios asociados a resultados, proyectos y ejecución.",
    meta: "16 anexos · 18.4 MB", url: "#"
  },
  {
    id: "r6", year: 2026, type: "informe", status: "borrador",
    title: "Informe preliminar de avance 2026",
    description: "Corte de seguimiento para preparar la nueva edición institucional.",
    meta: "En preparación · Borrador", url: "#"
  },
  {
    id: "r7", year: 2026, type: "datos", status: "publicado",
    title: "Seguimiento semestral de metas",
    description: "Consolidado demostrativo del avance de metas estratégicas durante 2026.",
    meta: "6 hojas · 740 KB", url: "#"
  },
  {
    id: "r8", year: 2027, type: "informe", status: "programado",
    title: "Espacio reservado para la vigencia 2027",
    description: "La estructura documental se habilitará cuando inicie el proceso correspondiente.",
    meta: "Próximamente · Programado", url: "#"
  }
];

const infoContent = {
  plan: {
    title: "Cumplimiento del plan",
    body: "Representa el avance consolidado de las metas estratégicas de la vigencia seleccionada. Puede calcularse desde el plan de desarrollo, plan de acción o instrumento institucional equivalente."
  },
  projects: {
    title: "Proyectos ejecutados",
    body: "Agrupa iniciativas terminadas, en operación o con entregables verificables. El detalle puede organizarse por dependencia, sector, territorio, presupuesto o población beneficiaria."
  },
  commitments: {
    title: "Compromisos atendidos",
    body: "Mide la atención de compromisos, solicitudes y respuestas derivadas de ejercicios de participación, audiencias públicas y seguimiento ciudadano."
  },
  participation: {
    title: "Espacios de participación",
    body: "Incluye encuentros, mesas, audiencias, encuestas, talleres y otros escenarios de diálogo o consulta con la ciudadanía."
  }
};

let years = loadData(STORAGE_KEYS.years, defaultYears);
let resources = loadData(STORAGE_KEYS.resources, defaultResources);
let selectedYear = years[0]?.year || 2025;
let toastTimer;

function clone(data){
  return JSON.parse(JSON.stringify(data));
}

function loadData(key, fallback){
  try{
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) && parsed.length ? parsed : clone(fallback);
  }catch{
    return clone(fallback);
  }
}

function saveData(){
  localStorage.setItem(STORAGE_KEYS.years, JSON.stringify(years));
  localStorage.setItem(STORAGE_KEYS.resources, JSON.stringify(resources));
}

function getYear(year){
  return years.find(item => Number(item.year) === Number(year));
}

function countResources(year, type){
  return resources.filter(item => Number(item.year) === Number(year) && (!type || item.type === type)).length;
}

function iconFor(type){
  return {
    informe: "PDF",
    presentacion: "PPT",
    video: "VID",
    datos: "XLS",
    anexo: "ANX"
  }[type] || "DOC";
}

function labelFor(type){
  return {
    informe: "Informe",
    presentacion: "Presentación",
    video: "Video",
    datos: "Datos",
    anexo: "Anexo"
  }[type] || "Documento";
}

function showToast(message){
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openDialog(id){
  const dialog = document.getElementById(id);
  if(dialog && !dialog.open) dialog.showModal();
}

function closeDialog(id){
  const dialog = document.getElementById(id);
  if(dialog?.open) dialog.close();
}

function renderYearTabs(){
  const tabs = document.querySelector("#yearTabs");
  tabs.innerHTML = "";
  years.sort((a,b) => Number(a.year) - Number(b.year)).forEach(item => {
    const button = document.createElement("button");
    button.className = `year-tab ${Number(item.year) === Number(selectedYear) ? "active" : ""}`;
    button.dataset.year = item.year;
    button.textContent = item.year;
    button.addEventListener("click", () => selectYear(item.year));
    tabs.appendChild(button);
  });

  const historical = document.createElement("button");
  historical.className = "year-tab";
  historical.textContent = "Histórico";
  historical.addEventListener("click", () => {
    document.querySelector("#repositorio").scrollIntoView({behavior:"smooth"});
    document.querySelector("#yearFilter").value = "all";
    renderResources();
  });
  tabs.appendChild(historical);
}

function renderYearCards(){
  const holder = document.querySelector("#yearCards");
  holder.innerHTML = "";
  years.forEach(item => {
    const card = document.createElement("article");
    card.className = "year-card reveal visible";
    card.innerHTML = `
      <div class="year-card-head">
        <strong>${item.year}</strong>
        <span>${item.status}</span>
      </div>
      <p>${escapeHTML(item.description)}</p>
      <div class="year-card-footer">
        <span>${countResources(item.year)} recursos · ${item.progress}% avance</span>
        <button class="text-link" data-open-year="${item.year}">Abrir →</button>
      </div>
    `;
    holder.appendChild(card);
  });
}

function selectYear(year){
  const item = getYear(year);
  if(!item) return;
  selectedYear = Number(year);
  renderYearTabs();
  document.querySelector("#yearStatus").textContent = item.status;
  document.querySelector("#yearTitle").textContent = `Rendición de Cuentas ${item.year}`;
  document.querySelector("#yearDescription").textContent = item.description;
  document.querySelector("#yearProgress").textContent = `${item.progress}%`;
  document.querySelector("#docsCount").textContent = countResources(item.year);
  document.querySelector("#videoCount").textContent = countResources(item.year, "video");
  document.querySelector("#commitmentCount").textContent = item.commitments;
  document.querySelector("#progressLabel").textContent = `${item.progress}%`;
  document.querySelector("#progressBar").style.width = `${item.progress}%`;
  document.querySelector("#heroCurrentEdition").textContent = `VIGENCIA ${item.year}`;

  const status = document.querySelector("#yearStatus");
  status.style.background = item.status === "PUBLICADA" ? "#eaf6ef" : item.status === "PROGRAMADA" ? "#f7e8ea" : "#fff2dd";
  status.style.color = item.status === "PUBLICADA" ? "#1f7a5a" : item.status === "PROGRAMADA" ? "#a12b35" : "#b96c2b";

  updateMetrics(item.metrics);
}

function updateMetrics(metrics){
  const map = {
    metricPlan: metrics.plan,
    metricProjects: metrics.projects,
    metricCommitments: metrics.commitments,
    metricParticipation: metrics.participation
  };
  Object.entries(map).forEach(([id,value]) => {
    const element = document.getElementById(id);
    element.dataset.target = value;
    animateCounter(element, value);
  });
}

function animateCounter(element, target){
  let current = 0;
  const step = Math.max(1, Math.ceil(Number(target) / 36));
  clearInterval(element._timer);
  element.textContent = "0";
  element._timer = setInterval(() => {
    current += step;
    if(current >= target){
      current = target;
      clearInterval(element._timer);
    }
    element.textContent = current;
  }, 24);
}

function openYearModal(year){
  const item = getYear(year);
  if(!item) return;
  const yearResources = resources.filter(r => Number(r.year) === Number(year));
  const published = yearResources.filter(r => r.status === "publicado").length;
  document.querySelector("#yearModalContent").innerHTML = `
    <section class="year-modal-hero">
      <span class="eyebrow" style="color:#d6ad55">${escapeHTML(item.status)}</span>
      <h2>Rendición de Cuentas ${item.year}</h2>
      <p>${escapeHTML(item.description)}</p>
      <div class="year-modal-grid">
        <div><strong>${item.progress}%</strong><span>Avance general</span></div>
        <div><strong>${yearResources.length}</strong><span>Recursos</span></div>
        <div><strong>${published}</strong><span>Publicados</span></div>
        <div><strong>${item.commitments}</strong><span>Compromisos</span></div>
      </div>
    </section>
    <section class="year-modal-body">
      <div>
        <h3>Contenido principal</h3>
        <ul>${item.highlights.map(h => `<li>${escapeHTML(h)}</li>`).join("")}</ul>
        <h3>Descripción de la edición</h3>
        <p>${escapeHTML(item.description)}</p>
      </div>
      <div>
        <h3>Recursos disponibles</h3>
        ${yearResources.length ? yearResources.slice(0,5).map(resource => `
          <button class="search-result" data-resource-id="${resource.id}">
            <span><strong>${escapeHTML(resource.title)}</strong><small>${labelFor(resource.type)} · ${resource.status}</small></span>
            <b>↗</b>
          </button>
        `).join("") : "<p>No hay recursos registrados todavía.</p>"}
      </div>
    </section>
  `;
  openDialog("yearModal");
}

function renderYearOptions(){
  const selects = [
    document.querySelector("#yearFilter"),
    document.querySelector("#participationYear"),
    document.querySelector("#resourceYear"),
    document.querySelector("#compareYearA"),
    document.querySelector("#compareYearB")
  ];

  selects.forEach(select => {
    if(!select) return;
    const keepAll = select.id === "yearFilter";
    const current = select.value;
    select.innerHTML = keepAll ? '<option value="all">Todas las vigencias</option>' : '<option value="">Seleccione</option>';
    years.forEach(item => {
      const option = document.createElement("option");
      option.value = item.year;
      option.textContent = item.year;
      select.appendChild(option);
    });
    if([...select.options].some(opt => opt.value === current)) select.value = current;
  });

  if(years.length >= 2){
    document.querySelector("#compareYearA").value = years[0].year;
    document.querySelector("#compareYearB").value = years[1].year;
  }
}

function renderResources(){
  const grid = document.querySelector("#resourceGrid");
  const query = document.querySelector("#resourceSearch").value.toLowerCase().trim();
  const year = document.querySelector("#yearFilter").value;
  const type = document.querySelector("#typeFilter").value;
  const status = document.querySelector("#statusFilter").value;

  const filtered = resources.filter(item => {
    const searchText = `${item.title} ${item.description} ${item.year} ${item.type} ${item.status}`.toLowerCase();
    return (!query || searchText.includes(query))
      && (year === "all" || Number(item.year) === Number(year))
      && (type === "all" || item.type === type)
      && (status === "all" || item.status === status);
  });

  grid.innerHTML = filtered.map(item => `
    <article class="resource-card">
      <div class="resource-icon">${iconFor(item.type)}</div>
      <div>
        <div class="resource-card-top">
          <span>${item.year} · ${labelFor(item.type).toUpperCase()}</span>
          <span class="resource-status">${item.status.toUpperCase()}</span>
        </div>
        <h3>${escapeHTML(item.title)}</h3>
        <p>${escapeHTML(item.description)}</p>
        <div class="resource-meta"><span>${escapeHTML(item.meta || "Información digital")}</span></div>
      </div>
      <button class="resource-open" data-resource-id="${item.id}" aria-label="Abrir recurso">↗</button>
    </article>
  `).join("");

  document.querySelector("#emptyState").style.display = filtered.length ? "none" : "block";
  updateSummary();
}

function openResourceModal(id){
  const item = resources.find(resource => resource.id === id);
  if(!item) return;
  document.querySelector("#resourceModalContent").innerHTML = `
    <div class="resource-preview">
      <div class="resource-preview-visual">${iconFor(item.type)}</div>
      <div>
        <span class="eyebrow">${item.year} · ${labelFor(item.type).toUpperCase()}</span>
        <h2>${escapeHTML(item.title)}</h2>
        <p>${escapeHTML(item.description)}</p>
        <div class="resource-details">
          <div><strong>Vigencia</strong><span>${item.year}</span></div>
          <div><strong>Estado</strong><span>${item.status}</span></div>
          <div><strong>Formato</strong><span>${labelFor(item.type)}</span></div>
          <div><strong>Detalle</strong><span>${escapeHTML(item.meta || "Recurso digital")}</span></div>
        </div>
        <div class="modal-actions">
          <a class="btn btn-primary" href="${safeUrl(item.url)}" ${item.url !== "#" ? 'target="_blank" rel="noopener"' : ""}>Abrir recurso</a>
          <button class="btn btn-ghost" data-filter-year="${item.year}">Ver toda la vigencia</button>
        </div>
      </div>
    </div>
  `;
  openDialog("resourceModal");
}

function updateSummary(){
  document.querySelector("#headerResourceCount").textContent = `${resources.length} recursos`;
  document.querySelector("#heroYearsCount").textContent = years.length;
  document.querySelector("#heroDocsCount").textContent = resources.length;
  document.querySelector("#repositoryTotal").textContent = resources.length;
  document.querySelector("#repositoryPublished").textContent = resources.filter(r => r.status === "publicado").length;
  document.querySelector("#repositoryYears").textContent = years.length;
}

function runComparison(){
  const a = getYear(document.querySelector("#compareYearA").value);
  const b = getYear(document.querySelector("#compareYearB").value);
  if(!a || !b){
    showToast("Seleccione dos vigencias válidas.");
    return;
  }
  const rows = [
    ["Avance general", a.progress, b.progress, "%"],
    ["Cumplimiento del plan", a.metrics.plan, b.metrics.plan, "%"],
    ["Proyectos", a.metrics.projects, b.metrics.projects, ""],
    ["Compromisos atendidos", a.metrics.commitments, b.metrics.commitments, "%"],
    ["Participación", a.metrics.participation, b.metrics.participation, ""]
  ];
  const column = (item, index) => `
    <div class="compare-column">
      <span class="eyebrow">VIGENCIA</span>
      <h3>${item.year}</h3>
      ${rows.map(row => `
        <div class="compare-row">
          <span><b>${row[0]}</b><strong>${row[index]}${row[3]}</strong></span>
          <i><u style="width:${Math.min(Number(row[index]),100)}%"></u></i>
        </div>
      `).join("")}
      <p>${countResources(item.year)} recursos registrados · ${item.status}</p>
    </div>
  `;
  document.querySelector("#compareResult").innerHTML = `<div class="compare-grid">${column(a,1)}${column(b,2)}</div>`;
}

function renderGlobalSearch(query = ""){
  const holder = document.querySelector("#globalSearchResults");
  const q = query.toLowerCase().trim();
  if(!q){
    holder.innerHTML = `
      <button class="search-result" data-jump="#vigencias"><span><strong>Explorar vigencias</strong><small>2025, 2026 y años futuros</small></span><b>→</b></button>
      <button class="search-result" data-jump="#repositorio"><span><strong>Consultar repositorio</strong><small>Informes, videos, datos y anexos</small></span><b>→</b></button>
      <button class="search-result" data-jump="#compromisos"><span><strong>Revisar compromisos</strong><small>Estado y seguimiento público</small></span><b>→</b></button>
    `;
    return;
  }

  const yearMatches = years.filter(item => `${item.year} ${item.status} ${item.description}`.toLowerCase().includes(q));
  const resourceMatches = resources.filter(item => `${item.title} ${item.description} ${item.year} ${item.type}`.toLowerCase().includes(q));
  const results = [
    ...yearMatches.map(item => `<button class="search-result" data-open-year="${item.year}"><span><strong>Rendición de Cuentas ${item.year}</strong><small>${escapeHTML(item.status)}</small></span><b>→</b></button>`),
    ...resourceMatches.map(item => `<button class="search-result" data-resource-id="${item.id}"><span><strong>${escapeHTML(item.title)}</strong><small>${item.year} · ${labelFor(item.type)}</small></span><b>↗</b></button>`)
  ];
  holder.innerHTML = results.length ? results.join("") : `<div class="empty-state" style="display:block"><strong>Sin resultados</strong><p>No encontramos coincidencias para “${escapeHTML(query)}”.</p></div>`;
}

function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[char]));
}

function safeUrl(value){
  const url = String(value || "#").trim();
  return /^(https?:\/\/|#|\/)/i.test(url) ? url : "#";
}

function initReveal(){
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting) entry.target.classList.add("visible");
    });
  }, {threshold:.1});
  document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
}

function initAccessibility(){
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.accessibility) || "{}");
  if(saved.size) document.documentElement.style.setProperty("--base-size", `${saved.size}px`);
  if(saved.contrast) document.body.classList.add("high-contrast");
  if(saved.motion) document.body.classList.add("reduce-motion");

  function persist(){
    localStorage.setItem(STORAGE_KEYS.accessibility, JSON.stringify({
      size: parseFloat(getComputedStyle(document.documentElement).fontSize),
      contrast: document.body.classList.contains("high-contrast"),
      motion: document.body.classList.contains("reduce-motion")
    }));
  }

  document.querySelector("#fontIncrease").addEventListener("click", () => {
    const size = Math.min(20, parseFloat(getComputedStyle(document.documentElement).fontSize) + 1);
    document.documentElement.style.setProperty("--base-size", `${size}px`);
    persist();
  });
  document.querySelector("#fontDecrease").addEventListener("click", () => {
    const size = Math.max(14, parseFloat(getComputedStyle(document.documentElement).fontSize) - 1);
    document.documentElement.style.setProperty("--base-size", `${size}px`);
    persist();
  });
  document.querySelector("#contrastToggle").addEventListener("click", () => {
    document.body.classList.toggle("high-contrast"); persist();
  });
  document.querySelector("#motionToggle").addEventListener("click", () => {
    document.body.classList.toggle("reduce-motion"); persist();
  });
  document.querySelector("#resetAccessibility").addEventListener("click", () => {
    document.documentElement.style.setProperty("--base-size","16px");
    document.body.classList.remove("high-contrast","reduce-motion");
    localStorage.removeItem(STORAGE_KEYS.accessibility);
  });
}

document.addEventListener("click", event => {
  const closeButton = event.target.closest("[data-close-dialog]");
  if(closeButton) closeDialog(closeButton.dataset.closeDialog);

  if(event.target.closest("[data-close-panel]")){
    document.querySelector("#accessibilityPanel").classList.remove("open");
  }

  const yearButton = event.target.closest("[data-open-year]");
  if(yearButton) openYearModal(yearButton.dataset.openYear);

  const resourceButton = event.target.closest("[data-resource-id]");
  if(resourceButton) openResourceModal(resourceButton.dataset.resourceId);

  const scrollButton = event.target.closest("[data-scroll]");
  if(scrollButton) document.querySelector(scrollButton.dataset.scroll)?.scrollIntoView({behavior:"smooth"});

  const jumpButton = event.target.closest("[data-jump]");
  if(jumpButton){
    closeDialog("searchModal");
    document.querySelector(jumpButton.dataset.jump)?.scrollIntoView({behavior:"smooth"});
  }

  const filterYear = event.target.closest("[data-filter-year]");
  if(filterYear){
    closeDialog("resourceModal");
    document.querySelector("#yearFilter").value = filterYear.dataset.filterYear;
    renderResources();
    document.querySelector("#repositorio").scrollIntoView({behavior:"smooth"});
  }

  const metricButton = event.target.closest("[data-info]");
  if(metricButton){
    const item = infoContent[metricButton.dataset.info];
    document.querySelector("#infoModalContent").innerHTML = `<span class="eyebrow">DETALLE DEL INDICADOR</span><h2>${item.title}</h2><p>${item.body}</p>`;
    openDialog("infoModal");
  }

  const storyButton = event.target.closest("[data-open-story]");
  if(storyButton){
    const stories = {
      impacto:["Más que cifras: el impacto de la gestión","Esta sección puede ampliarse con una narración editorial, fotografías, testimonios, cifras destacadas, enlaces a evidencias y conclusiones de la vigencia."],
      transparencia:["Información organizada para facilitar la verificación","El portal puede clasificar cada contenido por dependencia, sector, meta, proyecto, población beneficiaria, territorio y tipo documental."],
      participacion:["La voz ciudadana como parte del informe","Las preguntas, respuestas y compromisos pueden publicarse con estado, responsable, fecha de respuesta y soportes relacionados."]
    };
    const story = stories[storyButton.dataset.openStory];
    document.querySelector("#infoModalContent").innerHTML = `<span class="eyebrow">HISTORIA DESTACADA</span><h2>${story[0]}</h2><p>${story[1]}</p>`;
    openDialog("infoModal");
  }
});

document.querySelector("#openSummaryButton").addEventListener("click", () => {
  const item = getYear(selectedYear);
  document.querySelector("#infoModalContent").innerHTML = `
    <span class="eyebrow">RESUMEN RÁPIDO</span>
    <h2>Rendición de Cuentas ${item.year}</h2>
    <p>${escapeHTML(item.description)}</p>
    <div class="resource-details">
      <div><strong>Avance general</strong><span>${item.progress}%</span></div>
      <div><strong>Recursos</strong><span>${countResources(item.year)}</span></div>
      <div><strong>Videos</strong><span>${countResources(item.year,"video")}</span></div>
      <div><strong>Compromisos</strong><span>${item.commitments}</span></div>
    </div>
  `;
  openDialog("infoModal");
});

document.querySelector("#openYearButton").addEventListener("click", () => openYearModal(selectedYear));
document.querySelector("#compareButton").addEventListener("click", () => { openDialog("compareModal"); runComparison(); });
document.querySelector("#runCompare").addEventListener("click", runComparison);
document.querySelector("#searchTrigger").addEventListener("click", () => { openDialog("searchModal"); renderGlobalSearch(); setTimeout(() => document.querySelector("#globalSearch").focus(),100); });
document.querySelector("#globalSearch").addEventListener("input", event => renderGlobalSearch(event.target.value));

document.querySelector("#accessibilityButton").addEventListener("click", () => {
  document.querySelector("#accessibilityPanel").classList.toggle("open");
});

document.querySelector("#openManagerButton").addEventListener("click", () => openDialog("managerModal"));
document.querySelector("#addYearButton").addEventListener("click", () => openDialog("yearFormModal"));
document.querySelector("#addResourceButton").addEventListener("click", () => openDialog("resourceFormModal"));
document.querySelector("#managerAddYear").addEventListener("click", () => { closeDialog("managerModal"); openDialog("yearFormModal"); });
document.querySelector("#managerAddResource").addEventListener("click", () => { closeDialog("managerModal"); openDialog("resourceFormModal"); });

document.querySelector("#yearForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.target);
  const year = Number(form.get("year"));
  if(getYear(year)){
    showToast("Esa vigencia ya existe.");
    return;
  }
  years.push({
    year,
    status: form.get("status"),
    description: form.get("description"),
    progress: Number(form.get("progress")),
    videos: 0,
    commitments: 0,
    metrics: { plan:Number(form.get("progress")), projects:0, commitments:0, participation:0 },
    highlights:["Nueva edición creada","Repositorio disponible","Contenido pendiente de publicación"]
  });
  selectedYear = year;
  saveData();
  renderAll();
  event.target.reset();
  closeDialog("yearFormModal");
  showToast(`Vigencia ${year} creada correctamente.`);
});

document.querySelector("#resourceForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.target);
  resources.unshift({
    id: `r${Date.now()}`,
    title: form.get("title"),
    year: Number(form.get("year")),
    type: form.get("type"),
    status: form.get("status"),
    description: form.get("description"),
    url: form.get("url") || "#",
    meta: "Recurso agregado localmente"
  });
  saveData();
  renderAll();
  event.target.reset();
  closeDialog("resourceFormModal");
  showToast("Recurso agregado al repositorio.");
});

document.querySelector("#exportData").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({years,resources},null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "respaldo-rendicion-cuentas.json";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Configuración exportada.");
});

document.querySelector("#resetDemo").addEventListener("click", () => {
  const confirmed = confirm("¿Desea eliminar los cambios locales y restaurar la demostración?");
  if(!confirmed) return;
  localStorage.removeItem(STORAGE_KEYS.years);
  localStorage.removeItem(STORAGE_KEYS.resources);
  years = clone(defaultYears);
  resources = clone(defaultResources);
  selectedYear = 2025;
  closeDialog("managerModal");
  renderAll();
  showToast("Demostración restablecida.");
});

["resourceSearch","yearFilter","typeFilter","statusFilter"].forEach(id => {
  document.getElementById(id).addEventListener("input", renderResources);
});

document.querySelector("#participationForm").addEventListener("submit", event => {
  event.preventDefault();
  document.querySelector("#formMessage").textContent = "Participación registrada localmente para esta demostración.";
  event.target.reset();
  showToast("Participación registrada.");
});

document.querySelector("#newsletterForm").addEventListener("submit", event => {
  event.preventDefault();
  event.target.reset();
  showToast("Suscripción registrada en la demostración.");
});

document.querySelector("#openNewsButton").addEventListener("click", () => {
  document.querySelector("#infoModalContent").innerHTML = `
    <span class="eyebrow">PUBLICACIONES</span>
    <h2>Actualidad de la Rendición de Cuentas</h2>
    <p>Este espacio puede convertirse en un módulo de noticias administrable con fecha, imagen, autor, categoría, contenido y documentos relacionados.</p>
    <div class="resource-details">
      <div><strong>14 JUL 2026</strong><span>Repositorio histórico habilitado</span></div>
      <div><strong>30 JUN 2026</strong><span>Avance de edición 2026</span></div>
      <div><strong>18 MAR 2026</strong><span>Seguimiento de compromisos</span></div>
      <div><strong>15 DIC 2025</strong><span>Publicación del informe central</span></div>
    </div>
  `;
  openDialog("infoModal");
});

const menuToggle = document.querySelector("#menuToggle");
const mainNav = document.querySelector("#mainNav");
menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded",String(open));
});
mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => mainNav.classList.remove("open")));

document.querySelector("#backTop").addEventListener("click", () => window.scrollTo({top:0,behavior:"smooth"}));
window.addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  document.querySelector("#readingProgress").style.width = `${max > 0 ? (scrollY/max)*100 : 0}%`;
  document.querySelector("#backTop").classList.toggle("visible", scrollY > 650);
});

document.querySelector("#dontShowWelcome").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEYS.welcome,"1");
  closeDialog("welcomeModal");
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if(event.target === dialog) dialog.close();
  });
});

function renderAll(){
  renderYearTabs();
  renderYearCards();
  renderYearOptions();
  renderResources();
  selectYear(selectedYear);
  updateSummary();
}

document.querySelector("#currentYear").textContent = new Date().getFullYear();
initReveal();
initAccessibility();
renderAll();

if(!localStorage.getItem(STORAGE_KEYS.welcome)){
  setTimeout(() => openDialog("welcomeModal"), 500);
}
