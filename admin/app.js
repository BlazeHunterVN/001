const SUPABASE_URL = 'https://lscypgvlydfdhiulzbwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzY3lwZ3ZseWRmZGhpdWx6Ynd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MDI0NzIsImV4cCI6MjA4MTk3ODQ3Mn0.rH9PwSC6pLdsjCGg8pkL7LofJVZjMGe_7Fn1b5lKAdI';
const SUPABASE_TABLE = 'nation_banners';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginError = document.getElementById('login-error');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnKeyLogin = document.getElementById('btn-key-login');
const emailInput = document.getElementById('email-input');
const keyInput = document.getElementById('access-key-input');
const btnLogout = document.getElementById('btn-logout');

const bannerTableBody = document.getElementById('banner-table-body');
const btnAddBanner = document.getElementById('btn-add-banner');
const bannerModal = document.getElementById('banner-modal');
const closeModal = document.querySelector('.close-modal');
const bannerForm = document.getElementById('banner-form');
const modalTitle = document.getElementById('modal-title');

let isEditing = false;
let currentEditId = null;
let allBanners = [];
const filterNation = document.getElementById('filter-nation');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const email = session.user.email;
        const isAllowed = await checkWhitelist(email);
        if (isAllowed) {
            showDashboard();
        } else {
            await supabaseClient.auth.signOut();
            showError('Email Or Access Key Is Not Correct!');
        }
    } else {
        showLogin();
    }
}

async function checkWhitelist(email) {
    if (!email) return false;
    const { data, error } = await supabaseClient
        .from('admin_access')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !data) return false;
    return true;
}

async function handleGoogleLogin() {
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.href
        }
    });
    if (error) showError(error.message);
}

async function handleKeyLogin() {
    const email = emailInput.value.trim();
    const key = keyInput.value.trim();

    if (!email || !key) {
        showError('Please Enter Email And Access Key!');
        return;
    }

    const { data, error } = await supabaseClient
        .from('admin_access')
        .select('*')
        .eq('email', email)
        .eq('access_key', key)
        .single();

    if (error || !data) {
        if (error) console.error('Login error:', error);
        showError('Email Or Access Key Is Not Correct!');
    } else {
        showDashboard();
        localStorage.setItem('admin_granted', 'true');
    }
}

window.addEventListener('load', () => {
    if (localStorage.getItem('admin_granted') === 'true') {
        showDashboard();
    } else {
        checkSession();
    }
});

function showLogin() {
    loginContainer.style.display = 'flex';
    dashboardContainer.style.display = 'none';
}

function showDashboard() {
    loginContainer.style.display = 'none';
    dashboardContainer.style.display = 'flex';
    fetchBanners();
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

btnGoogleLogin.addEventListener('click', handleGoogleLogin);
btnKeyLogin.addEventListener('click', handleKeyLogin);

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('admin_granted');
    window.location.reload();
});

async function fetchBanners() {
    const { data, error } = await supabaseClient
        .from(SUPABASE_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching banners:', error);
        return;
    }

    allBanners = data;
    filterAndRender();
}

function parseDateString(dateStr) {
    if (!dateStr || !dateStr.trim()) return null;
    const parts = dateStr.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
}

function filterAndRender() {
    const selectedNation = filterNation.value;
    const dateFromStr = filterDateFrom ? filterDateFrom.value : '';
    const dateToStr = filterDateTo ? filterDateTo.value : '';

    let filtered = allBanners;

    if (selectedNation !== 'all') {
        filtered = filtered.filter(b => b.nation_key === selectedNation);
    }

    const dateFrom = parseDateString(dateFromStr);
    const dateTo = parseDateString(dateToStr);

    if (dateFrom || dateTo) {
        filtered = filtered.filter(b => {
            const bannerDate = parseDateString(b.start_date);
            if (!bannerDate) return false; // Exclude banners without valid dates

            if (dateFrom && bannerDate < dateFrom) return false;
            if (dateTo && bannerDate > dateTo) return false;

            return true;
        });
    }

    renderBanners(filtered);
}

if (filterNation) {
    filterNation.addEventListener('change', filterAndRender);
}

