

// =====================================================
// 1) Get URL parameter ?id=001
// =====================================================
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

const caveId = getQueryParam('id');


// =====================================================
// 2) Supabase Client (same as main script)
// =====================================================
const supabaseClient = supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY
);


// =====================================================
// 3) Marker icon
// =====================================================
var blackIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});


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
    return null;
  }

  return data.signedUrl;
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
// 4) Load cave from Supabase
// =====================================================
async function loadCave() {
    const { data: cave, error } = await supabaseClient
        .from("caves")
        .select("*")
        .eq("id", caveId)
        .single();

    if (error || !cave) {
        caveName
        const h1 = document.getElementById("caveName")
        h1.textContent = "Gua tidak ditemukan!";

        const content =  document.getElementById("content-wrapper")
        content.classList.add('hidden');
        return;
    }

    // Convert UTM → WGS84
    const utm51S = '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs';
    const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
    const [lon, lat] = proj4(utm51S, wgs84, [cave.utm_x, cave.utm_y]);


    // =====================================================
    // 5) Fill page content
    // =====================================================
    document.title = 'Korpala | ' + cave.name;
    document.getElementById('caveName').textContent = cave.name;
    document.getElementById('caveRegion').textContent = cave.region;
    document.getElementById('caveType').textContent = cave.type;
    document.getElementById('caveDepth').textContent = cave.depth_m + ' m';
    document.getElementById('caveDesc').textContent = cave.description || '';

    document.getElementById("caveUTM").textContent = cave.utm_x + ', ' + cave.utm_y;
    document.getElementById("caveLatLon").textContent = lat.toFixed(5) + ', ' + lon.toFixed(5);

    if (cave.image_ext) {
        const label = document.getElementById('labelCaveImagePreview');
        const signedUrl = await buildImageUrl(cave.id, cave.image_ext);

        if (signedUrl) {
            displayExistingFile(signedUrl, "caveImagePreview");
            label.classList.remove('hidden');
        }
    }


    // =====================================================
    // 6) Leaflet Map (same style as main script)
    // =====================================================
    const bounds = [
        [-12, 90],
        [7, 145]
    ];

    const map = L.map('map', {
        minZoom: 5,
        maxZoom: 14,
        maxBounds: bounds,
        scrollWheelZoom: false
    });

    map.fitBounds(bounds, { padding: [50, 50] });
    map.setView([lat, lon], 12);

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenTopoMap contributors'
    }).addTo(map);

    L.marker([lat, lon], { icon: blackIcon }).addTo(map);


    // -----------------------------------------------------
    // Enable zoom only with CTRL (same code)
// -----------------------------------------------------
    map.scrollWheelZoom.disable();

    document.addEventListener('keydown', (e) => {
        if (e.key === "Control")
            map.getContainer().classList.add('ctrl-active');
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === "Control")
            map.getContainer().classList.remove('ctrl-active');
    });

    map.getContainer().addEventListener('wheel', function (e) {
        if (e.ctrlKey) {
            e.preventDefault();
            map.scrollWheelZoom.enable();
            clearTimeout(map._wheelTimeout);
            map._wheelTimeout = setTimeout(() => {
                map.scrollWheelZoom.disable();
            }, 200);
        }
    }, { passive: false });
}


// =====================================================
// 7) Run everything
// =====================================================
loadCave();


