function showAlert(type, message) {
  const host = document.getElementById('alertHost');
  if (!host) return;

  const div = document.createElement('div');
  div.className = `alert alert-${type} alert-dismissible fade show`;
  div.setAttribute('role', 'alert');
  div.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  host.appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

async function fetchJson(url, options) {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

async function loadVoucherPrice() {
  const input = document.getElementById('voucherPrice');
  if (!input) return;

  const data = await fetchJson('/api/admin/settings', { method: 'GET' });
  input.value = Number(data?.settings?.voucher_price ?? 360).toFixed(2);
}

async function saveVoucherPrice(price) {
  await fetchJson('/api/admin/settings/voucher-price', {
    method: 'PUT',
    body: JSON.stringify({ voucher_price: price }),
  });
}

async function loadVendors() {
  const select = document.getElementById('vendorSelect');
  if (!select) return;

  const data = await fetchJson('/api/admin/vendors', { method: 'GET' });
  const vendors = data?.vendors || [];

  select.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = vendors.length ? 'Select a vendor...' : 'No vendors found';
  select.appendChild(placeholder);

  for (const v of vendors) {
    const opt = document.createElement('option');
    opt.value = String(v.id);
    opt.textContent = `${v.name || v.username} (id: ${v.id})`;
    select.appendChild(opt);
  }
}

function formatDate(dt) {
  if (!dt) return '-';
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return String(dt);
  }
}

function renderApiKeys(keys) {
  const tbody = document.getElementById('apiKeysTbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!keys.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" class="text-muted">No API keys for this vendor.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const k of keys) {
    const tr = document.createElement('tr');
    const badge = k.is_active
      ? '<span class="badge text-bg-success">ACTIVE</span>'
      : '<span class="badge text-bg-secondary">SUSPENDED</span>';

    tr.innerHTML = `
      <td>${k.name || 'API Key'}</td>
      <td>${badge}</td>
      <td>${formatDate(k.created_at)}</td>
      <td>${formatDate(k.last_used_at)}</td>
      <td class="text-end">
        <button class="btn btn-sm ${k.is_active ? 'btn-outline-danger' : 'btn-outline-success'} toggle-btn">
          ${k.is_active ? 'Suspend' : 'Activate'}
        </button>
      </td>
    `;

    const btn = tr.querySelector('.toggle-btn');
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await fetchJson(`/api/admin/api-keys/${k.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: !k.is_active }),
        });
        showAlert('success', `API key ${!k.is_active ? 'activated' : 'suspended'} successfully.`);
        await loadApiKeysForSelectedVendor();
      } catch (e) {
        showAlert('danger', e.message);
      } finally {
        btn.disabled = false;
      }
    });

    tbody.appendChild(tr);
  }
}

async function loadApiKeysForSelectedVendor() {
  const select = document.getElementById('vendorSelect');
  if (!select) return;

  const vendorId = select.value;
  const tbody = document.getElementById('apiKeysTbody');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Loading...</td></tr>`;
  }

  if (!vendorId) {
    renderApiKeys([]);
    return;
  }

  const data = await fetchJson(`/api/admin/vendors/${vendorId}/api-keys`, {
    method: 'GET',
  });
  renderApiKeys(data?.apiKeys || []);
}

async function handleLogout() {
  try {
    localStorage.removeItem('admin_token');
    const res = await fetch('/api/admin/logout', { method: 'POST' });
    if (res.ok) window.location.href = '/admin-login';
    else showAlert('danger', 'Logout failed');
  } catch (e) {
    showAlert('danger', 'Logout failed');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('admin_token')) {
    window.location.href = '/admin-login';
    return;
  }
  try {
    await loadVoucherPrice();
    await loadVendors();
  } catch (e) {
    showAlert('danger', e.message);
  }

  const priceForm = document.getElementById('voucherPriceForm');
  priceForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('voucherPrice');
    const btn = document.getElementById('savePriceBtn');
    const value = Number.parseFloat(input?.value);
    if (!Number.isFinite(value) || value <= 0) {
      showAlert('danger', 'Please enter a valid positive price.');
      return;
    }

    btn.disabled = true;
    try {
      await saveVoucherPrice(value);
      showAlert('success', 'Voucher price updated.');
      await loadVoucherPrice();
    } catch (err) {
      showAlert('danger', err.message);
    } finally {
      btn.disabled = false;
    }
  });

  const vendorSelect = document.getElementById('vendorSelect');
  vendorSelect?.addEventListener('change', async () => {
    try {
      await loadApiKeysForSelectedVendor();
    } catch (e) {
      showAlert('danger', e.message);
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
});

