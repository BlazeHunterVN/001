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
const bannerForm = document.getElementById('banner-form');
const adminCardTitle = document.querySelector('.admin-card h3');

let isEditing = false;
let currentEditId = null;
let allBanners = [];
const filterNation = document.getElementById('filter-nation');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const btnDeleteSelected = document.getElementById('btn-delete-selected');

const bannerType = document.getElementById('banner-type');
const bannerNationKey = document.getElementById('banner-nation-key');
const bannerEndDate = document.getElementById('banner-end-date');
const toggleBannerForm = document.getElementById('toggle-banner-form');
const adminCard = document.querySelector('.admin-card');
const cardHeader = document.querySelector('.card-header');

const tabLinks = document.querySelectorAll('.tab-link');
const tabPanes = document.querySelectorAll('.tab-pane');
const sidebar = document.querySelector('.sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-active');
        } else {
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
        }
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-active');
    });
}

if (window.innerWidth > 1024) {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');
}

tabLinks.forEach(link => {
    link.addEventListener('click', () => {
        const tabId = link.dataset.tab;

        tabLinks.forEach(l => l.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        link.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

const homeSettingsForm = document.getElementById('home-settings-form');
const homeBgPc = document.getElementById('home-bg-pc');
const homeBgMobile = document.getElementById('home-bg-mobile');

async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        const email = session.user.email;
        const isAllowed = await checkWhitelist(email);
        if (isAllowed) {
            localStorage.setItem('admin_email', email); // Ensure email is saved for role check
            localStorage.setItem('admin_granted', 'true');
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

    // Basic anti-spam/brute force protection
    const now = Date.now();
    const lastAttempt = parseInt(localStorage.getItem('last_login_attempt') || '0');
    if (now - lastAttempt < 2000) {
        showError('Please Wait A Moment Before Trying Again!');
        return;
    }
    localStorage.setItem('last_login_attempt', now.toString());

    if (!email || !key) {
        showError('Please Enter Email And Access Key!');
        return;
    }

    const { data: isValid, error } = await supabaseClient.rpc('verify_admin_key', {
        p_email: email,
        p_key: key
    });

    if (error || !isValid) {
        if (error) console.error('Login error:', error);
        showError('Email Or Access Key Is Not Correct!');
    } else {
        localStorage.setItem('admin_granted', 'true');
        localStorage.setItem('admin_email', email);
        localStorage.setItem('admin_key', key);
        showDashboard();
    }
}

async function checkAdminRole() {
    let email = localStorage.getItem('admin_email');

    // Fallback: If no email in local storage, verify with session
    if (!email) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session && session.user.email) {
            email = session.user.email;
            localStorage.setItem('admin_email', email);
        } else {
            console.warn("No admin email found for role check.");
            return;
        }
    }

    console.log("Checking role for:", email);

    try {
        const { data: role, error } = await supabaseClient.rpc('get_admin_role', {
            p_email: email
        });

        console.log("Role result:", role, "Error:", error);



        if (error) {
            console.error('RPC Error:', error);
            if (error.message && error.message.includes('function') && error.message.includes('does not exist')) {
                alert('SYSTEM NOTICE: Database function missing. Run "admin/COMPLETE_SETUP.sql" in Supabase.');
            }
        }

        if (role && role.toLowerCase() === 'senior admin') {
            if (navGrantAccess) {
                navGrantAccess.style.display = 'flex';
                // Trigger reflow/redraw
                navGrantAccess.offsetHeight;
            }
        } else {
            if (navGrantAccess) navGrantAccess.style.display = 'none';
        }
    } catch (err) {
        console.error('Error checking role:', err);
    }
}

window.addEventListener('load', () => {
    if (localStorage.getItem('admin_granted') === 'true' && localStorage.getItem('admin_email')) {
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
    fetchBanners().then(() => {
        autoCleanupBanners();
    });
    fetchHomeSettings();

    setInterval(() => {
        if (localStorage.getItem('admin_granted') === 'true') {
            fetchBanners();
            fetchHomeSettings();
        }
    }, 30000);
}

async function autoCleanupBanners() {
    if (allBanners.length === 0) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const expiredIds = allBanners.filter(banner => {
        if (!banner.end_date) return false;
        if (banner.nation_key === 'news') return false; // Never auto-delete news
        const end = parseDateString(banner.end_date);
        if (!end) return false;

        const diffTime = today.getTime() - end.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays > 10;
    }).map(b => parseInt(b.id));

    if (expiredIds.length > 0) {
        console.log(`Auto-cleaning ${expiredIds.length} expired banners older than 10 days.`);
        const email = localStorage.getItem('admin_email');
        const key = localStorage.getItem('admin_key');

        const { error } = await supabaseClient.rpc('manage_banner_delete', {
            p_email: email,
            p_key: key,
            p_ids: expiredIds
        });

        if (!error) {
            fetchBanners();
        } else {
            console.error('Auto-cleanup error:', error);
        }
    }
}

function showError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
}

btnGoogleLogin.addEventListener('click', handleGoogleLogin);
btnKeyLogin.addEventListener('click', handleKeyLogin);

const togglePasswordBtn = document.getElementById('toggle-password');
if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', function () {
        const type = keyInput.getAttribute('type') === 'password' ? 'text' : 'password';
        keyInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });
}

btnLogout.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    localStorage.removeItem('admin_granted');
    localStorage.removeItem('admin_email');
    localStorage.removeItem('admin_key');
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
            if (!bannerDate) return false;

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

const btnApplyFilter = document.getElementById('btn-apply-filter');
if (btnApplyFilter) {
    btnApplyFilter.addEventListener('click', filterAndRender);
}

if (bannerType) {
    bannerType.addEventListener('change', () => {
        const newsOption = bannerNationKey.querySelector('option[value="news"]');
        if (bannerType.value === 'NEWS') {
            bannerNationKey.value = 'news';
            bannerNationKey.disabled = true;
            bannerNationKey.required = false;
        } else {
            bannerNationKey.disabled = false;
            bannerNationKey.required = true;
            if (newsOption) {
                newsOption.disabled = true;
                newsOption.title = "Only available for NEWS type";
            }
            if (bannerNationKey.value === 'news') bannerNationKey.value = 'vietnam';
        }
    });
}

const cardHeaders = document.querySelectorAll('.card-header');
cardHeaders.forEach(header => {
    header.addEventListener('click', () => {
        const card = header.closest('.admin-card');
        if (card) {
            card.classList.toggle('collapsed');
        }
    });
});

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
            <td>${banner.end_date || '--/--/----'}</td>
            <td>
                <button class="action-btn btn-edit" onclick="openEditModal('${banner.id}', '${banner.title || ''}', '${banner.url}', '${banner.banner_link || ''}', '${banner.nation_key}', '${banner.start_date || ''}', '${banner.end_date || ''}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteBanner('${banner.id}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        bannerTableBody.appendChild(tr);
    });

    updateCheckboxListeners();
    updateDeleteButtonVisibility();
}

