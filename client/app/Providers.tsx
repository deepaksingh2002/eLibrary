"use client";

import { Provider as ReduxProvider } from "react-redux";
import { store } from "../store/reduxStore";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      {children}
    </ReduxProvider>
  );
}
