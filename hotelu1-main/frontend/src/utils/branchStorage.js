/** Per-restaurant localStorage keys so each branch has its own tables / QR codes. */

export const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};

export const getBranchStorageKey = (prefix) => {
  const user = getCurrentUser();
  let branchId = 'hq';
  if (user?.subfranchise_id != null && user?.subfranchise_id !== '') {
    branchId = String(user.subfranchise_id);
  } else if (
    ['franchise', 'subfranchise'].includes(String(user?.role || '').toLowerCase())
  ) {
    try {
      const selected = localStorage.getItem('franchiseActiveBranchId');
      if (selected) branchId = selected;
    } catch {
      /* noop */
    }
  }
  return `${prefix}_branch_${branchId}`;
};

export const loadBranchJson = (prefix, fallback) => {
  try {
    const raw = localStorage.getItem(getBranchStorageKey(prefix));
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const saveBranchJson = (prefix, value) => {
  try {
    localStorage.setItem(getBranchStorageKey(prefix), JSON.stringify(value));
  } catch {
    /* noop */
  }
};
