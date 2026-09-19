(() => {
  "use strict";

  const FIREBASE_VERSION = "12.15.0";
  const SCHEMA_VERSION = 12;
  const firebaseConfig = Object.freeze({
    apiKey: "AIzaSyD02YaIMxLO2IPAJYZdPY2cWUvpkZDRo2U",
    authDomain: "rendicion-de-cuentas-6aceb.firebaseapp.com",
    projectId: "rendicion-de-cuentas-6aceb",
    storageBucket: "rendicion-de-cuentas-6aceb.firebasestorage.app",
    messagingSenderId: "509564686428",
    appId: "1:509564686428:web:4e1257b5305dd8b4c51699",
    measurementId: "G-BQ6DLM4ENY"
  });

  const SECTION_KEYS = Object.freeze([
    "years",
    "resources",
    "dashboards",
    "commitments",
    "citizenRequests",
    "news",
    "settings",
    "content",
    "pageSettings"
  ]);
  const MAX_SECTION_BYTES = 850 * 1024;
  const EDITOR_ROLES = new Set(["super_admin", "admin", "editor"]);

  const runtime = {
    initialized: false,
    ready: false,
    connected: navigator.onLine,
    user: null,
    profile: null,
    profileSource: "",
    profileError: null,
    role: null,
    canWrite: false,
    isSuperAdmin: false,
    syncing: false,
    syncPending: false,
    syncTimer: null,
    ideasFingerprint: "",
    lastError: null,
    app: null,
    auth: null,
    db: null,
    modules: null,
    initPromise: null,
    transport: "auto-long-polling"
  };

  const portal = () => window.Portal;
  const emit = (name, detail = {}) =>
    window.dispatchEvent(new CustomEvent(name, { detail }));

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function normalizeRole(value) {
    const aliases = {
      superadmin: "super_admin",
      super_administrador: "super_admin",
      superadministrador: "super_admin",
      administrador_principal: "super_admin",
      super_admin: "super_admin",
      admin: "admin",
      administrador: "admin",
      editor: "editor",
      invitado: "guest",
      visitante: "guest",
      viewer: "guest",
      usuario: "guest",
      guest: "guest"
    };
    return aliases[normalizeText(value)] || "guest";
  }

  function roleLabel(role) {
    return {
      super_admin: "Superadministrador",
      admin: "Administrador",
      editor: "Editor",
      guest: "Invitado"
    }[normalizeRole(role)] || "Invitado";
  }

  function friendlyError(error) {
    const code = String(error?.code || "");
    const messages = {
      "auth/invalid-credential": "Correo o contraseña incorrectos.",
      "auth/user-not-found": "No existe un usuario con ese correo.",
      "auth/wrong-password": "La contraseña no es correcta.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
      "auth/invalid-email": "El correo electrónico no es válido.",
      "auth/weak-password": "La contraseña debe tener al menos 8 caracteres.",
      "auth/too-many-requests": "Se realizaron demasiados intentos. Espere unos minutos.",
      "auth/network-request-failed": "No fue posible conectarse con Firebase.",
      "auth/popup-closed-by-user": "La ventana de acceso se cerró antes de completar el proceso.",
      "auth/unauthorized-domain": "Autorice este dominio en Firebase Authentication.",
      "permission-denied": "La cuenta no tiene permiso para realizar esta operación. Revise el rol del usuario y publique las reglas incluidas.",
      "failed-precondition": "Firestore todavía no está configurado correctamente.",
      "unavailable": "Firestore no está disponible temporalmente. Revise la conexión e inténtelo de nuevo.",
      "firebase/not-ready": "Firebase no pudo inicializarse.",
      "firebase/section-too-large": "Una sección del portal supera el tamaño seguro permitido por Firestore.",
      "firebase/invalid-json": "Una sección contiene datos que no pueden serializarse.",
      "firebase/cdn-load-failed": "No fue posible cargar el SDK oficial de Firebase desde gstatic.com."
    };
    return messages[code] || error?.message || "Ocurrió un error al comunicarse con Firebase.";
  }

  async function loadModules() {
    try {
      const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
      const [app, auth, firestore] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-auth.js`),
        import(`${base}/firebase-firestore.js`)
      ]);
      return { app, auth, firestore };
    } catch (cause) {
      const error = new Error(
        "No fue posible cargar Firebase desde el CDN oficial. Revise bloqueadores, antivirus, proxy o acceso a gstatic.com."
      );
      error.code = "firebase/cdn-load-failed";
      error.cause = cause;
      throw error;
    }
  }

  function authDetail(extra = {}) {
    return {
      user: runtime.user,
      profile: runtime.profile,
      profileSource: runtime.profileSource,
      profileError: runtime.profileError ? friendlyError(runtime.profileError) : "",
      role: runtime.role,
      roleLabel: roleLabel(runtime.role),
      canWrite: runtime.canWrite,
      isSuperAdmin: runtime.isSuperAdmin,
      emailVerified: Boolean(runtime.user?.emailVerified),
      ...extra
    };
  }

  function ensureReady() {
    if (!runtime.ready || !runtime.modules || !runtime.db || !runtime.auth) {
      const error = new Error("Firebase no se encuentra listo.");
      error.code = "firebase/not-ready";
      throw error;
    }
  }

  async function init() {
    if (runtime.ready) return runtime;
    if (runtime.initPromise) return runtime.initPromise;

    runtime.initialized = true;
    runtime.initPromise = (async () => {
      try {
        runtime.modules = await loadModules();
        runtime.app = runtime.modules.app.getApps().length
          ? runtime.modules.app.getApp()
          : runtime.modules.app.initializeApp(firebaseConfig);
        runtime.auth = runtime.modules.auth.getAuth(runtime.app);
        runtime.auth.languageCode = "es";

        try {
          runtime.db = runtime.modules.firestore.initializeFirestore(runtime.app, {
            ignoreUndefinedProperties: true,
            experimentalAutoDetectLongPolling: true
          });
        } catch (error) {
          if (String(error?.code || "").includes("already-initialized")) {
            runtime.db = runtime.modules.firestore.getFirestore(runtime.app);
          } else {
            throw error;
          }
        }

        await runtime.modules.auth.setPersistence(
          runtime.auth,
          runtime.modules.auth.browserLocalPersistence
        );

        await new Promise(resolve => {
          let first = true;
          runtime.modules.auth.onAuthStateChanged(
            runtime.auth,
            async user => {
              await handleAuthState(user, { reason: first ? "initial" : "change" });
              if (first) {
                first = false;
                resolve();
              }
            },
            error => {
              runtime.lastError = error;
              runtime.profileError = error;
              emit("firebase:auth", authDetail({ reason: "observer_error" }));
              if (first) {
                first = false;
                resolve();
              }
            }
          );
        });

        await hydrateFromCloud();
        runtime.ready = true;
        emit("firebase:ready", {
          connected: runtime.connected,
          projectId: firebaseConfig.projectId,
          schemaVersion: SCHEMA_VERSION
        });
        return runtime;
      } catch (error) {
        runtime.lastError = error;
        runtime.ready = false;
        emit("firebase:ready", { connected: false, error: friendlyError(error) });
        console.warn("[Firebase] No fue posible inicializar.", error);
        throw error;
      } finally {
        if (!runtime.ready) runtime.initPromise = null;
      }
    })();

    return runtime.initPromise;
  }

  function canonicalProfile(user, source = {}) {
    return {
      uid: user.uid,
      displayName: String(source.displayName || source.name || source.nombre || user.displayName || "").slice(0, 120),
      email: String(user.email || source.email || "").toLowerCase(),
      role: normalizeRole(source.role ?? source.rol ?? source.tipoUsuario ?? source.userRole),
      active: source.active !== false,
      emailVerified: Boolean(user.emailVerified),
      phone: String(source.phone || "").slice(0, 40),
      neighborhood: String(source.neighborhood || "").slice(0, 120)
    };
  }

  async function readProfile(user) {
    const { doc, getDoc } = runtime.modules.firestore;
    const uidSnapshot = await getDoc(doc(runtime.db, "users", user.uid));
    if (uidSnapshot.exists()) {
      return { data: uidSnapshot.data(), docId: user.uid, source: "uid" };
    }

    if (user.email) {
      const legacySnapshot = await getDoc(doc(runtime.db, "users", user.email));
      if (legacySnapshot.exists()) {
        return { data: legacySnapshot.data(), docId: user.email, source: "email_legacy" };
      }
    }
    return null;
  }

  async function createGuestProfile(user, values = {}) {
    const { doc, setDoc, serverTimestamp } = runtime.modules.firestore;
    const profile = canonicalProfile(user, { ...values, role: "guest", active: true });
    await setDoc(doc(runtime.db, "users", user.uid), {
      ...profile,
      role: "guest",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    }, { merge: false });
    return { data: profile, docId: user.uid, source: "created_guest" };
  }

  async function migrateLegacyProfile(user, legacy) {
    const { doc, setDoc, serverTimestamp } = runtime.modules.firestore;
    const profile = canonicalProfile(user, legacy.data || {});
    await setDoc(doc(runtime.db, "users", user.uid), {
      ...profile,
      migratedFrom: legacy.docId,
      migratedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp()
    }, { merge: true });
    return { data: profile, docId: user.uid, source: "migrated_to_uid" };
  }

  async function handleAuthState(user, options = {}) {
    runtime.user = user || null;
    runtime.profile = null;
    runtime.profileSource = "";
    runtime.profileError = null;
    runtime.role = null;
    runtime.canWrite = false;
    runtime.isSuperAdmin = false;

    if (!user) {
      emit("firebase:auth", authDetail(options));
      return;
    }

    try {
      let profile = await readProfile(user);
      if (!profile) profile = await createGuestProfile(user);
      if (profile.source === "email_legacy") {
        profile = await migrateLegacyProfile(user, profile);
      }

      const canonical = canonicalProfile(user, profile.data || {});
      runtime.profile = { ...canonical, docId: profile.docId };
      runtime.profileSource = profile.source;
      runtime.role = canonical.role;
      runtime.canWrite = canonical.active && EDITOR_ROLES.has(canonical.role);
      runtime.isSuperAdmin = canonical.active && canonical.role === "super_admin";

      const { doc, setDoc, serverTimestamp } = runtime.modules.firestore;
      await setDoc(doc(runtime.db, "users", user.uid), {
        displayName: canonical.displayName,
        email: canonical.email,
        emailVerified: Boolean(user.emailVerified),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(() => {});
    } catch (error) {
      runtime.lastError = error;
      runtime.profileError = error;
      console.warn("[Firebase] No fue posible leer el perfil del usuario.", error);
    }

    emit("firebase:auth", authDetail(options));
  }

  async function signInEmail(email, password) {
    if (!runtime.ready) await init();
    ensureReady();
    const credential = await runtime.modules.auth.signInWithEmailAndPassword(
      runtime.auth,
      String(email || "").trim(),
      String(password || "")
    );
    await handleAuthState(credential.user, { reason: "email_login" });
    return credential;
  }

  async function signInGoogle() {
    if (!runtime.ready) await init();
    ensureReady();
    const provider = new runtime.modules.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await runtime.modules.auth.signInWithPopup(runtime.auth, provider);
    await handleAuthState(credential.user, { reason: "google_login" });
    return credential;
  }

  async function registerEmail(values = {}) {
    if (!runtime.ready) await init();
    ensureReady();
    const displayName = String(values.displayName || "").trim();
    const email = String(values.email || "").trim().toLowerCase();
    const password = String(values.password || "");
    if (displayName.length < 3) throw new Error("Escriba su nombre completo.");
    if (password.length < 8) {
      const error = new Error("La contraseña debe tener al menos 8 caracteres.");
      error.code = "auth/weak-password";
      throw error;
    }

    const credential = await runtime.modules.auth.createUserWithEmailAndPassword(runtime.auth, email, password);
    await runtime.modules.auth.updateProfile(credential.user, { displayName });
    await createGuestProfile(credential.user, values);
    await runtime.modules.auth.sendEmailVerification(credential.user).catch(error =>
      console.warn("[Firebase] Cuenta creada sin correo de verificación.", error)
    );
    await handleAuthState(credential.user, { reason: "registration" });
    return credential;
  }

  async function resendVerification() {
    ensureReady();
    if (!runtime.auth.currentUser) throw new Error("Debe iniciar sesión.");
    await runtime.modules.auth.sendEmailVerification(runtime.auth.currentUser);
  }

  async function sendPasswordReset(email) {
    if (!runtime.ready) await init();
    ensureReady();
    const value = String(email || "").trim();
    if (!value) throw new Error("Escriba el correo de la cuenta.");
    await runtime.modules.auth.sendPasswordResetEmail(runtime.auth, value);
  }

  async function updateOwnProfile(values = {}) {
    ensureReady();
    const user = runtime.auth.currentUser;
    if (!user) throw new Error("Debe iniciar sesión.");
    const displayName = String(values.displayName || "").trim().slice(0, 120);
    if (displayName) await runtime.modules.auth.updateProfile(user, { displayName });
    const { doc, setDoc, serverTimestamp } = runtime.modules.firestore;
    await setDoc(doc(runtime.db, "users", user.uid), {
      displayName: displayName || user.displayName || "",
      phone: String(values.phone || "").slice(0, 40),
      neighborhood: String(values.neighborhood || "").slice(0, 120),
      updatedAt: serverTimestamp()
    }, { merge: true });
    await handleAuthState(user, { reason: "profile_update" });
  }

  async function signOutUser() {
    if (!runtime.auth) return;
    await runtime.modules.auth.signOut(runtime.auth);
  }

  async function listUserProfiles() {
    if (!runtime.ready) await init();
    ensureReady();
    if (!runtime.isSuperAdmin) {
      const error = new Error("Solo el superadministrador puede consultar usuarios.");
      error.code = "permission-denied";
      throw error;
    }
    const { collection, getDocs } = runtime.modules.firestore;
    const snapshot = await getDocs(collection(runtime.db, "users"));
    const byIdentity = new Map();
    snapshot.docs.forEach(item => {
      const data = item.data();
      const profile = {
        docId: item.id,
        uid: data.uid || (item.id.includes("@") ? "" : item.id),
        displayName: data.displayName || data.name || data.nombre || "Usuario sin nombre",
        email: data.email || (item.id.includes("@") ? item.id : ""),
        role: normalizeRole(data.role ?? data.rol ?? data.tipoUsuario ?? data.userRole),
        roleLabel: roleLabel(data.role ?? data.rol ?? data.tipoUsuario ?? data.userRole),
        active: data.active !== false,
        emailVerified: Boolean(data.emailVerified),
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || "",
        lastLoginAt: data.lastLoginAt?.toDate?.()?.toISOString?.() || "",
        legacy: item.id.includes("@")
      };
      const key = profile.email || profile.uid || profile.docId;
      const current = byIdentity.get(key);
      if (!current || (current.legacy && !profile.legacy)) byIdentity.set(key, profile);
    });
    const order = { super_admin: 0, admin: 1, editor: 2, guest: 3 };
    return [...byIdentity.values()].sort((a, b) =>
      (order[a.role] - order[b.role]) || a.displayName.localeCompare(b.displayName, "es")
    );
  }

  async function updateUserAccess(profile, values = {}) {
    if (!runtime.ready) await init();
    ensureReady();
    if (!runtime.isSuperAdmin) {
      const error = new Error("Solo el superadministrador puede cambiar roles.");
      error.code = "permission-denied";
      throw error;
    }

    const target = typeof profile === "string" ? { docId: profile } : profile;
    const role = normalizeRole(values.role);
    const active = values.active !== false;
    const targetId = target.uid || (!String(target.docId || "").includes("@") ? target.docId : "");
    if (!targetId) throw new Error("El usuario debe iniciar sesión una vez para generar su identificador UID.");

    const isCurrent = targetId === runtime.user?.uid;
    if (isCurrent && (role !== "super_admin" || !active)) {
      throw new Error("No puede quitarse su propio rol de superadministrador ni desactivar su cuenta.");
    }

    const { doc, setDoc, serverTimestamp, addDoc, collection } = runtime.modules.firestore;
    await setDoc(doc(runtime.db, "users", targetId), {
      uid: targetId,
      email: String(target.email || "").toLowerCase(),
      displayName: String(target.displayName || "").slice(0, 120),
      role,
      active,
      updatedAt: serverTimestamp(),
      updatedBy: runtime.user.uid
    }, { merge: true });

    await addDoc(collection(runtime.db, "auditLogs"), {
      action: "user_access_update",
      targetUserId: targetId,
      targetEmail: target.email || "",
      role,
      active,
      userId: runtime.user.uid,
      email: runtime.user.email || "",
      createdAt: serverTimestamp(),
      page: location.pathname
    }).catch(() => {});

    if (isCurrent) await handleAuthState(runtime.auth.currentUser, { reason: "access_update" });
    emit("firebase:users", { action: "updated", profile: { ...target, uid: targetId, role, active } });
    return { ...target, uid: targetId, role, active };
  }

  function safeJson(value, section) {
    let json;
    try {
      json = JSON.stringify(value, (_key, item) => {
        if (typeof item === "number" && !Number.isFinite(item)) return null;
        if (typeof item === "function" || typeof item === "symbol" || item === undefined) return null;
        return item;
      });
    } catch (error) {
      if (!error.code) error.code = "firebase/invalid-json";
      throw error;
    }
    if (json === undefined) json = "null";
    const bytes = new TextEncoder().encode(json).length;
    if (bytes > MAX_SECTION_BYTES) {
      const error = new Error(`La sección ${section} pesa ${Math.ceil(bytes / 1024)} KB.`);
      error.code = "firebase/section-too-large";
      error.section = section;
      error.bytes = bytes;
      throw error;
    }
    return { json, bytes };
  }

  function parseSection(payload, fallback) {
    if (typeof payload !== "string") return fallback;
    try {
      const value = JSON.parse(payload);
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function decodeLegacyValue(value) {
    if (Array.isArray(value)) return value.map(decodeLegacyValue);
    if (!value || typeof value !== "object") return value;
    if (value.spEncodedType === "array-v2" && Array.isArray(value.spEncodedItems)) {
      return value.spEncodedItems.map(decodeLegacyValue);
    }
    if (value.spEncodedType === "map-v2" && Array.isArray(value.spEncodedEntries)) {
      return Object.fromEntries(value.spEncodedEntries
        .filter(entry => entry && typeof entry.key === "string")
        .map(entry => [entry.key, decodeLegacyValue(entry.value)]));
    }
    if (Array.isArray(value.__sp_firestore_array_v1__)) {
      return value.__sp_firestore_array_v1__.map(decodeLegacyValue);
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeLegacyValue(item)]));
  }

  function cloudSections() {
    const state = portal()?.state;
    if (!state) throw new Error("El estado del portal no está disponible.");
    return Object.fromEntries(SECTION_KEYS.map(key => [key, state[key]]));
  }

  function sanitizeIdea(idea = {}) {
    return {
      title: String(idea.title || "").slice(0, 120),
      author: String(idea.author || "").slice(0, 120),
      location: String(idea.location || "").slice(0, 120),
      category: String(idea.category || "").slice(0, 80),
      description: String(idea.description || "").slice(0, 1200),
      status: String(idea.status || "recibida").slice(0, 40),
      response: String(idea.response || "").slice(0, 2500),
      votes: Math.max(0, Number(idea.votes || 0) || 0),
      created: String(idea.created || new Date().toLocaleDateString("es-CO")).slice(0, 80),
      createdBy: String(idea.createdBy || "").slice(0, 128),
      createdByEmail: String(idea.createdByEmail || "").slice(0, 254)
    };
  }

  function fingerprintIdeas(items) {
    return JSON.stringify((Array.isArray(items) ? items : []).map(item => ({ id: item.id, ...sanitizeIdea(item) })));
  }

  async function hydrateFromCloud() {
    if (!runtime.db || !portal()) return false;
    try {
      const { collection, getDocs, doc, getDoc } = runtime.modules.firestore;
      const [sectionSnapshot, ideaSnapshot, metaSnapshot] = await Promise.all([
        getDocs(collection(runtime.db, "portalState")),
        getDocs(collection(runtime.db, "ideas")),
        getDoc(doc(runtime.db, "portal", "meta"))
      ]);

      const state = portal().state;
      let loadedSections = 0;
      sectionSnapshot.docs.forEach(item => {
        if (!SECTION_KEYS.includes(item.id)) return;
        const parsed = parseSection(item.data().payload, state[item.id]);
        state[item.id] = parsed;
        loadedSections += 1;
      });

      if (!loadedSections) {
        const legacySnapshot = await getDoc(doc(runtime.db, "portal", "main"));
        if (legacySnapshot.exists()) {
          const legacy = decodeLegacyValue(legacySnapshot.data());
          SECTION_KEYS.forEach(key => {
            if (legacy[key] !== undefined) state[key] = legacy[key];
          });
          loadedSections = 1;
        }
      }

      const cloudIdeas = ideaSnapshot.docs.map(item => ({ id: item.id, ...sanitizeIdea(item.data()) }));
      if (cloudIdeas.length) state.ideas = cloudIdeas;
      runtime.ideasFingerprint = fingerprintIdeas(state.ideas);

      if (loadedSections || cloudIdeas.length) {
        portal().helpers.save({ localOnly: true });
        portal().applySettings();
        const remoteVersion = Number(metaSnapshot.data()?.updatedAtMs || 0);
        if (remoteVersion) localStorage.setItem("sp_v12_cloud_version", String(remoteVersion));
        emit("firebase:data", { source: "cloud", remoteVersion, schemaVersion: SCHEMA_VERSION });
        return true;
      }
      return false;
    } catch (error) {
      runtime.lastError = error;
      console.warn("[Firebase] Lectura pública no disponible.", error);
      return false;
    }
  }

  function queueSync() {
    if (!runtime.canWrite) return;
    clearTimeout(runtime.syncTimer);
    runtime.syncTimer = setTimeout(() => {
      pushAll().catch(error => {
        runtime.lastError = error;
        emit("firebase:sync", { status: "error", error: friendlyError(error), code: error?.code || "" });
        portal()?.helpers.toast(friendlyError(error));
      });
    }, 700);
  }

  async function commitIdeaChanges(items) {
    const { collection, getDocs, doc, writeBatch, serverTimestamp } = runtime.modules.firestore;
    const existing = await getDocs(collection(runtime.db, "ideas"));
    const current = new Map(items.filter(item => item?.id).map(item => [String(item.id), item]));
    const operations = [];

    existing.docs.forEach(item => {
      if (!current.has(item.id)) operations.push({ type: "delete", ref: item.ref });
    });
    current.forEach((item, id) => {
      operations.push({
        type: "set",
        ref: doc(runtime.db, "ideas", id),
        data: { ...sanitizeIdea(item), updatedAt: serverTimestamp() }
      });
    });

    for (let start = 0; start < operations.length; start += 450) {
      const batch = writeBatch(runtime.db);
      operations.slice(start, start + 450).forEach(operation => {
        if (operation.type === "delete") batch.delete(operation.ref);
        else batch.set(operation.ref, operation.data, { merge: true });
      });
      await batch.commit();
    }
  }

  async function pushAll(options = {}) {
    if (!runtime.ready) await init();
    ensureReady();
    if (!runtime.canWrite) {
      const error = new Error("La cuenta no tiene permisos de edición.");
      error.code = "permission-denied";
      throw error;
    }
    if (runtime.syncing) {
      runtime.syncPending = true;
      return;
    }

    runtime.syncing = true;
    runtime.syncPending = false;
    emit("firebase:sync", { status: "saving" });

    try {
      const { doc, writeBatch, serverTimestamp, addDoc, collection } = runtime.modules.firestore;
      const sections = cloudSections();
      const prepared = Object.fromEntries(
        SECTION_KEYS.map(key => [key, safeJson(sections[key], key)])
      );
      const updatedAtMs = Date.now();
      const batch = writeBatch(runtime.db);

      SECTION_KEYS.forEach(key => {
        batch.set(doc(runtime.db, "portalState", key), {
          payload: prepared[key].json,
          bytes: prepared[key].bytes,
          schemaVersion: SCHEMA_VERSION,
          updatedAt: serverTimestamp(),
          updatedAtMs,
          updatedBy: runtime.user.uid,
          updatedByEmail: runtime.user.email || ""
        }, { merge: false });
      });
      batch.set(doc(runtime.db, "portal", "meta"), {
        schemaVersion: SCHEMA_VERSION,
        storageFormat: "section-json-v1",
        sections: [...SECTION_KEYS],
        updatedAt: serverTimestamp(),
        updatedAtMs,
        updatedBy: runtime.user.uid,
        updatedByEmail: runtime.user.email || ""
      }, { merge: false });
      await batch.commit();

      const currentIdeas = Array.isArray(portal().state.ideas) ? portal().state.ideas : [];
      const currentFingerprint = fingerprintIdeas(currentIdeas);
      if (currentFingerprint !== runtime.ideasFingerprint) {
        await commitIdeaChanges(currentIdeas);
        runtime.ideasFingerprint = currentFingerprint;
      }

      addDoc(collection(runtime.db, "auditLogs"), {
        action: options.action || "portal_sync",
        userId: runtime.user.uid,
        email: runtime.user.email || "",
        createdAt: serverTimestamp(),
        page: location.pathname,
        schemaVersion: SCHEMA_VERSION,
        totalBytes: Object.values(prepared).reduce((sum, item) => sum + item.bytes, 0)
      }).catch(() => {});

      localStorage.setItem("sp_v12_cloud_version", String(updatedAtMs));
      emit("firebase:sync", { status: "saved", at: updatedAtMs, schemaVersion: SCHEMA_VERSION });
      portal()?.helpers.toast("Cambios sincronizados con Firestore.");
    } finally {
      runtime.syncing = false;
      if (runtime.syncPending) {
        runtime.syncPending = false;
        queueSync();
      }
    }
  }

  async function createPublicIdea(idea) {
    if (!runtime.ready) await init();
    ensureReady();
    const { doc, setDoc, serverTimestamp } = runtime.modules.firestore;
    const payload = sanitizeIdea({
      ...idea,
      status: "recibida",
      response: "",
      votes: 0,
      createdBy: runtime.user?.uid || "",
      createdByEmail: runtime.user?.email || ""
    });
    await setDoc(doc(runtime.db, "ideas", String(idea.id)), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: false });
    runtime.ideasFingerprint = fingerprintIdeas(portal()?.state?.ideas || []);
    return payload;
  }

  async function uploadFile(file, path, options = {}) {
    if (!runtime.ready) await init();
    if (!runtime.canWrite) {
      const error = new Error("La cuenta no tiene permiso para subir archivos.");
      error.code = "permission-denied";
      throw error;
    }
    if (!window.DrivePortal) throw new Error("Google Drive todavía no se encuentra disponible.");
    return window.DrivePortal.uploadFile(file, path, options);
  }

  async function uploadDataUrl(dataUrl, path, options = {}) {
    if (!runtime.ready) await init();
    if (!runtime.canWrite) {
      const error = new Error("La cuenta no tiene permiso para subir imágenes.");
      error.code = "permission-denied";
      throw error;
    }
    if (!window.DrivePortal) throw new Error("Google Drive todavía no se encuentra disponible.");
    return window.DrivePortal.uploadDataUrl(dataUrl, path, options);
  }

  window.addEventListener("online", async () => {
    runtime.connected = true;
    if (runtime.db && runtime.modules?.firestore?.enableNetwork) {
      await runtime.modules.firestore.enableNetwork(runtime.db).catch(() => {});
    }
    emit("firebase:connection", { connected: true, transport: runtime.transport });
    hydrateFromCloud();
  });

  window.addEventListener("offline", () => {
    runtime.connected = false;
    emit("firebase:connection", { connected: false, transport: runtime.transport });
  });

  window.FirebasePortal = {
    init,
    signInEmail,
    signInGoogle,
    registerEmail,
    resendVerification,
    sendPasswordReset,
    updateOwnProfile,
    signOut: signOutUser,
    hydrateFromCloud,
    pushAll,
    queueSync,
    createPublicIdea,
    uploadFile,
    uploadDataUrl,
    listUserProfiles,
    updateUserAccess,
    normalizeRole,
    roleLabel,
    friendlyError,
    auditPayload: () => {
      const sections = cloudSections();
      const report = Object.fromEntries(SECTION_KEYS.map(key => {
        const prepared = safeJson(sections[key], key);
        return [key, { bytes: prepared.bytes, kilobytes: Math.ceil(prepared.bytes / 1024) }];
      }));
      return {
        ok: true,
        schemaVersion: SCHEMA_VERSION,
        storageFormat: "section-json-v1",
        sections: report,
        totalBytes: Object.values(report).reduce((sum, item) => sum + item.bytes, 0)
      };
    },
    canWrite: () => runtime.canWrite,
    isSuperAdmin: () => runtime.isSuperAdmin,
    getStatus: () => ({ ...runtime, roleLabel: roleLabel(runtime.role) })
  };
})();
