import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchIdState] = useState(localStorage.getItem('bb_branch') || 'all');
  const [loading, setLoading] = useState(true);

  const loadBranches = useCallback(async () => {
    const { data } = await api.get('/branches');
    setBranches(data);
    return data;
  }, []);

  const setBranchId = (id) => {
    localStorage.setItem('bb_branch', id);
    setBranchIdState(id);
  };

  const bootstrap = useCallback(
    async (u) => {
      setUser(u);
      const list = await loadBranches();
      if (u.role !== 'superadmin') {
        setBranchId(u.branch?._id || u.branch);
      } else {
        const saved = localStorage.getItem('bb_branch');
        if (!saved || (saved !== 'all' && !list.some((b) => b._id === saved))) setBranchId('all');
      }
    },
    [loadBranches]
  );

  useEffect(() => {
    const token = localStorage.getItem('bb_token');
    if (!token) return setLoading(false);
    api
      .get('/auth/me')
      .then(({ data }) => bootstrap(data))
      .catch(() => localStorage.removeItem('bb_token'))
      .finally(() => setLoading(false));
  }, [bootstrap]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('bb_token', data.token);
    if (data.user.role === 'superadmin') localStorage.setItem('bb_branch', 'all');
    await bootstrap(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('bb_token');
    localStorage.removeItem('bb_branch');
    setUser(null);
    setBranches([]);
  };

  const value = useMemo(() => {
    const isSuper = user?.role === 'superadmin';
    const currentBranch = branchId && branchId !== 'all' ? branches.find((b) => b._id === branchId) || null : null;
    return {
      user,
      loading,
      login,
      logout,
      branches,
      loadBranches,
      branchId,
      setBranchId,
      currentBranch,
      isSuper,
      isAllBranches: isSuper && !currentBranch,
      currency: currentBranch?.settings?.currency || '₹',
      can: (...roles) => !!user && roles.includes(user.role),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, branches, branchId]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