window.deleteBanner = async (id) => {
    if (confirm('Are you sure you want to delete it?')) {
        const email = localStorage.getItem('admin_email');
        const key = localStorage.getItem('admin_key');

        const { error } = await supabaseClient.rpc('manage_banner_delete', {
            p_email: email,
            p_key: key,
            p_ids: [parseInt(id)]
        });

        if (error) alert('Error: ' + error.message);
        else fetchBanners();
    }
};

window.openEditModal = (id, title, url, link, nation, startDate, endDate) => {
    isEditing = true;
    currentEditId = id;
    if (adminCardTitle) adminCardTitle.textContent = 'Edit Banner';

    document.getElementById('banner-title').value = title;
    document.getElementById('banner-url').value = url;
    document.getElementById('banner-link').value = link;
    document.getElementById('banner-nation-key').value = nation;
    document.getElementById('banner-start-date').value = startDate;
    document.getElementById('banner-end-date').value = endDate || '';

    if (nation === 'news' || nation === 'NEWS') {
        bannerType.value = 'NEWS';
        bannerNationKey.value = 'news';
        bannerNationKey.disabled = true;
    } else {
        bannerType.value = 'NATION';
        bannerNationKey.disabled = false;
        const newsOption = bannerNationKey.querySelector('option[value="news"]');
        if (newsOption) {
            newsOption.disabled = true;
            newsOption.title = "Only available for NEWS type";
        }
    }

    const saveBtn = document.getElementById('btn-save-banner');
    if (saveBtn) saveBtn.textContent = 'Update Banner';

    const adminCard = document.querySelector('.admin-card');
    if (adminCard) {
        adminCard.scrollIntoView({ behavior: 'smooth' });
    }
};

