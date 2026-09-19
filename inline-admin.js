(() => {
  const Portal = window.Portal;
  if (!Portal) return;

  const { state, helpers } = Portal;
  let active = false;
  let inspectorTarget = null;
  let mutationObserver = null;
  let saveTimer = null;
  let bannerTimer = null;
  let bannerIndex = 0;
  const publicationUi = { tab:"recent", year:"all", type:"all", view:"grid" };
  let quickControlsEnabled = sessionStorage.getItem("sp_admin_quick_view") !== "visitor";

  const pageKey = () => helpers.pageKey();

  function normalizeBannerConfig(config = {}) {
    if (!config || typeof config !== "object") config = {};
    if (!Array.isArray(config.slides)) config.slides = config.image ? [config.image] : [];
    config.slides = config.slides.filter(Boolean).slice(0,5);
    if (!config.rotationMs) config.rotationMs = 6000;
    if (typeof config.overlay !== "number") config.overlay = 22;
    if (!config.position) config.position = "center center";
    if (!config.textAlign) config.textAlign = "left";
    return config;
  }


  function pageData() {
    const key = pageKey();
    if (!state.pageSettings[key]) {
      state.pageSettings[key] = {
        publication: { status:"published", publishAt:"" },
        banner: {
          image:"",
          slides:[],
          rotationMs:6000,
          height:"",
          position:"center center",
          overlay:22,
          textAlign:"left"
        },
        sections:{},
        elements:{},
        sectionOrder:[],
        customBlocks:[]
      };
    }
    state.pageSettings[key].banner = normalizeBannerConfig(state.pageSettings[key].banner);
    return state.pageSettings[key];
  }

  function contentKey(element) {
    if (element.dataset.adminContentKey) return element.dataset.adminContentKey;

    const main = document.querySelector("main");
    const section = element.closest("section,article,aside") || main;
    const sectionId = section?.id
      || section?.dataset.adminEntity
      || [...(main?.querySelectorAll("section,article,aside") || [])].indexOf(section);
    const candidates = section
      ? [...section.querySelectorAll("h1,h2,h3,h4,p,li,summary,blockquote,.button,a:not(nav a)")]
      : [];
    const index = candidates.indexOf(element);
    const key = `${pageKey()}:text:${sectionId}:${element.tagName.toLowerCase()}:${index}`;
    element.dataset.adminContentKey = key;
    return key;
  }

  function sectionKey(section) {
    if (section.dataset.adminSectionKey) return section.dataset.adminSectionKey;
    const main = document.querySelector("main");
    const index = [...(main?.querySelectorAll(":scope > section") || document.querySelectorAll("main section"))].indexOf(section);
    const key = section.id || section.dataset.adminEntity || `section-${Math.max(index,0)}`;
    section.dataset.adminSectionKey = key;
    return key;
  }

  function imageKey(image) {
    if (image.dataset.adminImageKey) return image.dataset.adminImageKey;
    const images = [...document.querySelectorAll("main img,header img")];
    const key = `${pageKey()}:image:${image.id || image.className || images.indexOf(image)}`;
    image.dataset.adminImageKey = key;
    return key;
  }

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        helpers.save();
        showSaved();
      } catch (error) {
        helpers.toast("No fue posible guardar. Reduzca el tamaño de las imágenes cargadas.");
      }
    }, 180);
  }

  function showSaved() {
    const indicator = document.querySelector("#inlineAdminSaved");
    const quickIndicator = document.querySelector("#quickSaveState");

    [indicator,quickIndicator].filter(Boolean).forEach(node => {
      node.textContent = "Guardado";
      node.classList.add("is-visible");
      clearTimeout(node._timer);
      node._timer = setTimeout(
        () => node.classList.remove("is-visible"),
        1400
      );
    });
  }

  function compressedImage(file, options = {}) {
    const { maxWidth = 1920, maxHeight = 1080, quality = .82 } = options;
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Seleccione un archivo de imagen."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No fue posible leer la imagen."));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("La imagen no es válida."));
        image.onload = () => {
          let width = image.naturalWidth;
          let height = image.naturalHeight;
          const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function persistImage(dataUrl,category="content") {
    if (!window.FirebasePortal?.canWrite?.()) {
      helpers.toast("Debe iniciar sesión con un administrador autorizado.");
      return dataUrl;
    }

    if (!window.DrivePortal?.isConfigured?.()) {
      helpers.toast("Configure Google Drive para publicar imágenes. Se conservará temporalmente en este navegador.");
      return dataUrl;
    }

    try {
      return await window.DrivePortal.uploadDataUrl(
        dataUrl,
        `public/images/${category}`,
        {
          category,
          year:currentYearContext(),
          makePublic:true
        }
      );
    } catch (error) {
      helpers.toast(window.DrivePortal?.friendlyError?.(error) || error.message);
      return dataUrl;
    }
  }

  async function persistDocument(file,category="documents") {
    if (!file) return "";
    if (!window.FirebasePortal?.canWrite?.()) {
      helpers.toast("Debe iniciar sesión con un administrador autorizado.");
      return "";
    }
    if (!window.DrivePortal?.isConfigured?.()) {
      helpers.toast("Configure Google Drive antes de subir documentos.");
      return "";
    }
    return window.DrivePortal.uploadFile(
      file,
      `public/documents/${category}`,
      {
        category,
        year:currentYearContext(),
        makePublic:true
      }
    );
  }

  function currentYearContext() {
    const bodyYear = Number(document.body.dataset.year || 0);
    if (bodyYear) return bodyYear;
    const queryYear = Number(new URLSearchParams(location.search).get("year") || 0);
    if (queryYear) return queryYear;
    return new Date().getFullYear();
  }

  function toolbarTemplate() {
    const s = state.settings;
    const p = pageData();
    const driveConfig =
      window.DrivePortal?.getConfig?.()
      || window.DRIVE_CONFIG
      || {};

    return `
      <div class="admin-console-shell"
        id="inlineAdminToolbar"
        aria-hidden="true">

        <button class="admin-console-backdrop"
          id="inlineConsoleBackdrop"
          type="button"
          aria-label="Cerrar panel administrativo"></button>

        <aside class="admin-console"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inlineConsoleTitle">

          <header class="admin-console__header">
            <div class="admin-console__identity">
              <span class="admin-console__avatar" id="inlineConsoleAvatar">A</span>
              <div>
                <small>Sesión administrativa</small>
                <strong id="inlineConsoleUser">Administrador</strong>
                <span id="inlineConsoleRole">Gestión del portal</span>
              </div>
            </div>

            <div class="admin-console__header-actions">
              <span class="inline-admin-saved" id="inlineAdminSaved">Guardado</span>
              <button type="button"
                class="admin-console__close ui-close-control"
                id="inlineConsoleClose"
                aria-label="Cerrar panel administrativo"><span aria-hidden="true">×</span></button>
            </div>
          </header>

          <div class="admin-console__layout">
            <nav class="admin-console__nav"
              aria-label="Módulos administrativos">

              <button type="button"
                class="active"
                data-console-tab="editing">
                <span aria-hidden="true">✎</span>
                <b>Edición</b>
                <small>Editar la página</small>
              </button>

              <button type="button" data-console-tab="appearance">
                <span aria-hidden="true">◐</span>
                <b>Apariencia</b>
                <small>Colores y tipografía</small>
              </button>

              <button type="button" data-console-tab="header">
                <span aria-hidden="true">▤</span>
                <b>Encabezado</b>
                <small>Logos y tamaños</small>
              </button>

              <button type="button" data-console-tab="banner">
                <span aria-hidden="true">▧</span>
                <b>Banner</b>
                <small>Carrusel e imágenes</small>
              </button>

              <button type="button" data-console-tab="publishing">
                <span aria-hidden="true">✓</span>
                <b>Publicación</b>
                <small>Estado y contenido</small>
              </button>

              <button type="button"
                id="inlineDriveQuick"
                data-console-tab="drive">
                <span class="drive-status-dot" id="inlineDriveQuickDot"></span>
                <b id="inlineDriveQuickLabel">Google Drive</b>
                <small>Archivos y evidencias</small>
              </button>

              <button type="button" data-console-tab="firestore">
                <span class="firebase-sync-dot"></span>
                <b>Firestore</b>
                <small>Sincronización de datos</small>
              </button>

              <button type="button"
                id="inlineUsersNav"
                data-console-tab="users">
                <span aria-hidden="true">◎</span>
                <b>Usuarios</b>
                <small>Roles y accesos</small>
              </button>

              <div class="admin-console__nav-footer">
                <button type="button"
                  class="admin-console__visitor"
                  id="inlineVisitorView">
                  <span aria-hidden="true">◉</span>
                  <b>Vista visitante</b>
                  <small>Revisar la página sin controles</small>
                </button>

                <button type="button"
                  class="admin-console__logout"
                  id="inlineLogout">
                  <span aria-hidden="true">↪</span>
                  <b>Cerrar sesión</b>
                </button>
              </div>
            </nav>

            <div class="admin-console__content">
              <section class="admin-console-panel active"
                data-console-panel="editing">
                <div class="admin-console-panel__heading">
                  <span>EDICIÓN DIRECTA</span>
                  <h2 id="inlineConsoleTitle">Administración del portal</h2>
                  <p>Active la edición para modificar textos, imágenes, secciones y tarjetas directamente sobre la página.</p>
                </div>

                <div class="admin-editing-status" id="inlineEditingStatus">
                  <span class="admin-live-dot"></span>
                  <div>
                    <strong id="inlineEditingStatusTitle">Vista visitante</strong>
                    <small id="inlineEditingStatusText">Los controles de edición están ocultos.</small>
                  </div>
                </div>

                <div class="admin-primary-actions">
                  <button type="button"
                    class="admin-action-primary"
                    id="inlineEditModeToggle">
                    Activar edición en la página
                  </button>

                  <button type="button"
                    class="admin-action-secondary"
                    id="inlineVisitorViewSecondary">
                    Cambiar a vista visitante
                  </button>
                </div>

                <div class="admin-console-card">
                  <div class="admin-console-card__heading">
                    <strong>Crear contenido</strong>
                    <small>Agregue nuevos elementos sin salir del panel.</small>
                  </div>

                  <div class="admin-create-grid">
                    <button type="button"
                      class="inline-content-create"
                      data-create-entity="year">＋ Nueva vigencia</button>
                    <button type="button"
                      class="inline-content-create"
                      data-create-entity="resource">＋ Nuevo recurso</button>
                    <button type="button"
                      class="inline-content-create"
                      data-create-entity="idea">＋ Nueva idea ciudadana</button>
                    <button type="button"
                      class="inline-content-create"
                      id="inlineNewBlock">＋ Nuevo bloque</button>
                  </div>
                </div>

                <div class="admin-console-tip">
                  <strong>Consejo:</strong>
                  cierre el panel después de activar la edición para trabajar sobre la página con mayor espacio.
                </div>
              </section>

              <section class="admin-console-panel"
                data-console-panel="appearance">
                <div class="admin-console-panel__heading">
                  <span>DISEÑO GENERAL</span>
                  <h2>Apariencia</h2>
                  <p>Controle la identidad visual y la escala del portal.</p>
                </div>

                <div class="admin-form-grid">
                  <label>Color principal
                    <input id="inlinePrimary" type="color" value="${s.primary}">
                  </label>

                  <label>Color de acento
                    <input id="inlineAccent" type="color" value="${s.accent}">
                  </label>

                  <label class="admin-field-wide">
                    Tamaño de letra
                    <output id="inlineFontOutput">${s.fontScale}%</output>
                    <input id="inlineFontScale"
                      type="range"
                      min="90"
                      max="130"
                      value="${s.fontScale}">
                  </label>

                  <label>Ancho del contenido
                    <select id="inlineContentWidth">
                      <option value="1120" ${Number(s.contentWidth)===1120?"selected":""}>Compacto</option>
                      <option value="1200" ${Number(s.contentWidth||1200)===1200?"selected":""}>Estándar</option>
                      <option value="1320" ${Number(s.contentWidth)===1320?"selected":""}>Amplio</option>
                    </select>
                  </label>

                  <label>Animaciones
                    <select id="inlineAnimation">
                      <option value="smooth" ${s.animationMode==="smooth"?"selected":""}>Fluidas</option>
                      <option value="subtle" ${s.animationMode==="subtle"?"selected":""}>Sutiles</option>
                      <option value="none" ${s.animationMode==="none"?"selected":""}>Sin animación</option>
                    </select>
                  </label>
                </div>
              </section>

              <section class="admin-console-panel"
                data-console-panel="header">
                <div class="admin-console-panel__heading">
                  <span>IDENTIDAD INSTITUCIONAL</span>
                  <h2>Encabezado y logos</h2>
                  <p>Ajuste la cabecera sin afectar la navegación pública.</p>
                </div>

                <div class="admin-form-grid">
                  <label class="admin-field-wide">
                    Altura de la cabecera
                    <output id="inlineHeaderOutput">${s.headerHeight}px</output>
                    <input id="inlineHeaderHeight"
                      type="range"
                      min="64"
                      max="110"
                      value="${s.headerHeight}">
                  </label>

                  <label>
                    Tamaño del escudo
                    <output id="inlineCrestOutput">${s.crestSize}px</output>
                    <input id="inlineCrestSize"
                      type="range"
                      min="34"
                      max="82"
                      value="${s.crestSize}">
                  </label>

                  <label>
                    Tamaño de la marca
                    <output id="inlineBrandOutput">${s.brandSize}px</output>
                    <input id="inlineBrandSize"
                      type="range"
                      min="72"
                      max="230"
                      value="${s.brandSize}">
                  </label>

                  <label class="admin-toggle-field admin-field-wide">
                    <input id="inlineShowBrand"
                      type="checkbox"
                      ${s.showTourismLogo!==false?"checked":""}>
                    <span>Mostrar marca San Pedro</span>
                  </label>

                  <label class="admin-upload-field">
                    <span>Cambiar escudo</span>
                    <input id="inlineCrestUpload"
                      type="file"
                      accept="image/*">
                  </label>

                  <label class="admin-upload-field">
                    <span>Cambiar marca</span>
                    <input id="inlineBrandUpload"
                      type="file"
                      accept="image/*">
                  </label>
                </div>

                <button type="button"
                  class="admin-action-secondary"
                  id="inlineResetLogos">Restablecer logos</button>
              </section>

              <section class="admin-console-panel"
                data-console-panel="banner">
                <div class="admin-console-panel__heading">
                  <span>PORTADA VISUAL</span>
                  <h2>Banner principal</h2>
                  <p>Cargue hasta cinco imágenes. El carrusel cambia automáticamente cada seis segundos.</p>
                </div>

                <div class="banner-dimension-card">
                  <strong>Tamaño recomendado</strong>
                  <span>1600 × 900 píxeles</span>
                  <small>Proporción 16:9. Mantenga el contenido importante hacia el centro y la derecha.</small>
                </div>

                <div class="admin-form-grid">
                  <label class="admin-upload-field">
                    <span>Imagen principal</span>
                    <input id="inlineBannerUpload"
                      type="file"
                      accept="image/*">
                  </label>

                  <label class="admin-upload-field">
                    <span>Galería del banner — máximo 5</span>
                    <input id="inlineBannerGallery"
                      type="file"
                      accept="image/*"
                      multiple>
                  </label>

                  <label class="admin-field-wide">
                    Altura
                    <output id="inlineBannerOutput">${p.banner.height || "Automática"}</output>
                    <input id="inlineBannerHeight"
                      type="range"
                      min="420"
                      max="860"
                      value="${parseInt(p.banner.height)||610}">
                  </label>

                  <label>Posición
                    <select id="inlineBannerPosition">
                      ${["center center","center top","center bottom","left center","right center"].map(value => `<option value="${value}" ${p.banner.position===value?"selected":""}>${value.replace("center","Centro").replace("top","Arriba").replace("bottom","Abajo").replace("left","Izquierda").replace("right","Derecha")}</option>`).join("")}
                    </select>
                  </label>

                  <label>
                    Intensidad del degradado
                    <output id="inlineOverlayOutput">${p.banner.overlay}%</output>
                    <input id="inlineBannerOverlay"
                      type="range"
                      min="0"
                      max="75"
                      value="${p.banner.overlay}">
                  </label>

                  <label>Alineación del texto
                    <select id="inlineBannerAlign">
                      <option value="left" ${p.banner.textAlign==="left"?"selected":""}>Izquierda</option>
                      <option value="center" ${p.banner.textAlign==="center"?"selected":""}>Centro</option>
                    </select>
                  </label>
                </div>

                <div class="inline-banner-meta">
                  <div>
                    <strong>Rotación automática</strong>
                    <span>cada 6 segundos</span>
                  </div>
                  <div>
                    <strong>Imágenes cargadas</strong>
                    <span id="inlineBannerCount">${(p.banner.slides || []).filter(Boolean).length || (p.banner.image ? 1 : 0)}</span>
                  </div>
                </div>

                <div class="inline-banner-preview-strip"
                  id="inlineBannerPreviewStrip"></div>

                <button type="button"
                  class="admin-action-danger"
                  id="inlineRemoveBanner">Limpiar banner</button>
              </section>

              <section class="admin-console-panel"
                data-console-panel="publishing">
                <div class="admin-console-panel__heading">
                  <span>CONTROL EDITORIAL</span>
                  <h2>Publicación</h2>
                  <p>Gestione los contenidos visibles, organice la vista y abra un formulario completo para publicar nuevos materiales.</p>
                </div>

                <div class="admin-form-grid publication-state-grid">
                  <label>Estado del portal
                    <select id="inlinePublicationStatus">
                      <option value="published" ${p.publication.status==="published"?"selected":""}>Publicado</option>
                      <option value="draft" ${p.publication.status==="draft"?"selected":""}>Borrador</option>
                      <option value="scheduled" ${p.publication.status==="scheduled"?"selected":""}>Programado</option>
                    </select>
                  </label>

                  <label>Fecha de publicación
                    <input id="inlinePublishAt"
                      type="datetime-local"
                      value="${p.publication.publishAt || ""}">
                  </label>
                </div>

                <div class="publication-manager-shell">
                  <div class="publication-manager-toolbar">
                    <div class="publication-manager-order">
                      <span class="publication-manager-order__label">Ordenar por:</span>
                      <div class="publication-manager-tabs" role="tablist" aria-label="Estados de publicación">
                        <button type="button" class="publication-tab is-active" data-pub-tab="recent">Recientes</button>
                        <button type="button" class="publication-tab" data-pub-tab="inactive">Inactivos</button>
                        <button type="button" class="publication-tab" data-pub-tab="featured">Destacados</button>
                        <button type="button" class="publication-tab" data-pub-tab="hidden">Ocultos</button>
                      </div>
                    </div>

                    <div class="publication-manager-side">
                      <div class="publication-manager-filters">
                        <label>
                          <span>Filtrar por fecha</span>
                          <select id="pubYearFilter"></select>
                        </label>
                        <label>
                          <span>Tipo de contenido</span>
                          <select id="pubTypeFilter">
                            <option value="all">Todos los contenidos</option>
                            <option value="informe">Informes</option>
                            <option value="presentacion">Presentaciones</option>
                            <option value="video">Videos</option>
                            <option value="datos">Datos</option>
                            <option value="compromiso">Compromisos</option>
                            <option value="respuesta">Respuestas</option>
                          </select>
                        </label>
                      </div>

                      <div class="publication-manager-view">
                        <button type="button" class="publication-view-button is-active" id="pubViewGrid" aria-label="Vista en cuadrícula">
                          <span aria-hidden="true">▦</span>
                        </button>
                        <button type="button" class="publication-view-button" id="pubViewList" aria-label="Vista en lista">
                          <span aria-hidden="true">☰</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="publication-manager-actions">
                    <button type="button" class="publication-new-button" id="pubNewContent">Nuevo contenido</button>
                    <div class="publication-manager-summary" id="pubManagerSummary">Preparando gestor editorial…</div>
                  </div>

                  <div class="publication-manager-list is-grid" id="pubManagerList"></div>
                </div>

                <div class="admin-console-tip">
                  El formulario de publicación permite cargar imagen, documento, enlace, vigencia, descripción, estado y visibilidad del contenido.
                </div>
              </section>

              <section class="admin-console-panel"
                id="inlineDriveMenu"
                data-console-panel="drive">
                <div class="admin-console-panel__heading">
                  <span>ARCHIVOS DEL PORTAL</span>
                  <h2>Google Drive</h2>
                  <p>Administre documentos, fotografías, videos y evidencias.</p>
                </div>

                <div class="drive-connection-card">
                  <div class="drive-connection-copy">
                    <span class="drive-status-dot" id="inlineDriveDot"></span>
                    <div>
                      <strong id="inlineDriveConfigurationTitle">Configuración preparada</strong>
                      <small id="inlineDriveStatus">Validando configuración…</small>
                    </div>
                  </div>

                  <button type="button"
                    class="drive-main-connect"
                    id="inlineDriveConnect">Conectar Google Drive</button>
                </div>

                <div class="admin-console-card">
                  <div class="admin-console-card__heading">
                    <strong>Carpeta principal</strong>
                    <small>Seleccione dónde se organizarán los archivos.</small>
                  </div>

                  <div class="admin-form-grid">
                    <label>Nombre de la carpeta
                      <input id="inlineDriveFolderName"
                        value="${helpers.escape(driveConfig.rootFolderName || "Rendición de Cuentas San Pedro")}">
                    </label>

                    <label>ID de carpeta existente
                      <input id="inlineDriveFolderId"
                        value="${helpers.escape(driveConfig.rootFolderId || "")}"
                        placeholder="Puede permanecer vacío">
                    </label>
                  </div>

                  <div class="drive-folder-actions">
                    <button type="button"
                      class="drive-secondary-action"
                      id="inlineDrivePick">Elegir carpeta</button>
                    <button type="button"
                      class="drive-secondary-action"
                      id="inlineDriveCreate">Crear carpeta</button>
                    <button type="button"
                      class="drive-secondary-action"
                      id="inlineDriveOpen">Abrir carpeta</button>
                  </div>
                </div>

                <details class="drive-advanced-settings">
                  <summary>
                    <span>Configuración técnica</span>
                    <b aria-hidden="true">＋</b>
                  </summary>

                  <div class="drive-fields-grid">
                    <label class="drive-field-wide">ID de cliente OAuth
                      <input id="inlineDriveClientId"
                        autocomplete="off"
                        value="${helpers.escape(driveConfig.clientId || "")}">
                    </label>

                    <label class="drive-field-wide">API key de Google Picker
                      <input id="inlineDriveApiKey"
                        autocomplete="off"
                        value="${helpers.escape(driveConfig.apiKey || "")}">
                    </label>

                    <label>Número del proyecto
                      <input id="inlineDriveAppId"
                        inputmode="numeric"
                        value="${helpers.escape(driveConfig.appId || "")}">
                    </label>

                    <label class="admin-toggle-field">
                      <input id="inlineDrivePublic"
                        type="checkbox"
                        ${driveConfig.makeFilesPublic !== false ? "checked" : ""}>
                      <span>Publicar archivos mediante enlace</span>
                    </label>
                  </div>
                </details>

                <div class="drive-upload-progress"
                  id="inlineDriveProgress"
                  hidden>
                  <span id="inlineDriveProgressLabel">Preparando archivo…</span>
                  <i><u id="inlineDriveProgressBar"></u></i>
                </div>

                <button type="button"
                  class="admin-action-danger"
                  id="inlineDriveDisconnect">Desconectar cuenta</button>
              </section>

              <section class="admin-console-panel"
                data-console-panel="firestore">
                <div class="admin-console-panel__heading">
                  <span>BASE DE DATOS</span>
                  <h2>Firestore</h2>
                  <p>Sincronice contenido, indicadores, vigencias y enlaces con la base de datos.</p>
                </div>

                <div class="admin-service-card">
                  <span class="firebase-sync-dot"></span>
                  <div>
                    <strong>Sincronización manual</strong>
                    <small>Guarde inmediatamente los cambios actuales del portal.</small>
                  </div>
                </div>

                <button type="button"
                  class="admin-action-primary"
                  id="inlineFirebaseSync">Sincronizar ahora</button>
              </section>

              <section class="admin-console-panel"
                data-console-panel="users">
                <div class="admin-console-panel__heading">
                  <span>CONTROL DE ACCESO</span>
                  <h2>Usuarios</h2>
                  <p>Consulte usuarios invitados y administre sus roles.</p>
                </div>

                <div class="admin-service-card">
                  <span aria-hidden="true">◎</span>
                  <div>
                    <strong>Gestión de usuarios</strong>
                    <small>Disponible exclusivamente para el superadministrador.</small>
                  </div>
                </div>

                <button type="button"
                  class="admin-action-primary"
                  id="inlineManageUsers">Abrir gestión de usuarios</button>
              </section>
            </div>
          </div>
        </aside>
      </div>

      <aside class="inline-admin-inspector"
        id="inlineAdminInspector"
        aria-label="Inspector de edición">
        <div class="inline-inspector-head">
          <div>
            <strong id="inlineInspectorTitle">Editor</strong>
            <small id="inlineInspectorSubtitle">Seleccione un elemento</small>
          </div>
          <button type="button"
            id="inlineInspectorClose"
            aria-label="Cerrar inspector">×</button>
        </div>

        <div class="inline-inspector-content"
          id="inlineInspectorContent">
          <div class="inline-empty-state">
            <span>✦</span>
            <strong>Seleccione una sección, tarjeta, texto o imagen.</strong>
            <p>Los cambios se guardan automáticamente.</p>
          </div>
        </div>
      </aside>

      <div class="publication-modal" id="publicationModal" hidden>
        <div class="publication-modal__backdrop" id="publicationModalBackdrop"></div>
        <div class="publication-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="publicationModalTitle">
          <div class="publication-modal__head">
            <div>
              <span class="publication-modal__eyebrow">CENTRO EDITORIAL</span>
              <h3 id="publicationModalTitle">Nuevo contenido</h3>
              <p id="publicationModalSubtitle">Complete la información del recurso que se publicará en el portal.</p>
            </div>
            <button type="button" class="publication-modal__close ui-close-control" id="publicationModalClose" aria-label="Cerrar formulario"><span aria-hidden="true">×</span></button>
          </div>

          <form class="publication-modal__form" id="publicationForm">
            <input type="hidden" name="id" value="">

            <div class="publication-modal__grid">
              <label class="publication-field publication-field--wide">Título principal
                <input name="title" required placeholder="Ejemplo: Informe de Gestión y Rendición de Cuentas 2025">
              </label>

              <label class="publication-field">Vigencia
                <select name="year" id="publicationYearSelect"></select>
              </label>

              <label class="publication-field">Tipo de contenido
                <select name="type">
                  <option value="informe">Informe</option>
                  <option value="presentacion">Presentación</option>
                  <option value="video">Video</option>
                  <option value="datos">Datos</option>
                  <option value="compromiso">Compromiso</option>
                  <option value="respuesta">Respuesta</option>
                </select>
              </label>

              <label class="publication-field publication-field--wide">Descripción breve
                <textarea name="description" rows="4" required placeholder="Explique en pocas líneas el contenido, el contexto y el valor del material."></textarea>
              </label>

              <label class="publication-field">Detalle visible
                <input name="meta" placeholder="Ejemplo: 42 diapositivas · 9,2 MB">
              </label>

              <label class="publication-field">Enlace externo o institucional
                <input name="url" placeholder="https://...">
              </label>

              <label class="publication-field">Fuente o dependencia responsable
                <input name="source" placeholder="Secretaría de Planeación">
              </label>

              <label class="publication-field">Fecha de referencia
                <input name="publishedAt" type="date">
              </label>

              <label class="publication-field publication-field--wide">Texto alternativo de la imagen
                <input name="alt" placeholder="Describa la imagen para accesibilidad">
              </label>

              <label class="publication-field publication-field--wide publication-upload">Documento o video principal
                <input name="document" type="file" accept=".pdf,.xlsx,.xls,.csv,.ppt,.pptx,.doc,.docx,video/*">
                <small id="publicationDocumentHint">Puede subir PDF, Excel, PowerPoint, Word o video.</small>
              </label>

              <label class="publication-field publication-field--wide publication-upload">Imagen de portada
                <input name="image" type="file" accept="image/*">
                <small id="publicationImageHint">Cargue una portada visual para destacar el contenido.</small>
              </label>
            </div>

            <div class="publication-modal__toggles">
              <label class="publication-switch"><input type="checkbox" name="featured"><span>Marcar como destacado</span></label>
              <label class="publication-switch"><input type="checkbox" name="active" checked><span>Contenido activo</span></label>
              <label class="publication-switch"><input type="checkbox" name="hidden"><span>Ocultar de la vista pública</span></label>
            </div>

            <div class="publication-modal__actions">
              <button type="button" class="publication-secondary-button" id="publicationModalCancel">Cancelar</button>
              <button type="submit" class="publication-primary-button" id="publicationModalSave">Guardar contenido</button>
            </div>
          </form>
        </div>
      </div>

      <div class="news-editor-modal" id="newsEditorModal" hidden>
        <button type="button" class="news-editor-modal__backdrop" id="newsEditorBackdrop" aria-label="Cerrar editor de noticia"></button>

        <section class="news-editor-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="newsEditorTitle">
          <header class="news-editor-modal__head">
            <div>
              <span>EDITOR DE NOTICIAS</span>
              <h2 id="newsEditorTitle">Nueva noticia</h2>
              <p id="newsEditorSubtitle">Publique una novedad con estructura institucional, accesible y preparada para buscadores.</p>
            </div>
            <button type="button" class="news-editor-modal__close ui-close-control" id="newsEditorClose" aria-label="Cerrar editor"><span aria-hidden="true">×</span></button>
          </header>

          <form class="news-editor-form" id="newsEditorForm">
            <input type="hidden" name="id">

            <div class="news-editor-grid">
              <label class="news-editor-field news-editor-field--wide">Título
                <input name="title" maxlength="180" required placeholder="Título claro y descriptivo">
              </label>

              <label class="news-editor-field">Categoría
                <input name="category" maxlength="80" required placeholder="Transparencia, Participación, Resultados…">
              </label>

              <label class="news-editor-field">Fecha de publicación
                <input name="publishedAt" type="date" required>
              </label>

              <label class="news-editor-field">Dependencia o fuente
                <input name="source" maxlength="120" placeholder="Secretaría o dependencia responsable">
              </label>

              <label class="news-editor-field">Autor institucional
                <input name="author" maxlength="120" placeholder="Alcaldía Municipal de San Pedro">
              </label>

              <label class="news-editor-field news-editor-field--wide">Resumen
                <textarea name="excerpt" rows="3" maxlength="420" required placeholder="Resumen breve para la tarjeta de la noticia"></textarea>
              </label>

              <label class="news-editor-field news-editor-field--wide">Contenido completo
                <textarea name="body" rows="10" required placeholder="Escriba la noticia. Separe los párrafos con una línea en blanco."></textarea>
              </label>

              <label class="news-editor-field news-editor-field--wide">Etiquetas
                <input name="tags" placeholder="Transparencia, gestión, participación">
              </label>

              <label class="news-editor-field news-editor-field--wide">Texto alternativo de la imagen
                <input name="imageAlt" maxlength="240" placeholder="Describa la fotografía para personas que no pueden verla">
              </label>

              <label class="news-editor-field news-editor-upload">Imagen de portada
                <input name="image" type="file" accept="image/*">
                <small id="newsImageHint">JPG o PNG. Tamaño sugerido: 1600 × 900 px.</small>
              </label>

              <label class="news-editor-field news-editor-upload">Documento relacionado
                <input name="document" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx">
                <small id="newsDocumentHint">Puede adjuntar un informe, presentación o base de datos.</small>
              </label>

              <label class="news-editor-field news-editor-field--wide">Enlace relacionado
                <input name="url" placeholder="https://...">
              </label>
            </div>

            <div class="news-editor-switches">
              <label><input name="featured" type="checkbox"><span>Noticia destacada</span></label>
              <label><input name="active" type="checkbox" checked><span>Publicación activa</span></label>
              <label><input name="hidden" type="checkbox"><span>Ocultar de la vista pública</span></label>
            </div>

            <footer class="news-editor-actions">
              <button type="button" class="publication-secondary-button" id="newsEditorCancel">Cancelar</button>
              <button type="submit" class="publication-primary-button" id="newsEditorSave">Guardar noticia</button>
            </footer>
          </form>
        </section>
      </div>
    `;
  }

  function injectToolbar() {
    if (document.querySelector("#inlineAdminToolbar")) return;
    const holder = document.createElement("div");
    holder.id = "inlineAdminRoot";
    holder.innerHTML = toolbarTemplate();

    document.body.appendChild(holder);

    bindToolbar();
    bindNewsEditor();
    renderPublicationManager();
    updateDrivePanel();
    updateConsoleIdentity();
    updateEditingInterface();
  }

  function selectConsoleTab(tabName = "editing") {
    document.querySelectorAll("[data-console-tab]").forEach(button => {
      const selected = button.dataset.consoleTab === tabName;
      button.classList.toggle("active",selected);
      button.setAttribute("aria-selected",String(selected));
    });

    document.querySelectorAll("[data-console-panel]").forEach(panel => {
      const selected = panel.dataset.consolePanel === tabName;
      panel.classList.toggle("active",selected);
      panel.hidden = !selected;
      if (selected) {
        panel.classList.remove("ui-panel-enter");
        requestAnimationFrame(() => panel.classList.add("ui-panel-enter"));
      }
    });

    if (tabName === "drive") updateDrivePanel();
    if (tabName === "users") updateUserManagementButton();
    if (tabName === "publishing") renderPublicationManager();

    const content = document.querySelector(".admin-console__content");
    if (content) {
      content.scrollTo({
        top:0,
        behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth"
      });
    }
  }

  function updateConsoleIdentity() {
    const status = window.FirebasePortal?.getStatus?.() || {};
    const profile = status.profile || {};
    const displayName =
      profile.displayName
      || status.user?.displayName
      || status.user?.email
      || (sessionStorage.getItem("sp_admin_mode") === "local"
        ? "Administrador local"
        : "Administrador");

    const role =
      status.roleLabel
      || window.FirebasePortal?.roleLabel?.(status.role)
      || (sessionStorage.getItem("sp_admin_mode") === "local"
        ? "Acceso local"
        : "Gestión del portal");

    const nameNode = document.querySelector("#inlineConsoleUser");
    const roleNode = document.querySelector("#inlineConsoleRole");
    const avatarNode = document.querySelector("#inlineConsoleAvatar");

    if (nameNode) nameNode.textContent = displayName;
    if (roleNode) roleNode.textContent = role;
    if (avatarNode) avatarNode.textContent =
      String(displayName).trim().charAt(0).toUpperCase() || "A";
  }

  function updateEditingInterface() {
    const title = document.querySelector("#inlineEditingStatusTitle");
    const text = document.querySelector("#inlineEditingStatusText");
    const toggle = document.querySelector("#inlineEditModeToggle");
    const status = document.querySelector("#inlineEditingStatus");

    if (title) title.textContent = active ? "Edición activa" : "Vista visitante";
    if (text) {
      text.textContent = active
        ? "Puede editar directamente los elementos visibles de la página."
        : "Los controles de edición están ocultos.";
    }
    if (toggle) {
      toggle.textContent = active
        ? "Desactivar edición"
        : "Activar edición en la página";
    }
    status?.classList.toggle("is-active",active);
  }

  function openConsole(tabName = "editing") {
    enableQuickControls();
    injectToolbar();
    const shell = document.querySelector("#inlineAdminToolbar");
    if (!shell) return;

    shell.classList.add("open");
    shell.setAttribute("aria-hidden","false");
    document.body.classList.add("admin-console-open", "admin-explicit-open");
    selectConsoleTab(tabName);
    updateConsoleIdentity();
    updateEditingInterface();

    window.setTimeout(() => {
      document.querySelector(".admin-console__close")?.focus();
    },60);
  }

  function closeConsole() {
    const shell = document.querySelector("#inlineAdminToolbar");
    shell?.classList.remove("open");
    shell?.setAttribute("aria-hidden","true");
    document.body.classList.remove("admin-console-open", "admin-explicit-open");
  }

  function bindToolbar() {
    const get = selector => document.querySelector(selector);

    get("#inlinePrimary")?.addEventListener("input", event => {
      state.settings.primary = event.target.value;
      Portal.applySettings();
      persist();
    });
    get("#inlineAccent")?.addEventListener("input", event => {
      state.settings.accent = event.target.value;
      Portal.applySettings();
      persist();
    });
    get("#inlineFontScale")?.addEventListener("input", event => {
      state.settings.fontScale = Number(event.target.value);
      get("#inlineFontOutput").value = `${event.target.value}%`;
      Portal.applySettings();
      persist();
    });
    get("#inlineContentWidth")?.addEventListener("change", event => {
      state.settings.contentWidth = Number(event.target.value);
      Portal.applySettings();
      persist();
    });
    get("#inlineAnimation")?.addEventListener("change", event => {
      state.settings.animationMode = event.target.value;
      Portal.applySettings();
      persist();
    });

    get("#inlineHeaderHeight")?.addEventListener("input", event => {
      state.settings.headerHeight = Number(event.target.value);
      get("#inlineHeaderOutput").value = `${event.target.value}px`;
      Portal.applySettings();
      persist();
    });
    get("#inlineCrestSize")?.addEventListener("input", event => {
      state.settings.crestSize = Number(event.target.value);
      get("#inlineCrestOutput").value = `${event.target.value}px`;
      Portal.applySettings();
      persist();
    });
    get("#inlineBrandSize")?.addEventListener("input", event => {
      state.settings.brandSize = Number(event.target.value);
      get("#inlineBrandOutput").value = `${event.target.value}px`;
      Portal.applySettings();
      persist();
    });
    get("#inlineShowBrand")?.addEventListener("change", event => {
      state.settings.showTourismLogo = event.target.checked;
      document.querySelector(".header-tourism-logo")?.classList.toggle("is-hidden", !event.target.checked);
      document.querySelector(".header-brand__divider")?.classList.toggle("is-hidden", !event.target.checked);
      document.querySelector(".header-brand")?.classList.toggle("no-tourism-logo", !event.target.checked);
      persist();
    });

    get("#inlineCrestUpload")?.addEventListener("change", async event => {
      try {
        state.settings.headerCrest = await persistImage(await compressedImage(event.target.files[0], {maxWidth:600,maxHeight:600,quality:.88}),"branding/crest");
        const image = document.querySelector(".header-crest");
        if (image) image.src = state.settings.headerCrest;
        persist();
      } catch (error) { helpers.toast(error.message); }
      event.target.value = "";
    });

    get("#inlineBrandUpload")?.addEventListener("change", async event => {
      try {
        state.settings.headerBrand = await persistImage(await compressedImage(event.target.files[0], {maxWidth:1200,maxHeight:600,quality:.9}),"branding/brand");
        const image = document.querySelector(".header-tourism-logo");
        if (image) image.src = state.settings.headerBrand;
        persist();
      } catch (error) { helpers.toast(error.message); }
      event.target.value = "";
    });

    get("#inlineResetLogos")?.addEventListener("click", () => {
      state.settings.headerCrest = "";
      state.settings.headerBrand = "";
      state.settings.showTourismLogo = true;
      document.querySelector(".header-crest").src = "assets/escudo-san-pedro.png";
      const brand = document.querySelector(".header-tourism-logo");
      brand.src = "assets/imagen-san-pedro-color.png";
      brand.classList.remove("is-hidden");
      document.querySelector(".header-brand__divider")?.classList.remove("is-hidden");
      document.querySelector(".header-brand")?.classList.remove("no-tourism-logo");
      get("#inlineShowBrand").checked = true;
      persist();
    });

    get("#inlineBannerUpload")?.addEventListener("change", async event => {
      try {
        const savedImage = await persistImage(await compressedImage(event.target.files[0], {maxWidth:2200,maxHeight:1200,quality:.84}),`banners/${pageKey()}`);
        const banner = normalizeBannerConfig(pageData().banner);
        banner.image = savedImage;
        if (!banner.slides.length) banner.slides = [savedImage];
        else banner.slides[0] = savedImage;
        updateBannerPreview();
        applyBanner();
        persist();
      } catch (error) { helpers.toast(error.message); }
      event.target.value = "";
    });

    get("#inlineBannerGallery")?.addEventListener("change", async event => {
      try {
        const files = Array.from(event.target.files || []).slice(0,5);
        if (!files.length) return;
        const slides = [];
        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const saved = await persistImage(
            await compressedImage(file, {maxWidth:2200,maxHeight:1400,quality:.84}),
            `banners/${pageKey()}/slide-${index + 1}`
          );
          slides.push(saved);
        }
        const banner = normalizeBannerConfig(pageData().banner);
        banner.slides = slides;
        banner.image = slides[0] || banner.image || "";
        updateBannerPreview();
        applyBanner();
        persist();
        helpers.toast(`Galería del banner actualizada (${slides.length} imágenes).`);
      } catch (error) { helpers.toast(error.message); }
      event.target.value = "";
    });

    get("#inlineBannerHeight")?.addEventListener("input", event => {
      pageData().banner.height = `${event.target.value}px`;
      get("#inlineBannerOutput").value = `${event.target.value}px`;
      applyBanner();
      persist();
    });
    get("#inlineBannerPosition")?.addEventListener("change", event => {
      pageData().banner.position = event.target.value;
      applyBanner();
      persist();
    });
    get("#inlineBannerOverlay")?.addEventListener("input", event => {
      pageData().banner.overlay = Number(event.target.value);
      get("#inlineOverlayOutput").value = `${event.target.value}%`;
      applyBanner();
      persist();
    });
    get("#inlineBannerAlign")?.addEventListener("change", event => {
      pageData().banner.textAlign = event.target.value;
      applyBanner();
      persist();
    });
    get("#inlineRemoveBanner")?.addEventListener("click", () => {
      const banner = normalizeBannerConfig(pageData().banner);
      banner.image = "";
      banner.slides = [];
      banner.height = "";
      updateBannerPreview();
      applyBanner();
      persist();
    });

    get("#inlinePublicationStatus")?.addEventListener("change", event => {
      pageData().publication.status = event.target.value;
      applyPublicationState();
      persist();
    });
    get("#inlinePublishAt")?.addEventListener("change", event => {
      pageData().publication.publishAt = event.target.value;
      applyPublicationState();
      persist();
    });

    document.querySelectorAll("[data-create-entity]").forEach(button => {
      button.addEventListener("click", () => openNewEntityInspector(button.dataset.createEntity));
    });
    bindPublicationManager();
    updateBannerPreview();

    document.querySelectorAll("[data-console-tab]").forEach(button => {
      button.addEventListener("click", () => {
        selectConsoleTab(button.dataset.consoleTab);
      });
    });

    get("#inlineConsoleClose")?.addEventListener("click",closeConsole);
    get("#inlineConsoleBackdrop")?.addEventListener("click",closeConsole);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && document.querySelector("#newsEditorModal")?.classList.contains("open")) {
        closeNewsModal();
        return;
      }
      if (event.key === "Escape" && document.querySelector("#publicationModal")?.classList.contains("open")) {
        closePublicationModal();
        return;
      }
      if (event.key === "Escape"
        && document.querySelector("#inlineAdminToolbar")?.classList.contains("open")) {
        closeConsole();
      }
    });

    get("#inlineEditModeToggle")?.addEventListener("click", () => {
      if (active) {
        deactivate(false);
        openConsole("editing");
        helpers.toast("Edición desactivada. Está revisando la vista visitante.");
      } else {
        activate(false);
        openConsole("editing");
        helpers.toast("Edición directa activada.");
      }
    });

    const visitorMode = () => {
      disableQuickControls();
      deactivate(false);
      closeConsole();
      helpers.toast("Vista de visitante activada.");
    };

    get("#inlineVisitorView")?.addEventListener("click",visitorMode);
    get("#inlineVisitorViewSecondary")?.addEventListener("click",visitorMode);

    function saveDriveConfiguration() {
      if (!window.DrivePortal) return null;
      return window.DrivePortal.configure({
        clientId:get("#inlineDriveClientId")?.value.trim() || "",
        apiKey:get("#inlineDriveApiKey")?.value.trim() || "",
        appId:get("#inlineDriveAppId")?.value.trim() || "",
        rootFolderName:get("#inlineDriveFolderName")?.value.trim() || "Rendición de Cuentas San Pedro",
        rootFolderId:get("#inlineDriveFolderId")?.value.trim() || "",
        makeFilesPublic:Boolean(get("#inlineDrivePublic")?.checked)
      });
    }

    get("#inlineDriveConnect")?.addEventListener("click", async () => {
      try {
        saveDriveConfiguration();
        await window.DrivePortal.connect();
        const info = await window.DrivePortal.testConnection();
        await window.DrivePortal.ensureRootFolder({fallbackCreate:true});
        updateDrivePanel();
        helpers.toast(`Google Drive conectado${info?.user?.displayName ? `: ${info.user.displayName}` : ""}.`);
      } catch (error) {
        helpers.toast(window.DrivePortal?.friendlyError?.(error) || error.message);
      }
    });

    get("#inlineDrivePick")?.addEventListener("click", async () => {
      try {
        saveDriveConfiguration();
        const folder = await window.DrivePortal.chooseFolder();
        if (folder) {
          get("#inlineDriveFolderId").value = folder.id;
          get("#inlineDriveFolderName").value = folder.name;
          updateDrivePanel();
          helpers.toast(`Carpeta seleccionada: ${folder.name}.`);
        }
      } catch (error) {
        helpers.toast(window.DrivePortal?.friendlyError?.(error) || error.message);
      }
    });

    get("#inlineDriveCreate")?.addEventListener("click", async () => {
      try {
        saveDriveConfiguration();
        await window.DrivePortal.connect();
        const folder = await window.DrivePortal.createNewRootFolder();
        get("#inlineDriveFolderId").value = folder.id;
        get("#inlineDriveFolderName").value = folder.name;
        updateDrivePanel();
        helpers.toast(`Carpeta creada: ${folder.name}.`);
      } catch (error) {
        helpers.toast(window.DrivePortal?.friendlyError?.(error) || error.message);
      }
    });

    get("#inlineDriveDisconnect")?.addEventListener("click", async () => {
      try {
        await window.DrivePortal?.disconnect?.();
        updateDrivePanel();
        helpers.toast("Google Drive desconectado.");
      } catch (error) {
        helpers.toast(window.DrivePortal?.friendlyError?.(error) || error.message);
      }
    });

    get("#inlineDriveOpen")?.addEventListener("click", () => {
      try { window.DrivePortal?.openRootFolder?.(); }
      catch (error) { helpers.toast(error.message); }
    });

    ["#inlineDriveClientId","#inlineDriveApiKey","#inlineDriveAppId","#inlineDriveFolderName","#inlineDriveFolderId","#inlineDrivePublic"].forEach(selector => {
      get(selector)?.addEventListener("change", () => {
        saveDriveConfiguration();
        updateDrivePanel();
      });
    });

    get("#inlineManageUsers")?.addEventListener("click",openUsersInspector);

    get("#inlineFirebaseSync")?.addEventListener("click", async () => {
      try {
        await window.FirebasePortal?.pushAll?.({action:"manual_sync"});
      } catch (error) {
        helpers.toast(window.FirebasePortal?.friendlyError?.(error) || error.message);
      }
    });
    get("#inlineNewBlock")?.addEventListener("click", () => openNewBlockInspector());
    get("#inlineLogout")?.addEventListener("click", logout);
    get("#inlineInspectorClose")?.addEventListener("click", closeInspector);
  }



  function normalizeManagedResource(item = {}) {
    return {
      id: item.id || `r${Date.now()}${Math.floor(Math.random()*1000)}`,
      title: item.title || "Contenido sin título",
      year: Number(item.year) || currentYearContext() || new Date().getFullYear(),
      type: item.type || "informe",
      description: item.description || "",
      meta: item.meta || "Recurso digital",
      url: item.url || "#",
      image: item.image || "",
      featured: Boolean(item.featured),
      hidden: Boolean(item.hidden),
      active: item.active !== false,
      source: item.source || "",
      alt: item.alt || "",
      publishedAt: item.publishedAt || (typeof item.createdAt === "string" && item.createdAt.length >= 10 ? item.createdAt.slice(0,10) : new Date().toISOString().slice(0,10)),
      createdAt: item.createdAt || new Date().toISOString()
    };
  }

  function ensureManagedResources() {
    state.resources = (state.resources || []).map(normalizeManagedResource);
    return state.resources;
  }

  function resourceTypeBadge(type = "") {
    const map = {
      informe: "PDF",
      presentacion: "PPT",
      video: "VID",
      datos: "XLS",
      compromiso: "ACT",
      respuesta: "DOC"
    };
    return map[type] || "DOC";
  }

  function formatPublicationDate(dateString = "") {
    if (!dateString) return "Sin fecha";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("es-CO", { day:"numeric", month:"short", year:"numeric" });
  }

  function getManagedResources() {
    ensureManagedResources();
    let items = [...state.resources].map(normalizeManagedResource);

    if (publicationUi.tab === "inactive") items = items.filter(item => item.active === false);
    if (publicationUi.tab === "featured") items = items.filter(item => item.featured);
    if (publicationUi.tab === "hidden") items = items.filter(item => item.hidden);
    if (publicationUi.tab === "recent") items = items.filter(item => item.hidden !== true && item.active !== false);

    if (publicationUi.year !== "all") items = items.filter(item => String(item.year) === String(publicationUi.year));
    if (publicationUi.type !== "all") items = items.filter(item => item.type === publicationUi.type);

    items.sort((a,b) => {
      const left = new Date(a.publishedAt || a.createdAt || 0).getTime();
      const right = new Date(b.publishedAt || b.createdAt || 0).getTime();
      return right - left;
    });

    return items;
  }

  function renderPublicationYearFilter() {
    const select = document.querySelector("#pubYearFilter");
    const yearSelect = document.querySelector("#publicationYearSelect");
    if (!select && !yearSelect) return;
    const years = [...new Set((state.years || []).map(item => Number(item.year)).filter(Boolean))].sort((a,b)=>b-a);
    if (!years.length) years.push(new Date().getFullYear());
    const options = ['<option value="all">Todas las fechas</option>']
      .concat(years.map(year => `<option value="${year}">${year}</option>`))
      .join("");
    if (select) {
      select.innerHTML = options;
      select.value = publicationUi.year || "all";
    }
    if (yearSelect) {
      yearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join("");
    }
  }

  function renderPublicationManager() {
    const holder = document.querySelector("#pubManagerList");
    const summary = document.querySelector("#pubManagerSummary");
    if (!holder || !summary) return;

    renderPublicationYearFilter();
    holder.classList.remove("is-refreshed");
    requestAnimationFrame(() => holder.classList.add("is-refreshed"));
    const items = getManagedResources();

    document.querySelectorAll("[data-pub-tab]").forEach(button => {
      button.classList.toggle("is-active", button.dataset.pubTab === publicationUi.tab);
    });
    document.querySelector("#pubTypeFilter") && (document.querySelector("#pubTypeFilter").value = publicationUi.type);
    document.querySelector("#pubYearFilter") && (document.querySelector("#pubYearFilter").value = publicationUi.year);
    document.querySelector("#pubViewGrid")?.classList.toggle("is-active", publicationUi.view === "grid");
    document.querySelector("#pubViewList")?.classList.toggle("is-active", publicationUi.view === "list");

    holder.className = `publication-manager-list ${publicationUi.view === "grid" ? "is-grid" : "is-list"}`;

    const tabLabel = {
      recent: "recientes",
      inactive: "inactivos",
      featured: "destacados",
      hidden: "ocultos"
    }[publicationUi.tab] || "filtrados";

    summary.innerHTML = `<strong>${items.length}</strong> contenidos ${tabLabel}. Use “Nuevo contenido” para abrir el formulario completo de publicación.`;

    if (!items.length) {
      holder.innerHTML = `
        <div class="publication-empty-state">
          <strong>No hay contenidos para este filtro.</strong>
          <p>Pruebe otra vista o cree una nueva publicación para el portal institucional.</p>
          <button type="button" class="publication-new-button" data-pub-create-inline="1">Crear contenido</button>
        </div>`;
      return;
    }

    holder.innerHTML = items.map(item => {
      const chips = [
        item.featured ? '<span class="publication-chip is-featured">Destacado</span>' : '',
        item.hidden ? '<span class="publication-chip is-hidden">Oculto</span>' : '',
        item.active === false ? '<span class="publication-chip is-inactive">Inactivo</span>' : '<span class="publication-chip is-active">Activo</span>'
      ].join('');
      return `
        <article class="publication-card ${item.featured ? 'is-featured' : ''}">
          <div class="publication-card__badge ${'type-'+item.type}">${resourceTypeBadge(item.type)}</div>
          <div class="publication-card__body">
            <div class="publication-card__meta">${helpers.escape(String(item.year))} · ${helpers.escape(helpers.typeLabel(item.type))} · ${helpers.escape(formatPublicationDate(item.publishedAt))}</div>
            <h3>${helpers.escape(item.title)}</h3>
            <p>${helpers.escape(item.description || item.meta || 'Contenido institucional')}</p>
            <div class="publication-card__chips">${chips}</div>
          </div>
          <div class="publication-card__footer">
            <span class="publication-card__detail">${helpers.escape(item.meta || 'Recurso digital')}</span>
            <div class="publication-card__actions">
              <button type="button" class="publication-mini-action" data-pub-edit="${item.id}">Editar</button>
              <button type="button" class="publication-mini-action" data-pub-featured="${item.id}">${item.featured ? 'Quitar destacado' : 'Destacar'}</button>
              <button type="button" class="publication-mini-action" data-pub-hidden="${item.id}">${item.hidden ? 'Mostrar' : 'Ocultar'}</button>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function openPublicationModal(resourceId = "") {
    ensureManagedResources();
    const modal = document.querySelector("#publicationModal");
    const form = document.querySelector("#publicationForm");
    if (!modal || !form) return;

    const resource = state.resources.find(item => item.id === resourceId);
    const normalized = normalizeManagedResource(resource || {});
    renderPublicationYearFilter();

    document.querySelector("#publicationModalTitle").textContent = resource ? "Editar contenido" : "Nuevo contenido";
    document.querySelector("#publicationModalSubtitle").textContent = resource
      ? "Actualice texto, archivo, imagen, estado y visibilidad del contenido seleccionado."
      : "Complete la información editorial que necesita el contenido antes de publicarlo.";

    form.reset();
    form.elements.id.value = resource ? normalized.id : "";
    form.elements.title.value = normalized.title && resource ? normalized.title : "";
    form.elements.year.value = String(normalized.year || new Date().getFullYear());
    form.elements.type.value = normalized.type || "informe";
    form.elements.description.value = normalized.description || "";
    form.elements.meta.value = normalized.meta && resource ? normalized.meta : "";
    form.elements.url.value = normalized.url && normalized.url !== '#' && resource ? normalized.url : "";
    form.elements.source.value = normalized.source || "";
    form.elements.publishedAt.value = normalized.publishedAt || new Date().toISOString().slice(0,10);
    form.elements.alt.value = normalized.alt || "";
    form.elements.featured.checked = Boolean(normalized.featured);
    form.elements.active.checked = normalized.active !== false;
    form.elements.hidden.checked = Boolean(normalized.hidden);
    form.elements.document.value = "";
    form.elements.image.value = "";
    document.querySelector("#publicationDocumentHint").textContent = normalized.url && resource ? `Archivo o enlace actual configurado.` : "Puede subir PDF, Excel, PowerPoint, Word o video.";
    document.querySelector("#publicationImageHint").textContent = normalized.image && resource ? "La portada actual se conservará si no sube una nueva imagen." : "Cargue una portada visual para destacar el contenido.";

    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("open");
      form.elements.title?.focus();
    });
    document.body.classList.add("publication-modal-open");
  }

  function closePublicationModal() {
    const modal = document.querySelector("#publicationModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.classList.remove("publication-modal-open");
    setTimeout(() => { modal.hidden = true; }, 180);
  }

  function persistPortalChanges(message = "Cambios guardados.") {
    helpers.save?.();
    persist();
    renderPublicationManager();
    helpers.toast(message);
  }

  function bindPublicationManager() {
    document.querySelectorAll("[data-pub-tab]").forEach(button => {
      button.addEventListener("click", () => {
        publicationUi.tab = button.dataset.pubTab || "recent";
        renderPublicationManager();
      });
    });

    document.querySelector("#pubYearFilter")?.addEventListener("change", event => {
      publicationUi.year = event.target.value;
      renderPublicationManager();
    });

    document.querySelector("#pubTypeFilter")?.addEventListener("change", event => {
      publicationUi.type = event.target.value;
      renderPublicationManager();
    });

    document.querySelector("#pubViewGrid")?.addEventListener("click", () => {
      publicationUi.view = "grid";
      renderPublicationManager();
    });
    document.querySelector("#pubViewList")?.addEventListener("click", () => {
      publicationUi.view = "list";
      renderPublicationManager();
    });

    document.querySelector("#pubNewContent")?.addEventListener("click", () => openPublicationModal());
    document.querySelector("#pubManagerList")?.addEventListener("click", event => {
      const create = event.target.closest("[data-pub-create-inline]");
      if (create) {
        openPublicationModal();
        return;
      }
      const edit = event.target.closest("[data-pub-edit]");
      if (edit) {
        openPublicationModal(edit.dataset.pubEdit);
        return;
      }
      const toggleFeatured = event.target.closest("[data-pub-featured]");
      if (toggleFeatured) {
        const item = ensureManagedResources().find(resource => resource.id === toggleFeatured.dataset.pubFeatured);
        if (!item) return;
        item.featured = !item.featured;
        persistPortalChanges(item.featured ? "Contenido marcado como destacado." : "Se retiró del destacado.");
        return;
      }
      const toggleHidden = event.target.closest("[data-pub-hidden]");
      if (toggleHidden) {
        const item = ensureManagedResources().find(resource => resource.id === toggleHidden.dataset.pubHidden);
        if (!item) return;
        item.hidden = !item.hidden;
        persistPortalChanges(item.hidden ? "Contenido ocultado del portal." : "Contenido visible nuevamente.");
      }
    });

    document.querySelector("#publicationModalClose")?.addEventListener("click", closePublicationModal);
    document.querySelector("#publicationModalCancel")?.addEventListener("click", closePublicationModal);
    document.querySelector("#publicationModalBackdrop")?.addEventListener("click", closePublicationModal);

    document.querySelector("#publicationForm")?.addEventListener("change", event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      const file = input.files?.[0];
      const hintId = input.name === "document"
        ? "#publicationDocumentHint"
        : "#publicationImageHint";
      const hint = document.querySelector(hintId);
      if (!hint) return;

      if (!file) return;
      const size = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;
      hint.textContent = `${file.name} · ${size}`;
      hint.closest(".publication-upload")?.classList.add("has-selected-file");
    });

    document.querySelector("#publicationForm")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const saveButton = document.querySelector("#publicationModalSave");
      const existing = ensureManagedResources().find(item => item.id === data.get("id"));
      const baseItem = normalizeManagedResource(existing || {});

      saveButton.disabled = true;
      saveButton.textContent = "Guardando…";
      form.classList.add("is-saving");
      form.setAttribute("aria-busy","true");
      try {
        let image = baseItem.image || "";
        let url = baseItem.url || data.get("url") || "#";

        const imageFile = form.elements.image.files[0];
        if (imageFile) {
          image = await persistImage(
            await compressedImage(imageFile, { maxWidth: 1600, maxHeight: 1100, quality: .85 }),
            `resources/${data.get("year")}`
          );
        }

        const documentFile = form.elements.document.files[0];
        if (documentFile) {
          url = await persistDocument(documentFile, `resources/${data.get("year")}`) || url;
        } else if ((data.get("url") || "").trim()) {
          url = data.get("url").trim();
        }

        const record = {
          ...baseItem,
          title: String(data.get("title") || "").trim(),
          year: Number(data.get("year")) || new Date().getFullYear(),
          type: String(data.get("type") || "informe"),
          description: String(data.get("description") || "").trim(),
          meta: String(data.get("meta") || "").trim() || "Recurso digital",
          url: url || "#",
          source: String(data.get("source") || "").trim(),
          publishedAt: String(data.get("publishedAt") || "").trim() || new Date().toISOString().slice(0,10),
          alt: String(data.get("alt") || "").trim(),
          featured: data.get("featured") === "on",
          active: data.get("active") === "on",
          hidden: data.get("hidden") === "on",
          image,
          createdAt: existing?.createdAt || new Date().toISOString()
        };

        if (existing) {
          Object.assign(existing, record);
        } else {
          state.resources.unshift({
            id: `r${Date.now()}`,
            ...record
          });
        }

        persistPortalChanges(existing ? "Contenido actualizado correctamente." : "Nuevo contenido agregado al portal.");
        closePublicationModal();
      } catch (error) {
        helpers.toast(window.FirebasePortal?.friendlyError?.(error) || error.message);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Guardar contenido";
        form.classList.remove("is-saving");
        form.removeAttribute("aria-busy");
      }
    });

    renderPublicationManager();
  }


  function normalizeNewsItem(item = {}) {
    return {
      id:item.id || `n${Date.now()}`,
      title:item.title || "",
      category:item.category || "Gestión municipal",
      excerpt:item.excerpt || "",
      body:item.body || "",
      publishedAt:item.publishedAt || new Date().toISOString().slice(0,10),
      source:item.source || "",
      author:item.author || "Alcaldía Municipal de San Pedro",
      tags:Array.isArray(item.tags)
        ? item.tags
        : String(item.tags || "").split(",").map(value => value.trim()).filter(Boolean),
      image:item.image || "",
      imageAlt:item.imageAlt || "",
      url:item.url || "#",
      featured:Boolean(item.featured),
      active:item.active !== false,
      hidden:Boolean(item.hidden),
      createdAt:item.createdAt || new Date().toISOString()
    };
  }

  function ensureNewsState() {
    if (!Array.isArray(state.news)) state.news = [];
    state.news = state.news.map(normalizeNewsItem);
    return state.news;
  }

  function openNewsModal(newsId = "") {
    injectToolbar();
    ensureNewsState();

    const modal = document.querySelector("#newsEditorModal");
    const form = document.querySelector("#newsEditorForm");
    if (!modal || !form) return;

    const current = state.news.find(item => item.id === newsId);
    const item = normalizeNewsItem(current || {});

    document.querySelector("#newsEditorTitle").textContent =
      current ? "Editar noticia" : "Nueva noticia";
    document.querySelector("#newsEditorSubtitle").textContent =
      current
        ? "Actualice la publicación y guarde los cambios sin abandonar la página."
        : "Cree una publicación institucional con imagen, contenido, etiquetas y documento relacionado.";

    form.reset();
    form.elements.id.value = current ? item.id : "";
    form.elements.title.value = current ? item.title : "";
    form.elements.category.value = item.category;
    form.elements.publishedAt.value = item.publishedAt;
    form.elements.source.value = item.source;
    form.elements.author.value = item.author;
    form.elements.excerpt.value = item.excerpt;
    form.elements.body.value = item.body;
    form.elements.tags.value = item.tags.join(", ");
    form.elements.imageAlt.value = item.imageAlt;
    form.elements.url.value = item.url !== "#" ? item.url : "";
    form.elements.featured.checked = item.featured;
    form.elements.active.checked = item.active;
    form.elements.hidden.checked = item.hidden;
    form.elements.image.value = "";
    form.elements.document.value = "";

    document.querySelector("#newsImageHint").textContent =
      current && item.image
        ? "La portada actual se conservará si no carga una nueva imagen."
        : "JPG o PNG. Tamaño sugerido: 1600 × 900 px.";
    document.querySelector("#newsDocumentHint").textContent =
      current && item.url !== "#"
        ? "El documento o enlace actual se conservará si no selecciona otro."
        : "Puede adjuntar un informe, presentación o base de datos.";

    modal.hidden = false;
    requestAnimationFrame(() => {
      modal.classList.add("open");
      form.elements.title?.focus();
    });
    document.body.classList.add("news-editor-open");
  }

  function closeNewsModal() {
    const modal = document.querySelector("#newsEditorModal");
    if (!modal) return;
    modal.classList.remove("open");
    document.body.classList.remove("news-editor-open");
    window.setTimeout(() => {
      modal.hidden = true;
    },180);
  }

  function saveNewsAndRefresh(message) {
    helpers.save();
    persist();
    window.dispatchEvent(new CustomEvent("portal:datachange"));
    window.dispatchEvent(new CustomEvent("portal:rendered"));
    refreshQuickAdminControls();
    helpers.toast(message);
  }

  function bindNewsEditor() {
    const modal = document.querySelector("#newsEditorModal");
    const form = document.querySelector("#newsEditorForm");
    if (!modal || !form || modal.dataset.bound === "1") return;
    modal.dataset.bound = "1";

    document.querySelector("#newsEditorClose")?.addEventListener("click",closeNewsModal);
    document.querySelector("#newsEditorCancel")?.addEventListener("click",closeNewsModal);
    document.querySelector("#newsEditorBackdrop")?.addEventListener("click",closeNewsModal);

    form.addEventListener("change",event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      const file = input.files?.[0];
      if (!file) return;

      const size = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1,Math.round(file.size / 1024))} KB`;
      const hint = document.querySelector(
        input.name === "image" ? "#newsImageHint" : "#newsDocumentHint"
      );
      if (hint) hint.textContent = `${file.name} · ${size}`;
    });

    form.addEventListener("submit",async event => {
      event.preventDefault();
      const data = new FormData(form);
      const saveButton = document.querySelector("#newsEditorSave");
      const current = ensureNewsState().find(item => item.id === data.get("id"));
      const baseItem = normalizeNewsItem(current || {});

      saveButton.disabled = true;
      saveButton.textContent = "Guardando…";
      form.classList.add("is-saving");

      try {
        let image = baseItem.image;
        let url = baseItem.url || "#";

        const imageFile = form.elements.image.files[0];
        if (imageFile) {
          image = await persistImage(
            await compressedImage(imageFile,{
              maxWidth:1800,
              maxHeight:1200,
              quality:.86
            }),
            "news/images"
          );
        }

        const documentFile = form.elements.document.files[0];
        if (documentFile) {
          url = await persistDocument(documentFile,"news/documents") || url;
        } else if (String(data.get("url") || "").trim()) {
          url = String(data.get("url")).trim();
        }

        const record = {
          ...baseItem,
          title:String(data.get("title") || "").trim(),
          category:String(data.get("category") || "").trim(),
          excerpt:String(data.get("excerpt") || "").trim(),
          body:String(data.get("body") || "").trim(),
          publishedAt:String(data.get("publishedAt") || "").trim(),
          source:String(data.get("source") || "").trim(),
          author:String(data.get("author") || "").trim(),
          tags:String(data.get("tags") || "")
            .split(",")
            .map(value => value.trim())
            .filter(Boolean),
          imageAlt:String(data.get("imageAlt") || "").trim(),
          image,
          url:url || "#",
          featured:data.get("featured") === "on",
          active:data.get("active") === "on",
          hidden:data.get("hidden") === "on",
          createdAt:current?.createdAt || new Date().toISOString()
        };

        if (current) Object.assign(current,record);
        else state.news.unshift({
          id:`n${Date.now()}`,
          ...record
        });

        closeNewsModal();
        saveNewsAndRefresh(
          current
            ? "Noticia actualizada correctamente."
            : "Nueva noticia publicada."
        );
      } catch (error) {
        helpers.toast(
          window.FirebasePortal?.friendlyError?.(error)
          || error.message
        );
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Guardar noticia";
        form.classList.remove("is-saving");
      }
    });
  }

  function adminCanEdit() {
    return Boolean(
      state.admin
      || window.FirebasePortal?.getStatus?.()?.canWrite
      || sessionStorage.getItem("sp_admin_mode") === "local"
    );
  }

  function quickSectionKind(section) {
    const page = document.body.dataset.page || "";
    const identity = [
      section.id,
      section.className,
      section.querySelector(".section-kicker")?.textContent,
      section.querySelector("h1,h2")?.textContent
    ].join(" ").toLowerCase();

    if (page === "news" || identity.includes("noticia")) return "news";
    if (page === "resources" || /recurso|biblioteca|documento|destacado/.test(identity)) return "resource";
    if (page === "ideas" || /idea|particip/.test(identity)) return "idea";
    if (/hero|banner|portada/.test(identity)) return "banner";
    return "resource";
  }

  function quickCreateLabel(kind) {
    return {
      news:"Nueva noticia",
      resource:"Nuevo recurso",
      idea:"Nueva idea",
      banner:"Editar banner"
    }[kind] || "Nuevo contenido";
  }

  function disableSectionQuickText(section) {
    if (!section) return;
    section.classList.remove("admin-quick-text-active");

    section.querySelectorAll(".admin-inline-text").forEach(element => {
      if (active) return;
      element.contentEditable = "false";
      element.classList.remove("admin-inline-text");
      element.removeAttribute("aria-label");
    });

    section.querySelectorAll(".admin-inline-image").forEach(image => {
      if (!active) image.classList.remove("admin-inline-image");
    });

    const button = section.querySelector("[data-quick-text]");
    if (button) button.textContent = "Editar textos";
  }

  function toggleSectionQuickText(section) {
    if (!section) return;
    const enabling = !section.classList.contains("admin-quick-text-active");

    document.querySelectorAll(".admin-quick-text-active").forEach(current => {
      if (current !== section) disableSectionQuickText(current);
    });

    if (!enabling) {
      disableSectionQuickText(section);
      helpers.toast("Edición de textos finalizada.");
      return;
    }

    section.classList.add("admin-quick-text-active");

    section.querySelectorAll(
      "h1,h2,h3,h4,p,li,blockquote,summary,.button,a:not(nav a)"
    ).forEach(element => {
      if (element.closest(
        "form,dialog,[data-admin-entity],.admin-section-edit-button,.admin-quick-card-edit,.no-inline-edit"
      )) return;
      element.classList.add("admin-inline-text");
      element.contentEditable = "true";
      element.spellcheck = true;
      element.dataset.adminContentKey = contentKey(element);
      element.setAttribute(
        "aria-label",
        `Texto editable: ${element.textContent.trim().slice(0,80)}`
      );
    });

    section.querySelectorAll("img").forEach(image => {
      image.classList.add("admin-inline-image");
      image.dataset.adminImageKey = imageKey(image);
    });

    const button = section.querySelector("[data-quick-text]");
    if (button) button.textContent = "Finalizar textos";
    helpers.toast("Edite directamente los textos de esta sección.");
  }

  function studioSectionSettings(section) {
    const key = sectionKey(section);
    const saved = pageData().sections[key] || {};
    return {
      key,
      visible:saved.visible !== false,
      backgroundColor:saved.backgroundColor || "",
      paddingTop:Number(saved.paddingTop || 0),
      paddingBottom:Number(saved.paddingBottom || 0),
      minHeight:Number(saved.minHeight || 0)
    };
  }

  function openVisualStudio(section) {
    if (!section) return;

    const current = studioSectionSettings(section);
    const kind = quickSectionKind(section);
    const title =
      section.querySelector("h1,h2,h3")?.textContent?.trim()
      || "Sección del portal";
    const textsActive =
      section.classList.contains("admin-quick-text-active");

    openInspector(
      "Estudio visual",
      title,
      `
      <div class="visual-studio">
        <div class="visual-studio__status">
          <span></span>
          <div>
            <strong>Edición conectada</strong>
            <small>Los cambios se guardan localmente y se envían a Firebase mediante la sincronización configurada.</small>
          </div>
        </div>

        <section class="visual-studio__group">
          <div class="visual-studio__heading">
            <span>01</span>
            <div>
              <strong>Contenido</strong>
              <small>Modifique únicamente textos estáticos. Las tarjetas usan su editor de datos.</small>
            </div>
          </div>

          <div class="visual-studio__actions">
            <button type="button"
              class="visual-studio__primary"
              id="studioToggleText">
              ${textsActive ? "Finalizar edición de textos" : "Editar textos en la página"}
            </button>

            <button type="button"
              id="studioCreateContent">
              ${helpers.escape(quickCreateLabel(kind))}
            </button>
          </div>
        </section>

        <section class="visual-studio__group">
          <div class="visual-studio__heading">
            <span>02</span>
            <div>
              <strong>Apariencia de la sección</strong>
              <small>Los controles se aplican en tiempo real.</small>
            </div>
          </div>

          <div class="visual-studio__fields">
            <label class="visual-studio__switch">
              <input id="studioVisible"
                type="checkbox"
                ${current.visible ? "checked" : ""}>
              <span>Mostrar sección</span>
            </label>

            <label>
              Fondo
              <div class="visual-studio__color-row">
                <input id="studioBackground"
                  type="color"
                  value="${current.backgroundColor || "#ffffff"}">
                <label class="visual-studio__switch">
                  <input id="studioTransparent"
                    type="checkbox"
                    ${current.backgroundColor ? "" : "checked"}>
                  <span>Automático</span>
                </label>
              </div>
            </label>

            <label>
              Espacio superior
              <output id="studioTopOutput">${current.paddingTop}px</output>
              <input id="studioTop"
                type="range"
                min="0"
                max="160"
                value="${current.paddingTop}">
            </label>

            <label>
              Espacio inferior
              <output id="studioBottomOutput">${current.paddingBottom}px</output>
              <input id="studioBottom"
                type="range"
                min="0"
                max="160"
                value="${current.paddingBottom}">
            </label>
          </div>
        </section>

        <section class="visual-studio__group">
          <div class="visual-studio__heading">
            <span>03</span>
            <div>
              <strong>Organización</strong>
              <small>Cambie la posición o restablezca el diseño de esta sección.</small>
            </div>
          </div>

          <div class="visual-studio__actions visual-studio__actions--three">
            <button type="button" id="studioMoveUp">Subir</button>
            <button type="button" id="studioMoveDown">Bajar</button>
            <button type="button"
              class="visual-studio__danger"
              id="studioReset">Restablecer</button>
          </div>
        </section>
      </div>`
    );

    const updateStyle = () => {
      const data = pageData().sections[current.key] || {};

      data.visible =
        document.querySelector("#studioVisible")?.checked !== false;
      data.backgroundColor =
        document.querySelector("#studioTransparent")?.checked
          ? ""
          : document.querySelector("#studioBackground")?.value || "";
      data.paddingTop = Number(
        document.querySelector("#studioTop")?.value || 0
      );
      data.paddingBottom = Number(
        document.querySelector("#studioBottom")?.value || 0
      );

      pageData().sections[current.key] = data;
      applySectionStyles();
      persist();

      const top = document.querySelector("#studioTop");
      const bottom = document.querySelector("#studioBottom");
      if (top) {
        document.querySelector("#studioTopOutput").value =
          `${top.value}px`;
      }
      if (bottom) {
        document.querySelector("#studioBottomOutput").value =
          `${bottom.value}px`;
      }
    };

    [
      "#studioVisible",
      "#studioBackground",
      "#studioTransparent",
      "#studioTop",
      "#studioBottom"
    ].forEach(selector => {
      document.querySelector(selector)?.addEventListener(
        "input",
        updateStyle
      );
      document.querySelector(selector)?.addEventListener(
        "change",
        updateStyle
      );
    });

    document.querySelector("#studioToggleText")?.addEventListener(
      "click",
      () => {
        toggleSectionQuickText(section);
        closeInspector();
      }
    );

    document.querySelector("#studioCreateContent")?.addEventListener(
      "click",
      () => {
        closeInspector();

        if (kind === "news") {
          openNewsModal();
          return;
        }
        if (kind === "idea") {
          openNewEntityInspector("idea");
          return;
        }
        if (kind === "banner") {
          openConsole("banner");
          return;
        }

        injectToolbar();
        openPublicationModal();
      }
    );

    document.querySelector("#studioMoveUp")?.addEventListener(
      "click",
      () => {
        moveSection(section,"up");
        closeInspector();
      }
    );

    document.querySelector("#studioMoveDown")?.addEventListener(
      "click",
      () => {
        moveSection(section,"down");
        closeInspector();
      }
    );

    document.querySelector("#studioReset")?.addEventListener(
      "click",
      () => {
        delete pageData().sections[current.key];
        section.hidden = false;
        section.style.backgroundColor = "";
        section.style.backgroundImage = "";
        section.style.paddingTop = "";
        section.style.paddingBottom = "";
        section.style.minHeight = "";
        persist();
        closeInspector();
        helpers.toast("Diseño de la sección restablecido.");
      }
    );
  }

  function clearQuickAdminControls() {
    document.querySelectorAll(
      ".admin-section-edit-button,.admin-quick-card-edit,.admin-quick-dock"
    ).forEach(element => element.remove());

    document.querySelectorAll(".admin-quick-section").forEach(section => {
      disableSectionQuickText(section);
      section.classList.remove("admin-quick-section");
    });

    document.body.classList.remove("admin-quick-mode");
  }

  function decorateQuickAdminControls() {
    if (!adminCanEdit() || !quickControlsEnabled || active) {
      clearQuickAdminControls();
      return;
    }

    document.body.classList.add("admin-quick-mode");

    document.querySelectorAll(
      "main > section,main > article"
    ).forEach(section => {
      if (section.querySelector(
        ":scope > .admin-section-edit-button"
      )) return;

      section.classList.add("admin-quick-section");

      const title =
        section.querySelector("h1,h2")?.textContent?.trim()
        || "Sección";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-section-edit-button";
      button.dataset.visualStudio = "true";
      button.setAttribute(
        "aria-label",
        `Editar sección: ${title.slice(0,80)}`
      );
      button.innerHTML = `
        <span aria-hidden="true">✎</span>
        <b>Editar sección</b>`;
      section.appendChild(button);
    });

    document.querySelectorAll("[data-admin-entity]").forEach(card => {
      if (card.querySelector(
        ":scope > .admin-quick-card-edit"
      )) return;

      const type = card.dataset.adminEntity;
      const id = card.dataset.entityId || "";
      if (!type || !id) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-quick-card-edit";
      button.dataset.quickEntity = type;
      button.dataset.entityId = id;
      button.dataset.entityYear =
        card.dataset.entityYear || "";
      button.setAttribute(
        "aria-label",
        "Editar los datos de este elemento"
      );
      button.innerHTML = `
        <span aria-hidden="true">✎</span>
        <b>Editar</b>`;
      card.appendChild(button);
    });

    if (!document.querySelector(".admin-quick-dock")) {
      const dock = document.createElement("div");
      dock.className = "admin-quick-dock";
      dock.innerHTML = `
        <div class="admin-quick-dock__identity">
          <span></span>
          <div>
            <strong>Edición administrativa</strong>
            <small id="quickSaveState">Cambios sincronizados</small>
          </div>
        </div>

        <div class="admin-quick-dock__actions">
          <button type="button"
            data-quick-global="resource">
            ＋ Publicar
          </button>
          <button type="button"
            data-quick-global="news">
            ＋ Noticia
          </button>
          <button type="button"
            data-quick-global="visitor">
            Vista visitante
          </button>
          <button type="button"
            class="is-primary"
            data-quick-global="console">
            Administrador
          </button>
        </div>`;
      document.body.appendChild(dock);
    }
  }

  function refreshQuickAdminControls() {
    window.setTimeout(decorateQuickAdminControls,60);
  }

  function enableQuickControls() {
    quickControlsEnabled = true;
    sessionStorage.setItem("sp_admin_quick_view","edit");
    refreshQuickAdminControls();
  }

  function disableQuickControls() {
    quickControlsEnabled = false;
    sessionStorage.setItem("sp_admin_quick_view","visitor");
    clearQuickAdminControls();
  }

  function bindQuickAdminActions() {
    document.addEventListener("click",event => {
      const studioButton =
        event.target.closest("[data-visual-studio]");
      const entityButton =
        event.target.closest("[data-quick-entity]");
      const globalButton =
        event.target.closest("[data-quick-global]");

      if (!studioButton && !entityButton && !globalButton) return;

      event.preventDefault();
      event.stopPropagation();

      if (studioButton) {
        openVisualStudio(
          studioButton.closest("section,article")
        );
        return;
      }

      if (entityButton) {
        openEntityInspector(
          entityButton.dataset.quickEntity,
          entityButton.dataset.entityId,
          entityButton.dataset.entityYear
        );
        return;
      }

      const kind = globalButton.dataset.quickGlobal;

      if (kind === "news") {
        openNewsModal();
        return;
      }

      if (kind === "resource") {
        injectToolbar();
        openPublicationModal();
        return;
      }

      if (kind === "visitor") {
        disableQuickControls();
        deactivate(false);
        helpers.toast(
          "Vista visitante activada. La sesión continúa abierta."
        );
        return;
      }

      if (kind === "console") {
        openConsole("editing");
      }
    },true);

    document.addEventListener("click",event => {
      const image = event.target.closest(
        ".admin-quick-text-active .admin-inline-image"
      );
      if (!image || active) return;

      event.preventDefault();
      event.stopPropagation();
      openImageInspector(image);
    },true);
  }

  function updateBannerPreview() {
    const holder = document.querySelector("#inlineBannerPreviewStrip");
    const count = document.querySelector("#inlineBannerCount");
    if (!holder || !count) return;
    const banner = normalizeBannerConfig(pageData().banner);
    const slides = banner.slides.length ? banner.slides : (banner.image ? [banner.image] : []);
    count.textContent = String(slides.length);
    holder.innerHTML = slides.length
      ? slides.map((src, index) => `<span class="inline-banner-thumb${index===0?" is-active":""}" style="background-image:url('${helpers.escape(src)}')" aria-label="Imagen ${index + 1} del banner"></span>`).join("")
      : `<span class="inline-banner-thumb is-empty">Sin imágenes</span>`;
  }

  function ensureBannerMediaLayer(banner) {
    let layer = banner.querySelector(".hero-custom-media");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "hero-custom-media";
      layer.setAttribute("aria-hidden","true");
      banner.prepend(layer);
    }
    return layer;
  }

  function stopBannerRotation() {
    if (bannerTimer) {
      clearInterval(bannerTimer);
      bannerTimer = null;
    }
    bannerIndex = 0;
  }

  function paintBannerLayer(layer, source, position) {
    if (!layer) return;
    layer.classList.add("is-fading");
    window.setTimeout(() => {
      layer.style.backgroundImage = source ? `url("${source}")` : "";
      layer.style.backgroundPosition = position || "center center";
      layer.style.backgroundSize = "cover";
      layer.classList.remove("is-fading");
    }, 140);
  }

  function updateDrivePanel() {
    const status = window.DrivePortal?.getStatus?.();
    const config = window.DrivePortal?.getConfig?.() || {};

    const clientInput = document.querySelector("#inlineDriveClientId");
    const keyInput = document.querySelector("#inlineDriveApiKey");
    const appInput = document.querySelector("#inlineDriveAppId");
    const folderNameInput = document.querySelector("#inlineDriveFolderName");
    const folderIdInput = document.querySelector("#inlineDriveFolderId");
    const publicInput = document.querySelector("#inlineDrivePublic");

    if (clientInput && !clientInput.value) clientInput.value = config.clientId || "";
    if (keyInput && !keyInput.value) keyInput.value = config.apiKey || "";
    if (appInput && !appInput.value) appInput.value = config.appId || "";
    if (folderNameInput) folderNameInput.value = config.rootFolderName || "Rendición de Cuentas San Pedro";
    if (folderIdInput) folderIdInput.value = config.rootFolderId || status?.rootFolderId || "";
    if (publicInput) publicInput.checked = config.makeFilesPublic !== false;

    const label = document.querySelector("#inlineDriveStatus");
    const dot = document.querySelector("#inlineDriveDot");
    const quickDot = document.querySelector("#inlineDriveQuickDot");
    const quickLabel = document.querySelector("#inlineDriveQuickLabel");
    const open = document.querySelector("#inlineDriveOpen");

    if (!label || !dot) return;

    [dot,quickDot].filter(Boolean).forEach(item => {
      item.classList.remove("is-connected","is-configured");
    });

    const connectButton = document.querySelector("#inlineDriveConnect");
    const title = document.querySelector("#inlineDriveConfigurationTitle");
    const hasFolder = Boolean(status?.rootFolderId || config.rootFolderId);

    if (status?.connected) {
      [dot,quickDot].filter(Boolean).forEach(item => item.classList.add("is-connected"));
      label.textContent = status.rootFolderName
        ? `Cuenta autorizada · carpeta: ${status.rootFolderName}`
        : "Cuenta autorizada correctamente.";
      if (quickLabel) quickLabel.textContent = "Drive conectado";
      if (title) title.textContent = "Google Drive conectado";
      if (connectButton) connectButton.textContent = "Reconectar cuenta";
    } else if (status?.configured) {
      [dot,quickDot].filter(Boolean).forEach(item => item.classList.add("is-configured"));
      label.textContent = "Los datos técnicos están listos. Autorice ahora la cuenta de Google.";
      if (quickLabel) quickLabel.textContent = "Conectar Drive";
      if (title) title.textContent = "Configuración preparada";
      if (connectButton) connectButton.textContent = "Conectar Google Drive";
    } else {
      label.textContent = "No se pudo leer la configuración de Google Drive.";
      if (quickLabel) quickLabel.textContent = "Configurar Drive";
      if (title) title.textContent = "Configuración incompleta";
      if (connectButton) connectButton.textContent = "Revisar configuración";
    }

    if (open) open.disabled = !hasFolder;
    if (open) open.title = hasFolder
      ? "Abrir la carpeta configurada"
      : "Primero cree o elija una carpeta";
  }

  function updateDriveProgress(detail = {}) {
    const holder = document.querySelector("#inlineDriveProgress");
    const label = document.querySelector("#inlineDriveProgressLabel");
    const bar = document.querySelector("#inlineDriveProgressBar");
    if (!holder || !label || !bar) return;

    if (detail.status === "preparing") {
      holder.hidden = false;
      label.textContent = `Preparando ${detail.name || "archivo"}…`;
      bar.style.width = "4%";
      return;
    }
    if (detail.status === "uploading") {
      holder.hidden = false;
      label.textContent = `Subiendo ${detail.name || "archivo"} · ${detail.progress || 0}%`;
      bar.style.width = `${detail.progress || 0}%`;
      return;
    }
    if (detail.status === "complete") {
      holder.hidden = false;
      label.textContent = "Archivo guardado en Google Drive.";
      bar.style.width = "100%";
      setTimeout(() => { holder.hidden = true; }, 2200);
    }
  }

  function bannerElement() {
    return document.querySelector(".home-hero,.page-hero");
  }


  function applyBanner() {
    const banner = bannerElement();
    if (!banner) return;
    const config = normalizeBannerConfig(pageData().banner);

    banner.style.minHeight = config.height || "";
    banner.style.setProperty("--admin-banner-position", config.position || "center center");
    banner.style.setProperty("--admin-banner-overlay", String((config.overlay || 0) / 100));

    const copy = banner.querySelector(".home-hero__copy,.page-hero__grid>div:first-child");
    if (copy) {
      copy.style.textAlign = config.textAlign || "left";
      copy.classList.toggle("is-centered", config.textAlign === "center");
    }

    const slides = config.slides.length ? config.slides : (config.image ? [config.image] : []);
    const media = ensureBannerMediaLayer(banner);

    stopBannerRotation();

    if (slides.length) {
      banner.classList.add("has-admin-banner","has-hero-gallery");
      paintBannerLayer(media, slides[0], config.position || "center center");
      if (slides.length > 1) {
        bannerTimer = window.setInterval(() => {
          bannerIndex = (bannerIndex + 1) % slides.length;
          paintBannerLayer(media, slides[bannerIndex], config.position || "center center");
          document.querySelectorAll(".inline-banner-thumb").forEach((item, index) => {
            item.classList.toggle("is-active", index === bannerIndex);
          });
        }, Number(config.rotationMs) || 6000);
      } else {
        document.querySelectorAll(".inline-banner-thumb").forEach((item, index) => {
          item.classList.toggle("is-active", index === 0);
        });
      }
    } else {
      banner.classList.remove("has-admin-banner","has-hero-gallery");
      media.style.backgroundImage = "";
      media.style.backgroundPosition = "";
      media.style.backgroundSize = "";
    }
  }

  function applyPublicationState() {
    const config = pageData().publication;
    document.body.dataset.publicationStatus = config.status || "published";

    document.querySelector(".publication-gate")?.remove();
    const main = document.querySelector("main");
    if (!main) return;

    const scheduledFuture = config.status === "scheduled"
      && config.publishAt
      && new Date(config.publishAt).getTime() > Date.now();
    const unavailable = !state.admin && (config.status === "draft" || scheduledFuture);

    main.hidden = unavailable;
    if (unavailable) {
      const notice = document.createElement("section");
      notice.className = "publication-gate";
      notice.innerHTML = `
        <span>PUBLICACIÓN ${config.status === "draft" ? "EN BORRADOR" : "PROGRAMADA"}</span>
        <h1>Esta página todavía no se encuentra disponible.</h1>
        <p>${scheduledFuture ? `Publicación prevista para ${new Date(config.publishAt).toLocaleString("es-CO")}.` : "El contenido está siendo preparado por la administración."}</p>
        <a class="button button-primary" href="index.html">Volver al inicio</a>`;
      document.querySelector("#siteHeader")?.after(notice);
    }
  }

  function applySavedContent() {
    document.querySelectorAll("main h1,main h2,main h3,main h4,main p,main li,main summary,main blockquote,main .button,main a:not(nav a)").forEach(element => {
      if (element.closest("form,dialog,.no-inline-edit")) return;
      const key = contentKey(element);
      if (Object.prototype.hasOwnProperty.call(state.content, key)) {
        element.innerHTML = state.content[key];
      }

      const style = pageData().elements[key];
      if (style) Object.assign(element.style, style);
    });

    document.querySelectorAll("main img,header img").forEach(image => {
      const key = imageKey(image);
      const media = pageData().elements[key];
      if (!media) return;
      if (media.src) image.src = media.src;
      if (media.alt !== undefined) image.alt = media.alt;
      if (media.width) image.style.width = media.width;
      if (media.objectFit) image.style.objectFit = media.objectFit;
    });
  }

  function applySectionOrder() {
    const order = pageData().sectionOrder || [];
    if (!order.length) return;

    const main = document.querySelector("main");
    if (!main) return;

    const sections = [...main.children].filter(element => element.tagName === "SECTION");
    const byKey = new Map(sections.map(section => [sectionKey(section), section]));
    order.forEach(key => {
      const section = byKey.get(key);
      if (section) main.appendChild(section);
    });
  }

  function applySectionStyles() {
    document.querySelectorAll("main > section,main > article").forEach(section => {
      const key = sectionKey(section);
      const style = pageData().sections[key];
      if (!style) return;

      section.hidden = style.visible === false;
      section.style.backgroundColor = style.backgroundColor || "";
      section.style.backgroundImage = style.backgroundImage ? `url("${style.backgroundImage}")` : "";
      section.style.backgroundSize = style.backgroundImage ? "cover" : "";
      section.style.backgroundPosition = style.backgroundPosition || "center center";
      section.style.paddingTop = style.paddingTop ? `${style.paddingTop}px` : "";
      section.style.paddingBottom = style.paddingBottom ? `${style.paddingBottom}px` : "";
      section.style.minHeight = style.minHeight ? `${style.minHeight}px` : "";
    });
  }

  function renderCustomBlocks() {
    const main = document.querySelector("main");
    if (!main) return;

    main.querySelectorAll("[data-custom-block]").forEach(element => element.remove());
    pageData().customBlocks.forEach(block => {
      const section = document.createElement("section");
      section.className = `home-section custom-inline-block custom-inline-block--${block.theme || "blue"}`;
      section.dataset.customBlock = block.id;
      section.innerHTML = `
        <div class="site-shell custom-inline-block__inner">
          <div>
            <span class="section-kicker">${helpers.escape(block.kicker || "NUEVO MÓDULO")}</span>
            <h2>${helpers.escape(block.title)}</h2>
            <p>${helpers.escape(block.text)}</p>
          </div>
          ${block.button ? `<a class="button button-primary" href="${helpers.safeUrl(block.url || "#")}">${helpers.escape(block.button)}</a>` : ""}
        </div>`;
      const footer = main.querySelector(".newsletter-bar");
      if (footer) main.insertBefore(section, footer);
      else main.appendChild(section);
    });
  }

  function decorate() {
    if (!active) return;

    applySavedContent();
    applySectionStyles();

    document.querySelectorAll("main section").forEach(section => {
      if (section.querySelector(":scope > .admin-section-tools")) return;
      section.classList.add("admin-editable-section");

      const tools = document.createElement("div");
      tools.className = "admin-section-tools";
      tools.innerHTML = `
        <button type="button" data-inline-section="${sectionKey(section)}">Editar sección</button>
        <button type="button" data-inline-move="up" aria-label="Subir sección">↑</button>
        <button type="button" data-inline-move="down" aria-label="Bajar sección">↓</button>`;
      section.prepend(tools);
    });

    document.querySelectorAll("[data-admin-entity]").forEach(card => {
      card.classList.add("admin-editable-card");
      if (card.querySelector(":scope > .admin-card-edit")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-card-edit";
      button.dataset.inlineEntity = card.dataset.adminEntity;
      button.dataset.entityId = card.dataset.entityId;
      button.dataset.entityYear = card.dataset.entityYear || "";
      button.textContent = "Editar";
      card.appendChild(button);
    });

    document.querySelectorAll("main h1,main h2,main h3,main h4,main p,main li,main summary,main blockquote,main .button,main a:not(nav a)").forEach(element => {
      if (element.closest("form,dialog,.admin-section-tools,.admin-card-edit,.no-inline-edit")) return;
      element.classList.add("admin-inline-text");
      element.contentEditable = "true";
      element.spellcheck = true;
      element.dataset.adminContentKey = contentKey(element);
      element.setAttribute("aria-label", `Texto editable: ${element.textContent.trim().slice(0,80)}`);
    });

    document.querySelectorAll("main img,header img").forEach(image => {
      image.classList.add("admin-inline-image");
      image.dataset.adminImageKey = imageKey(image);
    });
  }

  function undecorate() {
    document.querySelectorAll(".admin-section-tools,.admin-card-edit").forEach(element => element.remove());
    document.querySelectorAll(".admin-editable-section,.admin-editable-card,.admin-inline-image").forEach(element => {
      element.classList.remove("admin-editable-section","admin-editable-card","admin-inline-image");
    });
    document.querySelectorAll(".admin-inline-text").forEach(element => {
      element.contentEditable = "false";
      element.classList.remove("admin-inline-text");
      element.removeAttribute("aria-label");
    });
  }

  function activate(openPanel = true) {
    enableQuickControls();
    clearQuickAdminControls();
    active = true;
    state.admin = true;
    sessionStorage.setItem(Portal.KEYS.admin,"1");
    document.body.classList.add("admin-inline-active");

    injectToolbar();
    applyBanner();
    applyPublicationState();
    decorate();
    updateEditingInterface();

    if (openPanel) openConsole("editing");

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(() => {
        if (!active) return;
        clearTimeout(mutationObserver._timer);
        mutationObserver._timer = setTimeout(decorate,90);
      });
      const main = document.querySelector("main");
      if (main) mutationObserver.observe(main,{childList:true,subtree:true});
    }
  }

  function deactivate(showMessage = true) {
    active = false;
    document.body.classList.remove(
      "drive-panel-open",
      "admin-inline-active",
      "admin-inspector-open"
    );

    closeInspector();
    undecorate();
    updateEditingInterface();
    if (quickControlsEnabled) refreshQuickAdminControls();

    if (showMessage) {
      helpers.toast("Vista de visitante activada.");
    }
  }

  async function logout() {
    state.admin = false;
    sessionStorage.removeItem(Portal.KEYS.admin);
    sessionStorage.removeItem("sp_admin_mode");
    deactivate(false);
    closeConsole();

    if (window.FirebasePortal?.getStatus?.()?.user) {
      await window.FirebasePortal.signOut?.().catch(() => {});
    }

    window.dispatchEvent(new CustomEvent("portal:adminlogout"));
    helpers.toast("Sesión administrativa cerrada.");
  }

  function openInspector(title, subtitle, content) {
    inspectorTarget = null;
    document.querySelector("#inlineInspectorTitle").textContent = title;
    document.querySelector("#inlineInspectorSubtitle").textContent = subtitle || "";
    document.querySelector("#inlineInspectorContent").innerHTML = content;
    document.querySelector("#inlineAdminInspector").classList.add("open");
    document.body.classList.add("admin-inspector-open");
  }

  function closeInspector() {
    document.querySelector("#inlineAdminInspector")?.classList.remove("open");
    document.body.classList.remove("admin-inspector-open");
    inspectorTarget = null;
  }

  function openSectionInspector(section) {
    inspectorTarget = section;
    const key = sectionKey(section);
    const current = pageData().sections[key] || {
      visible:true, backgroundColor:"", backgroundImage:"",
      backgroundPosition:"center center", paddingTop:"", paddingBottom:"", minHeight:""
    };

    const title = section.querySelector("h1,h2,h3")?.textContent.trim() || "Sección";
    openInspector("Editar sección", title, `
      <div class="inline-inspector-form">
        <label class="inline-check"><input id="sectionVisible" type="checkbox" ${current.visible!==false?"checked":""}> Mostrar sección</label>
        <label>Color de fondo<input id="sectionBackground" type="color" value="${current.backgroundColor || "#ffffff"}"></label>
        <label class="inline-check"><input id="sectionTransparent" type="checkbox" ${!current.backgroundColor?"checked":""}> Fondo transparente</label>
        <label class="inline-file">Imagen de fondo<input id="sectionImage" type="file" accept="image/*"></label>
        <label>Posición
          <select id="sectionPosition">
            ${["center center","center top","center bottom","left center","right center"].map(value => `<option value="${value}" ${current.backgroundPosition===value?"selected":""}>${value}</option>`).join("")}
          </select>
        </label>
        <label>Espacio superior <output id="sectionTopOutput">${current.paddingTop || 0}px</output><input id="sectionTop" type="range" min="0" max="180" value="${current.paddingTop || 0}"></label>
        <label>Espacio inferior <output id="sectionBottomOutput">${current.paddingBottom || 0}px</output><input id="sectionBottom" type="range" min="0" max="180" value="${current.paddingBottom || 0}"></label>
        <label>Altura mínima <output id="sectionHeightOutput">${current.minHeight || 0}px</output><input id="sectionHeight" type="range" min="0" max="900" value="${current.minHeight || 0}"></label>
        <button type="button" class="inline-danger-button" id="sectionReset">Restablecer sección</button>
      </div>`);

    const update = () => {
      const data = pageData().sections[key] || {};
      data.visible = document.querySelector("#sectionVisible").checked;
      data.backgroundColor = document.querySelector("#sectionTransparent").checked ? "" : document.querySelector("#sectionBackground").value;
      data.backgroundPosition = document.querySelector("#sectionPosition").value;
      data.paddingTop = Number(document.querySelector("#sectionTop").value);
      data.paddingBottom = Number(document.querySelector("#sectionBottom").value);
      data.minHeight = Number(document.querySelector("#sectionHeight").value);
      pageData().sections[key] = data;
      applySectionStyles();
      persist();
    };

    ["#sectionVisible","#sectionBackground","#sectionTransparent","#sectionPosition","#sectionTop","#sectionBottom","#sectionHeight"].forEach(selector => {
      document.querySelector(selector)?.addEventListener("input", () => {
        document.querySelector("#sectionTopOutput").value = `${document.querySelector("#sectionTop").value}px`;
        document.querySelector("#sectionBottomOutput").value = `${document.querySelector("#sectionBottom").value}px`;
        document.querySelector("#sectionHeightOutput").value = `${document.querySelector("#sectionHeight").value}px`;
        update();
      });
    });

    document.querySelector("#sectionImage")?.addEventListener("change", async event => {
      try {
        const data = pageData().sections[key] || {};
        data.backgroundImage = await persistImage(await compressedImage(event.target.files[0], {maxWidth:2200,maxHeight:1300,quality:.83}),`sections/${pageKey()}`);
        pageData().sections[key] = data;
        applySectionStyles();
        persist();
      } catch (error) { helpers.toast(error.message); }
    });

    document.querySelector("#sectionReset")?.addEventListener("click", () => {
      delete pageData().sections[key];
      section.hidden = false;
      section.removeAttribute("style");
      persist();
      closeInspector();
    });
  }

  function openTextInspector(element) {
    inspectorTarget = element;
    const key = contentKey(element);
    const saved = pageData().elements[key] || {};
    const computed = getComputedStyle(element);

    openInspector("Editar texto", element.textContent.trim().slice(0,75), `
      <div class="inline-inspector-form">
        <p class="inline-hint">Puede escribir directamente sobre el texto en la página.</p>
        <label>Tamaño <output id="textSizeOutput">${Math.round(parseFloat(computed.fontSize))}px</output><input id="textSize" type="range" min="10" max="82" value="${Math.round(parseFloat(saved.fontSize || computed.fontSize))}"></label>
        <label>Color<input id="textColor" type="color" value="${rgbToHex(saved.color || computed.color)}"></label>
        <label>Peso
          <select id="textWeight">
            ${[400,500,600,700,800].map(value => `<option value="${value}" ${String(saved.fontWeight || computed.fontWeight)===String(value)?"selected":""}>${value}</option>`).join("")}
          </select>
        </label>
        <label>Alineación
          <select id="textAlign">
            ${["left","center","right"].map(value => `<option value="${value}" ${(saved.textAlign || computed.textAlign)===value?"selected":""}>${value}</option>`).join("")}
          </select>
        </label>
        <button type="button" class="inline-danger-button" id="textReset">Restablecer texto y estilo</button>
      </div>`);

    const apply = () => {
      const style = {
        fontSize:`${document.querySelector("#textSize").value}px`,
        color:document.querySelector("#textColor").value,
        fontWeight:document.querySelector("#textWeight").value,
        textAlign:document.querySelector("#textAlign").value
      };
      pageData().elements[key] = style;
      Object.assign(element.style, style);
      document.querySelector("#textSizeOutput").value = style.fontSize;
      persist();
    };

    ["#textSize","#textColor","#textWeight","#textAlign"].forEach(selector => {
      document.querySelector(selector)?.addEventListener("input", apply);
    });

    document.querySelector("#textReset")?.addEventListener("click", () => {
      delete state.content[key];
      delete pageData().elements[key];
      element.removeAttribute("style");
      location.reload();
    });
  }

  function openImageInspector(image) {
    inspectorTarget = image;
    const key = imageKey(image);
    const saved = pageData().elements[key] || {};

    openInspector("Editar imagen", image.alt || "Imagen", `
      <div class="inline-inspector-form">
        <img class="inline-image-preview" id="inlineImagePreview" src="${helpers.escape(image.src)}" alt="">
        <label class="inline-file">Subir otra imagen<input id="inlineImageUpload" type="file" accept="image/*"></label>
        <label>Texto alternativo<input id="inlineImageAlt" value="${helpers.escape(image.alt || "")}"></label>
        <label>Ancho <output id="inlineImageWidthOutput">${parseInt(image.getBoundingClientRect().width)}px</output><input id="inlineImageWidth" type="range" min="30" max="700" value="${parseInt(saved.width) || Math.round(image.getBoundingClientRect().width)}"></label>
        <label>Ajuste
          <select id="inlineImageFit">
            <option value="contain" ${(saved.objectFit || getComputedStyle(image).objectFit)==="contain"?"selected":""}>Contener</option>
            <option value="cover" ${(saved.objectFit || getComputedStyle(image).objectFit)==="cover"?"selected":""}>Cubrir</option>
          </select>
        </label>
        <button type="button" class="inline-danger-button" id="inlineImageReset">Restablecer imagen</button>
      </div>`);

    document.querySelector("#inlineImageUpload")?.addEventListener("change", async event => {
      try {
        const src = await persistImage(await compressedImage(event.target.files[0], {maxWidth:1800,maxHeight:1200,quality:.87}),`content/${pageKey()}`);
        const data = pageData().elements[key] || {};
        data.src = src;
        pageData().elements[key] = data;
        image.src = src;
        document.querySelector("#inlineImagePreview").src = src;
        persist();
      } catch (error) { helpers.toast(error.message); }
    });

    document.querySelector("#inlineImageAlt")?.addEventListener("input", event => {
      const data = pageData().elements[key] || {};
      data.alt = event.target.value;
      pageData().elements[key] = data;
      image.alt = event.target.value;
      persist();
    });

    document.querySelector("#inlineImageWidth")?.addEventListener("input", event => {
      const data = pageData().elements[key] || {};
      data.width = `${event.target.value}px`;
      pageData().elements[key] = data;
      image.style.width = data.width;
      document.querySelector("#inlineImageWidthOutput").value = data.width;
      persist();
    });

    document.querySelector("#inlineImageFit")?.addEventListener("change", event => {
      const data = pageData().elements[key] || {};
      data.objectFit = event.target.value;
      pageData().elements[key] = data;
      image.style.objectFit = data.objectFit;
      persist();
    });

    document.querySelector("#inlineImageReset")?.addEventListener("click", () => {
      delete pageData().elements[key];
      location.reload();
    });
  }

  function entityData(type, id, year) {
    const dashboard = state.dashboards?.[String(year)] || state.dashboards?.[year];
    if (type === "year") return state.years.find(item => String(item.year) === String(id));
    if (type === "resource") return state.resources.find(item => item.id === id);
    if (type === "idea") return state.ideas.find(item => item.id === id);
    if (type === "news") return ensureNewsState().find(item => item.id === id);
    if (type === "dashboardKpi") return dashboard?.kpis?.find(item => item.id === id);
    if (type === "investmentItem") return dashboard?.investment?.find(item => item.id === id);
    if (type === "reachItem") return dashboard?.populationReach?.find(item => item.id === id);
    if (type === "executionItem") return dashboard?.execution?.find(item => item.id === id);
    if (type === "commitment") return state.commitments.find(item => item.id === id);
    if (type === "citizenRequest") return state.citizenRequests.find(item => item.id === id);
    return null;
  }

  function openEntityInspector(type, id, year) {
    if (type === "news") {
      openNewsModal(id);
      return;
    }

    const entity = entityData(type, id, year);
    if (!entity) return;

    if (type === "year") {
      openInspector("Editar vigencia", `Rendición de Cuentas ${entity.year}`, `
        <form class="inline-inspector-form" id="entityEditForm">
          <label>Estado<select name="status">
            ${["Publicada","En construcción","Programada"].map(value => `<option ${entity.status===value?"selected":""}>${value}</option>`).join("")}
          </select></label>
          <label>Avance<input name="progress" type="number" min="0" max="100" value="${entity.progress}"></label>
          <label>Titular<input name="headline" value="${helpers.escape(entity.headline || "")}"></label>
          <label>Resumen<textarea name="summary" rows="5">${helpers.escape(entity.summary || "")}</textarea></label>
          <div class="inline-two-columns">
            <label>Documentos<input name="documents" type="number" min="0" value="${entity.documents || 0}"></label>
            <label>Videos<input name="videos" type="number" min="0" value="${entity.videos || 0}"></label>
            <label>Compromisos<input name="commitments" type="number" min="0" value="${entity.commitments || 0}"></label>
            <label>Respuestas<input name="questions" type="number" min="0" value="${entity.questions || 0}"></label>
          </div>
          <h4 class="inline-form-heading">Indicadores</h4>
          <div class="inline-two-columns">
            <label>Cumplimiento del plan<input name="metricPlan" type="number" min="0" max="100" value="${entity.metrics?.plan || 0}"></label>
            <label>Proyectos<input name="metricProjects" type="number" min="0" value="${entity.metrics?.projects || 0}"></label>
            <label>Compromisos atendidos<input name="metricCommitments" type="number" min="0" max="100" value="${entity.metrics?.commitments || 0}"></label>
            <label>Espacios participativos<input name="metricParticipation" type="number" min="0" value="${entity.metrics?.participation || 0}"></label>
          </div>
          <h4 class="inline-form-heading">Líneas estratégicas</h4>
          ${(entity.sectors || []).slice(0,4).map((sector,index) => {
            const sectorName = Array.isArray(sector) ? sector[0] : (sector?.name ?? sector?.label ?? "");
            const sectorValue = Array.isArray(sector) ? sector[1] : (sector?.value ?? sector?.progress ?? 0);
            return `
            <div class="inline-sector-row">
              <input name="sectorName${index}" value="${helpers.escape(sectorName)}" aria-label="Nombre de la línea ${index+1}">
              <input name="sectorValue${index}" type="number" min="0" max="100" value="${Number(sectorValue) || 0}" aria-label="Avance de la línea ${index+1}">
            </div>`;
          }).join("")}
          <label class="inline-file">Imagen de portada<input name="cover" type="file" accept="image/*"></label>
          ${entity.cover ? '<button type="button" class="inline-mini-button" id="removeEntityImage">Quitar portada</button>' : ""}
          <button class="button button-primary">Guardar vigencia</button>
        </form>`);
    }

    if (type === "resource") {
      openInspector("Editar recurso", entity.title, `
        <form class="inline-inspector-form" id="entityEditForm">
          <label>Título<input name="title" value="${helpers.escape(entity.title)}"></label>
          <label>Vigencia<select name="year">${state.years.map(year => `<option value="${year.year}" ${Number(entity.year)===Number(year.year)?"selected":""}>${year.year}</option>`).join("")}</select></label>
          <label>Tipo<select name="type">${["informe","presentacion","video","datos","compromiso","respuesta"].map(value => `<option value="${value}" ${entity.type===value?"selected":""}>${helpers.typeLabel(value)}</option>`).join("")}</select></label>
          <label>Descripción<textarea name="description" rows="4">${helpers.escape(entity.description)}</textarea></label>
          <label>Detalle<input name="meta" value="${helpers.escape(entity.meta || "")}"></label>
          <label>Enlace<input name="url" value="${helpers.escape(entity.url || "#")}"></label>
          <label class="inline-file">Subir documento<input name="document" type="file" accept=".pdf,.xlsx,.xls,.csv,.ppt,.pptx,.doc,.docx,video/*"></label>
          <label class="inline-check"><input name="featured" type="checkbox" ${entity.featured?"checked":""}> Recurso destacado</label>
          <label class="inline-file">Imagen del recurso<input name="image" type="file" accept="image/*"></label>
          ${entity.image ? '<button type="button" class="inline-mini-button" id="removeEntityImage">Quitar imagen</button>' : ""}
          <button class="button button-primary">Guardar recurso</button>
          <button type="button" class="inline-danger-button" id="deleteEntity">Eliminar recurso</button>
        </form>`);
    }

    if (type === "idea") {
      openInspector("Editar idea ciudadana", entity.title, `
        <form class="inline-inspector-form" id="entityEditForm">
          <label>Título<input name="title" value="${helpers.escape(entity.title)}"></label>
          <label>Autor o colectivo<input name="author" value="${helpers.escape(entity.author)}"></label>
          <label>Ubicación<input name="location" value="${helpers.escape(entity.location)}"></label>
          <label>Categoría<input name="category" value="${helpers.escape(entity.category)}"></label>
          <label>Descripción<textarea name="description" rows="5">${helpers.escape(entity.description)}</textarea></label>
          <label>Estado<select name="status">${["recibida","analisis","aceptada","resuelta"].map(value => `<option value="${value}" ${entity.status===value?"selected":""}>${helpers.statusLabel(value)}</option>`).join("")}</select></label>
          <label>Respuesta institucional<textarea name="response" rows="5">${helpers.escape(entity.response)}</textarea></label>
          <label>Apoyos<input name="votes" type="number" min="0" value="${entity.votes || 0}"></label>
          <button class="button button-primary">Guardar idea</button>
          <button type="button" class="inline-danger-button" id="deleteEntity">Eliminar idea</button>
        </form>`);
    }


    if (type === "dashboardKpi") {
      openInspector("Editar indicador", entity.label, `<form class="inline-inspector-form" id="entityEditForm">
        <label>Nombre<input name="label" value="${helpers.escape(entity.label)}"></label>
        <label>Valor numérico<input name="value" type="number" step="any" value="${entity.value}"></label>
        <label>Valor visible<input name="display" value="${helpers.escape(entity.display || "")}"></label>
        <label>Descripción<textarea name="description" rows="4">${helpers.escape(entity.description || "")}</textarea></label>
        <label>Ícono<input name="icon" value="${helpers.escape(entity.icon || "")}"></label>
        <label>Color<select name="color">${["blue","teal","orange","pink","purple","green"].map(value=>`<option ${entity.color===value?"selected":""}>${value}</option>`).join("")}</select></label>
        <button class="button button-primary">Guardar indicador</button></form>`);
    }

    if (["investmentItem","reachItem","executionItem"].includes(type)) {
      openInspector("Editar dato de gráfica", entity.label, `<form class="inline-inspector-form" id="entityEditForm">
        <label>Nombre<input name="label" value="${helpers.escape(entity.label)}"></label>
        <label>Valor<input name="value" type="number" step="any" value="${entity.value}"></label>
        ${type==="investmentItem"?`<label>Alcance<textarea name="scope" rows="4">${helpers.escape(entity.scope || "")}</textarea></label>`:""}
        <button class="button button-primary">Guardar dato</button></form>`);
    }

    if (type === "commitment") {
      openInspector("Editar compromiso", entity.title, `<form class="inline-inspector-form" id="entityEditForm">
        <label>Compromiso<input name="title" value="${helpers.escape(entity.title)}"></label>
        <label>Responsable<textarea name="responsible" rows="3">${helpers.escape(entity.responsible)}</textarea></label>
        <label>Alcance<textarea name="scope" rows="5">${helpers.escape(entity.scope)}</textarea></label>
        <label>Prioridad<select name="priority">${["Alta","Estratégica","Transversal"].map(value=>`<option ${entity.priority===value?"selected":""}>${value}</option>`).join("")}</select></label>
        <label>Estado<select name="status">${[["pendiente","Pendiente"],["en_progreso","En progreso"],["cumplido","Cumplido"],["bloqueado","Bloqueado"]].map(([value,label])=>`<option value="${value}" ${entity.status===value?"selected":""}>${label}</option>`).join("")}</select></label>
        <label>Avance <output id="commitmentProgressOutput">${entity.progress || 0}%</output><input name="progress" id="commitmentProgress" type="range" min="0" max="100" value="${entity.progress || 0}"></label>
        <label>Fecha objetivo<input name="dueDate" type="date" value="${helpers.escape(entity.dueDate || "")}"></label>
        <label>Enlace de evidencia<input name="evidenceUrl" value="${helpers.escape(entity.evidenceUrl || "")}"></label>
        <label class="inline-file">Subir evidencia<input name="evidenceFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx"></label>
        <button class="button button-primary">Guardar compromiso</button></form>`);
      document.querySelector("#commitmentProgress")?.addEventListener("input",event=>document.querySelector("#commitmentProgressOutput").value=`${event.target.value}%`);
    }

    if (type === "citizenRequest") {
      openInspector("Editar solicitud ciudadana", entity.request, `<form class="inline-inspector-form" id="entityEditForm">
        <label>Radicados<textarea name="radicados" rows="3">${helpers.escape(entity.radicados)}</textarea></label>
        <label>Solicitante<input name="applicant" value="${helpers.escape(entity.applicant)}"></label>
        <label>Tema<input name="topic" value="${helpers.escape(entity.topic)}"></label>
        <label>Estado<input name="status" value="${helpers.escape(entity.status)}"></label>
        <label>Solicitud<textarea name="request" rows="5">${helpers.escape(entity.request)}</textarea></label>
        <label>Respuesta institucional<textarea name="response" rows="6">${helpers.escape(entity.response || "")}</textarea></label>
        <label>Referencia y soporte<textarea name="support" rows="4">${helpers.escape(entity.support || "")}</textarea></label>
        <button class="button button-primary">Guardar solicitud</button></form>`);
    }

    const form = document.querySelector("#entityEditForm");
    const imageInput = form?.querySelector('input[name="image"],input[name="cover"]');
    const documentInput = form?.querySelector('input[name="document"]');
    const evidenceInput = form?.querySelector('input[name="evidenceFile"]');
    let pendingImage = null;
    let pendingDocument = null;
    let pendingEvidence = null;

    imageInput?.addEventListener("change", async event => {
      try {
        pendingImage = await persistImage(await compressedImage(event.target.files[0], {maxWidth:1800,maxHeight:1100,quality:.84}),`entities/${type}`);
        helpers.toast("Imagen preparada. Guarde los cambios.");
      } catch (error) { helpers.toast(error.message); }
    });

    documentInput?.addEventListener("change", async event => {
      try { pendingDocument = await persistDocument(event.target.files[0],`resources/${entity.id}`); helpers.toast("Documento cargado. Guarde los cambios."); }
      catch (error) { helpers.toast(window.FirebasePortal?.friendlyError?.(error) || error.message); }
    });

    evidenceInput?.addEventListener("change", async event => {
      try { pendingEvidence = await persistDocument(event.target.files[0],`commitments/${entity.id}`); helpers.toast("Evidencia cargada. Guarde los cambios."); }
      catch (error) { helpers.toast(window.FirebasePortal?.friendlyError?.(error) || error.message); }
    });

    document.querySelector("#removeEntityImage")?.addEventListener("click", () => {
      if (type === "year") entity.cover = "";
      if (type === "resource") entity.image = "";
      pendingImage = "";
      helpers.save();
      helpers.toast("Imagen eliminada.");
    });

    document.querySelector("#deleteEntity")?.addEventListener("click", () => {
      if (!confirm("¿Eliminar este elemento?")) return;
      if (type === "resource") state.resources = state.resources.filter(item => item.id !== entity.id);
      if (type === "idea") state.ideas = state.ideas.filter(item => item.id !== entity.id);
      helpers.save();
      location.reload();
    });

    form?.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);

      if (type === "year") {
        entity.status = data.get("status");
        entity.progress = Number(data.get("progress"));
        entity.headline = data.get("headline");
        entity.summary = data.get("summary");
        entity.documents = Number(data.get("documents"));
        entity.videos = Number(data.get("videos"));
        entity.commitments = Number(data.get("commitments"));
        entity.questions = Number(data.get("questions"));
        entity.metrics = {
          plan:Number(data.get("metricPlan")),
          projects:Number(data.get("metricProjects")),
          commitments:Number(data.get("metricCommitments")),
          participation:Number(data.get("metricParticipation"))
        };
        entity.sectors = [0,1,2,3]
          .map(index => ({
            name:String(data.get(`sectorName${index}`) || "").trim(),
            value:Math.max(0,Math.min(100,Number(data.get(`sectorValue${index}`)) || 0))
          }))
          .filter(item => item.name);
        if (pendingImage !== null) entity.cover = pendingImage;
      }

      if (type === "resource") {
        entity.title = data.get("title");
        entity.year = Number(data.get("year"));
        entity.type = data.get("type");
        entity.description = data.get("description");
        entity.meta = data.get("meta");
        entity.url = data.get("url");
        entity.featured = data.get("featured") === "on";
        if (pendingImage !== null) entity.image = pendingImage;
      }

      if (type === "idea") {
        entity.title = data.get("title");
        entity.author = data.get("author");
        entity.location = data.get("location");
        entity.category = data.get("category");
        entity.description = data.get("description");
        entity.status = data.get("status");
        entity.response = data.get("response");
        entity.votes = Number(data.get("votes"));
      }

      if (type === "dashboardKpi") {
        entity.label=data.get("label"); entity.value=Number(data.get("value")); entity.display=data.get("display"); entity.description=data.get("description"); entity.icon=data.get("icon"); entity.color=data.get("color");
      }
      if (["investmentItem","reachItem","executionItem"].includes(type)) {
        entity.label=data.get("label"); entity.value=Number(data.get("value")); if(type==="investmentItem") entity.scope=data.get("scope");
      }
      if (type === "commitment") {
        entity.title=data.get("title"); entity.responsible=data.get("responsible"); entity.scope=data.get("scope"); entity.priority=data.get("priority"); entity.status=data.get("status"); entity.progress=Number(data.get("progress")); entity.dueDate=data.get("dueDate"); entity.evidenceUrl=pendingEvidence || data.get("evidenceUrl"); entity.updatedAt=new Date().toISOString();
      }
      if (type === "citizenRequest") {
        entity.radicados=data.get("radicados"); entity.applicant=data.get("applicant"); entity.topic=data.get("topic"); entity.status=data.get("status"); entity.request=data.get("request"); entity.response=data.get("response"); entity.support=data.get("support");
      }
      if (type === "resource" && pendingDocument) entity.url=pendingDocument;

      helpers.save();
      helpers.toast("Cambios guardados.");
      setTimeout(() => location.reload(), 350);
    });
  }

  function updateUserManagementButton() {
    const button = document.querySelector("#inlineManageUsers");
    const nav = document.querySelector("#inlineUsersNav");
    const status = window.FirebasePortal?.getStatus?.();
    const allowed = Boolean(status?.isSuperAdmin);

    if (button) button.hidden = !allowed;
    if (nav) nav.hidden = !allowed;
  }

  function userRoleOptions(selected) {
    return [
      ["guest","Invitado"],
      ["editor","Editor"],
      ["admin","Administrador"],
      ["super_admin","Superadministrador"]
    ].map(([value,label]) => `
      <option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>
    `).join("");
  }

  function userDate(value) {
    if (!value) return "Sin registro";
    try {
      return new Date(value).toLocaleString("es-CO",{
        day:"2-digit",
        month:"short",
        year:"numeric",
        hour:"2-digit",
        minute:"2-digit"
      });
    } catch {
      return "Sin registro";
    }
  }

  async function openUsersInspector() {
    const status = window.FirebasePortal?.getStatus?.();
    if (!status?.isSuperAdmin) {
      helpers.toast("Solo el superadministrador puede gestionar usuarios.");
      return;
    }

    openInspector(
      "Gestión de usuarios",
      "Roles, acceso y cuentas ciudadanas",
      `<div class="users-loading"><span></span><strong>Cargando usuarios…</strong></div>`
    );

    try {
      const users = await window.FirebasePortal.listUserProfiles();
      const currentUid = status.user?.uid || "";
      const currentEmail = status.user?.email || "";

      document.querySelector("#inlineInspectorContent").innerHTML = `
        <div class="users-admin-summary">
          <div><strong>${users.length}</strong><small>Perfiles registrados</small></div>
          <div><strong>${users.filter(user => user.active).length}</strong><small>Cuentas activas</small></div>
          <div><strong>${users.filter(user => user.role !== "guest").length}</strong><small>Equipo administrativo</small></div>
        </div>

        <label class="users-search-field">
          Buscar usuario
          <input id="usersAdminSearch" placeholder="Nombre, correo o rol">
        </label>

        <p class="users-admin-note">
          Las cuentas nuevas se crean como <strong>Invitado</strong>. Desde aquí puede promoverlas a editor o administrador. Por seguridad no puede desactivar ni degradar su propia cuenta.
        </p>

        <div class="users-admin-list" id="usersAdminList">
          ${users.length ? users.map(user => {
            const isCurrent =
              user.uid === currentUid
              || user.email === currentEmail
              || user.docId === currentUid
              || user.docId === currentEmail;

            return `
              <article class="user-admin-card"
                data-user-card
                data-search="${helpers.escape(`${user.displayName} ${user.email} ${user.roleLabel}`.toLowerCase())}">
                <div class="user-admin-card__head">
                  <span class="user-admin-avatar">${helpers.escape((user.displayName || "U").charAt(0).toUpperCase())}</span>
                  <div>
                    <strong>${helpers.escape(user.displayName)}</strong>
                    <small>${helpers.escape(user.email || user.uid || user.docId)}</small>
                  </div>
                  ${isCurrent ? '<b class="current-user-badge">Su cuenta</b>' : ""}
                </div>

                <div class="user-admin-meta">
                  <span>${user.emailVerified ? "Correo verificado" : "Correo pendiente"}</span>
                  <span>${user.active ? "Cuenta activa" : "Cuenta desactivada"}</span>
                  <span>Último acceso: ${helpers.escape(userDate(user.lastLoginAt))}</span>
                </div>

                <div class="user-admin-controls">
                  <label>Rol
                    <select data-user-role ${isCurrent ? "disabled" : ""}>
                      ${userRoleOptions(user.role)}
                    </select>
                  </label>
                  <label class="user-active-control">
                    <input type="checkbox" data-user-active ${user.active ? "checked" : ""} ${isCurrent ? "disabled" : ""}>
                    <span>Permitir acceso</span>
                  </label>
                  <button type="button"
                    class="button button-primary"
                    data-save-user
                    ${isCurrent ? "disabled" : ""}
                    data-doc-id="${helpers.escape(user.docId)}"
                    data-uid="${helpers.escape(user.uid || "")}"
                    data-email="${helpers.escape(user.email || "")}"
                    data-name="${helpers.escape(user.displayName || "")}">
                    Guardar cambios
                  </button>
                </div>
              </article>`;
          }).join("") : `
            <div class="users-empty-state">
              <strong>No hay perfiles registrados.</strong>
              <p>Los usuarios aparecerán después de crear una cuenta o iniciar sesión por primera vez.</p>
            </div>`
          }
        </div>
      `;

      document.querySelector("#usersAdminSearch")?.addEventListener("input",event => {
        const query = event.target.value.trim().toLowerCase();
        document.querySelectorAll("[data-user-card]").forEach(card => {
          card.hidden = query && !card.dataset.search.includes(query);
        });
      });

      document.querySelectorAll("[data-save-user]").forEach(button => {
        button.addEventListener("click",async () => {
          const card = button.closest("[data-user-card]");
          const role = card.querySelector("[data-user-role]").value;
          const active = card.querySelector("[data-user-active]").checked;

          button.disabled = true;
          button.textContent = "Guardando…";

          try {
            await window.FirebasePortal.updateUserAccess(
              {
                docId:button.dataset.docId,
                uid:button.dataset.uid,
                email:button.dataset.email,
                displayName:button.dataset.name
              },
              {role,active}
            );
            helpers.toast("Acceso del usuario actualizado.");
            await openUsersInspector();
          } catch (error) {
            helpers.toast(
              window.FirebasePortal?.friendlyError?.(error)
              || error.message
            );
            button.disabled = false;
            button.textContent = "Guardar cambios";
          }
        });
      });
    } catch (error) {
      document.querySelector("#inlineInspectorContent").innerHTML = `
        <div class="users-empty-state is-error">
          <strong>No fue posible consultar los usuarios.</strong>
          <p>${helpers.escape(window.FirebasePortal?.friendlyError?.(error) || error.message)}</p>
          <button type="button" class="button button-primary" id="retryUsersList">Reintentar</button>
        </div>`;
      document.querySelector("#retryUsersList")?.addEventListener("click",openUsersInspector);
    }
  }

  function openNewEntityInspector(type) {
    if (type === "year") {
      const nextYear = Math.max(...state.years.map(item => Number(item.year)), new Date().getFullYear()) + 1;
      openInspector("Nueva vigencia", "Crear una nueva edición", `
        <form class="inline-inspector-form" id="newEntityForm">
          <label>Año<input name="year" type="number" min="2025" max="2100" value="${nextYear}" required></label>
          <label>Estado<select name="status"><option>Programada</option><option>En construcción</option><option>Publicada</option></select></label>
          <label>Avance<input name="progress" type="number" min="0" max="100" value="0"></label>
          <label>Titular<input name="headline" value="Nueva edición de Rendición de Cuentas."></label>
          <label>Resumen<textarea name="summary" rows="5" required></textarea></label>
          <label class="inline-file">Imagen de portada<input name="cover" type="file" accept="image/*"></label>
          <button class="button button-primary">Crear vigencia</button>
        </form>`);
    }

    if (type === "resource") {
      openInspector("Nuevo recurso", "Agregar al centro documental", `
        <form class="inline-inspector-form" id="newEntityForm">
          <label>Título<input name="title" required></label>
          <label>Vigencia<select name="year">${state.years.map(year => `<option value="${year.year}">${year.year}</option>`).join("")}</select></label>
          <label>Tipo<select name="type">${["informe","presentacion","video","datos","compromiso","respuesta"].map(value => `<option value="${value}">${helpers.typeLabel(value)}</option>`).join("")}</select></label>
          <label>Descripción<textarea name="description" rows="4" required></textarea></label>
          <label>Detalle<input name="meta" placeholder="Ejemplo: 24 páginas · 3 MB"></label>
          <label>Enlace<input name="url" value="#"></label>
          <label class="inline-file">Subir documento<input name="document" type="file" accept=".pdf,.xlsx,.xls,.csv,.ppt,.pptx,.doc,.docx,video/*"></label>
          <label class="inline-check"><input name="featured" type="checkbox"> Mostrar como destacado</label>
          <label class="inline-file">Imagen del recurso<input name="image" type="file" accept="image/*"></label>
          <button class="button button-primary">Crear recurso</button>
        </form>`);
    }

    if (type === "idea") {
      openInspector("Nueva idea ciudadana", "Registro administrativo", `
        <form class="inline-inspector-form" id="newEntityForm">
          <label>Título<input name="title" required></label>
          <label>Autor o colectivo<input name="author" required></label>
          <label>Ubicación<input name="location" required></label>
          <label>Categoría<input name="category" required></label>
          <label>Descripción<textarea name="description" rows="5" required></textarea></label>
          <label>Estado<select name="status"><option value="recibida">Recibida</option><option value="analisis">En análisis</option><option value="aceptada">Se tendrá en cuenta</option><option value="resuelta">Resuelta</option></select></label>
          <label>Respuesta institucional<textarea name="response" rows="4">La propuesta fue recibida y está pendiente de revisión institucional.</textarea></label>
          <button class="button button-primary">Crear idea</button>
        </form>`);
    }

    const form = document.querySelector("#newEntityForm");
    if (!form) return;
    const imageInput = form.querySelector('input[name="image"],input[name="cover"]');
    const documentInput = form.querySelector('input[name="document"]');
    let preparedImage = "";
    let preparedDocument = "";

    imageInput?.addEventListener("change", async event => {
      try {
        preparedImage = await persistImage(await compressedImage(event.target.files[0], {maxWidth:1800,maxHeight:1100,quality:.84}),`entities/${type}`);
        helpers.toast("Imagen preparada.");
      } catch (error) { helpers.toast(error.message); }
    });


    documentInput?.addEventListener("change", async event => {
      try { preparedDocument = await persistDocument(event.target.files[0],`resources/new`); helpers.toast("Documento cargado."); }
      catch (error) { helpers.toast(window.FirebasePortal?.friendlyError?.(error) || error.message); }
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);

      if (type === "year") {
        const year = Number(data.get("year"));
        if (state.years.some(item => Number(item.year) === year)) {
          helpers.toast("La vigencia ya existe.");
          return;
        }
        state.years.push({
          year,
          status:data.get("status"),
          progress:Number(data.get("progress")),
          summary:data.get("summary"),
          headline:data.get("headline"),
          documents:0,
          videos:0,
          commitments:0,
          questions:0,
          cover:preparedImage,
          metrics:{plan:Number(data.get("progress")),projects:0,commitments:0,participation:0},
          sectors:[
          {name:"Infraestructura",value:0},
          {name:"Desarrollo social",value:0},
          {name:"Gestión administrativa",value:0},
          {name:"Participación ciudadana",value:0}
        ]
        });
      }

      if (type === "resource") {
        state.resources.unshift({
          id:`r${Date.now()}`,
          title:data.get("title"),
          year:Number(data.get("year")),
          type:data.get("type"),
          description:data.get("description"),
          meta:data.get("meta") || "Recurso digital",
          url:preparedDocument || data.get("url") || "#",
          featured:data.get("featured") === "on",
          image:preparedImage
        });
      }

      if (type === "idea") {
        state.ideas.unshift({
          id:`i${Date.now()}`,
          title:data.get("title"),
          author:data.get("author"),
          location:data.get("location"),
          category:data.get("category"),
          description:data.get("description"),
          status:data.get("status"),
          response:data.get("response"),
          votes:0,
          created:new Date().toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric"})
        });
      }

      helpers.save();
      helpers.toast("Contenido creado.");
      setTimeout(() => location.reload(), 350);
    });
  }

  function openNewBlockInspector() {
    openInspector("Crear nuevo bloque", "Se agregará antes del boletín final", `
      <form class="inline-inspector-form" id="newBlockForm">
        <label>Rótulo<input name="kicker" value="NUEVO MÓDULO"></label>
        <label>Título<input name="title" required></label>
        <label>Contenido<textarea name="text" rows="6" required></textarea></label>
        <label>Texto del botón<input name="button" value="Ver información"></label>
        <label>Enlace<input name="url" value="#"></label>
        <label>Estilo<select name="theme"><option value="blue">Azul</option><option value="light">Claro</option><option value="accent">Acento</option></select></label>
        <button class="button button-primary">Crear bloque</button>
      </form>`);

    document.querySelector("#newBlockForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const data = new FormData(event.target);
      pageData().customBlocks.push({
        id:`block-${Date.now()}`,
        kicker:data.get("kicker"),
        title:data.get("title"),
        text:data.get("text"),
        button:data.get("button"),
        url:data.get("url"),
        theme:data.get("theme")
      });
      persist();
      renderCustomBlocks();
      decorate();
      closeInspector();
      helpers.toast("Nuevo bloque creado.");
    });
  }

  function moveSection(section, direction) {
    const sibling = direction === "up" ? section.previousElementSibling : section.nextElementSibling;
    if (!sibling || sibling.tagName !== "SECTION") return;
    if (direction === "up") section.parentNode.insertBefore(section, sibling);
    else section.parentNode.insertBefore(sibling, section);

    const main = document.querySelector("main");
    pageData().sectionOrder = [...main.children]
      .filter(element => element.tagName === "SECTION")
      .map(sectionKey);
    persist();
    helpers.toast("Orden de las secciones guardado.");
  }

  function rgbToHex(value) {
    if (!value || value.startsWith("#")) return value || "#14213d";
    const parts = value.match(/\d+/g);
    if (!parts || parts.length < 3) return "#14213d";
    return `#${parts.slice(0,3).map(number => Number(number).toString(16).padStart(2,"0")).join("")}`;
  }

  function bindDocumentEditing() {
    document.addEventListener("click", event => {
      if (!active) return;

      const sectionButton = event.target.closest("[data-inline-section]");
      const moveButton = event.target.closest("[data-inline-move]");
      const entityButton = event.target.closest("[data-inline-entity]");
      const editableAction = event.target.closest(".admin-inline-text");

      if (sectionButton || moveButton || entityButton || (editableAction && editableAction.matches("a,button,.button"))) {
        event.preventDefault();
        event.stopImmediatePropagation();

        if (sectionButton) openSectionInspector(sectionButton.closest("section"));
        if (moveButton) moveSection(moveButton.closest("section"), moveButton.dataset.inlineMove);
        if (entityButton) openEntityInspector(entityButton.dataset.inlineEntity, entityButton.dataset.entityId, entityButton.dataset.entityYear);
      }
    }, true);

    document.addEventListener("input", event => {
      const editable = event.target.closest(".admin-inline-text");
      const quickEditing = Boolean(editable?.closest(".admin-quick-text-active"));
      if ((!active && !quickEditing) || !editable) return;
      const key = contentKey(editable);
      state.content[key] = editable.innerHTML;
      persist();
    });

    document.addEventListener("keydown", event => {
      const editable = event.target.closest(".admin-inline-text");
      const quickEditing = Boolean(editable?.closest(".admin-quick-text-active"));
      if ((!active && !quickEditing) || !editable) return;
      if (event.key === "Escape") editable.blur();
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") editable.blur();
    });

    document.addEventListener("click", event => {
      if (!active) return;

      const sectionButton = event.target.closest("[data-inline-section]");
      if (sectionButton) {
        event.preventDefault();
        event.stopPropagation();
        openSectionInspector(sectionButton.closest("section"));
        return;
      }

      const moveButton = event.target.closest("[data-inline-move]");
      if (moveButton) {
        event.preventDefault();
        event.stopPropagation();
        moveSection(moveButton.closest("section"), moveButton.dataset.inlineMove);
        return;
      }

      const entityButton = event.target.closest("[data-inline-entity]");
      if (entityButton) {
        event.preventDefault();
        event.stopPropagation();
        openEntityInspector(entityButton.dataset.inlineEntity, entityButton.dataset.entityId, entityButton.dataset.entityYear);
        return;
      }

      const image = event.target.closest(".admin-inline-image");
      if (image) {
        event.preventDefault();
        event.stopPropagation();
        openImageInspector(image);
        return;
      }

      const editable = event.target.closest(".admin-inline-text");
      if (editable) {
        if (editable.matches("a,button,.button")) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.altKey) {
          event.preventDefault();
          openTextInspector(editable);
        }
      }
    });
  }

  function init() {
    window.addEventListener("drive:ready", updateDrivePanel);
    window.addEventListener("drive:auth", updateDrivePanel);
    window.addEventListener("drive:folder", updateDrivePanel);
    window.addEventListener("drive:config", updateDrivePanel);
    window.addEventListener("drive:upload", event => updateDriveProgress(event.detail));
    window.addEventListener("drive:warning", event => helpers.toast(event.detail?.message || "Revise los permisos del archivo en Drive."));
    window.addEventListener("firebase:auth",event => {
      updateUserManagementButton();
      updateConsoleIdentity();

      if (event.detail?.canWrite) {
        if (sessionStorage.getItem("sp_admin_quick_view") !== "visitor") {
          quickControlsEnabled = true;
        }
        refreshQuickAdminControls();
      } else if (event.detail?.user) {
        closeConsole();
        deactivate(false);
        clearQuickAdminControls();
      }
    });
    window.addEventListener("firebase:users",() => {
      if (document.querySelector("#inlineInspectorTitle")?.textContent === "Gestión de usuarios") {
        openUsersInspector();
      }
    });

    updateUserManagementButton();
    applySavedContent();
    applySectionOrder();
    applySectionStyles();
    renderCustomBlocks();
    applyBanner();
    applyPublicationState();
    bindDocumentEditing();
    bindQuickAdminActions();
    bindNewsEditor();
    refreshQuickAdminControls();

    window.addEventListener("portal:datachange", refreshQuickAdminControls);

    window.addEventListener("portal:rendered", () => {
      applySavedContent();
      applySectionOrder();
      applySectionStyles();
      renderCustomBlocks();
      if (active) decorate();
      else refreshQuickAdminControls();
    });
  }

  window.InlineAdmin = {
    init,
    activate,
    deactivate,
    openConsole,
    closeConsole,
    openNews:openNewsModal,
    openVisualStudio,
    enableQuickControls,
    disableQuickControls,
    isEditing:() => active,
    decorate,
    openEntityEditor:openEntityInspector,
    openUsers:openUsersInspector
  };
})();