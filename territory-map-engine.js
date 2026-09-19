(() => {
  "use strict";

  const MAPLIBRE_VERSION = "5.24.0";
  const MAPLIBRE_JS =
    `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
  const MAPLIBRE_CSS =
    `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

  const OPENFREE = Object.freeze({
    plano:"https://tiles.openfreemap.org/styles/positron",
    relieve:"https://tiles.openfreemap.org/styles/liberty"
  });

  const TERRAIN_URL = "https://tiles.mapterhorn.com/tilejson.json";
  const SATELLITE_TILE =
    "https://server.arcgisonline.com/ArcGIS/rest/services/" +
    "World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const LABEL_TILE =
    "https://services.arcgisonline.com/ArcGIS/rest/services/" +
    "Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

  const state = {
    promise:null,
    map:null,
    container:null,
    fallback:null,
    ready:false,
    activeStyle:"plano",
    items:[],
    mode:"territory",
    markers:[],
    popup:null,
    options:null,
    styleToken:0
  };

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g,char => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    })[char]);

  const categoryIcon = category => ({
    territory:"◎",
    impact:"!",
    work:"↗",
    participation:"✦"
  })[category] || "◎";

  const categoryLabel = category => ({
    territory:"Territorio",
    impact:"Afectación",
    work:"Obra o respuesta",
    participation:"Participación"
  })[category] || "Territorio";

  function portalHelpers() {
    return window.Portal?.helpers || {};
  }

  function loadLibrary() {
    if (window.maplibregl?.Map) return Promise.resolve(window.maplibregl);
    if (state.promise) return state.promise;

    state.promise = new Promise((resolve,reject) => {
      if (!document.querySelector("#territoryMapLibreCss")) {
        const css = document.createElement("link");
        css.id = "territoryMapLibreCss";
        css.rel = "stylesheet";
        css.href = MAPLIBRE_CSS;
        document.head.appendChild(css);
      }

      const existing = document.querySelector("#territoryMapLibreJs");
      if (existing) {
        existing.addEventListener("load",() => resolve(window.maplibregl),{
          once:true
        });
        existing.addEventListener("error",reject,{once:true});
        return;
      }

      const script = document.createElement("script");
      script.id = "territoryMapLibreJs";
      script.src = MAPLIBRE_JS;
      script.defer = true;
      script.onload = () => resolve(window.maplibregl);
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return state.promise;
  }

  function satelliteStyle({labels = false} = {}) {
    const layers = [
      {
        id:"satellite-base",
        type:"raster",
        source:"satellite",
        paint:{
          "raster-saturation":.08,
          "raster-contrast":.05,
          "raster-brightness-min":.08,
          "raster-brightness-max":.98
        }
      },
      {
        id:"terrain-shadow",
        type:"hillshade",
        source:"hillshadeSource",
        paint:{
          "hillshade-shadow-color":"#102b42",
          "hillshade-highlight-color":"#f4ead3",
          "hillshade-accent-color":"#4985a8",
          "hillshade-exaggeration":.34
        }
      }
    ];

    if (labels) {
      layers.push({
        id:"reference-labels",
        type:"raster",
        source:"referenceLabels",
        paint:{
          "raster-opacity":.94,
          "raster-contrast":.10
        }
      });
    }

    return {
      version:8,
      projection:{type:"mercator"},
      sources:{
        satellite:{
          type:"raster",
          tiles:[SATELLITE_TILE],
          tileSize:256,
          maxzoom:19,
          attribution:"Imágenes © Esri y proveedores"
        },
        referenceLabels:{
          type:"raster",
          tiles:[LABEL_TILE],
          tileSize:256,
          maxzoom:19
        },
        terrainSource:{
          type:"raster-dem",
          url:TERRAIN_URL,
          tileSize:256
        },
        hillshadeSource:{
          type:"raster-dem",
          url:TERRAIN_URL,
          tileSize:256
        }
      },
      layers,
      terrain:{
        source:"terrainSource",
        exaggeration:1.25
      },
      sky:{
        "atmosphere-blend":[
          "interpolate",["linear"],["zoom"],0,1,6,.14,12,0
        ]
      }
    };
  }

  function styleDefinition(name) {
    if (name === "satelite") return satelliteStyle({labels:false});
    if (name === "hibrido") return satelliteStyle({labels:true});
    return OPENFREE[name] || OPENFREE.plano;
  }

  function styleCamera(name) {
    if (name === "plano") return {pitch:42,bearing:-8};
    if (name === "relieve") return {pitch:66,bearing:-16};
    if (name === "satelite") return {pitch:62,bearing:12};
    return {pitch:66,bearing:-12};
  }

  function firstSymbolLayer() {
    return state.map?.getStyle()?.layers?.find(layer =>
      layer.type === "symbol" && layer.layout?.["text-field"]
    )?.id;
  }

  function configureTerrainAndBuildings() {
    const map = state.map;
    if (!map?.isStyleLoaded()) return;

    try {
      if (!map.getSource("territory-terrain")) {
        map.addSource("territory-terrain",{
          type:"raster-dem",
          url:TERRAIN_URL,
          tileSize:256
        });
      }
      map.setTerrain({
        source:"territory-terrain",
        exaggeration:state.activeStyle === "plano" ? .72 : 1.24
      });

      if (!map.getLayer("territory-hillshade")) {
        map.addLayer({
          id:"territory-hillshade",
          type:"hillshade",
          source:"territory-terrain",
          paint:{
            "hillshade-shadow-color":"#16374e",
            "hillshade-highlight-color":"#f4f5df",
            "hillshade-accent-color":"#4d87a9",
            "hillshade-exaggeration":
              state.activeStyle === "plano" ? .12 : .34
          }
        },firstSymbolLayer());
      }
    } catch {
      // El mapa continúa aunque el proveedor de elevación no responda.
    }

    try {
      const layers = map.getStyle()?.layers || [];
      const building = layers.find(layer =>
        layer["source-layer"] === "building" &&
        ["fill","line"].includes(layer.type)
      );

      if (
        building &&
        !map.getLayer("territory-3d-buildings")
      ) {
        map.addLayer({
          id:"territory-3d-buildings",
          source:building.source,
          "source-layer":building["source-layer"],
          type:"fill-extrusion",
          minzoom:14,
          filter:building.filter,
          paint:{
            "fill-extrusion-color":[
              "interpolate",["linear"],["zoom"],
              14,"#d7e8f5",
              17,"#ffffff"
            ],
            "fill-extrusion-height":[
              "coalesce",
              ["to-number",["get","render_height"]],
              ["to-number",["get","height"]],
              6
            ],
            "fill-extrusion-base":[
              "coalesce",
              ["to-number",["get","render_min_height"]],
              ["to-number",["get","min_height"]],
              0
            ],
            "fill-extrusion-opacity":.78,
            "fill-extrusion-vertical-gradient":true
          }
        },firstSymbolLayer());
      }
    } catch {
      // Algunas zonas rurales no incluyen geometría de edificios.
    }
  }

  function popupMarkup(item) {
    const details = [];
    if (item.kind) details.push(item.kind);
    if (item.sector) details.push(item.sector);
    if (item.status) details.push(item.status);
    if (item.people) details.push(`${item.people} personas`);
    if (item.veredas?.length) details.push(item.veredas.join(", "));

    return `
      <div class="territory-maplibre-popup">
        <span>${escapeHtml(categoryLabel(item.category || "territory"))}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(
          item.description || item.note || details.join(" · ")
        )}</p>
        ${details.length
          ? `<small>${escapeHtml(details.join(" · "))}</small>`
          : ""}
      </div>`;
  }

  function clearMarkers() {
    state.markers.forEach(marker => marker.remove());
    state.markers = [];
    state.popup?.remove?.();
    state.popup = null;
  }

  function markerElement(item) {
    const category = item.category || "territory";
    const element = document.createElement("button");
    element.type = "button";
    element.className =
      `territory-gl-marker is-${category}`;
    element.setAttribute("aria-label",`Abrir ${item.name}`);
    element.innerHTML = `
      <span class="territory-gl-marker__pulse"></span>
      <i>${escapeHtml(categoryIcon(category))}</i>
      <b>${escapeHtml(item.name)}</b>`;
    element.addEventListener("click",event => {
      event.stopPropagation();
      state.options?.onSelect?.(item);
      openPopup(item);
    });
    return element;
  }

  function openPopup(item) {
    if (!state.map || !window.maplibregl) return;
    state.popup?.remove?.();
    state.popup = new window.maplibregl.Popup({
      className:"territory-maplibre-popup-shell",
      closeButton:true,
      closeOnClick:false,
      maxWidth:"310px",
      offset:28
    })
      .setLngLat([item.lng,item.lat])
      .setHTML(popupMarkup(item))
      .addTo(state.map);
  }

  function impactGeoJSON(items) {
    return {
      type:"FeatureCollection",
      features:items
        .filter(item =>
          item.category === "impact" &&
          Number.isFinite(item.lng) &&
          Number.isFinite(item.lat)
        )
        .map(item => ({
          type:"Feature",
          geometry:{
            type:"Point",
            coordinates:[item.lng,item.lat]
          },
          properties:{
            id:item.id,
            people:Number(item.people) || 0
          }
        }))
    };
  }

  function renderImpactLayer() {
    const map = state.map;
    if (!map?.isStyleLoaded()) return;

    const data = impactGeoJSON(state.items);
    const source = map.getSource("territory-impact-source");

    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("territory-impact-source",{
      type:"geojson",
      data
    });

    map.addLayer({
      id:"territory-impact-glow",
      type:"circle",
      source:"territory-impact-source",
      paint:{
        "circle-radius":[
          "interpolate",["linear"],["get","people"],
          0,14,
          25,24,
          100,40,
          500,68,
          1500,100
        ],
        "circle-color":"#ff6b42",
        "circle-opacity":.10,
        "circle-stroke-color":"#ff8d70",
        "circle-stroke-width":1.3,
        "circle-stroke-opacity":.58,
        "circle-blur":.18
      }
    },firstSymbolLayer());
  }

  function render(items = state.items,mode = state.mode) {
    state.items = Array.isArray(items) ? items : [];
    state.mode = mode || "territory";

    if (!state.ready || !state.map) return;

    clearMarkers();
    renderImpactLayer();

    state.items.forEach(item => {
      if (!Number.isFinite(item.lng) || !Number.isFinite(item.lat)) return;
      const marker = new window.maplibregl.Marker({
        element:markerElement(item),
        anchor:"center"
      })
        .setLngLat([item.lng,item.lat])
        .addTo(state.map);
      marker.__territoryItem = item;
      state.markers.push(marker);
    });
  }

  function handleStyleReady(token) {
    if (token !== state.styleToken || !state.map?.isStyleLoaded()) return;
    configureTerrainAndBuildings();
    render();
    const camera = styleCamera(state.activeStyle);
    state.map.easeTo({
      pitch:camera.pitch,
      bearing:camera.bearing,
      duration:850,
      essential:true
    });
    state.options?.onStatus?.(
      `Vista ${state.activeStyle} preparada`,
      false
    );
    portalHelpers().hideLoading?.(
      `Vista ${state.activeStyle} cargada.`,
      {delay:760}
    );
  }

  function switchBasemap(name,button = null) {
    if (!state.ready || !state.map) return;
    if (!["plano","relieve","satelite","hibrido"].includes(name)) return;
    if (name === state.activeStyle) return;

    state.activeStyle = name;
    state.styleToken += 1;
    const token = state.styleToken;

    portalHelpers().showLoading?.(
      `Preparando la vista ${name}…`,
      {title:"Cargando mapa",trigger:button}
    );
    state.options?.onStatus?.(`Cargando vista ${name}…`,true);

    state.map.setStyle(styleDefinition(name),{
      diff:false
    });
    state.map.once("style.load",() => handleStyleReady(token));
  }

  function flyTo(item) {
    if (!state.ready || !state.map || !item) return;

    state.options?.onStatus?.(`Acercando la vista a ${item.name}`,true);
    state.map.flyTo({
      center:[item.lng,item.lat],
      zoom:15.65,
      pitch:68,
      bearing:24,
      duration:1900,
      curve:1.42,
      speed:.72,
      easing:t => 1 - Math.pow(1 - t,4),
      essential:true
    });

    state.map.once("moveend",() => {
      openPopup(item);
      state.options?.onStatus?.(`${item.name} en detalle`,false);
    });
  }

  function reset() {
    if (!state.ready || !state.map) return;

    const valid = (state.options?.allTerritory || state.items)
      .filter(item =>
        Number.isFinite(item.lng) && Number.isFinite(item.lat)
      );

    if (!valid.length) {
      state.map.flyTo({
        center:state.options?.center || [-76.22805,3.99557],
        zoom:11.8,
        pitch:54,
        bearing:-12,
        duration:1500,
        essential:true
      });
      return;
    }

    const bounds = valid.reduce(
      (acc,item) => acc.extend([item.lng,item.lat]),
      new window.maplibregl.LngLatBounds(
        [valid[0].lng,valid[0].lat],
        [valid[0].lng,valid[0].lat]
      )
    );

    state.map.fitBounds(bounds,{
      padding:{top:105,right:70,bottom:95,left:70},
      maxZoom:12.8,
      pitch:54,
      bearing:-12,
      duration:1700,
      essential:true
    });
  }

  function getCenter() {
    const center = state.map?.getCenter?.();
    return center
      ? {lat:center.lat,lng:center.lng}
      : null;
  }

  function resize() {
    state.map?.resize?.();
  }

  async function init(options = {}) {
    if (state.ready && state.map) return state.map;
    if (state.map && !state.ready) return state.promise;

    state.options = options;
    state.container = options.container;
    state.fallback = options.fallback;

    await loadLibrary();

    if (!window.maplibregl?.supported?.({failIfMajorPerformanceCaveat:true})) {
      throw new Error("El dispositivo no dispone de WebGL suficiente.");
    }

    const center = options.center || [-76.22805,3.99557];

    state.map = new window.maplibregl.Map({
      container:state.container,
      style:styleDefinition("plano"),
      center,
      zoom:11.8,
      pitch:54,
      bearing:-12,
      maxPitch:82,
      maxZoom:19,
      minZoom:8.7,
      antialias:true,
      fadeDuration:280,
      attributionControl:false,
      cooperativeGestures:false,
      renderWorldCopies:false
    });

    state.map.addControl(new window.maplibregl.NavigationControl({
      showCompass:true,
      showZoom:true,
      visualizePitch:true
    }),"top-right");

    state.map.addControl(new window.maplibregl.FullscreenControl({
      container:state.container.closest(".territory-map-shell") || undefined
    }),"top-right");

    state.map.addControl(new window.maplibregl.ScaleControl({
      maxWidth:110,
      unit:"metric"
    }),"bottom-left");

    state.map.on("click",event => {
      options.onMapClick?.({
        lat:event.lngLat.lat,
        lng:event.lngLat.lng
      });
    });

    state.map.on("movestart",() => {
      options.onStatus?.("Moviendo cámara territorial…",true);
    });

    state.map.on("moveend",() => {
      const centerNow = state.map.getCenter();
      options.onMove?.({
        lat:centerNow.lat,
        lng:centerNow.lng,
        zoom:state.map.getZoom(),
        pitch:state.map.getPitch(),
        bearing:state.map.getBearing()
      });
      options.onStatus?.("Cámara territorial lista",false);
    });

    state.map.on("error",event => {
      const message = event?.error?.message || "";
      if (/webgl|context/i.test(message)) {
        console.warn("TerritoryMapEngine:",message);
      }
    });

    await new Promise((resolve,reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("Tiempo de carga del mapa agotado.")),
        9000
      );
      state.map.once("load",() => {
        clearTimeout(timeout);
        resolve();
      });
      state.map.once("error",event => {
        if (!state.map?.loaded?.()) {
          clearTimeout(timeout);
          reject(event.error || new Error("No fue posible cargar el mapa."));
        }
      });
    });

    state.ready = true;
    configureTerrainAndBuildings();
    state.fallback?.classList.add("is-hidden");
    state.container?.classList.add("is-ready","is-maplibre");
    render(options.items || [],options.mode || "territory");

    window.setTimeout(() => {
      resize();
      reset();
    },140);

    options.onReady?.();
    return state.map;
  }

  function isReady() {
    return state.ready;
  }

  window.TerritoryMapEngine = {
    init,
    render,
    flyTo,
    reset,
    switchBasemap,
    getCenter,
    resize,
    isReady
  };
})();