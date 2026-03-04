import { ApolloClient, InMemoryCache, HttpLink } from "@apollo/client";
import { FLOW_COUNCIL_SUBGRAPH, SUPERFLUID_SUBGRAPH } from "./constants";

let flowCouncilClient: ApolloClient | null = null;
let superfluidClient: ApolloClient | null = null;

export function getFlowCouncilClient() {
  if (!flowCouncilClient) {
    flowCouncilClient = new ApolloClient({
      link: new HttpLink({ uri: FLOW_COUNCIL_SUBGRAPH }),
      cache: new InMemoryCache(),
    });
  }
  return flowCouncilClient;
}

export function getSuperfluidClient() {
  if (!superfluidClient) {
    superfluidClient = new ApolloClient({
      link: new HttpLink({ uri: SUPERFLUID_SUBGRAPH }),
      cache: new InMemoryCache(),
    });
  }
  return superfluidClient;
}
