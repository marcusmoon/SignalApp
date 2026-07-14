import { createContext, useContext, type ReactNode } from 'react';

/**
 * iPhone More 허브 → 보드·공시·유튜브는 root Stack으로 연다.
 * 이 Provider 안에서는 탭 `SignalHeader` / 커스텀 드릴 헤더를 숨기고
 * Expo Stack 네이티브 헤더(+ PhoneHeaderBackButton)만 쓴다.
 */
const PhoneMoreStackChromeContext = createContext(false);

export function PhoneMoreStackChromeProvider({ children }: { children: ReactNode }) {
  return (
    <PhoneMoreStackChromeContext.Provider value={true}>{children}</PhoneMoreStackChromeContext.Provider>
  );
}

export function usePhoneMoreStackChrome(): boolean {
  return useContext(PhoneMoreStackChromeContext);
}
