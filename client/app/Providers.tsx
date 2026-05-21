"use client";

import { Provider as ReduxProvider } from "react-redux";
import { store } from "../store/reduxStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
export function Providers({ children }: { children: React.ReactNode }) {
    const queryClient = useMemo(() => new QueryClient(), []);

  return (
      <QueryClientProvider client={queryClient}>
    <ReduxProvider store={store}>
      {children}
    </ReduxProvider>
    </QueryClientProvider>
  );
}
