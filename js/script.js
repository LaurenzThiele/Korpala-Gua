// =====================================================
// 1) Supabase Setup
// =====================================================
const supabaseClient = supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY
);

// =====================================================
// 2) Leaflet Map Setup
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
}).setView([-2.5, 118], 5 );

map.fitBounds(bounds, { padding: [50, 50] });

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// -----------------------------------------------------
// Enable zoom only with CTRL
// -----------------------------------------------------
map.scrollWheelZoom.disable();

document.addEventListener('keydown', (e) => {
    if (e.key === "Control") {
        map.getContainer().classList.add('ctrl-active');
    }
});
document.addEventListener('keyup', (e) => {
    if (e.key === "Control") {
        map.getContainer().classList.remove('ctrl-active');
    }
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

// =====================================================
// 3) Marker Icon + Storage
// =====================================================
var blackIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

const markers = {};


// =====================================================
// 4) Fetch Data
// =====================================================
async function fetchCaves() {
    const { data, error } = await supabaseClient
        .from("caves")
        .select("*");

    return { data, error };
}


// =====================================================
// 5) Render Map + Table
// =====================================================
async function renderCaves() {
    const tbody = document.querySelector("#caveTable tbody");

    const { data: caves, error } = await fetchCaves();

    // Error state
    if (error) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 5;
        td.textContent = "Mohon maaf, terjadi gangguan pada sistem. Silakan coba lagi nanti.";
        td.style.textAlign = "center";

        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    // No data state
    if (!caves || caves.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 5;
        td.textContent = "Belum ada data";
        td.style.textAlign = "center";

        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    const regions = new Set();
    const types = new Set();
    let minDepth = Infinity;
    let maxDepth = -Infinity;

    caves.forEach(props => {

        // Convert UTM → WGS84
        const utm51S = '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs';
        const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
        const [lon, lat] = proj4(utm51S, wgs84, [props.utm_x, props.utm_y]);

        // Track filters
        regions.add(props.region);
        types.add(props.type);
        minDepth = Math.min(minDepth, props.depth_m);
        maxDepth = Math.max(maxDepth, props.depth_m);

        // Add marker
        const popupContent = `
            <div>
                <strong style="color: rgb(234,2,6); text-transform: uppercase; display: block; margin-bottom: 6px;">
                    ${props.name}
                </strong>

                <span style="display: block; margin-bottom: 2px;">
                    ${props.region}
                </span>

                <span style="display: block; margin-bottom: 2px;">
                    ${props.type}
                </span>

                <span style="display: block; margin-bottom: 6px;">
                    ${props.depth_m} m
                </span>

                <a href="cave.html?id=${props.id}" 
                style="color: rgb(248,245,4); text-decoration: none; display: inline-block;">
                    Lihat selengkapnya
                </a>
            </div>

        `;
        const marker = L.marker([lat, lon], { icon: blackIcon })
            .addTo(map)
            .bindPopup(popupContent);

        markers[props.id] = marker;

        // Table row
        const tr = document.createElement("tr");
        tr.dataset.id = props.id;
        tr.innerHTML = `
            <td>${props.id}</td>
            <td>${props.name}</td>
            <td>${props.region}</td>
            <td>${props.type}</td>
            <td>${props.depth_m}</td>
        `;
        tbody.appendChild(tr);
    });

    // ---------------------------------------------
    // Populate filters
    // ---------------------------------------------
    const regionFilter = document.getElementById('region-filter');
    const typeFilter = document.getElementById('type-filter');
    const depthMin = document.getElementById('depth-min');
    const depthMax = document.getElementById('depth-max');

    regions.forEach(r => regionFilter.append(new Option(r, r)));
    types.forEach(t => typeFilter.append(new Option(t, t)));

    depthMin.value = minDepth;
    depthMax.value = maxDepth;
    depthMin.min = minDepth;
    depthMin.max = maxDepth;
    depthMax.min = minDepth;
    depthMax.max = maxDepth;

    // ---------------------------------------------
    // DataTable
    // ---------------------------------------------
    let table = new DataTable('#caveTable', {
        language: {
            url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/id.json',
            paginate: { first: '«', previous: '‹', next: '›', last: '»' }
        }
    });

    regionFilter.addEventListener('change', () => table.column(2).search(regionFilter.value).draw());
    typeFilter.addEventListener('change', () => table.column(3).search(typeFilter.value).draw());

    DataTable.ext.search.push(function (settings, rowData) {
        const depth = parseFloat(rowData[4]);
        const min = parseFloat(depthMin.value) || -Infinity;
        const max = parseFloat(depthMax.value) || Infinity;
        return depth >= min && depth <= max;
    });

    depthMin.addEventListener('input', () => table.draw());
    depthMax.addEventListener('input', () => table.draw());

    // ---------------------------------------------
    // Click row → Fly to marker
    // ---------------------------------------------
    document.querySelector('#caveTable tbody').addEventListener('click', function (e) {
        const tr = e.target.closest('tr');
        if (!tr) return;

        const id = tr.dataset.id;
        const cave = caves.find(c => c.id == id);

        const utm51S = '+proj=utm +zone=51 +south +datum=WGS84 +units=m +no_defs';
        const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';
        const [lon, lat] = proj4(utm51S, wgs84, [cave.utm_x, cave.utm_y]);

        map.flyTo([lat, lon], 12);
        markers[id].openPopup();

        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}


// =====================================================
// 6) RUN EVERYTHING
// =====================================================
renderCaves();

// =====================================================
// 7) Make table responsive
// =====================================================
function updateInfoText() {
    const info = document.getElementById('caveTable_info');
    if (!info) return;

    const w = window.innerWidth;

    // Only apply change on <= 768px
    if (w <= 768) {
        info.textContent = info.textContent.replace(
            /Menampilkan\s+(\d+)\s+sampai\s+(\d+)\s+dari\s+(\d+)\s+entri/,
            "$1-$2 dari $3"
        );
    } else {
        // Optional: restore full version if wider
        info.textContent = info.textContent.replace(
            /(\d+)-(\d+)\s+dari\s+(\d+)/,
            "Menampilkan $1 sampai $2 dari $3 entri"
        );
    }
}

// Run on load + on resize
updateInfoText();
window.addEventListener('resize', updateInfoText);

// Also run whenever DataTables redraws:
$('#caveTable').on('draw.dt', updateInfoText);
