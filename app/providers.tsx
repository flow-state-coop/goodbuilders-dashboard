"use client";

import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { ApolloProvider } from "@apollo/client/react";
import { ReactNode, useMemo } from "react";
import { FLOW_COUNCIL_SUBGRAPH } from "@/lib/constants";

export default function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(
    () =>
      new ApolloClient({
        link: new HttpLink({ uri: FLOW_COUNCIL_SUBGRAPH }),
        cache: new InMemoryCache(),
      }),
    [],
  );

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
