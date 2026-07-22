/** Helpers for multi-restaurant / branch scoping in the UI. */

export const isAdminUser = (user) =>
  String(user?.role || '').toLowerCase() === 'admin';

export const isFranchiseManager = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return role === 'franchise' || role === 'subfranchise';
};

export const canManageFranchiseUsers = (user) =>
  isAdminUser(user) || isFranchiseManager(user);

export const isBranchScopedUser = (user) => {
  if (!user) return false;
  if (isAdminUser(user)) return false;
  if (user.subfranchise_id != null) return true;
  const role = String(user.role || '').toLowerCase();
  return role === 'subfranchise';
};

export const getBranchLabel = (user) => {
  if (user?.branch?.name) return user.branch.name;
  if (isAdminUser(user)) return 'Main Branch / HQ';
  if (user?.subfranchise_id != null) return `Branch #${user.subfranchise_id}`;
  return 'Main Branch / HQ';
};

export const getBranchSubLabel = (user) => {
  if (isAdminUser(user)) return 'HQ orders only · franchises separate';
  if (user?.branch?.code) return user.branch.code;
  if (user?.branch?.city) return user.branch.city;
  if (user?.subfranchise_id != null) return 'Your restaurant only';
  return 'Headquarters';
};

/** Branch id to stamp on new orders — null means HQ/main branch only. */
export const getOrderBranchIdForUser = (user) => {
  if (!user || isAdminUser(user)) return null;

  const role = String(user.role || '').toLowerCase();

  if (user.subfranchise_id != null && user.subfranchise_id !== '') {
    return Number(user.subfranchise_id);
  }

  if (role === 'subfranchise' || role === 'franchise') {
    try {
      const selected = localStorage.getItem('franchiseActiveBranchId');
      if (selected != null && selected !== '') return Number(selected);
    } catch {
      /* noop */
    }
  }

  if (['manager', 'waiter', 'chef', 'cashier'].includes(role)) {
    return null;
  }

  return null;
};

export const appendBranchToOrderPayload = (payload, user) => {
  const branchId = getOrderBranchIdForUser(user);
  if (branchId != null && !Number.isNaN(branchId)) {
    return { ...payload, subfranchise_id: branchId };
  }
  return payload;
};
