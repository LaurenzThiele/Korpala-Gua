// =====================================================
// admin-script.js
// =====================================================

// (1) Immediately hide overlay before anything else
const overlayElem = document.getElementById('adminLoginOverlay');
if (overlayElem) overlayElem.style.display = 'none';

// (2) 1) Supabase client (window.ENV is provided by your config.js)
const supabaseClient = supabase.createClient(
  window.ENV.SUPABASE_URL,
  window.ENV.SUPABASE_ANON_KEY
);

// ===== Admin Auth Overlay: lock UI until login =====
document.addEventListener('DOMContentLoaded', () => {
  hideForms();
  const overlay = document.getElementById('adminLoginOverlay');
  const loginForm = document.getElementById('adminLoginForm');
  const emailInput = document.getElementById('adminLoginEmail');
  const pwInput = document.getElementById('adminLoginPassword');
  const errorDiv = document.getElementById('adminLoginError');
  document.body.classList.add('admin-locked');
  addFormContainer.classList.add('hidden');
  editFormContainer.classList.add('hidden');

  // Helper to show/hide overlay
  function showOverlay() { overlay.style.display = 'flex'; document.body.classList.add('admin-locked'); }
  function hideOverlay() { overlay.style.display = 'none'; document.body.classList.remove('admin-locked'); }

  // Session check (do NOT show overlay until check is complete)
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      hideOverlay();
      hideForms();
    } else {
      showOverlay();
    }
  });

  // Login form handler
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.textContent = '';
    const email = emailInput.value.trim();
    const password = pwInput.value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorDiv.textContent = 'Login gagal: ' + (error.message || error);
    } else {
      hideOverlay();
      addFormContainer.classList.remove('hidden');
      editFormContainer.classList.add('hidden');
      setStatus('Logged in');
    }
  });
  // If logged out mid-session, show overlay again
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (!session) showOverlay();
  });
});

// 2) DOM references
const addFormContainer = document.getElementById('addFormContainer');
const editFormContainer = document.getElementById('editFormContainer');

const addCaveForm = document.getElementById('addCaveForm');
const editCaveForm = document.getElementById('editCaveForm');

const editSelect = document.getElementById('editSelect');
const btnModeAdd = document.getElementById('btnModeAdd');

const btnDelete = document.getElementById('btnDelete');
const statusEl = document.getElementById('status');

let cavesData = []; // cached list
let editMarker = null; // marker reference for edit form
let addMarker = null; // marker reference for add form
let utmFieldListeners = { x: null, y: null }; // store listener references for edit form
let addUtmFieldListeners = { x: null, y: null }; // store listener references for add form

function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after delay
  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function setStatus(msg, isError = false) {
  if (!msg) return;
  showToast(msg, isError ? "error" : "success");
}

