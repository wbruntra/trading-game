import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { RootState } from '../index'

export interface Competition {
  id: number
  name: string
  start_date: string
  end_date: string
  initial_balance: number
  status: string
  created_by: number
  created_at: string
}

export interface CreateCompetitionRequest {
  name: string
  startDate: string
  endDate: string
  initialBalance: number
}

export interface Portfolio {
  id: number
  user_id: number
  competition_id: number
  competition_name?: string
  cash_balance: number
  created_at: string
  trades?: Trade[]
  holdings?: Holding[]
}

export interface Holding {
  symbol: string
  optionSymbol: string
  side: 'CALL' | 'PUT'
  quantity: number
  totalCost: number
  avgPrice: number
  strike: number
  lastPrice?: number
}

export interface Trade {
  id: number
  portfolio_id: number
  symbol: string
  option_symbol: string
  type: 'BUY' | 'SELL'
  side: 'CALL' | 'PUT'
  quantity: number
  price: number
  timestamp: string
}

export interface OptionsChain {
  symbol: string
  underlyingPrice: number
  quote?: {
    longName?: string
    regularMarketPrice?: number
  }
  expirationDates: string[]
  options: {
    expirationDate: string
    calls: OptionContract[]
    puts: OptionContract[]
  }[]
}

export interface OptionContract {
  contractSymbol: string
  strike: number
  lastPrice: number
  bid: number
  ask: number
  impliedVolatility: number
}

export interface LeaderboardEntry {
  id: number
  user_id: number
  username: string
  total_value: number
  cash_balance: number
  last_updated_at: string
}

export interface TradeRequest {
  symbol: string
  optionSymbol: string
  type: 'BUY' | 'SELL'
  side: 'CALL' | 'PUT'
  quantity: number
}

export interface SavedTrade {
  id: number
  portfolio_id: number
  symbol: string
  option_symbol: string
  type: 'BUY' | 'SELL'
  side: 'CALL' | 'PUT'
  quantity: number
  strike_price: number
  expiration_date: number
  note: string | null
  created_at: string
}

export interface SaveTradeRequest {
  symbol: string
  optionSymbol: string
  type: 'BUY' | 'SELL'
  side: 'CALL' | 'PUT'
  quantity: number
  strikePrice: number
  expirationDate: number
  note?: string
}

export const gameApi = createApi({
  reducerPath: 'gameApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }
      return headers
    },
  }),
  tagTypes: ['Competition', 'Portfolio', 'SavedTrade'],
  endpoints: (builder) => ({
    // Competitions
    getCompetitions: builder.query<Competition[], void>({
      query: () => '/competitions',
      providesTags: ['Competition'],
    }),
    getCompetition: builder.query<Competition, string>({
      query: (id) => `/competitions/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Competition', id }],
    }),
    createCompetition: builder.mutation<Competition, CreateCompetitionRequest>({
      query: (body) => ({
        url: '/competitions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Competition'],
    }),
    joinCompetition: builder.mutation<Portfolio, string>({
      query: (competitionId) => ({
        url: `/competitions/${competitionId}/join`,
        method: 'POST',
      }),
      invalidatesTags: ['Portfolio'],
    }),

    // Market Data
    getOptionsChain: builder.query<OptionsChain, { symbol: string; date?: number }>({
      query: ({ symbol, date }) => {
        let url = `/market/options/${symbol}`
        if (date) {
          url += `?date=${date}`
        }
        return url
      },
    }),

    // Trading
    getMyPortfolios: builder.query<Portfolio[], void>({
      query: () => '/trading/portfolios',
      providesTags: ['Portfolio'],
    }),
    getPortfolio: builder.query<Portfolio, string>({
      query: (id) => `/trading/portfolios/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Portfolio', id }],
    }),
    placeTrade: builder.mutation<
      { trade: Trade; newBalance: number },
      { competitionId: string; trade: TradeRequest }
    >({
      query: ({ competitionId, trade }) => ({
        url: `/trading/competitions/${competitionId}/trade`,
        method: 'POST',
        body: trade,
      }),
      invalidatesTags: ['Portfolio'], // Invalidate portfolio to update balance/holdings
    }),
    getLeaderboard: builder.query<
      LeaderboardEntry[],
      { competitionId: string; refresh?: boolean }
    >({
      query: ({ competitionId, refresh }) =>
        `/trading/competitions/${competitionId}/leaderboard${refresh ? '?refresh=true' : ''}`,
      providesTags: (_result, _error, { competitionId }) => [
        { type: 'Portfolio', id: `LEADERBOARD_${competitionId}` },
      ],
    }),

    // Saved Trades
    saveTrade: builder.mutation<
      SavedTrade,
      { competitionId: string; trade: SaveTradeRequest }
    >({
      query: ({ competitionId, trade }) => ({
        url: `/trading/competitions/${competitionId}/saved-trades`,
        method: 'POST',
        body: trade,
      }),
      invalidatesTags: ['SavedTrade'],
    }),
    getSavedTrades: builder.query<SavedTrade[], string>({
      query: (competitionId) => `/trading/competitions/${competitionId}/saved-trades`,
      providesTags: ['SavedTrade'],
    }),
    deleteSavedTrade: builder.mutation<void, number>({
      query: (savedTradeId) => ({
        url: `/trading/saved-trades/${savedTradeId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SavedTrade'],
    }),
    executeSavedTrade: builder.mutation<{ trade: Trade; newBalance: number }, number>({
      query: (savedTradeId) => ({
        url: `/trading/saved-trades/${savedTradeId}/execute`,
        method: 'POST',
      }),
      invalidatesTags: ['SavedTrade', 'Portfolio'],
    }),
  }),
})

export const {
  useGetCompetitionsQuery,
  useGetCompetitionQuery,
  useCreateCompetitionMutation,
  useJoinCompetitionMutation,
  useGetOptionsChainQuery,
  useGetPortfolioQuery,
  useGetMyPortfoliosQuery,
  usePlaceTradeMutation,
  useGetLeaderboardQuery,
  useSaveTradeMutation,
  useGetSavedTradesQuery,
  useDeleteSavedTradeMutation,
  useExecuteSavedTradeMutation,
} = gameApi