if (filterDateFrom) {
    filterDateFrom.addEventListener('input', filterAndRender);
}

if (filterDateTo) {
    filterDateTo.addEventListener('input', filterAndRender);
}

function renderBanners(banners) {
    bannerTableBody.innerHTML = '';
    banners.forEach(banner => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="banner-checkbox" data-id="${banner.id}"></td>
            <td><img src="${banner.url}" alt="Banner" style="height: 50px; object-fit: cover;"></td>
            <td>${banner.title || 'No Title'}</td>
            <td><span class="badge badge-info">${banner.nation_key}</span></td>
            <td>${banner.start_date || '--/--/----'}</td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal('${banner.id}', '${banner.title || ''}', '${banner.url}', '${banner.banner_link || ''}', '${banner.nation_key}', '${banner.start_date || ''}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteBanner('${banner.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        bannerTableBody.appendChild(tr);
    });

    // Add event listeners to checkboxes
    updateCheckboxListeners();
    updateDeleteButtonVisibility();
}

window.deleteBanner = async (id) => {
    if (confirm('Are you sure you want to delete it?')) {
        const { error } = await supabaseClient.from(SUPABASE_TABLE).delete().eq('id', id);
        if (error) alert('Error: ' + error.message);
        else fetchBanners();
    }
};

window.openEditModal = (id, title, url, link, nation, startDate) => {
    isEditing = true;
    currentEditId = id;
    modalTitle.textContent = 'EDIT BANNER LANGUAGE';

    document.getElementById('banner-title').value = title;
    document.getElementById('banner-url').value = url;
    document.getElementById('banner-link').value = link;
    document.getElementById('banner-nation-key').value = nation;
    document.getElementById('banner-start-date').value = startDate;

    bannerModal.style.display = 'block';
};

btnAddBanner.addEventListener('click', () => {
    isEditing = false;
    currentEditId = null;
    modalTitle.textContent = 'ADD BANNER LANGUAGE';
    bannerForm.reset();
    bannerModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
    bannerModal.style.display = 'none';
});

bannerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('banner-title').value;
    const url = document.getElementById('banner-url').value;
    const banner_link = document.getElementById('banner-link').value;
    const nation_key = document.getElementById('banner-nation-key').value;
    const start_date = document.getElementById('banner-start-date').value;

    const payload = {
        title,
        url,
        banner_link,
        nation_key,
        start_date
    };

    if (isEditing) {
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE)
            .update(payload)
            .eq('id', currentEditId);
        if (error) alert('Error Updating: ' + error.message);
    } else {
        const { error } = await supabaseClient
            .from(SUPABASE_TABLE)
            .insert([payload]);
        if (error) alert('Error Adding: ' + error.message);
    }

    bannerModal.style.display = 'none';
    fetchBanners();
});

window.onclick = function (event) {
    if (event.target == bannerModal) {
        bannerModal.style.display = 'none';
    }
}

function updateCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.banner-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', updateDeleteButtonVisibility);
    });
}

function updateDeleteButtonVisibility() {
    const checkboxes = document.querySelectorAll('.banner-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;

    if (btnDeleteSelected) {
        btnDeleteSelected.style.display = checkedCount > 0 ? 'inline-flex' : 'none';
    }

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
}

if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', function () {
        const checkboxes = document.querySelectorAll('.banner-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = this.checked;
        });
        updateDeleteButtonVisibility();
    });
}

if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', async function () {
        const checkboxes = document.querySelectorAll('.banner-checkbox:checked');
        const ids = Array.from(checkboxes).map(cb => cb.dataset.id);

        if (ids.length === 0) return;

        if (confirm(`Delete ${ids.length} selected banner(s)?`)) {
            let errorCount = 0;
            for (const id of ids) {
                const { error } = await supabaseClient.from(SUPABASE_TABLE).delete().eq('id', id);
                if (error) {
                    console.error('Error deleting banner:', id, error);
                    errorCount++;
                }
            }

            if (errorCount > 0) {
                alert(`Failed to delete ${errorCount} banner(s)`);
            }

            fetchBanners();
        }
    });
}