// =====================================================
// Fetch caves and populate edit select
// =====================================================
async function loadCaves() {
  const { data, error } = await supabaseClient
    .from('caves')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Supabase fetch error', error);
    setStatus('Error loading caves', true);
    return;
  }

  cavesData = data || [];

  editSelect.innerHTML = '<option value="">Edit Gua</option>';

  // populate select
  cavesData.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (Id: ${c.id})`;
    editSelect.appendChild(opt);
  });
}

// compute next id like "001"
function computeNextId() {
  if (!cavesData || cavesData.length === 0) return '001';
  const max = Math.max(...cavesData.map(c => parseInt(c.id, 10) || 0));
  return String(max + 1).padStart(3, '0');
}

// =====================================================
// UI helpers: show add or edit form
// =====================================================
function showAddForm() {
  addFormContainer.classList.remove('hidden');
  editFormContainer.classList.add('hidden');
  // reset add form and fill default id if you want to display it somewhere
  addCaveForm.reset();
  // Clear preview
  const previewContainer = document.getElementById('add_caveImagePreview');
  if (previewContainer) {
    previewContainer.innerHTML = '';
    previewContainer.classList.add('hidden');
  }
  // optionally show next id in status or a hidden field — we compute on submit
  
  // Initialize map for add form
  initAddFormMap();
}

// Initialize map for add form
function initAddFormMap() {
  // Remove old map instance if exists
  if (window.addMap) {
    window.addMap.remove();
    window.addMap = null;
  }

  // Remove old marker if exists
  if (addMarker) {
    addMarker.remove();
    addMarker = null;
  }

  // Remove old event listeners from UTM fields
  const addXField = document.getElementById('add_x');
  const addYField = document.getElementById('add_y');
  if (addUtmFieldListeners.x && addXField) {
    addXField.removeEventListener('input', addUtmFieldListeners.x);
    addXField.removeEventListener('change', addUtmFieldListeners.x);
  }
  if (addUtmFieldListeners.y && addYField) {
    addYField.removeEventListener('input', addUtmFieldListeners.y);
    addYField.removeEventListener('change', addUtmFieldListeners.y);
  }

  // Create a custom black icon
  var blackIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // Default center (Indonesia - approximate center)
  // If UTM fields have values, use them; otherwise use default
  let defaultLon, defaultLat, defaultZoom;
  
  if (addXField && addYField && addXField.value && addYField.value) {
    const utm_x = parseFloat(addXField.value);
    const utm_y = parseFloat(addYField.value);
    if (!isNaN(utm_x) && !isNaN(utm_y)) {
      [defaultLon, defaultLat] = proj4(UTM51S, WGS84, [utm_x, utm_y]);
      defaultZoom = 12;
    } else {
      [defaultLon, defaultLat] = [118, -2.5]; // Default location
      defaultZoom = 5;
    }
  } else {
    [defaultLon, defaultLat] = [118, -2.5]; // Default location
    defaultZoom = 5;
  }

  // Indonesia bounding box
  const bounds = [
      [-12, 90],
      [7, 145]
  ];


  // Init map
  window.addMap = L.map('add_map', {
    minZoom: 5,
    maxZoom: 14,
    maxBounds: bounds,
    scrollWheelZoom: false
  });

  // Set view
  window.addMap.setView([defaultLat, defaultLon], defaultZoom);

  // Add tile layer
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenTopoMap contributors'
  }).addTo(window.addMap);

  // Add draggable marker
  addMarker = L.marker([defaultLat, defaultLon], { 
    icon: blackIcon,
    draggable: true 
  }).addTo(window.addMap);

  // Listen to marker drag events
  addMarker.on('dragend', updateAddUTMFromMarker);

  // Add event listeners to UTM fields
  if (addXField) {
    addUtmFieldListeners.x = updateAddMarkerFromUTM;
    addXField.addEventListener('input', updateAddMarkerFromUTM);
    addXField.addEventListener('change', updateAddMarkerFromUTM);
  }
  if (addYField) {
    addUtmFieldListeners.y = updateAddMarkerFromUTM;
    addYField.addEventListener('input', updateAddMarkerFromUTM);
    addYField.addEventListener('change', updateAddMarkerFromUTM);
  }

  // Enable zoom only while holding CTRL (same behavior as edit form)
  window.addMap.scrollWheelZoom.disable();

  document.addEventListener('keydown', (e) => {
    if (e.key === "Control" && window.addMap)
      window.addMap.getContainer().classList.add('ctrl-active');
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === "Control" && window.addMap)
      window.addMap.getContainer().classList.remove('ctrl-active');
  });

  window.addMap.getContainer().addEventListener(
    'wheel',
    function (e) {
      if (e.ctrlKey && window.addMap) {
        e.preventDefault();
        window.addMap.scrollWheelZoom.enable();

        clearTimeout(window.addMap._wheelTimeout);
        window.addMap._wheelTimeout = setTimeout(() => {
          window.addMap.scrollWheelZoom.disable();
        }, 200);
      }
    },
    { passive: false }
  );
}

function showEditForm() {
  addFormContainer.classList.add('hidden');
  editFormContainer.classList.remove('hidden');
}

function hideForms() {
  addFormContainer.classList.add('hidden');
  editFormContainer.classList.add('hidden');
}

// =====================================================
// Coordinate conversion helpers for map synchronization
// =====================================================
const UTM51S = '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs';
const WGS84 = '+proj=longlat +datum=WGS84 +no_defs';

// Update UTM fields from marker position
function updateUTMFromMarker() {
  if (!editMarker) return;
  
  const latlng = editMarker.getLatLng();
  const [utm_x, utm_y] = proj4(WGS84, UTM51S, [latlng.lng, latlng.lat]);
  
  // Update input fields (use a flag to prevent infinite loop)
  if (!window._updatingFromMarker) {
    window._updatingFromMarker = true;
    const editXField = document.getElementById('edit_x');
    const editYField = document.getElementById('edit_y');
    if (editXField) editXField.value = Math.round(utm_x);
    if (editYField) editYField.value = Math.round(utm_y);
    window._updatingFromMarker = false;
  }
}

// Update marker position from UTM fields (edit form)
function updateMarkerFromUTM() {
  if (!editMarker || !window.editMap) return;
  if (window._updatingFromMarker) return; // Prevent loop if updating from marker
  
  const editXField = document.getElementById('edit_x');
  const editYField = document.getElementById('edit_y');
  if (!editXField || !editYField) return;
  
  const utm_x = parseFloat(editXField.value);
  const utm_y = parseFloat(editYField.value);
  
  if (isNaN(utm_x) || isNaN(utm_y)) return;
  
  // Convert UTM to WGS84
  const [lon, lat] = proj4(UTM51S, WGS84, [utm_x, utm_y]);
  
  // Update marker position (use a flag to prevent infinite loop)
  if (!window._updatingFromFields) {
    window._updatingFromFields = true;
    editMarker.setLatLng([lat, lon]);
    window.editMap.setView([lat, lon], window.editMap.getZoom());
    window._updatingFromFields = false;
  }
}

// Update UTM fields from marker position (add form)
function updateAddUTMFromMarker() {
  if (!addMarker) return;
  
  const latlng = addMarker.getLatLng();
  const [utm_x, utm_y] = proj4(WGS84, UTM51S, [latlng.lng, latlng.lat]);
  
  // Update input fields (use a flag to prevent infinite loop)
  if (!window._updatingFromAddMarker) {
    window._updatingFromAddMarker = true;
    const addXField = document.getElementById('add_x');
    const addYField = document.getElementById('add_y');
    if (addXField) addXField.value = Math.round(utm_x);
    if (addYField) addYField.value = Math.round(utm_y);
    window._updatingFromAddMarker = false;
  }
}

// Update marker position from UTM fields (add form)
function updateAddMarkerFromUTM() {
  if (!addMarker || !window.addMap) return;
  if (window._updatingFromAddMarker) return; // Prevent loop if updating from marker
  
  const addXField = document.getElementById('add_x');
  const addYField = document.getElementById('add_y');
  if (!addXField || !addYField) return;
  
  const utm_x = parseFloat(addXField.value);
  const utm_y = parseFloat(addYField.value);
  
  if (isNaN(utm_x) || isNaN(utm_y)) return;
  
  // Convert UTM to WGS84
  const [lon, lat] = proj4(UTM51S, WGS84, [utm_x, utm_y]);
  
  // Update marker position (use a flag to prevent infinite loop)
  if (!window._updatingFromAddFields) {
    window._updatingFromAddFields = true;
    addMarker.setLatLng([lat, lon]);
    window.addMap.setView([lat, lon], window.addMap.getZoom());
    window._updatingFromAddFields = false;
  }
}

// =====================================================
// Helper to build image URL from cave id and image_ext
// =====================================================
async function buildImageUrl(id, fileExt) {
  if (!fileExt) return null;

  const filename = `${id}.${fileExt}`;

  const { data, error } = await supabaseClient
    .storage
    .from('cave-images')
    .createSignedUrl(filename, 60); // expires in 60 sec

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}


// =====================================================
// File upload helper (returns {publicUrl, fileExt} or null)
// stores as: cave-images/{id}.{ext}
// =====================================================
async function uploadFileToBucket(file, id) {
  if (!file) return null;

  // restrict accepted types
  const allowed = ['text/html', 'application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const allowedExtensions = ['.png', '.jpeg', '.jpg', '.pdf', '.html'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  // Check by MIME type or extension
  if (!allowed.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    throw new Error('File type not allowed. Allowed: png, jpeg, jpg, pdf, html.');
  }

  // Extract extension without dot for database storage
  const fileExt = fileExtension.substring(1); // remove the leading dot

  // Always overwrite: choose "id" + ext as filename
  const filename = `${id}${fileExtension}`;
  const path = filename;

  // upload
  const { error: uploadError } = await supabaseClient.storage
    .from('cave-images')
    .upload(path, file, { upsert: true }); // allow overwrite

  if (uploadError) throw uploadError;

  // get public url
  const { publicUrl } = supabaseClient.storage
    .from('cave-images')
    .getPublicUrl(path);

  return { publicUrl, fileExt };
}

// =====================================================
// Delete file from bucket based on id and file_ext
// =====================================================
async function deleteFileFromBucket(filename) {
  if (!filename) return;
  
  try {
    const { error } = await supabaseClient.storage
      .from('cave-images')
      .remove([filename]);
    
    if (error) {
      console.error('Error deleting file from bucket:', error);
      // Don't throw - file might not exist
    }
  } catch (e) {
    console.error('Error deleting file:', e);
    // Don't throw - continue with cave deletion
  }
}


// =====================================================
// Show loading overlay
// =====================================================
function startLoading(previewContainerId) {
    const previewContainer = document.getElementById(previewContainerId);
    if (!previewContainer) return;

    previewContainer.innerHTML = ''; // Clear existing content

    const loading = document.createElement('div');
    loading.classList.add('loading-overlay'); // class for styling

    previewContainer.appendChild(loading);
    previewContainer.classList.remove('hidden');
}

// =====================================================
// Remove loading overlay
// =====================================================
function stopLoading(previewContainerId) {
    const previewContainer = document.getElementById(previewContainerId);
    if (!previewContainer) return;

    const loading = previewContainer.querySelector('.loading-overlay');
    if (loading) loading.remove();
}

// =====================================================
// Display file preview (local file version of displayExistingFile)
// =====================================================
async function displayFilePreview(file, previewContainerId) {
    const previewContainer = document.getElementById(previewContainerId);
    startLoading(previewContainerId);

    if (!file) {
        previewContainer.classList.add('hidden');
        stopLoading(previewContainerId);
        return;
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    // =====================================================
    // IMAGE (local)
    // =====================================================
    if (
        fileType.startsWith('image/') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg')
    ) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Preview';

        img.style.opacity = 0;

        img.onload = () => {
            img.style.opacity = 1;
            stopLoading(previewContainerId);
            previewContainer.appendChild(img);
        };

        img.onerror = () => {
            stopLoading(previewContainerId);
        };

        return;
    }

    // =====================================================
    // PDF (local)
    // =====================================================
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        const pdfWrapper = document.createElement('div');
        pdfWrapper.classList.add('pdf-viewer');
        pdfWrapper.style.maxHeight = '70vh';
        pdfWrapper.style.width = '100%';
        pdfWrapper.style.overflow = 'hidden';

        pdfWrapper.style.opacity = 0;

        const buffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdfDoc.getPage(1);

        const viewport = page.getViewport({ scale: 1.2 });

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        pdfWrapper.appendChild(canvas);

        await page.render({ canvasContext: ctx, viewport }).promise;

        const wrapperHeight = Math.min(window.innerHeight * 0.7, viewport.height);
        const scaleFactor = wrapperHeight / canvas.height;

        canvas.style.width = canvas.width * scaleFactor + 'px';
        canvas.style.height = canvas.height * scaleFactor + 'px';

        // fade-in
        pdfWrapper.style.opacity = 1;

        stopLoading(previewContainerId);
        previewContainer.appendChild(pdfWrapper);
        return;
    }

    // =====================================================
    // HTML (local)
    // =====================================================
    if (fileType === 'text/html' || fileName.endsWith('.html')) {
        const reader = new FileReader();

        reader.onload = (e) => {
            let htmlContent = e.target.result;

            const baseUrl =
                window.location.origin +
                window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);

            if (!/<base\s+[^>]*>/i.test(htmlContent)) {
                if (/<\/head>/i.test(htmlContent)) {
                    htmlContent = htmlContent.replace(/<\/head>/i, `<base href="${baseUrl}"></head>`);
                } else if (/<head[^>]*>/i.test(htmlContent)) {
                    htmlContent = htmlContent.replace(/(<head[^>]*>)/i, `$1<base href="${baseUrl}">`);
                } else {
                    htmlContent = `<base href="${baseUrl}">${htmlContent}`;
                }
            }

            const iframe = document.createElement('iframe');
            iframe.setAttribute('scrolling', 'no');
            iframe.style.border = 'none';

            iframe.style.opacity = 0;

            iframe.onload = () => {
               try {
                  const doc = iframe.contentDocument || iframe.contentWindow.document;
                  const contentHeight = doc.body.scrollHeight;

                  // clamp to 70vh or content height
                  let height = Math.min(contentHeight, window.innerHeight * 0.7);

                  // enforce minimum height
                  height = Math.max(height, 450);

                  iframe.style.height = height + 'px';
                  iframe.style.width = Math.min(previewContainer.clientWidth, height * 16 / 9) + 'px';

              } catch (e) {
                  // fallback: 70vh, but still enforce minimum 450px
                  let height = Math.min(window.innerHeight * 0.7, window.innerHeight * 0.7);

                  height = Math.max(height, 450);

                  iframe.style.height = height + 'px';
                  iframe.style.width = Math.min(previewContainer.clientWidth, height * 16 / 9) + 'px';
              }

                iframe.style.opacity = 1;

                stopLoading(previewContainerId);
            };

            previewContainer.appendChild(iframe);

            iframe.srcdoc = htmlContent;
        };

        reader.readAsText(file);
        return;
    }

    // Unknown file type
    previewContainer.classList.add('hidden');
    stopLoading(previewContainerId);
}



// =====================================================
// Display existing file from URL
// =====================================================
function displayExistingFile(url, previewContainerId) {
    const previewContainer = document.getElementById(previewContainerId);
    startLoading(previewContainerId);

    if (!url) {
        previewContainer.classList.add('hidden');
        stopLoading(previewContainerId);
        return;
    }

    let pathname;
    try {
        pathname = new URL(url).pathname.toLowerCase();
    } catch {
        pathname = url.toLowerCase();
    }

    // -------- IMAGE --------
    if (pathname.match(/\.(png|jpg|jpeg)$/i)) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Cave Image';
        // Append only when successfully loaded
        img.onload = () => {
            stopLoading(previewContainerId);
            previewContainer.appendChild(img);
        };

        // Stop loading if error occurs, but do not append image
        img.onerror = () => {
            stopLoading(previewContainerId);
            // Optionally show an error message
            // previewContainer.textContent = 'Failed to load image';
        };
        return;
    }

    // -------- PDF --------
    if (pathname.endsWith('.pdf')) {
        const pdfWrapper = document.createElement('div');
        pdfWrapper.classList.add('pdf-viewer');
        pdfWrapper.style.maxHeight = '70vh';
        pdfWrapper.style.width = '100%';
        pdfWrapper.style.overflow = 'hidden';

        const safeUrl = url + (url.includes("?") ? "&download=1" : "?download=1");

        pdfjsLib.getDocument(safeUrl).promise.then(pdfDoc => {
            pdfDoc.getPage(1).then(page => {
                const viewport = page.getViewport({ scale: 1.2 });
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                pdfWrapper.appendChild(canvas);

                page.render({ canvasContext: context, viewport }).promise.then(() => {
                    const wrapperHeight = Math.min(window.innerHeight * 0.7, viewport.height);
                    const scaleFactor = wrapperHeight / canvas.height;
                    canvas.style.width = canvas.width * scaleFactor + 'px';
                    canvas.style.height = canvas.height * scaleFactor + 'px';

                    // remove loader first
                    stopLoading(previewContainerId);

                    // now append PDF wrapper
                    previewContainer.appendChild(pdfWrapper);
                });
            });
        });
        return;
    }

    // -------- HTML --------
    if (pathname.endsWith('.html')) {

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('HTML not found');
                return response.text();
            })
            .then(htmlContent => {

                const urlObj = new URL(url);
                const baseUrl = urlObj.origin + urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);

                if (!/<base\s+[^>]*>/i.test(htmlContent)) {
                    if (/<\/head>/i.test(htmlContent)) {
                        htmlContent = htmlContent.replace(/<\/head>/i, `<base href="${baseUrl}"></head>`);
                    } else if (/<head[^>]*>/i.test(htmlContent)) {
                        htmlContent = htmlContent.replace(/(<head[^>]*>)/i, `$1<base href="${baseUrl}">`);
                    } else {
                        htmlContent = `<base href="${baseUrl}">${htmlContent}`;
                    }
                }

                const iframe = document.createElement("iframe");
                iframe.setAttribute("scrolling", "no");

                // HIDE IFRAME DURING LOADING
                iframe.style.opacity = 0;

                iframe.onload = () => {
                  try {
                      const doc = iframe.contentDocument || iframe.contentWindow.document;
                      const contentHeight = doc.body.scrollHeight;

                      // clamp to 70vh or content height
                      let height = Math.min(contentHeight, window.innerHeight * 0.7);

                      // enforce minimum height
                      height = Math.max(height, 450);

                      iframe.style.height = height + 'px';
                      iframe.style.width = Math.min(previewContainer.clientWidth, height * 16 / 9) + 'px';

                  } catch (e) {
                      // fallback: 70vh, but still enforce minimum 450px
                      let height = Math.min(window.innerHeight * 0.7, window.innerHeight * 0.7);

                      height = Math.max(height, 450);

                      iframe.style.height = height + 'px';
                      iframe.style.width = Math.min(previewContainer.clientWidth, height * 16 / 9) + 'px';
                  }
                    // NOW SHOW IFRAME
                    iframe.style.opacity = 1;

                    stopLoading(previewContainerId);
                };
                
                previewContainer.appendChild(iframe);
                
                // Trigger load
                iframe.srcdoc = htmlContent;
            })
            .catch(() => {
                previewContainer.innerHTML = '';
                previewContainer.classList.add('hidden');
                stopLoading(previewContainerId);
            });

        return;
    }


    // Default: hide container for unrecognized formats
    previewContainer.classList.add('hidden');
    stopLoading(previewContainerId);
}

// =====================================================
// Collect add form payload
// =====================================================
function collectAddPayload() {
  return {      
    name: document.getElementById('add_name').value.trim(),
    region: document.getElementById('add_region').value.trim(),
    type: document.getElementById('add_type').value.trim(),
    depth_m: Number(document.getElementById('add_depth_m').value) || 0,
    description: document.getElementById('add_description').value || '',
    utm_x: Number(document.getElementById('add_x').value) || 0,
    utm_y: Number(document.getElementById('add_y').value) || 0  };
}

// =====================================================
// Collect edit payload
// =====================================================
function collectEditPayload() {
  return {
    id: document.getElementById('edit_id').value,
    name: document.getElementById('edit_name').value.trim(),
    region: document.getElementById('edit_region').value.trim(),
    type: document.getElementById('edit_type').value.trim(),
    depth_m: Number(document.getElementById('edit_depth_m').value) || 0,
    description: document.getElementById('edit_description').value || '',
    utm_x: Number(document.getElementById('edit_x').value) || 0,
    utm_y: Number(document.getElementById('edit_y').value) || 0
  };
}

// =====================================================
// Add flow: submit addCaveForm
// =====================================================
addCaveForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    // Collect base payload
    const payload = collectAddPayload();

    // Step 1: Insert cave first to get ID
    const { data: insertData, error: insertError } = await supabaseClient
      .from('caves')
      .insert([payload])
      .select()
      .single();

    if (insertError || !insertData) throw insertError || new Error('Insert failed');
    const caveId = insertData.id;

    // Step 2: Check for image upload requirement
    const file = document.getElementById('add_caveImageFile')?.files?.[0];
    if (file) {
      const localExt = file.name.split('.').pop().toLowerCase();

      try {
        // Upload image
        const uploadResult = await uploadFileToBucket(file, caveId);
        const publicUrl = uploadResult.publicUrl;
        const finalExt = uploadResult.imageExt || localExt;

        // Patch cave with image info
        const { error: updateError } = await supabaseClient
          .from('caves')
          .update({
            image_url: publicUrl,
            image_ext: finalExt
          })
          .eq('id', caveId);

        if (updateError) throw updateError;

      } catch (uploadErr) {
        console.error('Image upload failed:', uploadErr);

        // IMPORTANT: delete the cave since upload failed
        await supabaseClient.from('caves').delete().eq('id', caveId);

        // Stop flow completely
        throw new Error('Image upload failed. Cave was not saved.');
      }
    }

    // Step 3: Success
    setStatus('Gua ditambah');
    addCaveForm.reset();
    await loadCaves();
    hideForms();
    initAddFormMap();

  } catch (err) {
    console.error(err);
    setStatus('tambah gua gagal: ' + (err.message || err), true);
  }
});


// =====================================================
// Edit select: when user picks a cave, populate edit form
// =====================================================
editSelect.addEventListener('change', async (e) => {
  const id = e.target.value;
  if (!id) {
    hideForms();
    return;
  }

  const cave = cavesData.find(c => String(c.id) === String(id));
  if (!cave) {
    hideForms();
    return;
  }

  // populate edit form fields
  document.getElementById('edit_id').value = cave.id;
  document.getElementById('edit_name').value = cave.name || '';
  document.getElementById('edit_region').value = cave.region || '';
  document.getElementById('edit_type').value = cave.type || '';
  document.getElementById('edit_depth_m').value = cave.depth_m || '';
  document.getElementById('edit_description').value = cave.description || '';
  document.getElementById('edit_x').value = cave.utm_x ?? '';
  document.getElementById('edit_y').value = cave.utm_y ?? '';

  // Build image URL from cave.file_ext if available
  const imageUrl = cave.image_ext ? await buildImageUrl(cave.id, cave.image_ext) : null;
  if (imageUrl) {
    displayExistingFile(imageUrl, 'edit_caveImagePreview');
  }

  showEditForm();

  // ----------------------------------------------
  // Show Leaflet map inside Edit Form
  // ----------------------------------------------

  // Remove old map instance if exists
  if (window.editMap) {
    window.editMap.remove();
    window.editMap = null;
  }

  // Remove old marker if exists
  if (editMarker) {
    editMarker.remove();
    editMarker = null;
  }

  // Remove old event listeners from UTM fields
  const editXField = document.getElementById('edit_x');
  const editYField = document.getElementById('edit_y');
  if (utmFieldListeners.x && editXField) {
    editXField.removeEventListener('input', utmFieldListeners.x);
    editXField.removeEventListener('change', utmFieldListeners.x);
  }
  if (utmFieldListeners.y && editYField) {
    editYField.removeEventListener('input', utmFieldListeners.y);
    editYField.removeEventListener('change', utmFieldListeners.y);
  }

  // Create a custom black icon
  var blackIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });

  // Convert UTM → WGS84
  const [lon, lat] = proj4(UTM51S, WGS84, [cave.utm_x, cave.utm_y]);

  // Indonesia bounding box
  const bounds = [
      [-12, 90],
      [7, 145]
  ];

  // Init map
  window.editMap = L.map('edit_map', {
    minZoom: 5,
    maxZoom: 14,
    maxBounds: bounds,
    scrollWheelZoom: false
  });

  // Set view
  window.editMap.fitBounds(bounds, { padding: [50, 50] });
  window.editMap.setView([lat, lon], 12);

  // Add tile layer
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenTopoMap contributors'
  }).addTo(window.editMap);

  // Add draggable marker
  editMarker = L.marker([lat, lon], { 
    icon: blackIcon,
    draggable: true 
  }).addTo(window.editMap);

  // Listen to marker drag events
  editMarker.on('dragend', updateUTMFromMarker);

  // Add event listeners to UTM fields
  if (editXField) {
    utmFieldListeners.x = updateMarkerFromUTM;
    editXField.addEventListener('input', updateMarkerFromUTM);
    editXField.addEventListener('change', updateMarkerFromUTM);
  }
  if (editYField) {
    utmFieldListeners.y = updateMarkerFromUTM;
    editYField.addEventListener('input', updateMarkerFromUTM);
    editYField.addEventListener('change', updateMarkerFromUTM);
  }

// ----------------------------------------------
// Enable zoom only while holding CTRL (same behavior)
// ----------------------------------------------
window.editMap.scrollWheelZoom.disable();

document.addEventListener('keydown', (e) => {
    if (e.key === "Control")
        window.editMap.getContainer().classList.add('ctrl-active');
});

document.addEventListener('keyup', (e) => {
    if (e.key === "Control")
        window.editMap.getContainer().classList.remove('ctrl-active');
});

window.editMap.getContainer().addEventListener(
    'wheel',
    function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
            window.editMap.scrollWheelZoom.enable();

            clearTimeout(window.editMap._wheelTimeout);
            window.editMap._wheelTimeout = setTimeout(() => {
                window.editMap.scrollWheelZoom.disable();
            }, 200);
        }
    },
    { passive: false }
);

});

// =====================================================
// Update flow: submit editCaveForm
// =====================================================
editCaveForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const payload = collectEditPayload();
    const file = document.getElementById('edit_caveImageFile')?.files?.[0];

    // Prepare update object (never update id)
    const updateObj = { ...payload };
    delete updateObj.id;

    let publicUrl = null;
    let finalExt = null;

    // =====================================================
    // Handle new image upload FIRST (so if it fails, no DB update happens)
    // =====================================================
    if (file) {
      const localExt = file.name.split('.').pop().toLowerCase();

      try {
        const uploadResult = await uploadFileToBucket(file, payload.id);
        publicUrl = uploadResult.publicUrl;
        finalExt = uploadResult.imageExt || localExt;
      } catch (uploadErr) {
        console.error(uploadErr);
        throw new Error("Image upload failed. Changes were NOT saved.");
      }

      updateObj.image_url = publicUrl;
      updateObj.image_ext = finalExt;
    } else {
      // Do not change existing image fields
      delete updateObj.image_url;
      delete updateObj.image_ext;
    }

    // =====================================================
    // Perform the UPDATE
    // =====================================================
    const { error } = await supabaseClient
      .from('caves')
      .update(updateObj)
      .eq('id', payload.id);

    if (error) throw error;

    // =====================================================
    // Success
    // =====================================================
    setStatus('Gua diperbarui');
    await loadCaves();
    hideForms();

    // Update preview
    if (file) {
      displayFilePreview(file, 'edit_caveImagePreview');
    } else if (updateObj.image_url) {
      displayExistingFile(updateObj.image_url, 'edit_caveImagePreview');
    }

  } catch (err) {
    console.error(err);
    setStatus('Gagal memperbarui gua: ' + (err.message || err), true);
  }
});


// =====================================================
// Delete flow
// =====================================================
btnDelete.addEventListener('click', async (e) => {
  e.preventDefault();

  const id = document.getElementById('edit_id').value;
  const name = document.getElementById('edit_name').value;

  if (!confirm(`Hapus Gua ${name}? Ini tidak dapat dibatalkan.`)) return;

  try {
    // -----------------------------------------------------
    // 1. Get cave record so we know the filename to delete
    // -----------------------------------------------------
    const cave = cavesData.find(c => String(c.id) === String(id));

    // -----------------------------------------------------
    // 2. Delete image from bucket (if exists)
    // -----------------------------------------------------
    if (cave && cave.image_ext) {
      const filename = `${id}.${cave.image_ext}`;
      console.log(filename)
      try {
        await deleteFileFromBucket(filename);
      } catch (fileErr) {
        console.error("Image deletion error:", fileErr);
        // It is usually safe to continue, because:
        // - Cave deletion must not fail just because image could not be deleted
        // - The image is orphaned but harmless
      }
    }

    // -----------------------------------------------------
    // 3. Delete cave record
    // -----------------------------------------------------
    const { error } = await supabaseClient
      .from('caves')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // -----------------------------------------------------
    // 4. Cleanup UI
    // -----------------------------------------------------
    setStatus('Gua dihapus');
    await loadCaves();
    hideForms();

  } catch (err) {
    setStatus('gagal menghapus gua: ' + (err.message || err), true);
  }
});


// =====================================================
// Mode button: Add new cave (you only provided btnModeAdd in HTML)
// If user wants an explicit "Edit mode" button we can add it later.
// =====================================================
btnModeAdd.addEventListener('click', () => {
  editSelect.value = '';
  showAddForm();
});

// =====================================================
// File input change listeners for preview
// =====================================================
const addCaveImageFile = document.getElementById('add_caveImageFile');
const editCaveImageFile = document.getElementById('edit_caveImageFile');

if (addCaveImageFile) {
  addCaveImageFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      displayFilePreview(file, 'add_caveImagePreview');
    } else {
      const previewContainer = document.getElementById('add_caveImagePreview');
      if (previewContainer) previewContainer.innerHTML = '';
    }
  });
}

if (editCaveImageFile) {
  editCaveImageFile.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      displayFilePreview(file, 'edit_caveImagePreview');
    } else {
      // If file input is cleared, show existing file if any
      const id = document.getElementById('edit_id').value;
      if (id) {
        const cave = cavesData.find(c => String(c.id) === String(id));
        if (cave && cave.image_url) {
          displayExistingFile(cave.image_url, 'edit_caveImagePreview');
        } else {
          const previewContainer = document.getElementById('edit_caveImagePreview');
          if (previewContainer) previewContainer.innerHTML = '';
        }
      }
    }
  });
}

// initial load
loadCaves();