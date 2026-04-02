import { gql } from "graphql-request";

export const ALL_BALLOTS_QUERY = gql`
  query AllBallots($councilId: String!, $first: Int!, $skip: Int!) {
    ballots(
      first: $first
      skip: $skip
      where: { flowCouncil: $councilId }
      orderBy: createdAtTimestamp
      orderDirection: asc
    ) {
      id
      votes {
        votedBy
        recipient {
          account
        }
        amount
      }
      createdAtTimestamp
    }
  }
`;

export const FLOW_UPDATED_EVENTS_QUERY = gql`
  query FlowUpdatedEvents($receiver: String!, $first: Int!, $skip: Int!) {
    flowUpdatedEvents(
      first: $first
      skip: $skip
      where: { receiver: $receiver }
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      sender
      receiver
      flowRate
      oldFlowRate
      timestamp
      totalAmountStreamedUntilTimestamp
      type
    }
  }
`;

export const MENTOR_VOTERS_QUERY = gql`
  query MentorVoters($councilId: String!, $accounts: [String!]!) {
    voters(where: { flowCouncil: $councilId, account_in: $accounts }) {
      account
      votingPower
    }
  }
`;

export const RECIPIENTS_QUERY = gql`
  query Recipients($councilId: String!) {
    recipients(where: { flowCouncil: $councilId }, first: 1000) {
      account
      removed
      removedAtTimestamp
    }
  }
`;

export const DISTRIBUTION_POOL_QUERY = gql`
  query DistributionPool($poolId: String!) {
    pool(id: $poolId) {
      flowRate
      adjustmentFlowRate
      totalAmountFlowedDistributedUntilUpdatedAt
      updatedAtTimestamp
      totalUnits
      poolMembers(first: 1000) {
        account {
          id
        }
        units
        updatedAtTimestamp
        totalAmountReceivedUntilUpdatedAt
        isConnected
      }
    }
  }
`;
