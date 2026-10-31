import { createContext } from 'react';

export const AuthContext = createContext({
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  logout: () => {},
});

export default AuthContext;