function resetForm() {
    isEditing = false;
    currentEditId = null;
    if (adminCardTitle) adminCardTitle.textContent = 'Add New Banner';
    bannerForm.reset();
    const saveBtn = document.getElementById('btn-save-banner');
    if (saveBtn) saveBtn.textContent = 'Add Banner';
    if (bannerNationKey) {
        bannerNationKey.disabled = false;
        const newsOption = bannerNationKey.querySelector('option[value="news"]');
        if (newsOption) {
            newsOption.disabled = false;
            newsOption.title = "";
        }
    }
}

bannerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('banner-title').value;
    const url = document.getElementById('banner-url').value;
    const banner_link = document.getElementById('banner-link').value;
    const nation_key = document.getElementById('banner-nation-key').value;
    const start_date = document.getElementById('banner-start-date').value;

    const email = localStorage.getItem('admin_email');
    const key = localStorage.getItem('admin_key');

    const rpcPayload = {
        p_email: email,
        p_key: key,
        p_title: title,
        p_url: url,
        p_banner_link: banner_link,
        p_nation_key: nation_key,
        p_start_date: start_date,
        p_end_date: document.getElementById('banner-end-date').value
    };

    if (isEditing) {
        rpcPayload.p_id = parseInt(currentEditId);
    }

    const { error } = await supabaseClient.rpc('manage_banner_upsert', rpcPayload);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        resetForm();
        fetchBanners();
    }
});

async function fetchHomeSettings() {
    const { data, error } = await supabaseClient
        .from('home_settings')
        .select('*')
        .eq('id', 1)
        .single();

    if (error) {
        console.error('Error fetching home settings:', error);
        return;
    }

    if (data) {
        if (homeBgPc) homeBgPc.value = data.bg_pc_url || '';
        if (homeBgMobile) homeBgMobile.value = data.bg_mobile_url || '';
    }
}

if (homeSettingsForm) {
    homeSettingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const pcUrl = homeBgPc.value.trim();
        const mobileUrl = homeBgMobile.value.trim();

        const email = localStorage.getItem('admin_email');
        const key = localStorage.getItem('admin_key');

        const { error } = await supabaseClient.rpc('manage_home_settings', {
            p_email: email,
            p_key: key,
            p_bg_pc_url: pcUrl,
            p_bg_mobile_url: mobileUrl
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('Settings saved successfully!');
            fetchHomeSettings();
        }
    });
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
            const email = localStorage.getItem('admin_email');
            const key = localStorage.getItem('admin_key');

            const { error } = await supabaseClient.rpc('manage_banner_delete', {
                p_email: email,
                p_key: key,
                p_ids: ids.map(id => parseInt(id))
            });

            if (error) {
                console.error('Error deleting banners:', error);
                alert('Error deleting: ' + error.message);
            }

            fetchBanners();
        }
    });
}

