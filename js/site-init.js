(function init() {
  renderAllDynamicSections();
  loadSiteContentFromServer();
  assignDirectEditableElements();
  applyDirectText();
  applyEditableAssets();
  bindAdminForms();
  wireDirectEditInteractions();
  setupAdminPanel();
  setupScrollAndReveal();
  setupFullGalleryModal();
  setupGalleryLightbox();
  setupCursorGlow();
  setupFeaturedMedia();
  setupIndexInfoPopup();
})();
