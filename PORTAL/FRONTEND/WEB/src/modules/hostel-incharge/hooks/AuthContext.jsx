/* eslint-disable react-refresh/only-export-components */
import { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
  token: null,
  assignedHostel: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
  refreshAssignedHostel: async () => {},
});

export default AuthContext;