const navGrantAccess = document.getElementById('nav-grant-access');
const adminTableBody = document.getElementById('admin-table-body');
const grantAccessForm = document.getElementById('grant-access-form');
const btnSaveAdmin = document.getElementById('btn-save-admin');
const btnCancelAdmin = document.getElementById('btn-cancel-admin');
const isEditAdminInput = document.getElementById('is-edit-admin');

const originalShowDashboard = showDashboard;
showDashboard = function () {
    originalShowDashboard();
    checkAdminRole();

    if (navGrantAccess && navGrantAccess.classList.contains('active') && navGrantAccess.style.display === 'none') {
        document.querySelector('[data-tab="banners"]').click();
    }
};

async function fetchAdminUsers() {
    const email = localStorage.getItem('admin_email');
    const key = localStorage.getItem('admin_key');

    const { data: users, error } = await supabaseClient.rpc('manage_get_admins', {
        p_email: email,
        p_key: key
    });

    if (error) {
        console.error('Error fetching admins:', error);
        adminTableBody.innerHTML = `<tr><td colspan="4" style="color: red; text-align: center;">Error: ${error.message}</td></tr>`;
        return;
    }

    renderAdminUsers(users);
}

function renderAdminUsers(users) {
    if (!adminTableBody) return;
    adminTableBody.innerHTML = '';

    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.email}</td>
            <td style="font-family: monospace;">${user.access_key}</td>
            <td><span class="badge ${user.role === 'Senior Admin' ? 'badge-primary' : 'badge-info'}">${user.role || 'Admin'}</span></td>
            <td>
                <button class="action-btn btn-edit" type="button" onclick="editAdmin('${user.email}', '${user.access_key}', '${user.role}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" type="button" onclick="deleteAdmin('${user.email}')"><i class="fas fa-trash"></i></button>
            </td>
        `;
        adminTableBody.appendChild(tr);
    });
}

window.editAdmin = (email, key, role) => {
    document.getElementById('admin-email').value = email;
    document.getElementById('admin-email').readOnly = true;
    document.getElementById('admin-key').value = key;
    document.getElementById('admin-role').value = role || 'admin';

    isEditAdminInput.value = 'true';
    btnSaveAdmin.textContent = 'UPDATE USER';
    btnCancelAdmin.style.display = 'inline-block';

    // Scroll to form
    grantAccessForm.scrollIntoView({ behavior: 'smooth' });
};

window.deleteAdmin = async (targetEmail) => {
    if (confirm(`Are you sure you want to delete admin user: ${targetEmail}?`)) {
        const email = localStorage.getItem('admin_email');
        const key = localStorage.getItem('admin_key');

        const { error } = await supabaseClient.rpc('manage_admin_delete', {
            p_requester_email: email,
            p_requester_key: key,
            p_target_email: targetEmail
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchAdminUsers();
        }
    }
};

if (grantAccessForm) {
    grantAccessForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const targetEmail = document.getElementById('admin-email').value;
        const targetKey = document.getElementById('admin-key').value;
        const targetRole = document.getElementById('admin-role').value;

        const email = localStorage.getItem('admin_email');
        const key = localStorage.getItem('admin_key');

        const { error } = await supabaseClient.rpc('manage_admin_upsert', {
            p_requester_email: email,
            p_requester_key: key,
            p_target_email: targetEmail,
            p_target_key: targetKey,
            p_target_role: targetRole
        });

        if (error) {
            alert('Error: ' + error.message);
        } else {
            alert('User saved successfully');
            resetAdminForm();
            fetchAdminUsers();
        }
    });

    btnCancelAdmin.addEventListener('click', resetAdminForm);
}

function resetAdminForm() {
    grantAccessForm.reset();
    document.getElementById('admin-email').readOnly = false;
    isEditAdminInput.value = 'false';
    btnSaveAdmin.textContent = 'ADD USER';
    btnCancelAdmin.style.display = 'none';
}

tabLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (link.dataset.tab === 'grant-access') {
            fetchAdminUsers();
        }
    });
});
