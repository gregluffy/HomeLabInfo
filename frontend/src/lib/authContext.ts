import { createContext, useContext } from "react";

interface AuthContextValue {
  authEnabled: boolean;
  username: string | null;
}

export const AuthContext = createContext<AuthContextValue>({
  authEnabled: false,
  username: null,
});

export const useAuth = () => useContext(AuthContext);
