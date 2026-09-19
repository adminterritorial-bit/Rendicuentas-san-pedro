(() => {
  "use strict";
  const remove = () => {
    [
      "sanPedroConnected",
      "spDevelopmentJourney",
      "spPublicWorksCorridor",
      "connectedCompare",
      "connectedClosing",
      "connectedAdminDialog"
    ].forEach(id => document.getElementById(id)?.remove());
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded",remove,{once:true});
  } else {
    remove();
  }
})();
