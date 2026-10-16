import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "./api";

type Session = {
  player: api.Player | null;
  loading: boolean;
  login: (nickname: string) => Promise<void>;
  rename: (nickname: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<api.Player | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await api.getToken()) setPlayer(await api.getMe());
      } catch {
        // Token inválido o sin red: se vuelve a pedir el apodo
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value: Session = {
    player,
    loading,
    login: async (nickname) => setPlayer(await api.loginWithNickname(nickname)),
    rename: async (nickname) => setPlayer(await api.changeNickname(nickname)),
    logout: async () => {
      await api.clearToken();
      setPlayer(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession fuera de SessionProvider");
  return ctx;
}
